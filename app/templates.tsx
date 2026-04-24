import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { templatesIcons } from '@/assets/icons/templates-icons';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { alarmTheme } from '@/components/alarms/theme';

type Category = { key: string; label: string };

type TemplateAlarm = {
  emoji: string;
  name: string;
  interval: string;
};

type TemplateCategoryTabsProps = {
  categories: Category[];
  activeKey: string;
  onSelect: (key: string) => void;
};

function TemplateCategoryTabs({ categories, activeKey, onSelect }: TemplateCategoryTabsProps) {
  return (
    <ScrollView
      style={styles.catTabsScroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.catTabsContainer}>
      {categories.map((cat) => {
        const active = cat.key === activeKey;
        return (
          <Pressable
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            style={[styles.catTab, active ? styles.catTabActive : null]}>
            <Text style={[styles.catTabText, active ? styles.catTabTextActive : null]}>{cat.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.catTabsEnd} />
    </ScrollView>
  );
}

type TemplateCardProps = {
  icon: string;
  iconTone: 'green' | 'purple' | 'amber' | 'blue';
  title: string;
  desc: string;
  alarms: TemplateAlarm[];
  installed: boolean;
  onToggleInstall: () => void;
};

const toneBg = {
  green: 'rgba(52,211,153,0.12)',
  purple: alarmTheme.accentDim,
  amber: 'rgba(251,191,36,0.12)',
  blue: 'rgba(96,165,250,0.12)',
} as const;

function TemplateCard({
  icon,
  iconTone,
  title,
  desc,
  alarms,
  installed,
  onToggleInstall,
}: TemplateCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: toneBg[iconTone] }]}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
      </View>

      <View style={styles.templateAlarms}>
        {alarms.map((alarm) => (
          <View key={`${title}-${alarm.name}`} style={styles.templateAlarm}>
            <Text style={styles.taEmoji}>{alarm.emoji}</Text>
            <Text style={styles.taName}>{alarm.name}</Text>
            <Text style={styles.taInterval}>{alarm.interval}</Text>
          </View>
        ))}
      </View>

      <View style={styles.templateFooter}>
        <Text style={styles.alarmCount}>{alarms.length} alarms</Text>
        <Pressable
          onPress={onToggleInstall}
          style={[
            styles.installBtn,
            installed ? styles.installBtnInstalled : iconTone === 'green' ? styles.installBtnGreen : styles.installBtnDefault,
          ]}>
          <Text
            style={[
              styles.installBtnText,
              installed ? styles.installTextInstalled : iconTone === 'green' ? styles.installTextGreen : styles.installTextDefault,
            ]}>
            {installed ? '✓ Installed' : '+ Install Pack'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const categories = [
  { key: 'all', label: 'All' },
  { key: 'plants', label: '🌱 Plants' },
  { key: 'health', label: '💊 Health' },
  { key: 'home', label: '🔧 Home' },
  { key: 'pets', label: '🐾 Pets' },
];

const initialTemplates = [
  {
    id: 'plants',
    category: 'plants',
    icon: templatesIcons.plants,
    iconTone: 'green' as const,
    title: 'New Plant Parent Pack',
    desc: 'Essential reminders for keeping your plants alive and thriving.',
    alarms: [
      { emoji: templatesIcons.taPlant, name: 'Water tropical plants', interval: 'Every 3 days' },
      { emoji: templatesIcons.taCactus, name: 'Water succulents', interval: 'Every 14 days' },
      { emoji: templatesIcons.plants, name: 'Fertilise plants', interval: 'Every 4 weeks' },
    ],
    installed: false,
  },
  {
    id: 'med',
    category: 'health',
    icon: templatesIcons.health,
    iconTone: 'purple' as const,
    title: 'Medication Starter Kit',
    desc: 'Common medication and supplement reminder schedules.',
    alarms: [
      { emoji: templatesIcons.taPill, name: 'Daily medication', interval: 'Every 1 day' },
      { emoji: templatesIcons.taLotion, name: 'Vitamin D', interval: 'Every 2 days' },
      { emoji: templatesIcons.taInjection, name: 'Weekly injection', interval: 'Every 7 days' },
    ],
    installed: true,
  },
  {
    id: 'home',
    category: 'home',
    icon: templatesIcons.home,
    iconTone: 'amber' as const,
    title: 'Home Maintenance Bundle',
    desc: 'Never forget another filter change or service interval.',
    alarms: [
      { emoji: templatesIcons.home, name: 'Change HVAC filter', interval: 'Every 3 months' },
      { emoji: templatesIcons.taCar, name: 'Tyre rotation', interval: 'Every 6 months' },
    ],
    installed: false,
  },
];

export default function TemplatesScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [templates, setTemplates] = useState(initialTemplates);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((item) =>
        activeCategory === 'all' ? true : item.category === activeCategory,
      ),
    [templates, activeCategory],
  );

  const toggleInstall = (id: string) => {
    setTemplates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, installed: !item.installed } : item)),
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.title}>
          Templates <Text style={styles.v2Badge}>V2</Text>
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>{templatesIcons.search}</Text>
        <Text style={styles.searchText}>Search templates…</Text>
      </View>

      <TemplateCategoryTabs
        categories={categories}
        activeKey={activeCategory}
        onSelect={setActiveCategory}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredTemplates.map((item) => (
          <TemplateCard
            key={item.id}
            icon={item.icon}
            iconTone={item.iconTone}
            title={item.title}
            desc={item.desc}
            alarms={item.alarms}
            installed={item.installed}
            onToggleInstall={() => toggleInstall(item.id)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
    paddingTop: 20,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: alarmTheme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  v2Badge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    color: '#fbbf24',
    fontSize: 9,
    fontFamily: 'monospace',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
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
  catTabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  catTabsScroll: {
    flexGrow: 'unset',
  },
  catTab: {
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  catTabActive: {
    backgroundColor: alarmTheme.accentDim,
    borderColor: alarmTheme.accent,
  },
  catTabText: {
    color: alarmTheme.muted,
    fontSize: 12,
  },
  catTabTextActive: {
    color: alarmTheme.accentBright,
  },
  catTabsEnd: {
    width: 8,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 88,
  },
  card: {
    width: '100%',
    backgroundColor: alarmTheme.surface,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardIcon: { fontSize: 22 },
  cardHeaderInfo: { flex: 1 },
  cardTitle: { color: alarmTheme.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardDesc: { color: alarmTheme.muted, fontSize: 11, lineHeight: 16.5 },
  templateAlarms: { gap: 5, marginBottom: 12 },
  templateAlarm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: alarmTheme.surface2,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  taEmoji: { fontSize: 13 },
  taName: { flex: 1, color: alarmTheme.text, fontSize: 11 },
  taInterval: { color: alarmTheme.accentBright, fontSize: 10, fontFamily: 'monospace' },
  templateFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alarmCount: { color: alarmTheme.muted, fontSize: 11, fontFamily: 'monospace' },
  installBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 16 },
  installBtnDefault: { backgroundColor: alarmTheme.accentDim, borderColor: 'rgba(124,106,240,0.3)' },
  installBtnGreen: { backgroundColor: 'rgba(52,211,153,0.12)', borderColor: 'rgba(52,211,153,0.3)' },
  installBtnInstalled: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: alarmTheme.border },
  installBtnText: { fontSize: 12, fontWeight: '600' },
  installTextDefault: { color: alarmTheme.accentBright },
  installTextGreen: { color: alarmTheme.green },
  installTextInstalled: { color: alarmTheme.muted },
});
