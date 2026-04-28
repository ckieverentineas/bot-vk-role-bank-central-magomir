import {
  VK_BUTTON_LABEL_MAX_LENGTH,
  VK_SNACKBAR_TEXT_MAX_LENGTH,
  limitVkButtonLabel,
  limitVkSnackbarText
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
