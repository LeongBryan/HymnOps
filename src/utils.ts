import { differenceInCalendarWeeks, format, parseISO } from "date-fns";

export function formatDate(dateValue: string | null): string {
  if (!dateValue) return "Unknown";
  try {
    return format(parseISO(dateValue), "MMM d, yyyy");
  } catch {
    return dateValue;
  }
}

export function weeksSince(dateValue: string | null): number | null {
  if (!dateValue) return null;
  try {
    return Math.max(0, differenceInCalendarWeeks(new Date(), parseISO(dateValue)));
  } catch {
    return null;
  }
}

export function toTitleCase(input: string): string {
  return input
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  return element;
}
