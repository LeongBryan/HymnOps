import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

/** Returns the current session user, or null if not signed in. */
export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Send a magic-link email. Throws on error.
 * After clicking the link the user lands on /v2 with the session set automatically.
 */
export async function signInWithMagicLink(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Render helper for write-only pages. Redirects to /login if unauthenticated.
 */
export function withAuth(
  container: HTMLElement,
  navigate: (path: string) => void,
  render: (user: User) => Promise<void>
): void {
  getUser().then((user) => {
    if (!user) {
      navigate("/login");
      return;
    }
    render(user).catch((err: unknown) => {
      container.innerHTML = "";
      const msg = document.createElement("p");
      msg.className = "empty-state";
      msg.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      container.appendChild(msg);
    });
  });
}

/**
 * Render helper for public pages. Always renders, passes isAuthenticated so
 * the page can conditionally show write controls.
 */
export function withPublicPage(
  container: HTMLElement,
  render: (isAuthenticated: boolean) => Promise<void>
): void {
  getUser().then((user) => {
    render(!!user).catch((err: unknown) => {
      container.innerHTML = "";
      const msg = document.createElement("p");
      msg.className = "empty-state";
      msg.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      container.appendChild(msg);
    });
  });
}
