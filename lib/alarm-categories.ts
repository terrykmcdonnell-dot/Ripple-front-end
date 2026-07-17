import { useCallback, useEffect, useState } from 'react';

import { rippleApiBaseUrl, rippleApiGetJson } from '@/lib/alarm-api';
import { fetchCurrentUserRowId } from '@/lib/users-table';

export type AlarmCategoryColorKey = 'purple' | 'green' | 'amber' | 'red' | 'blue';

export type AlarmCategory = {
  id: number;
  userId: number | null;
  name: string;
  icon: string;
  colorKey: AlarmCategoryColorKey;
  sortOrder: number;
  isSystem: boolean;
};

export const DEFAULT_ALARM_CATEGORIES: AlarmCategory[] = [
  { id: 1, userId: null, name: 'Health', icon: '💊', colorKey: 'purple', sortOrder: 10, isSystem: true },
  { id: 2, userId: null, name: 'Plants', icon: '🌱', colorKey: 'green', sortOrder: 20, isSystem: true },
  { id: 3, userId: null, name: 'Maintenance', icon: '🔧', colorKey: 'amber', sortOrder: 30, isSystem: true },
  { id: 4, userId: null, name: 'Pets', icon: '🐾', colorKey: 'amber', sortOrder: 40, isSystem: true },
  { id: 5, userId: null, name: 'Work', icon: '💼', colorKey: 'purple', sortOrder: 50, isSystem: true },
  { id: 6, userId: null, name: 'Custom', icon: '⭐', colorKey: 'purple', sortOrder: 60, isSystem: true },
];

type Cache = {
  userId: number;
  categories: AlarmCategory[];
};

let cache: Cache | null = null;
const listeners = new Set<() => void>();

function emitCategoryCacheChanged() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeAlarmCategories(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function invalidateAlarmCategoryCache(): void {
  cache = null;
  emitCategoryCacheChanged();
}

export function getCachedAlarmCategories(userId?: number): AlarmCategory[] | null {
  if (!cache) {
    return null;
  }
  if (userId != null && cache.userId !== userId) {
    return null;
  }
  return cache.categories;
}

function coerceColorKey(value: unknown): AlarmCategoryColorKey {
  return value === 'green' || value === 'amber' || value === 'red' || value === 'blue' ? value : 'purple';
}

function normalizeCategory(raw: unknown): AlarmCategory | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!Number.isFinite(id) || !name) {
    return null;
  }
  const userRaw = row.user_id ?? row.userId;
  const userId = userRaw == null ? null : Number(userRaw);
  const icon = typeof row.icon === 'string' && row.icon.trim() ? row.icon.trim() : '⭐';
  return {
    id,
    userId: userId != null && Number.isFinite(userId) ? userId : null,
    name,
    icon,
    colorKey: coerceColorKey(row.color_key ?? row.colorKey),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 100),
    isSystem: Boolean(row.is_system ?? row.isSystem ?? userRaw == null),
  };
}

function sortCategories(categories: AlarmCategory[]): AlarmCategory[] {
  return [...categories].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.name.localeCompare(b.name);
  });
}

export function findCategoryByName(categories: AlarmCategory[], name: string | undefined | null): AlarmCategory | null {
  const clean = name?.trim().toLowerCase();
  if (!clean) {
    return null;
  }
  return categories.find((category) => category.name.trim().toLowerCase() === clean) ?? null;
}

export function findDefaultCategory(categories: AlarmCategory[]): AlarmCategory {
  return findCategoryByName(categories, 'Health') ?? categories[0] ?? DEFAULT_ALARM_CATEGORIES[0];
}

export function findCustomCategory(categories: AlarmCategory[]): AlarmCategory {
  return findCategoryByName(categories, 'Custom') ?? findDefaultCategory(categories);
}

