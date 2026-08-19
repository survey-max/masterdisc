/**
 * Formularens tilstand. Den bor i sin egen fil, fordi app/login/actions.ts er
 * en 'use server'-fil, og sådan en må kun eksportere async funktioner — en
 * konstant dér får Next.js til at afvise hele modulet.
 */
export interface LoginState {
  fejl: string | null;
}

export const LOGIN_TOM: LoginState = { fejl: null };
