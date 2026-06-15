import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createCategoryIcons } from '@/assets/icons/alarm-create-icons';
import { historyIcons } from '@/assets/icons/history-icons';
import { BottomNavbar, useTabBarReservedHeight } from '@/components/alarms/BottomNavbar';
import { type AlarmThemePalette, alarmTypography, useAlarmTheme } from '@/components/alarms/theme';
import { ComplianceBanner } from '@/components/history/ComplianceBanner';
import { HistoryFilterTabs } from '@/components/history/HistoryFilterTabs';
import { HistoryItemRow } from '@/components/history/HistoryItemRow';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { categoryIdToChipKey } from '@/lib/alarm-format';
import { notifyAuthError } from '@/lib/auth-notify';
import { shouldSkipAuthFailureAlerts } from '@/lib/auth-session-errors';
import { fetchAlarmHistory, type AlarmHistoryApiRow } from '@/lib/alarm-history-api';
import { flushPendingAlarmHistoryWrites, loadPendingAlarmHistoryRows } from '@/lib/alarm-history-sync';
import {
  buildHistoryGroups,
  monthlyComplianceFromHistory,
  type HistoryGroupUi,
} from '@/lib/history-format';
import { fetchCurrentUserRowId } from '@/lib/users-table';

const FILTER_ALL = 'all' as const;

const tabs = [
  { key: FILTER_ALL, label: 'All Alarms' },
  { key: 'health', label: `${createCategoryIcons.health} Health` },
  { key: 'plants', label: `${createCategoryIcons.plants} Plants` },
  { key: 'maintenance', label: `${createCategoryIcons.maintenance} Maintenance` },
  { key: 'pets', label: `${createCategoryIcons.pets} Pets` },
  { key: 'work', label: `${createCategoryIcons.work} Work` },
  { key: 'custom', label: `${createCategoryIcons.custom} Custom` },
] as const;

function mergeHistoryRows(serverRows: AlarmHistoryApiRow[], pendingRows: AlarmHistoryApiRow[]): AlarmHistoryApiRow[] {
  const merged = new Map<string, AlarmHistoryApiRow>();
  for (const row of serverRows) {
    merged.set(`${row.user_id}:${row.alarm_id ?? 'null'}:${row.scheduled_fire_at}`, row);
  }
  for (const row of pendingRows) {
    merged.set(`${row.user_id}:${row.alarm_id ?? 'null'}:${row.scheduled_fire_at}`, row);
  }
  return [...merged.values()];
}

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: alarmTheme.bg },
    headerSafe: {
      backgroundColor: alarmTheme.bg,
      zIndex: 2,
      elevation: 6,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
    },
    title: { color: alarmTheme.text, fontSize: alarmTypography.title, fontWeight: '800', letterSpacing: -0.4 },
    list: { flex: 1, paddingHorizontal: 16 },
    listContent: { flexGrow: 1 },
    group: { marginBottom: 16 },
    groupLabel: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
      marginBottom: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontFamily: 'monospace',
    },
    empty: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.body,
      textAlign: 'center',
      paddingTop: 28,
      paddingHorizontal: 24,
    },
  });
}

export default function HistoryScreen() {
  useRequireAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(FILTER_ALL);
  const alarmTheme = useAlarmTheme();
  const tabBarPad = useTabBarReservedHeight();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  const [rows, setRows] = useState<AlarmHistoryApiRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const firstFocus = useRef(true);
  const loadGenRef = useRef(0);

  const loadHistory = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const gen = ++loadGenRef.current;
    const finishLoading = () => {
      if (loadGenRef.current === gen) {
        setInitialLoad(false);
      }
    };

    try {
      if (!silent) {
        setListError(null);
      }

      const { id: userId, error: userErr } = await fetchCurrentUserRowId();
      if (userErr || userId == null) {
        if (await shouldSkipAuthFailureAlerts()) {
          if (loadGenRef.current === gen) {
            setRows([]);
            setListError(null);
          }
          return;
        }
        if (loadGenRef.current === gen) {
          setListError(userErr?.message ?? 'Could not resolve your profile.');
        }
        return;
      }

      await flushPendingAlarmHistoryWrites().catch(() => undefined);
      const [next, pending] = await Promise.all([
        fetchAlarmHistory(userId),
        loadPendingAlarmHistoryRows(userId),
      ]);
      if (loadGenRef.current !== gen) {
        return;
      }
      setRows(mergeHistoryRows(next, pending));
      setListError(null);
    } catch (e) {
      if (loadGenRef.current !== gen) {
        return;
      }
      const msg = e instanceof Error ? e.message : 'Failed to load history.';
      setListError(msg);
      if (!silent) {
        notifyAuthError('History', e);
      }
    } finally {
      finishLoading();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory({ silent: !firstFocus.current });
      firstFocus.current = false;
      return () => {
        loadGenRef.current += 1;
      };
    }, [loadHistory]),
  );

  const filteredGroups = useMemo((): HistoryGroupUi[] => {
    const referenceNow = new Date();
    const filtered =
      activeTab === FILTER_ALL
        ? rows
        : rows.filter((r) => categoryIdToChipKey(r.category) === activeTab);
    return buildHistoryGroups(filtered, referenceNow);
  }, [activeTab, rows]);

  const compliance = useMemo(() => monthlyComplianceFromHistory(rows), [rows]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
        </View>
      </SafeAreaView>

      <HistoryFilterTabs tabs={[...tabs]} activeKey={activeTab} onSelect={setActiveTab} />

      <ComplianceBanner
        percent={compliance.percent}
        completedText={compliance.completedText}
        detailText={compliance.detailText}
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarPad }]}
        showsVerticalScrollIndicator={false}>
        {listError ? (
          <Text style={styles.empty}>{listError}</Text>
        ) : filteredGroups.length === 0 ? (
          <Text style={styles.empty}>No history in this category yet.</Text>
        ) : (
          filteredGroups.map((group) => (
            <View key={group.day} style={styles.group}>
              <Text style={styles.groupLabel}>{group.day}</Text>
              {group.items.map((item) => (
                <HistoryItemRow
                  key={item.id}
                  icon={item.icon}
                  name={item.name}
                  timeText={item.timeText}
                  status={item.status}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <FullScreenLoadingOverlay visible={initialLoad} />
      <BottomNavbar
        items={[
          { icon: historyIcons.alarms, label: 'Alarms', onPress: () => router.push('/alarm') },
          { icon: historyIcons.history, label: 'History', active: true, onPress: () => router.push('/history') },
          { icon: historyIcons.templates, label: 'Templates', onPress: () => router.push('/templates') },
          { icon: historyIcons.settings, label: 'Settings', onPress: () => router.push('/setting') },
        ]}
      />
    </View>
  );
}
