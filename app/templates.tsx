import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { templatesIcons } from '@/assets/icons/templates-icons';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateCategoryTabs } from '@/components/templates/TemplateCategoryTabs';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { canInstallTemplatePack } from '@/lib/subscription-access';
import { notifyAuthError } from '@/lib/auth-notify';
import { shouldSkipAuthFailureAlerts } from '@/lib/auth-session-errors';
import { installTemplatePack, uninstallTemplatePack } from '@/lib/install-template-pack';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';
import { TEMPLATE_PACK_DEFINITIONS, type TemplatePackDefinition, type TemplatePackId } from '@/lib/template-packs-data';
import { getAllPackAlarmIds, reconcilePackAlarmIdsWithServer } from '@/lib/template-packs-storage';
import { fetchCurrentUserRowId } from '@/lib/users-table';

const categories = [
  { key: 'all', label: 'All' },
  { key: 'plants', label: '🌱 Plants' },
  { key: 'health', label: '💊 Health' },
  { key: 'home', label: '🔧 Home' },
  { key: 'pets', label: '🐾 Pets' },
];

function packMatchesSearch(pack: TemplatePackDefinition, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const haystack = [
    pack.title,
    pack.desc,
    pack.apiCategory,
    ...pack.alarms.flatMap((a) => [a.label, a.intervalLabel]),
  ];
  return haystack.some((t) => t.toLowerCase().includes(q));
}

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
      paddingTop: 12,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
    },
    title: {
      color: alarmTheme.text,
      fontSize: alarmTypography.title,
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
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchIcon: {
      fontSize: alarmTypography.body,
      color: alarmTheme.muted,
    },
    searchInput: {
      flex: 1,
      fontSize: alarmTypography.body,
      color: alarmTheme.text,
      paddingVertical: 0,
      minHeight: 22,
    },
    scroll: {
      flex: 1,
      paddingHorizontal: 16,
    },
    scrollContent: {
      paddingBottom: 94,
    },
    emptySearch: {
      paddingVertical: 28,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    emptySearchText: {
      fontSize: alarmTypography.caption,
      color: alarmTheme.muted,
      textAlign: 'center',
      lineHeight: alarmTypography.caption + 8,
    },
  });
}

export default function TemplatesScreen() {
  useRequireAuth();
  const router = useRouter();
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const { showToast } = useAppToast();
  const { isSubscriber } = useSubscriptionStatus();
  const templateGalleryLocked = !canInstallTemplatePack(isSubscriber);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
      invalidateSubscriptionCache();
      void refreshPackState();
    }, [refreshPackState]),
  );

  const filteredPacks = useMemo(
    () =>
      TEMPLATE_PACK_DEFINITIONS.filter((item) => {
        const categoryOk = activeCategory === 'all' ? true : item.categoryTab === activeCategory;
        return categoryOk && packMatchesSearch(item, searchQuery);
      }),
    [activeCategory, searchQuery],
  );

  const emptyListMessage = useMemo(() => {
    const q = searchQuery.trim();
    if (q) {
      return `No templates match “${q}”. Try another search or switch category.`;
    }
    if (activeCategory !== 'all') {
      return 'No templates in this category yet. Try All or search above.';
    }
    return 'No templates available.';
  }, [activeCategory, searchQuery]);

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
          if (!(await shouldSkipAuthFailureAlerts())) {
            notifyAuthError('Templates', error ?? new Error('Missing user profile.'));
          }
          return;
        }
        if (installed) {
          await uninstallTemplatePack(packId, ids);
        } else {
          if (templateGalleryLocked) {
            showToast('Template gallery is included with Ripple Pro.');
            router.push('/paywall');
            return;
          }
          await installTemplatePack(userId, pack);
        }
        await refreshPackState();
      } catch (e) {
        notifyAuthError('Templates', e);
      } finally {
        setBusyPackId(null);
      }
    },
    [busyPackId, templateGalleryLocked, packAlarmIds, refreshPackState, router, showToast],
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates…"
          placeholderTextColor={alarmTheme.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <TemplateCategoryTabs categories={categories} activeKey={activeCategory} onSelect={setActiveCategory} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredPacks.length === 0 ? (
          <View style={styles.emptySearch}>
            <Text style={styles.emptySearchText}>{emptyListMessage}</Text>
          </View>
        ) : (
          filteredPacks.map((item) => (
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
              premiumLocked={templateGalleryLocked}
              onToggleInstall={() => void onTogglePack(item.id)}
            />
          ))
        )}
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
