import MarkdownIt from "markdown-it";
import { loadAppData } from "./data";
import { Router, currentRoutePath, toAppHref } from "./router";
import { AnalyticsPage } from "./pages/Analytics";
import { HomePage } from "./pages/Home";
import { PlannerPage } from "./pages/Planner";
import { ServiceDetailPage } from "./pages/ServiceDetail";
import { ServicesPage } from "./pages/Services";
import { SeriesDetailPage } from "./pages/SeriesDetail";
import { SeriesListPage } from "./pages/SeriesList";
import { SongDetailPage } from "./pages/SongDetail";
import { SongListPage } from "./pages/SongList";
import type { AppData, PageContext, PlannerState } from "./types";
import { createElement } from "./utils";
import { LoginPage } from "./v2/pages/Login";
import { SongLibraryPage } from "./v2/pages/SongLibrary";
import { SongFormPage } from "./v2/pages/SongForm";
import { ServiceLoggerPage } from "./v2/pages/ServiceLogger";
import { ServicesManagerPage } from "./v2/pages/ServicesManager";
import { SeriesManagerPage } from "./v2/pages/SeriesManager";
import { V2AnalyticsPage } from "./v2/pages/V2Analytics";
import "./styles/main.css";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "hymnops-theme";

function makeNav(path: string): HTMLElement {
  const links: Array<{ label: string; path: string }> = [
    { label: "Home", path: "/" },
    { label: "Songs", path: "/songs" },
    { label: "Services", path: "/services" },
    { label: "Series", path: "/series" },
    { label: "Planner", path: "/planner" },
    { label: "Analytics", path: "/analytics" },
    { label: "v2", path: "/v2" }
  ];

  const nav = createElement("nav", "app-nav");
  for (const item of links) {
    const anchor = createElement("a", "nav-link") as HTMLAnchorElement;
    anchor.href = toAppHref(item.path);
    anchor.textContent = item.label;
    const activePath = item.path;
    if ((activePath === "/" && path === "/") || (activePath !== "/" && path.startsWith(activePath))) {
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
  onToggleTheme: () => void
): void {
  const path = currentRoutePath();
  const shell = createElement("div", "app-shell");
  const header = createElement("header", "app-header");
  const brand = createElement("div", "app-brand");
  brand.appendChild(createElement("h1", "app-title", "HymnOps"));
  header.appendChild(brand);

  const headerControls = createElement("div", "app-header-controls");
  headerControls.append(makeNav(path), makeThemeToggle(themeMode, onToggleTheme));
  header.appendChild(headerControls);
  shell.appendChild(header);

  const main = createElement("main", "app-main");
  const pageTitle = createElement("h2", "sr-only", title);
  main.append(pageTitle, pageEl);
  shell.appendChild(main);

  app.innerHTML = "";
  app.appendChild(shell);
  document.title = `HymnOps | ${title}`;
}

function makeContext(
  data: AppData,
  markdown: MarkdownIt,
  planner: PlannerState,
  setPlanner: (next: PlannerState) => void,
  navigate: (pathWithQuery: string) => void,
  rerender: () => void
): PageContext {
  const context: PageContext = {
    data,
    markdown,
    planner,
    setPlanner: (next: PlannerState) => {
      setPlanner(next);
      context.planner = next;
    },
    navigate,
    rerender
  };
  return context;
}

function plannerDefault(): PlannerState {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    date,
    series_slug: null,
    sermon_title: null,
    sermon_text: null,
    preacher: null,
    songs: []
  };
}

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("Missing #app root element.");
  }

  try {
    const data = await loadAppData();
    const markdown = new MarkdownIt({ linkify: true });
    const router = new Router();
    const state = {
      planner: plannerDefault(),
      themeMode: resolveInitialThemeMode()
    };

    applyThemeMode(state.themeMode);

    const setPlanner = (next: PlannerState) => {
      state.planner = next;
    };

    const toggleThemeMode = () => {
      state.themeMode = state.themeMode === "dark" ? "light" : "dark";
      persistThemeMode(state.themeMode);
      applyThemeMode(state.themeMode);
      router.refresh();
    };

    const renderWith = (title: string, renderPage: (ctx: PageContext, query: URLSearchParams, params: Record<string, string>) => HTMLElement) => {
      return (params: Record<string, string>, query: URLSearchParams) => {
        const ctx = makeContext(
          data,
          markdown,
          state.planner,
          setPlanner,
          (path) => router.navigate(path),
          () => router.refresh()
        );
        const pageEl = renderPage(ctx, query, params);
        mountPage(app, title, pageEl, state.themeMode, toggleThemeMode);
      };
    };

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    systemTheme.addEventListener("change", (event) => {
      if (readStoredThemeMode()) return;
      state.themeMode = event.matches ? "dark" : "light";
      applyThemeMode(state.themeMode);
      router.refresh();
    });

    router.register(
      "/",
      renderWith("Home", (ctx) => HomePage(ctx))
    );
    router.register(
      "/songs",
      renderWith("Songs", (ctx) => SongListPage(ctx))
    );
    router.register(
      "/songs/:slug",
      renderWith("Song Detail", (ctx, _query, params) => SongDetailPage(ctx, params.slug))
    );
    router.register(
      "/services",
      renderWith("Services", (ctx, query) => ServicesPage(ctx, query))
    );
    router.register(
      "/services/:date",
      renderWith("Service Detail", (ctx, _query, params) => ServiceDetailPage(ctx, params.date))
    );
    router.register(
      "/series",
      renderWith("Series", (ctx, query) => SeriesListPage(ctx, query))
    );
    router.register(
      "/series/:slug",
      renderWith("Series Detail", (ctx, _query, params) => SeriesDetailPage(ctx, params.slug))
    );
    router.register(
      "/planner",
      renderWith("Planner", (ctx, query) => PlannerPage(ctx, query))
    );
    router.register(
      "/analytics",
      renderWith("Analytics", (ctx) => AnalyticsPage(ctx))
    );

    // ── v2 routes (Supabase-backed) ─────────────────────────────────────────
    // renderV2With: like renderWith but passes navigate/rerender instead of PageContext.
    const renderV2With = (
      title: string,
      renderPage: (
        navigate: (path: string) => void,
        params: Record<string, string>,
        query: URLSearchParams
      ) => HTMLElement
    ) => {
      return (params: Record<string, string>, query: URLSearchParams) => {
        const pageEl = renderPage((path) => router.navigate(path), params, query);
        mountPage(app, title, pageEl, state.themeMode, toggleThemeMode);
      };
    };

    router.register(
      "/v2",
      renderV2With("v2 Home", (navigate) => {
        const page = createElement("div", "page");
        page.appendChild(createElement("h1", undefined, "HymnOps v2"));
        const links2: Array<{ label: string; desc: string; path: string }> = [
          { label: "Log a Service",  desc: "Record today's service",        path: "/v2/log"         },
          { label: "Song Library",   desc: "Browse and edit songs",         path: "/v2/songs"       },
          { label: "Services",       desc: "View and manage services",      path: "/v2/services"    },
          { label: "Series",         desc: "Manage sermon series",          path: "/v2/series"      },
          { label: "Analytics",      desc: "DB-backed usage stats",         path: "/v2/analytics"   }
        ];
        const grid = createElement("div", "quick-actions");
        for (const l of links2) {
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

    router.register(
      "/v2/login",
      renderV2With("Sign in", (navigate) => LoginPage(navigate))
    );

    router.register(
      "/v2/songs",
      renderV2With("Song Library", (navigate) => SongLibraryPage(navigate))
    );

    router.register(
      "/v2/songs/new",
      renderV2With("Add Song", (navigate) => SongFormPage(navigate))
    );

    router.register(
      "/v2/songs/:slug/edit",
      renderV2With("Edit Song", (navigate, params) => SongFormPage(navigate, params.slug))
    );

    router.register(
      "/v2/log",
      renderV2With("Log Service", (navigate, _params, query) => ServiceLoggerPage(navigate, query))
    );

    router.register(
      "/v2/services",
      renderV2With("Services", (navigate) => ServicesManagerPage(navigate))
    );

    router.register(
      "/v2/series",
      renderV2With("Series", (navigate) => SeriesManagerPage(navigate))
    );

    router.register(
      "/v2/analytics",
      renderV2With("Analytics v2", (navigate) => V2AnalyticsPage(navigate))
    );

    router.setFallback(
      renderWith("Not Found", () => {
        const page = createElement("div", "page");
        page.appendChild(createElement("h1", undefined, "Not Found"));
        page.appendChild(createElement("p", "empty-state", "This page does not exist."));
        return page;
      })
    );

    router.start();
  } catch (error) {
    app.innerHTML = "";
    const wrapper = createElement("div", "page");
    wrapper.appendChild(createElement("h1", undefined, "Failed to load data"));
    wrapper.appendChild(
      createElement(
        "p",
        "empty-state",
        "Run `npm run build:index` first, then reload the app."
      )
    );
    const detail = createElement("pre", "error-detail", String(error));
    wrapper.appendChild(detail);
    app.appendChild(wrapper);
  }
}

bootstrap();
