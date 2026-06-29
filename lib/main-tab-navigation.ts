import type { Router } from 'expo-router';

export type MainTabRoute = '/alarm' | '/history' | '/templates' | '/setting';

export const MAIN_TAB_ROUTE_SUFFIXES: readonly MainTabRoute[] = [
  '/alarm',
  '/history',
  '/templates',
  '/setting',
];

/** True on signed-in tab screens (alarms, history, templates, settings). */
export function isMainTabPathname(pathname: string | undefined): boolean {
  const p = (pathname ?? '').split('?')[0] ?? '';
  if (!p || p === '/') {
    return false;
  }
  return MAIN_TAB_ROUTE_SUFFIXES.some((suffix) => p.endsWith(suffix));
}

/** Switch main tabs without stacking screens (keeps back stack clean). */
export function navigateToMainTab(router: Router, route: MainTabRoute): void {
  router.replace(route);
}
