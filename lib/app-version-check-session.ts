import { AppState, type AppStateStatus } from 'react-native';

import { checkAppVersion, type VersionCheckResult } from '@/lib/app-version-check';
import { runDeferredAppWork, runOnAppForeground } from '@/lib/defer-app-work';

export type AppVersionCheckSnapshot = {
  result: VersionCheckResult | null;
  dismissed: boolean;
  checking: boolean;
  launchId: number;
};

let state: AppVersionCheckSnapshot = {
  result: null,
  dismissed: false,
  checking: false,
  launchId: 0,
};

const listeners = new Set<() => void>();

function commitState(next: AppVersionCheckSnapshot): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

export function getAppVersionCheckSnapshot(): AppVersionCheckSnapshot {
  return state;
}

export function subscribeAppVersionCheck(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissAppVersionCheckPrompt(): void {
  if (state.dismissed) {
    return;
  }
  commitState({ ...state, dismissed: true });
}

/**
 * Starts a fresh version check — call on cold launch and whenever the app
 * returns to the foreground. Resets optional "Later" for that visit.
 */
export function beginNewAppLaunchVersionCheck(): void {
  const launchId = state.launchId + 1;
  commitState({
    result: null,
    dismissed: false,
    checking: true,
    launchId,
  });

  void (async () => {
    try {
      const result = await checkAppVersion();
      if (state.launchId !== launchId) {
        return;
      }
      commitState({
        ...state,
        result: result.status === 'up_to_date' ? null : result,
        checking: false,
      });
    } catch {
      if (state.launchId === launchId) {
        commitState({ ...state, checking: false });
      }
    }
  })();
}

/** Wire once in root layout — checks on cold start and each foreground. */
export function subscribeAppLaunchVersionChecks(): () => void {
  runDeferredAppWork(() => {
    beginNewAppLaunchVersionCheck();
  });

  let lastState: AppStateStatus = AppState.currentState;

  const subscription = AppState.addEventListener('change', (nextState) => {
    const wasBackground = lastState === 'background' || lastState === 'inactive';
    lastState = nextState;
    if (nextState === 'active' && wasBackground) {
      runOnAppForeground(() => {
        beginNewAppLaunchVersionCheck();
      });
    }
  });

  return () => {
    subscription.remove();
  };
}
