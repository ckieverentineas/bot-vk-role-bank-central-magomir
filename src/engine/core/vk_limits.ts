export const VK_BUTTON_LABEL_MAX_LENGTH = 40;
export const VK_SNACKBAR_TEXT_MAX_LENGTH = 90;

const ELLIPSIS = "...";

function limitVkText(text: string, maxLength: number): string {
  if (maxLength < 1) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= ELLIPSIS.length) {
    return text.slice(0, maxLength);
  }

  return `${text.slice(0, maxLength - ELLIPSIS.length)}${ELLIPSIS}`;
}

export function limitVkButtonLabel(label: string): string {
  return limitVkText(label, VK_BUTTON_LABEL_MAX_LENGTH);
}

export function limitVkSnackbarText(text: string): string {
  return limitVkText(text, VK_SNACKBAR_TEXT_MAX_LENGTH);
}
