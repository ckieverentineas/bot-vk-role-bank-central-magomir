import {
  buildTransferItemLogSummary,
  parseItemIdsText,
  resolveTransferItemOwnership
} from "../src/engine/events/module/shop/alliance_shop_item_mass_helpers";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNumberArrayEqual(actual: readonly number[], expected: readonly number[]): void {
  const actualText = actual.join(",");
  const expectedText = expected.join(",");

  if (actualText !== expectedText) {
    throw new Error(`Expected [${expectedText}], got [${actualText}]`);
  }
}

const parsed = parseItemIdsText("12 34 12\n56\t78");

if (parsed.status !== "success") {
  throw new Error("Valid item ID text must be parsed successfully");
}

assertNumberArrayEqual(parsed.itemIds, [12, 34, 56, 78]);

const empty = parseItemIdsText("   ");

assert(empty.status === "error", "Empty item ID text must be rejected");

const withInvalidToken = parseItemIdsText("12 abc 34");

assert(withInvalidToken.status === "error", "Non-numeric item ID token must be rejected");

const withNonPositiveId = parseItemIdsText("12 0 -3");

assert(withNonPositiveId.status === "error", "Zero and negative item IDs must be rejected");

const directOwnership = resolveTransferItemOwnership({
  allianceId: 7,
  allianceCoinIds: [101, 102],
  itemCategoryId: 12,
  itemCoinId: 500,
  category: { id: 12, name: "Зелья" },
  shop: { allianceId: 7, name: "Лавка" }
});

assert(directOwnership.status === "owned", "Item from alliance category must belong to alliance");

if (directOwnership.status === "owned") {
  assert(!directOwnership.isLegacy, "Item from live alliance category must not be marked as legacy");
  assert(directOwnership.categoryName === "Зелья", "Live category name must be preserved");
  assert(directOwnership.shopName === "Лавка", "Live shop name must be preserved");
}

const legacyOwnership = resolveTransferItemOwnership({
  allianceId: 7,
  allianceCoinIds: [101, 102],
  itemCategoryId: 999,
  itemCoinId: 101,
  category: null,
  shop: null
});

assert(legacyOwnership.status === "owned", "Legacy item with alliance coin must belong to alliance");

if (legacyOwnership.status === "owned") {
  assert(legacyOwnership.isLegacy, "Legacy item ownership must be marked as legacy");
  assert(legacyOwnership.categoryName.includes("999"), "Legacy category name must include source category ID");
}

const foreignOwnership = resolveTransferItemOwnership({
  allianceId: 7,
  allianceCoinIds: [101, 102],
  itemCategoryId: 999,
  itemCoinId: 500,
  category: null,
  shop: null
});

assert(foreignOwnership.status === "foreign", "Item without category and alliance coin must be foreign");

const boundedSummary = buildTransferItemLogSummary(
  [
    { id: 1, name: "Очень длинный товар для проверки ограничения строки" },
    { id: 2, name: "Ещё один очень длинный товар для проверки ограничения строки" },
    { id: 3, name: "Третий очень длинный товар для проверки ограничения строки" }
  ],
  90
);

assert(boundedSummary.length <= 90, "Mass transfer log summary must respect provided max length");
assert(boundedSummary.includes("ещё"), "Trimmed mass transfer log summary must mention hidden item count");
