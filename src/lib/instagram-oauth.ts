export const STATE_COOKIE = 'ig_oauth_state';

// Must match the redirect URI saved in the Meta app exactly
export function callbackUrl(req: Request) {
  return `${new URL(req.url).origin}/api/connect/instagram/callback`;
}
