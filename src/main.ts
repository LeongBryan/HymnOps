import MarkdownIt from "markdown-it";
import { loadAppData } from "./data";
import { Router } from "./router";
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
import "./styles/main.css";

function currentPathFromHash(): string {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const [path] = hash.split("?");
  if (!path || path.length === 0) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function makeNav(path: string): HTMLElement {
  const links: Array<{ label: string; href: string }> = [
    { label: "Home", href: "#/" },
    { label: "Songs", href: "#/songs" },
    { label: "Services", href: "#/services" },
    { label: "Series", href: "#/series" },
    { label: "Planner", href: "#/planner" },
    { label: "Analytics", href: "#/analytics" }
  ];

  const nav = createElement("nav", "app-nav");
  for (const item of links) {
    const anchor = createElement("a", "nav-link") as HTMLAnchorElement;
    anchor.href = item.href;
    anchor.textContent = item.label;
    const activePath = item.href.slice(1);
    if ((activePath === "/" && path === "/") || (activePath !== "/" && path.startsWith(activePath))) {
      anchor.classList.add("is-active");
    }
    nav.appendChild(anchor);
  }
  return nav;
}

function mountPage(app: HTMLElement, title: string, pageEl: HTMLElement): void {
  const path = currentPathFromHash();
  const shell = createElement("div", "app-shell");
  const header = createElement("header", "app-header");
  header.appendChild(createElement("h1", "app-title", "HymnOps"));
  header.appendChild(makeNav(path));
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
  navigate: (hashPath: string) => void
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
    rerender: () => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
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
    const state = { planner: plannerDefault() };

    const setPlanner = (next: PlannerState) => {
      state.planner = next;
    };

    const renderWith = (title: string, renderPage: (ctx: PageContext, query: URLSearchParams, params: Record<string, string>) => HTMLElement) => {
      return (params: Record<string, string>, query: URLSearchParams) => {
        const ctx = makeContext(data, markdown, state.planner, setPlanner, (path) => router.navigate(path));
        const pageEl = renderPage(ctx, query, params);
        mountPage(app, title, pageEl);
      };
    };

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
      renderWith("Services", (ctx) => ServicesPage(ctx))
    );
    router.register(
      "/services/:date",
      renderWith("Service Detail", (ctx, _query, params) => ServiceDetailPage(ctx, params.date))
    );
    router.register(
      "/series",
      renderWith("Series", (ctx) => SeriesListPage(ctx))
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
