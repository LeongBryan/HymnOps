import { signInWithMagicLink, getUser } from "../auth";
import { createElement } from "../../utils";

/**
 * /login — magic-link login page.
 * If the user is already authenticated, shows a "you're in" message with a link to /v2.
 */
export function LoginPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page v2-login-page");

  const card = createElement("div", "detail-block v2-login-card");
  card.appendChild(createElement("h1", undefined, "HymnOps v2"));
  card.appendChild(createElement("p", "page-intro", "Sign in with a magic link to log services and manage the song library."));

  const form = document.createElement("form");
  form.className = "v2-login-form";
  form.noValidate = true;

  const emailLabel = createElement("label", "v2-form-label", "Email address");
  emailLabel.setAttribute("for", "v2-login-email");
  const emailInput = document.createElement("input");
  emailInput.id = "v2-login-email";
  emailInput.type = "email";
  emailInput.className = "search-input";
  emailInput.placeholder = "you@example.com";
  emailInput.autocomplete = "email";
  emailInput.required = true;

  const submitBtn = createElement("button", "button-primary v2-login-submit", "Send magic link") as HTMLButtonElement;
  submitBtn.type = "submit";

  const statusEl = createElement("p", "v2-login-status");

  form.append(emailLabel, emailInput, submitBtn, statusEl);
  card.appendChild(form);
  page.appendChild(card);

  // If already signed in, skip the form
  getUser().then((user) => {
    if (user) {
      form.remove();
      const alreadyIn = createElement("p", "v2-login-status", `Signed in as ${user.email}.`);
      const goBtn = createElement("a", "button-primary", "Go to v2") as HTMLAnchorElement;
      goBtn.href = "/v2";
      goBtn.addEventListener("click", (e) => { e.preventDefault(); navigate("/v2"); });
      card.append(alreadyIn, goBtn);
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      statusEl.textContent = "Please enter your email.";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    statusEl.textContent = "";
    try {
      await signInWithMagicLink(email);
      form.innerHTML = "";
      const sent = createElement("p", "v2-login-status", `Magic link sent to ${email}. Check your inbox and click the link to sign in.`);
      form.appendChild(sent);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send magic link";
      statusEl.textContent = err instanceof Error ? err.message : "Something went wrong. Try again.";
    }
  });

  return page;
}
