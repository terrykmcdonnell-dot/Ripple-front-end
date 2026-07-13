import { rippleApiBaseUrl, rippleApiFetch, rippleApiGetJson } from '@/lib/alarm-api';

export type AlarmHistoryStatus = 'missed' | 'dismissed' | 'snoozed';

export type AlarmHistoryApiRow = {
  id: number;
  user_id: number;
  alarm_id: number | null;
  label: string;
  category: string;
  scheduled_fire_at: string;
  status: AlarmHistoryStatus;
  action_at: string | null;
  snooze_minutes: number | null;
};

export async function fetchAlarmHistory(userId: number): Promise<AlarmHistoryApiRow[]> {
  const qs = new URLSearchParams({ user_id: String(userId), limit: '500' });
  const url = `${rippleApiBaseUrl()}/api/alarm-history/?${qs.toString()}`;
  const body = (await rippleApiGetJson(url)) as unknown;
  if (!Array.isArray(body)) {
    return [];
  }
  return body.filter((row): row is AlarmHistoryApiRow => {
    if (!row || typeof row !== 'object') {
      return false;
    }
    const r = row as Record<string, unknown>;
    return typeof r.id === 'number' && typeof r.scheduled_fire_at === 'string' && typeof r.status === 'string';
  }) as AlarmHistoryApiRow[];
}

export async function upsertAlarmHistory(body: {
  user_id: number;
  alarm_id: number;
  scheduled_fire_at: string;
  status: AlarmHistoryStatus;
  label?: string;
  category?: string;
  action_at?: string | null;
  snooze_minutes?: number | null;
}): Promise<void> {
  const url = `${rippleApiBaseUrl()}/api/alarm-history/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      label: '',
      category: '',
      action_at: null,
      snooze_minutes: null,
      ...body,
    }),
  });
  if (res.ok) {
    return;
  }
  let detail = '';
  try {
    detail = await res.text();
  } catch {
    /* ignore */
  }
  throw new Error(detail || `Could not save history (${res.status}).`);
}

export async function clearAllAlarmHistory(userId: number): Promise<void> {
  const qs = new URLSearchParams({ user_id: String(userId) });
  const url = `${rippleApiBaseUrl()}/api/alarm-history/?${qs.toString()}`;
  const res = await rippleApiFetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (res.ok || res.status === 204) {
    return;
  }
  let detail = '';
  try {
    detail = await res.text();
  } catch {
    /* ignore */
  }
  throw new Error(detail || `Could not clear history (${res.status}).`);
}
