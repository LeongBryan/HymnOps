import { createElement } from "../utils";

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => string;
}

export function Table<T extends Record<string, unknown>>(columns: TableColumn<T>[], rows: T[]): HTMLElement {
  const wrapper = createElement("div", "table-wrap");
  const table = createElement("table", "data-table");
  const thead = createElement("thead");
  const headRow = createElement("tr");
  for (const column of columns) {
    const th = createElement("th", undefined, column.label);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = createElement("tbody");
  for (const row of rows) {
    const tr = createElement("tr");
    for (const column of columns) {
      const td = createElement("td");
      const value = row[column.key];
      td.textContent = column.render ? column.render(value, row) : String(value ?? "");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  if (rows.length === 0) {
    const tr = createElement("tr");
    const td = createElement("td", "table-empty", "No data");
    td.colSpan = Math.max(1, columns.length);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}
