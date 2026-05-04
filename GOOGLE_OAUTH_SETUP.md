# Google Sign-In (`@react-native-google-signin/google-signin`) — Ripple / alarm-app

[`hooks/use-google-auth.ts`](hooks/use-google-auth.ts) uses **[`@react-native-google-signin/google-signin`](https://github.com/react-native-google-signin/google-signin)** with Supabase [`signInWithIdToken`](https://supabase.com/docs/guides/auth/social-login/auth-google?platform=react-native). This is a **native** flow (not `expo-auth-session` / in-app browser).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | **Required.** Web application OAuth client ID from Google Cloud — passed to `GoogleSignin.configure({ webClientId })` so Google returns an **ID token** Supabase can verify. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | **Recommended on iOS.** iOS OAuth client ID — passed as `iosClientId` when set. Also ensure [`app.json`](app.json) plugin `iosUrlScheme` matches your iOS client (reversed client id). |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | **Reference / docs only** — Android uses package name + SHA in Google Cloud; you do not pass this string into `configure()`, but keep the client IDs aligned in Console. |

## Google Cloud Console

1. **Web client** — same client as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; used for token audience / Supabase.
2. **iOS client** — bundle ID `com.terrykm.ripplealarm` (see [`app.json`](app.json) `ios.bundleIdentifier`).
3. **Android client** — package `com.terrykm.ripplealarm` + debug/release **SHA-1/SHA-256** for the keystore that signs your app.

## Platform notes

- **Web** — the hook shows a message to use email sign-in or the native app; `GoogleSignin` does not run in the browser bundle.
- **Expo Go** — use a **development build** (`expo run:android` / `expo run:ios`) so the Google Sign-In native module is linked.
- OAuth consent screen: if the app is in **Testing**, add tester Google accounts under **OAuth consent screen → Test users**.

## Troubleshooting: Android `DEVELOPER_ERROR` / “Developer Error”

Google Sign-In fails with **code 10** most often when:

1. **`webClientId` is wrong** — `GoogleSignin.configure({ webClientId })` must use the OAuth client whose **type is “Web application”** in Google Cloud. It must **not** be the Android client ID string from your Android OAuth credential. Create **Credentials → Create OAuth client ID → Web application**, copy **that** client ID into **`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`**. The Android credential (package + SHA-1) is validated separately by Play Services and does **not** replace the Web client ID in JS.

2. **SHA-1 mismatch** — The fingerprint registered under the **Android** OAuth client must match the keystore **actually signing** the APK you run (often debug keystore for `expo run:android` debug). Re-run `./gradlew signingReport` if you switched machines or release vs debug.

3. **Package name typo** — Must match [`app.json`](app.json) `android.package` / Gradle `applicationId` exactly (`com.terrykm.ripplealarm`).

Supabase still expects tokens minted against your **Web** client audience when verifying Google login.

## References

- [React Native Google Sign-In](https://github.com/react-native-google-signin/google-signin)
- [Supabase: Google login (React Native)](https://supabase.com/docs/guides/auth/social-login/auth-google?platform=react-native)
- [Expo config plugin](https://github.com/react-native-google-signin/google-signin/blob/master/docs/expo.md) (already in [`app.json`](app.json) plugins)
