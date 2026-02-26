import type { Song } from "../types";
import { formatDate, weeksSince, createElement } from "../utils";
import { Chip } from "./Chip";

export function SongCard(song: Song): HTMLElement {
  const card = createElement("article", "song-card");
  const title = createElement("h3", "song-card-title");
  const link = createElement("a") as HTMLAnchorElement;
  link.href = `#/songs/${song.slug}`;
  link.textContent = song.title;
  title.appendChild(link);

  const meta = createElement("p", "song-card-meta");
  const weeks = weeksSince(song.last_sung_computed);
  const weekText = weeks === null ? "Never sung" : `${weeks} week(s) ago`;
  meta.textContent = `Times sung: ${song.times_sung} | Last sung: ${formatDate(song.last_sung_computed)} (${weekText})`;

  const chips = createElement("div", "chip-row");
  for (const theme of song.dominant_themes.slice(0, 4)) {
    chips.appendChild(Chip(theme));
  }

  card.append(title, meta, chips);
  return card;
}
