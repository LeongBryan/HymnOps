import { createElement } from "../utils";

export function Chip(label: string): HTMLElement {
  return createElement("span", "chip", label);
}
