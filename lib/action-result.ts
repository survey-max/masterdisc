/**
 * Result shape for every server action in the portal.
 *
 * The POC's arkiv.php answered {ok:true, …} / {ok:false, fejl:"…"} and the UI
 * showed `fejl` verbatim. Same contract here, so error text keeps reaching the
 * user instead of being logged and forgotten.
 */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; fejl: string };

export function actionFailed(fejl: string): { ok: false; fejl: string } {
  return { ok: false, fejl };
}

/** Turns any thrown value into text the user can act on. */
export function actionErrorText(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return 'Noget gik galt på serveren.';
}
