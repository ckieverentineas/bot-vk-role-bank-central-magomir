import { Keyboard } from "vk-io";

export enum InventoryType {
    ITEM_SHOP = "item_shop",
    ITEM_SHOP_ALLIANCE = "item_shop_alliance",
    // ... другие допустимые значения
}

export const button_alliance_return = Keyboard.builder().callbackButton({ label: '🌐 В ролевую', payload: { command: "system_call" }, color: 'primary' }).inline().oneTime()