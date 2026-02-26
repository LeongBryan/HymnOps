type RouteHandler = (params: Record<string, string>, query: URLSearchParams) => void;

interface Route {
  pattern: string;
  handler: RouteHandler;
}

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath.length === 0) {
    return "/";
  }
  return rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
}

function normalizeBasePath(rawBase: string): string {
  const trimmed = rawBase.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  let base = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!base.endsWith("/")) {
    base = `${base}/`;
  }
  return base.replace(/\/{2,}/g, "/");
}

const basePath = normalizeBasePath(import.meta.env.BASE_URL ?? "/");
const basePrefix = basePath === "/" ? "" : basePath.slice(0, -1);

function stripBasePath(pathname: string): string {
  const normalized = normalizePath(pathname);
  if (!basePrefix) {
    return normalized;
  }
  if (normalized === basePrefix) {
    return "/";
  }
  if (normalized.startsWith(`${basePrefix}/`)) {
    return normalized.slice(basePrefix.length) || "/";
  }
  return normalized;
}

function currentRoute(): { path: string; query: URLSearchParams } {
  return {
    path: stripBasePath(window.location.pathname),
    query: new URLSearchParams(window.location.search)
  };
}

export function toAppHref(pathWithQuery: string): string {
  const [pathPart, queryPart] = pathWithQuery.split("?");
  const normalizedPath = normalizePath(pathPart || "/");
  const prefixedPath = basePrefix ? `${basePrefix}${normalizedPath}` : normalizedPath;
  if (!queryPart || queryPart.length === 0) {
    return prefixedPath;
  }
  return `${prefixedPath}?${queryPart}`;
}

export function currentRoutePath(): string {
  return currentRoute().path;
}

function matchRoute(pattern: string, actualPath: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const actualParts = actualPath.split("/").filter(Boolean);

  if (patternParts.length !== actualParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const actual = actualParts[i];
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
      continue;
    }
    if (expected !== actual) {
      return null;
    }
  }
  return params;
}

export class Router {
  private routes: Route[] = [];
  private fallbackHandler: RouteHandler | null = null;
  private renderCurrent: (() => void) | null = null;

  register(pattern: string, handler: RouteHandler): void {
    this.routes.push({ pattern, handler });
  }

  setFallback(handler: RouteHandler): void {
    this.fallbackHandler = handler;
  }

  navigate(pathWithQuery: string): void {
    const targetHref = toAppHref(pathWithQuery);
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (targetHref !== currentHref) {
      window.history.pushState({}, "", targetHref);
    }
    this.renderCurrent?.();
  }

  refresh(): void {
    this.renderCurrent?.();
  }

  start(): void {
    const renderCurrent = () => {
      const { path, query } = currentRoute();
      for (const route of this.routes) {
        const match = matchRoute(route.pattern, path);
        if (match) {
          route.handler(match, query);
          return;
        }
      }
      if (this.fallbackHandler) {
        this.fallbackHandler({}, query);
      }
    };

    this.renderCurrent = renderCurrent;
    window.addEventListener("popstate", renderCurrent);
    renderCurrent();
  }
}
