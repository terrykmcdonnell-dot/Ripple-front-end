/**
 * Normalizes Google OAuth client IDs from env (quotes, stray whitespace).
 * IDs should match `*.apps.googleusercontent.com` for Cloud Console OAuth clients.
 */
export function normalizeGoogleOAuthClientId(raw: string | undefined | null): string | undefined {
  if (raw == null) {
    return undefined;
  }
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.length > 0 ? s : undefined;
}

export function isLikelyGoogleWebClientId(id: string): boolean {
  return /\.apps\.googleusercontent\.com$/i.test(id) && id.includes('-');
}
