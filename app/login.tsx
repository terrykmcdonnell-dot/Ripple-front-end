import { Redirect } from 'expo-router';

/** Alias route — sign-in lives at `/signin`. */
export default function LoginRoute() {
  return <Redirect href="/signin" />;
}
