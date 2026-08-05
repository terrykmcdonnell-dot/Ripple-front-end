import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { historyIcons } from '@/assets/icons/history-icons';
import { BottomNavbar, useTabBarReservedHeight } from '@/components/alarms/BottomNavbar';
import { type AlarmThemePalette, alarmTypography, useAlarmTheme } from '@/components/alarms/theme';
import { ComplianceBanner } from '@/components/history/ComplianceBanner';
import { HistoryFilterTabs } from '@/components/history/HistoryFilterTabs';
import { HistoryItemRow } from '@/components/history/HistoryItemRow';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { notifyAuthError } from '@/lib/auth-notify';
import { shouldSkipAuthFailureAlerts } from '@/lib/auth-session-errors';
import { getAlarmHistoryCache, invalidateAlarmHistoryCache, setAlarmHistoryCache } from '@/lib/alarm-history-cache';
import { findCategoryByName, useAlarmCategories } from '@/lib/alarm-categories';
import { clearAllAlarmHistory, fetchAlarmHistory, type AlarmHistoryApiRow } from '@/lib/alarm-history-api';
import {
  clearAllPendingAlarmHistory,
  flushPendingAlarmHistoryWrites,
  loadPendingAlarmHistoryRows,
  mergeHistoryRows,
} from '@/lib/alarm-history-sync';
import {
  buildHistoryGroups,
  monthlyComplianceFromHistory,
  type HistoryGroupUi,
} from '@/lib/history-format';
import { navigateToMainTab } from '@/lib/main-tab-navigation';
import { tryShowPendingNativeStoreReview } from '@/lib/in-app-review';
import { fetchCurrentUserRowId } from '@/lib/users-table';

const FILTER_ALL = 'all' as const;

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
      justifyContent: 'space-between',
      minHeight: 52,
    },
    title: { color: alarmTheme.text, fontSize: alarmTypography.title, fontWeight: '800', letterSpacing: -0.4 },
    clearAllBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    clearAllBtnPressed: {
      opacity: 0.7,
    },
    clearAllText: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.caption,
      fontWeight: '700',
    },
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
  const { showToast } = useAppToast();
  const [activeTab, setActiveTab] = useState<string>(FILTER_ALL);
  const { categories } = useAlarmCategories();
  const alarmTheme = useAlarmTheme();
  const tabBarPad = useTabBarReservedHeight();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  const [rows, setRows] = useState<AlarmHistoryApiRow[]>(() => getAlarmHistoryCache() ?? []);
  const [listError, setListError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(() => getAlarmHistoryCache() == null);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [clearing, setClearing] = useState(false);
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

      const flushPromise = flushPendingAlarmHistoryWrites().catch(() => undefined);
      if (!silent) {
        await flushPromise;
      }
      const [next, pending] = await Promise.all([
        fetchAlarmHistory(userId),
        loadPendingAlarmHistoryRows(userId),
      ]);
      if (loadGenRef.current !== gen) {
        return;
      }
      const merged = mergeHistoryRows(next, pending);
      setRows(merged);
      setAlarmHistoryCache(userId, merged);
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
      void tryShowPendingNativeStoreReview();

      const hasCachedRows = getAlarmHistoryCache() != null;
      let cancelled = false;

      const runLoad = () => {
        if (!cancelled) {
          void loadHistory({ silent: hasCachedRows });
        }
      };

      if (hasCachedRows) {
        const task = InteractionManager.runAfterInteractions(runLoad);
        return () => {
          cancelled = true;
          task.cancel();
          loadGenRef.current += 1;
        };
      }

      runLoad();
      return () => {
        cancelled = true;
        loadGenRef.current += 1;
      };
    }, [loadHistory]),
  );

  const filteredGroups = useMemo((): HistoryGroupUi[] => {
    const referenceNow = new Date();
    const filtered =
      activeTab === FILTER_ALL
        ? rows
        : rows.filter((r) => String(findCategoryByName(categories, r.category)?.id ?? '') === activeTab);
    return buildHistoryGroups(filtered, referenceNow, categories);
  }, [activeTab, categories, rows]);

  const compliance = useMemo(() => monthlyComplianceFromHistory(rows), [rows]);

  const handleClearAllHistory = useCallback(async () => {
    setClearing(true);
    try {
      const { id: userId, error: userErr } = await fetchCurrentUserRowId();
      if (userErr || userId == null) {
        if (!(await shouldSkipAuthFailureAlerts())) {
          notifyAuthError('History', userErr ?? new Error('Missing user profile.'));
        }
        return;
      }
      await clearAllAlarmHistory(userId);
      await clearAllPendingAlarmHistory();
      invalidateAlarmHistoryCache();
      setRows([]);
      setAlarmHistoryCache(userId, []);
      setListError(null);
      setClearConfirmVisible(false);
      showToast('History cleared.');
    } catch (e) {
      notifyAuthError('History', e);
    } finally {
      setClearing(false);
    }
  }, [showToast]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          {rows.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all history"
              style={({ pressed }) => [styles.clearAllBtn, pressed && styles.clearAllBtnPressed]}
              onPress={() => setClearConfirmVisible(true)}>
              <Text style={styles.clearAllText}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      <HistoryFilterTabs
        tabs={[
          { key: FILTER_ALL, label: 'All Alarms' },
          ...categories.map((category) => ({
            key: String(category.id),
            label: `${category.icon} ${category.name}`,
          })),
        ]}
        activeKey={activeTab}
        onSelect={setActiveTab}
      />

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

      <FullScreenLoadingOverlay visible={initialLoad || clearing} variant="embedded" />
      <AppConfirmModal
        visible={clearConfirmVisible}
        title="Clear all history?"
        body="This permanently removes every alarm history entry from your account. This cannot be undone."
        onRequestClose={() => !clearing && setClearConfirmVisible(false)}
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => {
              if (!clearing) {
                setClearConfirmVisible(false);
              }
            },
          },
          {
            label: clearing ? 'Clearing…' : 'Clear all',
            variant: 'danger',
            onPress: () => {
              if (!clearing) {
                void handleClearAllHistory();
              }
            },
          },
        ]}
      />
      <BottomNavbar
        items={[
          { icon: historyIcons.alarms, label: 'Alarms', onPress: () => navigateToMainTab(router, '/alarm') },
          { icon: historyIcons.history, label: 'History', active: true, onPress: () => navigateToMainTab(router, '/history') },
          { icon: historyIcons.templates, label: 'Templates', onPress: () => navigateToMainTab(router, '/templates') },
          { icon: historyIcons.settings, label: 'Settings', onPress: () => navigateToMainTab(router, '/setting') },
        ]}
      />
    </View>
  );
}
