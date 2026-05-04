import { createCategoryIcons } from '@/assets/icons/alarm-create-icons';
import { categoryIdToChipKey, formatScheduledLocalParts, type CategoryChipKey } from '@/lib/alarm-format';
import type { AlarmHistoryApiRow } from '@/lib/alarm-history-api';

export type HistoryRowUi = {
  id: number;
  categoryKey: CategoryChipKey;
  icon: string;
  name: string;
  timeText: string;
  status: 'dismissed' | 'snoozed' | 'missed';
};

export type HistoryGroupUi = {
  day: string;
  items: HistoryRowUi[];
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonthDay(d: Date): string {
  return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'long' })}`;
}

export function groupDayHeading(dayKey: string, referenceNow: Date): string {
  const [ys, ms, ds] = dayKey.split('-');
  const y = Number(ys);
  const mo = Number(ms);
  const day = Number(ds);
  const dayStart = new Date(y, mo - 1, day);
  const todayStart = startOfLocalDay(referenceNow);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (dayStart.getTime() === todayStart.getTime()) {
    return `Today - ${formatMonthDay(dayStart)}`;
  }
  if (dayStart.getTime() === yesterdayStart.getTime()) {
    return `Yesterday - ${formatMonthDay(dayStart)}`;
  }
  const weekday = dayStart.toLocaleDateString(undefined, { weekday: 'short' });
  return `${weekday} - ${formatMonthDay(dayStart)}`;
}

function formatHistoryTimeLine(row: AlarmHistoryApiRow): string {
  const fireParts = formatScheduledLocalParts(row.scheduled_fire_at);
  const fireLabel = `${fireParts.time} ${fireParts.ampm}`;
  if (row.status === 'missed') {
    return `${fireLabel} - no action taken`;
  }
  if (row.status === 'snoozed') {
    const mins = row.snooze_minutes != null && row.snooze_minutes > 0 ? row.snooze_minutes : 0;
    return `${fireLabel} - snoozed ${mins} mins`;
  }
  const actionIso = row.action_at ?? row.scheduled_fire_at;
  const ap = formatScheduledLocalParts(actionIso);
  return `${fireLabel} - dismissed at ${ap.time} ${ap.ampm}`;
}

export function mapAlarmHistoryRow(row: AlarmHistoryApiRow): HistoryRowUi {
  const categoryKey = categoryIdToChipKey(row.category);
  return {
    id: row.id,
    categoryKey,
    icon: createCategoryIcons[categoryKey],
    name: row.label.trim() || 'Alarm',
    timeText: formatHistoryTimeLine(row),
    status: row.status,
  };
}

export function buildHistoryGroups(rows: AlarmHistoryApiRow[], referenceNow: Date): HistoryGroupUi[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.scheduled_fire_at).getTime() - new Date(a.scheduled_fire_at).getTime(),
  );
  const map = new Map<string, AlarmHistoryApiRow[]>();
  for (const row of sorted) {
    const key = localDayKey(row.scheduled_fire_at);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return keys.map((key) => ({
    day: groupDayHeading(key, referenceNow),
    items: (map.get(key) ?? []).map(mapAlarmHistoryRow),
  }));
}

export function monthlyComplianceFromHistory(rows: AlarmHistoryApiRow[]): {
  percent: number;
  completedText: string;
  detailText: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const inMonth = rows.filter((r) => {
    const d = new Date(r.scheduled_fire_at);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const missed = inMonth.filter((r) => r.status === 'missed').length;
  const handled = inMonth.filter((r) => r.status === 'dismissed' || r.status === 'snoozed').length;
  const total = inMonth.length;
  const percent = total ? Math.round((handled / total) * 100) : 100;
  return {
    percent,
    completedText: total ? `${handled} of ${total} completed` : 'No alarms this month yet',
    detailText: `This month · ${missed} missed`,
  };
}
