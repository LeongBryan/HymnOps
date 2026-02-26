import { Chip } from "../components/Chip";
import type { PageContext } from "../types";
import { createElement, formatDate } from "../utils";

export function SongDetailPage(ctx: PageContext, slug: string): HTMLElement {
  const page = createElement("div", "page song-detail-page");
  const song = ctx.data.songs.find((item) => item.slug === slug);
  if (!song) {
    page.appendChild(createElement("h1", undefined, "Song not found"));
    page.appendChild(createElement("p", "empty-state", `No song exists for slug "${slug}".`));
    return page;
  }

  page.appendChild(createElement("h1", undefined, song.title));

  const sub = createElement("p", "song-subline");
  sub.textContent = `${song.ccli_number ? `CCLI ${song.ccli_number}` : "No CCLI"} | ${song.status}`;
  page.appendChild(sub);

  if (song.aka.length > 0) {
    const akaBlock = createElement("section", "detail-block");
    akaBlock.appendChild(createElement("h2", undefined, "Also Known As"));
    const row = createElement("div", "chip-row");
    song.aka.forEach((item) => row.appendChild(Chip(item)));
    akaBlock.appendChild(row);
    page.appendChild(akaBlock);
  }

  const people = createElement("section", "detail-grid");
  const writers = createElement("article", "detail-block");
  writers.appendChild(createElement("h2", undefined, "Writers"));
  writers.appendChild(
    createElement("p", undefined, song.writers.length > 0 ? song.writers.join(", ") : "No writer metadata entered.")
  );
  const originalArtist = createElement("article", "detail-block");
  originalArtist.appendChild(createElement("h2", undefined, "Original Artist"));
  originalArtist.appendChild(createElement("p", undefined, song.original_artist ?? "Not set"));
  people.append(writers, originalArtist);
  page.appendChild(people);

  const summary = createElement("section", "detail-block");
  summary.appendChild(createElement("h2", undefined, "Theological Summary"));
  summary.appendChild(createElement("p", undefined, song.theological_summary));
  page.appendChild(summary);

  const metadata = createElement("section", "detail-grid");
  const attributes = createElement("article", "detail-block");
  attributes.appendChild(createElement("h2", undefined, "Song Data"));
  const details = createElement("ul");
  const values = [
    `Key: ${song.key ?? "n/a"}`,
    `Tempo: ${song.tempo_bpm ?? "n/a"} bpm`,
    `Time signature: ${song.time_signature ?? "n/a"}`,
    `Congregational fit: ${song.congregational_fit ?? "n/a"}`,
    `Vocal range: ${song.vocal_range ?? "n/a"}`,
    `Last sung: ${formatDate(song.last_sung_computed)}`
  ];
  for (const value of values) {
    attributes.appendChild(createElement("p", undefined, value));
  }
  metadata.appendChild(attributes);

  const tags = createElement("article", "detail-block");
  tags.appendChild(createElement("h2", undefined, "Themes / Doctrine / Tone / Scripture"));
  const themeRow = createElement("div", "chip-row");
  song.dominant_themes.forEach((theme) => themeRow.appendChild(Chip(theme)));
  const doctrineRow = createElement("div", "chip-row");
  song.doctrinal_categories.forEach((item) => doctrineRow.appendChild(Chip(item)));
  const toneRow = createElement("div", "chip-row");
  song.emotional_tone.forEach((item) => toneRow.appendChild(Chip(item)));
  tags.appendChild(createElement("h3", undefined, "Themes"));
  tags.appendChild(themeRow);
  tags.appendChild(createElement("h3", undefined, "Doctrine"));
  tags.appendChild(doctrineRow);
  tags.appendChild(createElement("h3", undefined, "Tone"));
  tags.appendChild(toneRow);
  tags.appendChild(createElement("h3", undefined, "Scriptural Anchors"));
  const scriptureList = createElement("ul");
  for (const anchor of song.scriptural_anchors) {
    scriptureList.appendChild(createElement("li", undefined, anchor));
  }
  tags.appendChild(scriptureList);
  metadata.appendChild(tags);
  page.appendChild(metadata);

  const notes = createElement("section", "detail-grid");
  const notesBlock = createElement("article", "detail-block markdown-block");
  notesBlock.appendChild(createElement("h2", undefined, "Notes"));
  const notesBody = createElement("div");
  notesBody.innerHTML = ctx.markdown.render(song.notes_markdown ?? "_No notes._");
  notesBlock.appendChild(notesBody);
  notes.appendChild(notesBlock);

  const pastoral = createElement("article", "detail-block markdown-block");
  pastoral.appendChild(createElement("h2", undefined, "Pastoral Use"));
  const pastoralBody = createElement("div");
  pastoralBody.innerHTML = ctx.markdown.render(song.pastoral_use_markdown ?? "_No pastoral-use notes._");
  pastoral.appendChild(pastoralBody);
  notes.appendChild(pastoral);
  page.appendChild(notes);

  const history = createElement("section", "detail-block");
  history.appendChild(createElement("h2", undefined, "History"));
  if (song.history.length === 0) {
    history.appendChild(createElement("p", "empty-state", "No service history yet."));
  } else {
    const table = createElement("table", "data-table");
    const thead = createElement("thead");
    thead.innerHTML = "<tr><th>Date</th><th>Usage</th><th>Series</th><th>Key</th></tr>";
    const tbody = createElement("tbody");
    for (const entry of song.history) {
      const row = createElement("tr");
      row.innerHTML = `<td>${formatDate(entry.date)}</td><td>${entry.usage.join(", ")}</td><td>${entry.series_slug ?? "—"}</td><td>${entry.key ?? "—"}</td>`;
      tbody.appendChild(row);
    }
    table.append(thead, tbody);
    history.appendChild(table);
  }
  page.appendChild(history);

  if (song.songselect_url) {
    const source = createElement("p", "song-link");
    const link = createElement("a") as HTMLAnchorElement;
    link.href = song.songselect_url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open in SongSelect";
    source.appendChild(link);
    page.appendChild(source);
  }

  return page;
}
