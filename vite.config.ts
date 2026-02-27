import { defineConfig } from "vite";

function normalizeBase(rawBase: string): string {
  const trimmed = rawBase.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  let normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!normalized.endsWith("/")) {
    normalized = `${normalized}/`;
  }

  return normalized.replace(/\/{2,}/g, "/");
}

const configuredBase = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base: normalizeBase(configuredBase),
  build: {
    outDir: "dist",
    emptyOutDir: false
  }
});
