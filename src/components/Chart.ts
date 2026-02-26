import { createElement } from "../utils";

export interface ChartDatum {
  label: string;
  value: number;
}

interface ChartOptions {
  title: string;
  data: ChartDatum[];
}

export function Chart(options: ChartOptions): HTMLElement {
  const section = createElement("section", "chart");
  const title = createElement("h3", "chart-title", options.title);
  section.appendChild(title);

  const safeData = options.data.slice(0, 12);
  const maxValue = safeData.reduce((max, item) => Math.max(max, item.value), 0) || 1;

  for (const datum of safeData) {
    const row = createElement("div", "chart-row");
    const label = createElement("div", "chart-label", datum.label);
    const barWrap = createElement("div", "chart-bar-wrap");
    const bar = createElement("div", "chart-bar");
    bar.style.width = `${Math.max(4, (datum.value / maxValue) * 100)}%`;
    bar.textContent = String(datum.value);
    barWrap.appendChild(bar);
    row.append(label, barWrap);
    section.appendChild(row);
  }

  if (safeData.length === 0) {
    section.appendChild(createElement("p", "empty-state", "No chart data available."));
  }

  return section;
}
