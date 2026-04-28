import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_SIGNUP_KEY = '@ripple/pending_signup';

export type PendingSignUp = {
  name: string;
  email: string;
  password: string;
};

export async function savePendingSignUp(data: PendingSignUp) {
  await AsyncStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(data));
}

export async function getPendingSignUp(): Promise<PendingSignUp | null> {
  const raw = await AsyncStorage.getItem(PENDING_SIGNUP_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PendingSignUp;
    if (!parsed?.email || !parsed?.name || typeof parsed?.password !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingSignUp() {
  await AsyncStorage.removeItem(PENDING_SIGNUP_KEY);
}
