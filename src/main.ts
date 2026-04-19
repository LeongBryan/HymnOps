import { Router, currentRoutePath, toAppHref } from "./router";
import { createElement } from "./utils";
import { getUser, signOut } from "./v2/auth";

import { LoginPage } from "./v2/pages/Login";
import { SongLibraryPage } from "./v2/pages/SongLibrary";
import { SongFormPage } from "./v2/pages/SongForm";
import { ServiceLoggerPage } from "./v2/pages/ServiceLogger";
import { ServicesManagerPage } from "./v2/pages/ServicesManager";
import { ServiceDetailPage } from "./v2/pages/ServiceDetail";
import { SeriesManagerPage } from "./v2/pages/SeriesManager";
import { SeriesDetailPage } from "./v2/pages/SeriesDetail";
import { V2AnalyticsPage } from "./v2/pages/V2Analytics";
import "./styles/main.css";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "hymnops-theme";

function makeNav(path: string): HTMLElement {
  const links: Array<{ label: string; path: string }> = [
    { label: "Log Service", path: "/log"       },
    { label: "Songs",       path: "/songs"     },
    { label: "Services",    path: "/services"  },
    { label: "Series",      path: "/series"    },
    { label: "Analytics",   path: "/analytics" }
  ];

  const nav = createElement("nav", "app-nav");
  for (const item of links) {
    const anchor = createElement("a", "nav-link") as HTMLAnchorElement;
    anchor.href = toAppHref(item.path);
    anchor.textContent = item.label;
    if (path.startsWith(item.path)) {
      anchor.classList.add("is-active");
    }
    nav.appendChild(anchor);
  }
  return nav;
}

function getSystemThemeMode(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredThemeMode(): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

function persistThemeMode(themeMode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  } catch {
    // Ignore storage failures and keep the in-memory preference.
  }
}

function resolveInitialThemeMode(): ThemeMode {
  return readStoredThemeMode() ?? getSystemThemeMode();
}

function applyThemeMode(themeMode: ThemeMode): void {
  document.documentElement.dataset.theme = themeMode;
  document.documentElement.style.colorScheme = themeMode;
}

function makeThemeToggle(themeMode: ThemeMode, onToggle: () => void): HTMLButtonElement {
  const button = createElement(
    "button",
    "button-secondary theme-toggle",
    `Dark mode: ${themeMode === "dark" ? "on" : "off"}`
  ) as HTMLButtonElement;
  button.type = "button";
  button.setAttribute("aria-pressed", String(themeMode === "dark"));
  button.title = themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode";
  if (themeMode === "dark") {
    button.classList.add("is-active");
  }
  button.addEventListener("click", onToggle);
  return button;
}

function mountPage(
  app: HTMLElement,
  title: string,
  pageEl: HTMLElement,
  themeMode: ThemeMode,
  onToggleTheme: () => void,
  navigate: (path: string) => void
): void {
  const path = currentRoutePath();
  const shell = createElement("div", "app-shell");
  const header = createElement("header", "app-header");
  const brand = createElement("div", "app-brand");
  brand.appendChild(createElement("h1", "app-title", "HymnOps"));
  header.appendChild(brand);

  const nav = makeNav(path);
  const headerControls = createElement("div", "app-header-controls");
  headerControls.append(nav, makeThemeToggle(themeMode, onToggleTheme));
  header.appendChild(headerControls);
  shell.appendChild(header);

  const main = createElement("main", "app-main");
  const pageTitle = createElement("h2", "sr-only", title);
  main.append(pageTitle, pageEl);
  shell.appendChild(main);

  app.innerHTML = "";
  app.appendChild(shell);
  document.title = `HymnOps | ${title}`;

  // Async: append Sign in / Sign out once auth state resolves
  getUser().then((user) => {
    const authBtn = createElement("button", "nav-link nav-auth-btn",
      user ? "Sign out" : "Sign in") as HTMLButtonElement;
    authBtn.type = "button";
    authBtn.addEventListener("click", async () => {
      if (user) { await signOut(); navigate("/"); }
      else { navigate("/login"); }
    });
    nav.appendChild(authBtn);
  });
}

