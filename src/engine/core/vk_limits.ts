export const VK_BUTTON_LABEL_MAX_LENGTH = 40;
export const VK_SNACKBAR_TEXT_MAX_LENGTH = 90;
export const VK_MESSAGE_MAX_LENGTH = 3900;

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

export function splitVkMessage(message: string, maxLength: number = VK_MESSAGE_MAX_LENGTH): string[] {
  if (maxLength < 1) {
    return [];
  }

  if (message.length <= maxLength) {
    return [message];
  }

  const parts: string[] = [];
  const lines = message.split("\n");
  let currentPart = "";

  for (const line of lines) {
    if (canAppendLine(currentPart, line, maxLength)) {
      currentPart = appendLine(currentPart, line);
      continue;
    }

    if (currentPart.length > 0) {
      parts.push(currentPart);
      currentPart = "";
    }

    if (line.length <= maxLength) {
      currentPart = line;
      continue;
    }

    const lineParts = splitLongLine(line, maxLength);
    parts.push(...lineParts.slice(0, -1));
    currentPart = lineParts[lineParts.length - 1] ?? "";
  }

  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  return parts;
}

function canAppendLine(currentPart: string, line: string, maxLength: number): boolean {
  const separatorLength = currentPart.length > 0 ? 1 : 0;

  return currentPart.length + separatorLength + line.length <= maxLength;
}

function appendLine(currentPart: string, line: string): string {
  if (currentPart.length === 0) {
    return line;
  }

  return `${currentPart}\n${line}`;
}

function splitLongLine(line: string, maxLength: number): string[] {
  const parts: string[] = [];

  for (let start = 0; start < line.length; start += maxLength) {
    parts.push(line.slice(start, start + maxLength));
  }

  return parts;
}
