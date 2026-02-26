type RouteHandler = (params: Record<string, string>, query: URLSearchParams) => void;

interface Route {
  pattern: string;
  handler: RouteHandler;
}

function normalizeHashPath(rawHash: string): { path: string; query: URLSearchParams } {
  const hash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  const [pathPart, queryPart] = hash.split("?");
  const path = pathPart && pathPart.length > 0 ? pathPart : "/";
  return {
    path: path.startsWith("/") ? path : `/${path}`,
    query: new URLSearchParams(queryPart ?? "")
  };
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

  register(pattern: string, handler: RouteHandler): void {
    this.routes.push({ pattern, handler });
  }

  setFallback(handler: RouteHandler): void {
    this.fallbackHandler = handler;
  }

  navigate(path: string): void {
    window.location.hash = path;
  }

  start(): void {
    const renderCurrent = () => {
      const { path, query } = normalizeHashPath(window.location.hash);
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

    window.addEventListener("hashchange", renderCurrent);
    renderCurrent();
  }
}
