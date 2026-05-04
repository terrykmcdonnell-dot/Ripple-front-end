/**
 * Authoritative emoji per alarm category (`categories` table ↔ UI chips ↔ list rows).
 * Health 💊 · Plants 🌱 · Maintenance 🔧 · Pets 🐾 · Work 💼 · Custom ⭐
 */
export const createCategoryIcons = {
  health: '💊',
  plants: '🌱',
  maintenance: '🔧',
  pets: '🐾',
  work: '💼',
  custom: '⭐',
} as const;

export const createSoundIcon = '🎵';
