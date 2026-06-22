import type { Router } from 'expo-router';

export type MainTabRoute = '/alarm' | '/history' | '/templates' | '/setting';

/** Switch main tabs without stacking screens (keeps back stack clean). */
export function navigateToMainTab(router: Router, route: MainTabRoute): void {
  router.replace(route);
}