export function resolveCategoryMeta(
  categories: AlarmCategory[],
  opts: {
    categoryId?: number | null;
    categoryName?: string | null;
    categoryIcon?: string | null;
    categoryColorKey?: string | null;
  },
): AlarmCategory {
  const iconFromRow = opts.categoryIcon?.trim() || null;
  const colorFromRow = opts.categoryColorKey ? coerceColorKey(opts.categoryColorKey) : null;

  const withRowOverrides = (base: AlarmCategory): AlarmCategory => ({
    ...base,
    ...(iconFromRow ? { icon: iconFromRow } : {}),
    ...(colorFromRow ? { colorKey: colorFromRow } : {}),
  });

  const byId = opts.categoryId != null ? categories.find((item) => item.id === opts.categoryId) : null;
  if (byId) {
    return withRowOverrides(byId);
  }
  const byName = findCategoryByName(categories, opts.categoryName);
  if (byName) {
    return withRowOverrides(byName);
  }
  const fallback = findDefaultCategory(categories);
  return withRowOverrides({
    ...fallback,
    name: opts.categoryName?.trim() || fallback.name,
    icon: iconFromRow || fallback.icon,
    colorKey: colorFromRow || fallback.colorKey,
  });
}

export async function fetchAlarmCategories(userId: number): Promise<AlarmCategory[]> {
  const qs = new URLSearchParams({ user_id: String(userId) });
  const body = await rippleApiGetJson(`${rippleApiBaseUrl()}/api/categories/?${qs.toString()}`);
  const rows = Array.isArray(body) ? body.map(normalizeCategory).filter((row): row is AlarmCategory => row != null) : [];
  const categories = rows.length ? sortCategories(rows) : DEFAULT_ALARM_CATEGORIES;
  cache = { userId, categories };
  emitCategoryCacheChanged();
  return categories;
}

export async function createAlarmCategory(input: {
  userId: number;
  name: string;
  icon: string;
  colorKey: AlarmCategoryColorKey;
}): Promise<AlarmCategory> {
  const res = await fetch(`${rippleApiBaseUrl()}/api/categories/`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: input.userId,
      name: input.name,
      icon: input.icon,
      color_key: input.colorKey,
      sort_order: 100,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const category = normalizeCategory(await res.json());
  if (!category) {
    throw new Error('Category response was invalid.');
  }
  await fetchAlarmCategories(input.userId);
  return category;
}

export async function updateAlarmCategory(input: {
  id: number;
  userId: number;
  name: string;
  icon: string;
  colorKey: AlarmCategoryColorKey;
}): Promise<AlarmCategory> {
  const res = await fetch(`${rippleApiBaseUrl()}/api/categories/${input.id}`, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: input.userId,
      name: input.name,
      icon: input.icon,
      color_key: input.colorKey,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const category = normalizeCategory(await res.json());
  if (!category) {
    throw new Error('Category response was invalid.');
  }
  await fetchAlarmCategories(input.userId);
  return category;
}

export async function deleteAlarmCategory(input: {
  id: number;
  userId: number;
  reassignToCategoryId?: number;
}): Promise<void> {
  const qs = new URLSearchParams({ user_id: String(input.userId) });
  if (input.reassignToCategoryId != null) {
    qs.set('reassign_to_category_id', String(input.reassignToCategoryId));
  }
  const res = await fetch(`${rippleApiBaseUrl()}/api/categories/${input.id}/delete?${qs.toString()}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  await fetchAlarmCategories(input.userId);
}

export function useAlarmCategories(): {
  categories: AlarmCategory[];
  userId: number | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [categories, setCategories] = useState<AlarmCategory[]>(() => getCachedAlarmCategories() ?? DEFAULT_ALARM_CATEGORIES);
  const [userId, setUserId] = useState<number | null>(cache?.userId ?? null);
  const [loading, setLoading] = useState(() => getCachedAlarmCategories() == null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { id } = await fetchCurrentUserRowId();
      if (id == null) {
        setCategories(DEFAULT_ALARM_CATEGORIES);
        setUserId(null);
        return;
      }
      setUserId(id);
      setCategories(await fetchAlarmCategories(id));
    } catch {
      setCategories(getCachedAlarmCategories() ?? DEFAULT_ALARM_CATEGORIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAlarmCategories(() => {
      setCategories(getCachedAlarmCategories() ?? DEFAULT_ALARM_CATEGORIES);
      setUserId(cache?.userId ?? null);
    });
    void reload();
    return unsubscribe;
  }, [reload]);

  return { categories, userId, loading, reload };
}
