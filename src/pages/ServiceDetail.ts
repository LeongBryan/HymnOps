import type { PageContext, ServiceSongRef } from "../types";
import { createElement, formatDate } from "../utils";

function songToYaml(item: ServiceSongRef): string {
  const usage = item.usage.map((value) => `"${value}"`).join(", ");
  return [
    `  - slug: "${item.slug}"`,
    `    usage: [${usage}]`,
    `    key: ${item.key ? `"${item.key}"` : "null"}`,
    `    notes: ${item.notes ? `"${item.notes.replaceAll('"', '\\"')}"` : "null"}`
  ].join("\n");
}

function serviceTemplateFromExisting(date: string, serviceSeries: string | null, sermonTitle: string | null, sermonText: string | null, preacher: string | null, songs: ServiceSongRef[]): string {
  const songsYaml = songs.length > 0 ? `\n${songs.map((song) => songToYaml(song)).join("\n")}` : " []";
  return `---
date: "${date}"
series_slug: ${serviceSeries ? `"${serviceSeries}"` : "null"}
sermon_title: ${sermonTitle ? `"${sermonTitle.replaceAll('"', '\\"')}"` : "null"}
sermon_text: ${sermonText ? `"${sermonText.replaceAll('"', '\\"')}"` : "null"}
preacher: ${preacher ? `"${preacher.replaceAll('"', '\\"')}"` : "null"}
songs:${songsYaml}
---

## Service Notes

Add transitions, prayer cues, and team reminders.
`;
}

export function ServiceDetailPage(ctx: PageContext, date: string): HTMLElement {
  const page = createElement("div", "page service-detail-page");
  const service = ctx.data.services.find((item) => item.date === date);
  if (!service) {
    page.appendChild(createElement("h1", undefined, "Service not found"));
    page.appendChild(createElement("p", "empty-state", `No service exists for ${date}.`));
    return page;
  }

  page.appendChild(createElement("h1", undefined, `Service: ${formatDate(service.date)}`));
  page.appendChild(
    createElement(
      "p",
      "service-header-meta",
      `${service.series_slug ?? "No series"} | ${service.preacher ?? "Unknown preacher"}`
    )
  );

  const sermonBlock = createElement("section", "detail-block");
  sermonBlock.appendChild(createElement("h2", undefined, "Sermon"));
  sermonBlock.appendChild(createElement("p", undefined, `Title: ${service.sermon_title ?? "n/a"}`));
  sermonBlock.appendChild(createElement("p", undefined, `Text: ${service.sermon_text ?? "n/a"}`));
  sermonBlock.appendChild(createElement("p", undefined, `Preacher: ${service.preacher ?? "n/a"}`));
  page.appendChild(sermonBlock);

  const setlist = createElement("section", "detail-block");
  setlist.appendChild(createElement("h2", undefined, "Setlist"));
  const table = createElement("table", "data-table");
  table.innerHTML = "<thead><tr><th>Song</th><th>Usage</th><th>Key</th><th>Notes</th></tr></thead>";
  const tbody = createElement("tbody");
  for (const item of service.songs) {
    const row = createElement("tr");
    const songCell = createElement("td");
    const link = createElement("a") as HTMLAnchorElement;
    link.href = `#/songs/${item.slug}`;
    const song = ctx.data.songs.find((candidate) => candidate.slug === item.slug);
    link.textContent = song?.title ?? item.slug;
    songCell.appendChild(link);

    const usageCell = createElement("td", undefined, item.usage.join(", "));
    const keyCell = createElement("td", undefined, item.key ?? "—");
    const notesCell = createElement("td", undefined, item.notes ?? "—");
    row.append(songCell, usageCell, keyCell, notesCell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  setlist.appendChild(table);
  page.appendChild(setlist);

  const controls = createElement("section", "detail-block");
  controls.appendChild(createElement("h2", undefined, "Template Export"));
  const button = createElement("button", "button-primary", "Copy as Markdown Template") as HTMLButtonElement;
  const status = createElement("p", "copy-status", "");
  button.addEventListener("click", async () => {
    const markdown = serviceTemplateFromExisting(
      "<YYYY-MM-DD>",
      service.series_slug,
      service.sermon_title,
      service.sermon_text,
      service.preacher,
      service.songs
    );
    try {
      await navigator.clipboard.writeText(markdown);
      status.textContent = "Template copied to clipboard.";
    } catch {
      status.textContent = "Clipboard unavailable in this browser.";
    }
  });
  controls.append(button, status);
  page.appendChild(controls);

  return page;
}
