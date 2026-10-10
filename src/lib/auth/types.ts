// Types shared by server and browser code. Nothing sensitive: never tokens, only what the UI may show.
export interface AuthUser {
  id: string;
  email: string;
  /** Display name: the profile name, or the part of the email before "@". */
  name: string;
}

export interface SessionPayload {
  /** False when the server has no usable auth configuration. */
  configured: boolean;
  user: AuthUser | null;
}

export type ActionResult =
  | { status: 'success'; redirectTo?: string; message?: string }
  | { status: 'confirm_email'; email: string }
  | { status: 'sent' }
  | { status: 'error'; message?: string; fieldErrors?: Record<string, string> };
