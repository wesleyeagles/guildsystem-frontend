export const AUTH_RETURN_KEY = 'guildsystem.authReturnUrl';

export function consumeAuthReturnUrl(): string {
  const v = sessionStorage.getItem(AUTH_RETURN_KEY);
  sessionStorage.removeItem(AUTH_RETURN_KEY);
  return v || '/';
}
