import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { templatesIcons } from '@/assets/icons/templates-icons';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateCategoryTabs } from '@/components/templates/TemplateCategoryTabs';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { notifyAuthError } from '@/lib/auth-notify';
import { installTemplatePack, uninstallTemplatePack } from '@/lib/install-template-pack';
import { TEMPLATE_PACK_DEFINITIONS, type TemplatePackId } from '@/lib/template-packs-data';
import { getAllPackAlarmIds, reconcilePackAlarmIdsWithServer } from '@/lib/template-packs-storage';
import { fetchCurrentUserRowId } from '@/lib/users-table';

const categories = [
  { key: 'all', label: 'All' },
  { key: 'plants', label: '🌱 Plants' },
  { key: 'health', label: '💊 Health' },
  { key: 'home', label: '🔧 Home' },
  { key: 'pets', label: '🐾 Pets' },
];

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: alarmTheme.bg,
    },
    headerSafe: {
      backgroundColor: alarmTheme.bg,
      zIndex: 2,
      elevation: 6,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 10,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
    },
    title: {
      color: alarmTheme.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    searchBar: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchIcon: {
      fontSize: 14,
      color: alarmTheme.muted,
    },
    searchText: {
      fontSize: 13,
      color: alarmTheme.muted,
    },
    scroll: {
      flex: 1,
      paddingHorizontal: 16,
    },
    scrollContent: {
      paddingBottom: 88,
    },
  });
}

export default function TemplatesScreen() {
  useRequireAuth();
  const router = useRouter();
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [packAlarmIds, setPackAlarmIds] = useState<Record<string, number[]>>({});
  const [busyPackId, setBusyPackId] = useState<TemplatePackId | null>(null);
  const [packStateLoading, setPackStateLoading] = useState(true);

  const refreshPackState = useCallback(async () => {
    setPackStateLoading(true);
    try {
      const { id: userId, error } = await fetchCurrentUserRowId();
      if (error || userId == null) {
        setPackAlarmIds(await getAllPackAlarmIds());
        return;
      }
      try {
        const next = await reconcilePackAlarmIdsWithServer(userId);
        setPackAlarmIds(next);
      } catch {
        setPackAlarmIds(await getAllPackAlarmIds());
      }
    } finally {
      setPackStateLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPackState();
    }, [refreshPackState]),
  );

  const filteredPacks = useMemo(
    () =>
      TEMPLATE_PACK_DEFINITIONS.filter((item) =>
        activeCategory === 'all' ? true : item.categoryTab === activeCategory,
      ),
    [activeCategory],
  );

  const onTogglePack = useCallback(
    async (packId: TemplatePackId) => {
      const pack = TEMPLATE_PACK_DEFINITIONS.find((p) => p.id === packId);
      if (!pack || busyPackId) {
        return;
      }

      const ids = packAlarmIds[packId] ?? [];
      const installed = ids.length > 0;

      setBusyPackId(packId);
      try {
        const { id: userId, error } = await fetchCurrentUserRowId();
        if (error || userId == null) {
          notifyAuthError('Templates', error ?? new Error('Missing user profile.'));
          return;
        }
        if (installed) {
          await uninstallTemplatePack(packId, ids);
        } else {
          await installTemplatePack(userId, pack);
        }
        await refreshPackState();
      } catch (e) {
        notifyAuthError('Templates', e);
      } finally {
        setBusyPackId(null);
      }
    },
    [busyPackId, packAlarmIds, refreshPackState],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.title}>Templates</Text>
        </View>
      </SafeAreaView>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>{templatesIcons.search}</Text>
        <Text style={styles.searchText}>Search templates…</Text>
      </View>

      <TemplateCategoryTabs categories={categories} activeKey={activeCategory} onSelect={setActiveCategory} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredPacks.map((item) => (
          <TemplateCard
            key={item.id}
            icon={item.icon}
            iconTone={item.iconTone}
            title={item.title}
            desc={item.desc}
            alarms={item.alarms.map((a) => ({
              emoji: a.emoji,
              name: a.label,
              interval: a.intervalLabel,
            }))}
            installed={(packAlarmIds[item.id]?.length ?? 0) > 0}
            installBusy={busyPackId === item.id}
            onToggleInstall={() => void onTogglePack(item.id)}
          />
        ))}
      </ScrollView>

      <BottomNavbar
        items={[
          { icon: templatesIcons.alarms, label: 'Alarms', onPress: () => router.push('/alarm') },
          { icon: templatesIcons.history, label: 'History', onPress: () => router.push('/history') },
          { icon: templatesIcons.templates, label: 'Templates', active: true, onPress: () => router.push('/templates') },
          { icon: templatesIcons.settings, label: 'Settings', onPress: () => router.push('/setting') },
        ]}
      />

      <FullScreenLoadingOverlay visible={packStateLoading || busyPackId != null} />
    </View>
  );
}
