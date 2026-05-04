import { createAlarm, deleteAlarm, fetchAlarms } from '@/lib/alarm-api';
import { getSmartDefaultAlarmTime } from '@/lib/alarm-time';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { labelForAlarmSoundId, loadDefaultAlarmSoundId } from '@/lib/settings-preferences';
import type { TemplatePackDefinition, TemplatePackId } from '@/lib/template-packs-data';
import { setPackAlarmIds } from '@/lib/template-packs-storage';
import { syncUpcomingReminderNotifications } from '@/lib/upcoming-reminder-scheduler';

async function resolveCreatedIdsFallback(
  userId: number,
  beforeIds: Set<number>,
  expectedCount: number,
): Promise<number[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const after = await fetchAlarms(userId);
    const created = after
      .filter((a) => !beforeIds.has(a.id))
      .sort((a, b) => a.id - b.id)
      .map((a) => a.id);
    if (created.length === expectedCount) {
      return created;
    }
    await new Promise((r) => setTimeout(r, 280));
  }
  throw new Error(`Could not confirm ${expectedCount} new alarms were saved. Try again.`);
}

/**
 * Creates one API alarm per template row with shared anchor time ({@link getSmartDefaultAlarmTime}),
 * repeat interval/unit per row, and pack category + default sound label.
 */
export async function installTemplatePack(userId: number, pack: TemplatePackDefinition): Promise<void> {
  const before = await fetchAlarms(userId);
  const beforeIds = new Set(before.map((a) => a.id));

  const soundId = await loadDefaultAlarmSoundId();
  const soundLabel = labelForAlarmSoundId(soundId);
  const scheduledAt = getSmartDefaultAlarmTime().toISOString();

  try {
    for (const line of pack.alarms) {
      await createAlarm({
        user_id: userId,
        label: line.label,
        scheduled_at: scheduledAt,
        interval: line.interval,
        unit: line.unit,
        category: pack.apiCategory,
        sound: soundLabel,
      });
    }

    const storedIds = await resolveCreatedIdsFallback(userId, beforeIds, pack.alarms.length);
    await setPackAlarmIds(pack.id, storedIds);
  } catch (e) {
    const after = await fetchAlarms(userId);
    const stray = after.filter((a) => !beforeIds.has(a.id));
    await Promise.all(stray.map((a) => deleteAlarm(a.id).catch(() => undefined)));
    await setPackAlarmIds(pack.id, []);
    throw e;
  }

  await syncUpcomingReminderNotifications();
  await syncAlarmFireNotifications();
}

export async function uninstallTemplatePack(packId: TemplatePackId, alarmIds: number[]): Promise<void> {
  await Promise.all(alarmIds.map((id) => deleteAlarm(id).catch(() => undefined)));
  await setPackAlarmIds(packId, []);
  await syncUpcomingReminderNotifications();
  await syncAlarmFireNotifications();
}
