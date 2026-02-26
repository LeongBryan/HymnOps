import type { AppData } from "./types";

async function loadJson<T>(fileName: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}data/${fileName}`;
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName} (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function loadAppData(): Promise<AppData> {
  const [songs, services, series, derived] = await Promise.all([
    loadJson<AppData["songs"]>("songs.json"),
    loadJson<AppData["services"]>("services.json"),
    loadJson<AppData["series"]>("series.json"),
    loadJson<AppData["derived"]>("derived.json")
  ]);

  return { songs, services, series, derived };
}
