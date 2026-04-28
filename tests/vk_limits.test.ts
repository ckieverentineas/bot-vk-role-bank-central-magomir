import {
  VK_BUTTON_LABEL_MAX_LENGTH,
  VK_MESSAGE_MAX_LENGTH,
  VK_SNACKBAR_TEXT_MAX_LENGTH,
  limitVkButtonLabel,
  limitVkSnackbarText,
  splitVkMessage
} from "../src/engine/core/vk_limits";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Expected "${expected}", got "${actual}"`);
  }
}

const longUpgradeLabel =
  `⬆️ ${"Очень длинная способность персонажа"} → ` +
  `${"Максимально длинный уровень"} (123456🪙)`;

const limitedUpgradeLabel = limitVkButtonLabel(longUpgradeLabel);

assert(
  limitedUpgradeLabel.length <= VK_BUTTON_LABEL_MAX_LENGTH,
  `Button label length must be ${VK_BUTTON_LABEL_MAX_LENGTH} or less, got ${limitedUpgradeLabel.length}`
);
assert(limitedUpgradeLabel.endsWith("..."), "Long button label must end with ellipsis");

const exactButtonLabel = "x".repeat(VK_BUTTON_LABEL_MAX_LENGTH);
assertEqual(limitVkButtonLabel(exactButtonLabel), exactButtonLabel);

const longSnackbarText = `🔔 ${"Слишком длинное уведомление ".repeat(8)}`;
const limitedSnackbarText = limitVkSnackbarText(longSnackbarText);

assert(
  limitedSnackbarText.length <= VK_SNACKBAR_TEXT_MAX_LENGTH,
  `Snackbar text length must be ${VK_SNACKBAR_TEXT_MAX_LENGTH} or less, got ${limitedSnackbarText.length}`
);
assert(limitedSnackbarText.endsWith("..."), "Long snackbar text must end with ellipsis");

const shortSnackbarText = "🔔 Готово";
assertEqual(limitVkSnackbarText(shortSnackbarText), shortSnackbarText);

const longHelpText = [
  "☠ Меню помощи Спектр-3001:",
  "x".repeat(30),
  "y".repeat(30),
  "z".repeat(30)
].join("\n");

const helpParts = splitVkMessage(longHelpText, 40);

assert(helpParts.length > 1, "Long help text must be split into several VK messages");
assert(
  helpParts.every((part) => part.length <= 40),
  "Every split message part must fit the provided length limit"
);
assertEqual(helpParts.join("\n"), longHelpText);

const defaultParts = splitVkMessage("a".repeat(VK_MESSAGE_MAX_LENGTH + 1));
assert(
  defaultParts.every((part) => part.length <= VK_MESSAGE_MAX_LENGTH),
  "Every split message part must fit VK message default length limit"
);