function bootstrap(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app root element.");

  const state = { themeMode: resolveInitialThemeMode() };
  applyThemeMode(state.themeMode);

  const router = new Router();

  const toggleThemeMode = () => {
    state.themeMode = state.themeMode === "dark" ? "light" : "dark";
    persistThemeMode(state.themeMode);
    applyThemeMode(state.themeMode);
    router.refresh();
  };

  const renderPage = (
    title: string,
    renderFn: (
      navigate: (path: string) => void,
      params: Record<string, string>,
      query: URLSearchParams
    ) => HTMLElement
  ) => {
    return (params: Record<string, string>, query: URLSearchParams) => {
      const navigate = (path: string) => router.navigate(path);
      const pageEl = renderFn(navigate, params, query);
      mountPage(app, title, pageEl, state.themeMode, toggleThemeMode, navigate);
    };
  };

  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  systemTheme.addEventListener("change", (event) => {
    if (readStoredThemeMode()) return;
    state.themeMode = event.matches ? "dark" : "light";
    applyThemeMode(state.themeMode);
    router.refresh();
  });

  // ── Home ─────────────────────────────────────────────────────────────────
  router.register(
    "/",
    renderPage("Home", (navigate) => {
      const page = createElement("div", "page");
      page.appendChild(createElement("h1", undefined, "HymnOps"));
      const links: Array<{ label: string; desc: string; path: string }> = [
        { label: "Log a Service", desc: "Record today's service setlist and notes", path: "/log"       },
        { label: "Song Library",  desc: "Browse, add and edit songs",               path: "/songs"     },
        { label: "Services",      desc: "View and manage past services",             path: "/services"  },
        { label: "Series",        desc: "Manage sermon series",                      path: "/series"    },
        { label: "Analytics",     desc: "Usage stats and rotation gaps",             path: "/analytics" }
      ];
      const grid = createElement("div", "quick-actions");
      for (const l of links) {
        const card = createElement("a", "quick-link") as HTMLAnchorElement;
        card.href = toAppHref(l.path);
        card.addEventListener("click", (e) => { e.preventDefault(); navigate(l.path); });
        card.appendChild(createElement("h3", undefined, l.label));
        card.appendChild(createElement("p", undefined, l.desc));
        grid.appendChild(card);
      }
      page.appendChild(grid);
      return page;
    })
  );

  // ── Auth ─────────────────────────────────────────────────────────────────
  router.register(
    "/login",
    renderPage("Sign in", (navigate) => LoginPage(navigate))
  );

  // ── Songs ─────────────────────────────────────────────────────────────────
  router.register(
    "/songs",
    renderPage("Song Library", (navigate) => SongLibraryPage(navigate))
  );

  router.register(
    "/songs/new",
    renderPage("Add Song", (navigate) => SongFormPage(navigate))
  );

  router.register(
    "/songs/:slug/edit",
    renderPage("Edit Song", (navigate, params) => SongFormPage(navigate, params.slug))
  );

  // ── Services ─────────────────────────────────────────────────────────────
  router.register(
    "/log",
    renderPage("Log Service", (navigate, _params, query) => ServiceLoggerPage(navigate, query))
  );

  router.register(
    "/services",
    renderPage("Services", (navigate) => ServicesManagerPage(navigate))
  );

  router.register(
    "/services/:date",
    renderPage("Service", (navigate, params) => ServiceDetailPage(navigate, params.date))
  );

  // ── Series ────────────────────────────────────────────────────────────────
  router.register(
    "/series",
    renderPage("Series", (navigate) => SeriesManagerPage(navigate))
  );

  router.register(
    "/series/:slug",
    renderPage("Series Detail", (navigate, params) => SeriesDetailPage(navigate, params.slug))
  );

  // ── Analytics ─────────────────────────────────────────────────────────────
  router.register(
    "/analytics",
    renderPage("Analytics", (navigate) => V2AnalyticsPage(navigate))
  );

  // ── 404 ───────────────────────────────────────────────────────────────────
  router.setFallback(
    renderPage("Not Found", () => {
      const page = createElement("div", "page");
      page.appendChild(createElement("h1", undefined, "Not Found"));
      page.appendChild(createElement("p", "empty-state", "This page does not exist."));
      return page;
    })
  );

  router.start();
}

bootstrap();
