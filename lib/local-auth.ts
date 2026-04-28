import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_AUTH_KEY = 'alarm_local_user_email';

export async function setLocalSignedInUser(email: string) {
  await AsyncStorage.setItem(LOCAL_AUTH_KEY, email);
}

export async function getLocalSignedInUser() {
  return AsyncStorage.getItem(LOCAL_AUTH_KEY);
}

export async function clearLocalSignedInUser() {
  await AsyncStorage.removeItem(LOCAL_AUTH_KEY);
}
