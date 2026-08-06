import { InteractionManager } from 'react-native';

/** Wait until navigation/animations settle, then an extra beat before heavy I/O. */
const FOREGROUND_WORK_DELAY_MS = 1200;

export function runDeferredAppWork(
  task: () => void | Promise<void>,
  delayMs = 0,
): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      void task();
    }, delayMs);
  });
}

/** Stagger AsyncStorage / network work after resume so foreground stays responsive. */
export function runOnAppForeground(task: () => void | Promise<void>): void {
  runDeferredAppWork(task, FOREGROUND_WORK_DELAY_MS);
}
