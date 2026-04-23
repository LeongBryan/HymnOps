import { createElement } from "../utils";

export interface ServiceWhatsappLine {
  title: string;
  key?: string | null;
}

function normalizeValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function buildServiceWhatsappMessage(lines: ServiceWhatsappLine[]): string {
  return lines
    .map(({ title, key }) => {
      const normalizedTitle = normalizeValue(title);
      if (!normalizedTitle) {
        return null;
      }

      const normalizedKey = normalizeValue(key);
      return normalizedKey ? `${normalizedTitle} - ${normalizedKey}` : normalizedTitle;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function openServiceWhatsappModal(title: string, message: string): void {
  const overlay = createElement("div", "modal-overlay") as HTMLDivElement;
  overlay.dataset.modalKind = "whatsapp-export";

  const modal = createElement("div", "modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = createElement("div", "modal-header");
  const heading = createElement("h2", undefined, title);
  const closeBtn = createElement("button", "button-secondary", "Close") as HTMLButtonElement;
  closeBtn.type = "button";
  header.append(heading, closeBtn);

  const helperText = createElement(
    "p",
    "copy-status",
    "Copy the text below into WhatsApp."
  );

  const textArea = document.createElement("textarea");
  textArea.className = "export-area";
  textArea.readOnly = true;
  textArea.value = message;

  const actions = createElement("div", "modal-actions");
  const copyBtn = createElement("button", "button-primary", "Copy") as HTMLButtonElement;
  copyBtn.type = "button";
  actions.appendChild(copyBtn);

  let isClosed = false;
  const close = () => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      close();
    }
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  closeBtn.addEventListener("click", close);
  copyBtn.addEventListener("click", async () => {
    textArea.focus();
    textArea.select();

    if (!navigator.clipboard?.writeText) {
      helperText.textContent = "Clipboard copy is not available here, but the text is selected.";
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
      helperText.textContent = "Copied to clipboard.";
    } catch {
      helperText.textContent = "Clipboard copy failed, but the text is selected.";
    }
  });

  modal.append(header, helperText, textArea, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKeyDown);

  requestAnimationFrame(() => {
    textArea.focus();
    textArea.select();
  });
}
