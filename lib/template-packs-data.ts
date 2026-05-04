import { templatesIcons } from '@/assets/icons/templates-icons';

export type TemplatePackId = 'plants' | 'med' | 'home';

export type TemplateAlarmUnit = 'Hours' | 'Days' | 'Weeks' | 'Months';

export type TemplateAlarmDefinition = {
  /** Stable key for storage / correlation */
  key: string;
  emoji: string;
  label: string;
  interval: number;
  unit: TemplateAlarmUnit;
  /** Shown in template card rows */
  intervalLabel: string;
};

export type TemplatePackDefinition = {
  id: TemplatePackId;
  /** Matches category tab filter keys */
  categoryTab: 'plants' | 'health' | 'home';
  icon: string;
  iconTone: 'green' | 'purple' | 'amber';
  title: string;
  desc: string;
  /** Posted to POST /api/alarm/ `category` */
  apiCategory: string;
  alarms: TemplateAlarmDefinition[];
};

/** Three starter packs — alarms align with Template UI rows */
export const TEMPLATE_PACK_DEFINITIONS: TemplatePackDefinition[] = [
  {
    id: 'plants',
    categoryTab: 'plants',
    icon: templatesIcons.plants,
    iconTone: 'green',
    title: 'New Plant Parent Pack',
    desc: 'Essential reminders for keeping your plants alive and thriving.',
    apiCategory: 'Plants',
    alarms: [
      {
        key: 'tropical-water',
        emoji: templatesIcons.taPlant,
        label: 'Water tropical plants',
        interval: 3,
        unit: 'Days',
        intervalLabel: 'Every 3 days',
      },
      {
        key: 'succulent-water',
        emoji: templatesIcons.taCactus,
        label: 'Water succulents',
        interval: 14,
        unit: 'Days',
        intervalLabel: 'Every 14 days',
      },
      {
        key: 'fertilise',
        emoji: templatesIcons.plants,
        label: 'Fertilise plants',
        interval: 4,
        unit: 'Weeks',
        intervalLabel: 'Every 4 weeks',
      },
    ],
  },
  {
    id: 'med',
    categoryTab: 'health',
    icon: templatesIcons.health,
    iconTone: 'purple',
    title: 'Medication Starter Kit',
    desc: 'Common medication and supplement reminder schedules.',
    apiCategory: 'Health',
    alarms: [
      {
        key: 'daily-med',
        emoji: templatesIcons.taPill,
        label: 'Daily medication',
        interval: 1,
        unit: 'Days',
        intervalLabel: 'Every 1 day',
      },
      {
        key: 'vitamin-d',
        emoji: templatesIcons.taLotion,
        label: 'Vitamin D',
        interval: 2,
        unit: 'Days',
        intervalLabel: 'Every 2 days',
      },
      {
        key: 'weekly-injection',
        emoji: templatesIcons.taInjection,
        label: 'Weekly injection',
        interval: 7,
        unit: 'Days',
        intervalLabel: 'Every 7 days',
      },
    ],
  },
  {
    id: 'home',
    categoryTab: 'home',
    icon: templatesIcons.home,
    iconTone: 'amber',
    title: 'Home Maintenance Bundle',
    desc: 'Never forget another filter change or service interval.',
    apiCategory: 'Maintenance',
    alarms: [
      {
        key: 'hvac-filter',
        emoji: templatesIcons.home,
        label: 'Change HVAC filter',
        interval: 3,
        unit: 'Months',
        intervalLabel: 'Every 3 months',
      },
      {
        key: 'tyre-rotation',
        emoji: templatesIcons.taCar,
        label: 'Tyre rotation',
        interval: 6,
        unit: 'Months',
        intervalLabel: 'Every 6 months',
      },
    ],
  },
];
