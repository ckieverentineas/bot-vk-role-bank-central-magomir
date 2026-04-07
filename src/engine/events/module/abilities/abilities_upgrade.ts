// engine/events/module/abilities/abilities_upgrade.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { 
  Send_Message
} from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";
import { getLevelName, getAbilityPrice, getAllianceLevels } from "./abilities_helper";

/**
 * Меню прокачки способностей для игрока
 * Вызывается из главного меню (кнопка ⚡ Прокачка)
 */
export async function Abilities_Upgrade_Menu(context: any) {
  // Получаем cursor из payload, если есть
  let cursor = context.eventPayload?.cursor || 0;
  
  const user = await Person_Get(context);
  if (!user) return;

  const allianceId = user.id_alliance;
  if (!allianceId || allianceId <= 0) {
    await Send_Message(context.peerId, `${ico_list['warn'].ico} Вы не состоите в ролевой!`);
    return;
  }

  const levels = await getAllianceLevels(allianceId);
  if (levels.length === 0) {
    await Send_Message(context.peerId, `${ico_list['warn'].ico} В ролевой не настроены уровни!`);
    return;
  }

  const userAbilities = await prisma.userAbility.findMany({
    where: { userId: user.id },
    include: {
      ability: {
        include: {
          currency: true,
          category: true
        }
      }
    }
  });

  if (userAbilities.length === 0) {
    await Send_Message(
      context.peerId,
      `⚡ У вашего персонажа пока нет способностей.\nОбратитесь к администратору ролевой.`
    );
    return;
  }

  // Формируем список прокачиваемых способностей
  const upgradable: any[] = [];

  for (const ua of userAbilities) {
    const ability = ua.ability;
    const currentLevelId = ua.levelId;
    const maxLevelId = ability.maxLevelId;
    
    if (!maxLevelId) continue;
    
    // Проверяем, достигнут ли максимальный уровень
    const maxLevel = levels.find(l => l.id === maxLevelId);
    const currentLevel = levels.find(l => l.id === currentLevelId);
    
    if (currentLevel && maxLevel && currentLevel.order >= maxLevel.order) {
      continue; // Пропускаем, если уже максимальный уровень
    }
    
    const currentLevelIndex = levels.findIndex(l => l.id === currentLevelId);
    const nextLevel = levels[currentLevelIndex + 1];
    
    if (!nextLevel) continue;
    
    // Дополнительная проверка: если следующий уровень имеет order <= текущего
    if (currentLevel && nextLevel.order <= currentLevel.order) {
      continue;
    }
    
    const price = await getAbilityPrice(ability.id, nextLevel.id);
    if (price === undefined || price === null) continue;
    
    upgradable.push({
      abilityId: ability.id,
      abilityName: ability.name,
      categoryName: ability.category.name,
      categoryId: ability.categoryId,
      currentLevelId,
      currentLevelName: await getLevelName(currentLevelId),
      nextLevelId: nextLevel.id,
      nextLevelName: nextLevel.name,
      price,
      currencyId: ability.currencyId,
      currencySmile: ability.currency.smile,
      currencyName: ability.currency.name
    });
  }

  // Сортировка по категориям и алфавиту внутри категории
  upgradable.sort((a, b) => {
    if (a.categoryName !== b.categoryName) {
      return a.categoryName.localeCompare(b.categoryName);
    }
    return a.abilityName.localeCompare(b.abilityName);
  });

  if (upgradable.length === 0) {
    let abilitiesList = '';
    for (const ua of userAbilities) {
      const levelName = ua.levelId ? levels.find(l => l.id === ua.levelId)?.name || '?' : '?';
      abilitiesList += `  • ${ua.ability.name}: ${levelName}\n`;
    }
    await Send_Message(
      context.peerId,
      `⚡ Все ваши способности имеют максимальный уровень!\n\nВаши способности:\n${abilitiesList}`
    );
    return;
  }

  const ITEMS_PER_PAGE = 5;
  const totalItems = upgradable.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  // Ограничиваем cursor допустимыми значениями
  if (cursor >= totalItems) cursor = 0;
  if (cursor < 0) cursor = 0;
  
  const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;
  const pageUpgradable = upgradable.slice(cursor, cursor + ITEMS_PER_PAGE);

  let text = `${ico_list['config'].ico} Прокачка способностей:\n\n`;
  
  // Показываем балансы валют
  const uniqueCurrencyIds: number[] = [];
  for (const item of pageUpgradable) {
    if (!uniqueCurrencyIds.includes(item.currencyId)) {
      uniqueCurrencyIds.push(item.currencyId);
    }
  }
  
  text += `💰 Ваш баланс:\n`;
  for (const currencyId of uniqueCurrencyIds) {
    const item = pageUpgradable.find(i => i.currencyId === currencyId);
    if (item) {
      const balance = await prisma.balanceCoin.findFirst({
        where: { id_coin: currencyId, id_user: user.id }
      });
      text += `  ${item.currencySmile} ${item.currencyName}: ${balance?.amount || 0}\n`;
    }
  }
  text += `\n`;

  let currentCategory = '';
  for (let i = 0; i < pageUpgradable.length; i++) {
    const item = pageUpgradable[i];
    
    // Показываем категорию отдельной строкой
    if (item.categoryName !== currentCategory) {
      currentCategory = item.categoryName;
      text += `\n📁 ${currentCategory}:\n`;
    }
    
    text += `⚡ ${item.abilityName}: ${item.currentLevelName} → ${item.nextLevelName} (${item.price}${item.currencySmile})\n`;
  }

  text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
  text += `💡 Нажмите на кнопку способности для прокачки`;

  const keyboard = new KeyboardBuilder();

  for (let i = 0; i < pageUpgradable.length; i++) {
    const item = pageUpgradable[i];
    
    keyboard.callbackButton({
      label: `⬆️ ${item.abilityName.slice(0, 25)} → ${item.nextLevelName.slice(0, 15)} (${item.price}${item.currencySmile})`,
      payload: { 
        command: 'do_upgrade_action',
        abilityId: item.abilityId,
        nextLevelId: item.nextLevelId,
        price: item.price,
        currencyId: item.currencyId,
        currencySmile: item.currencySmile,
        abilityName: item.abilityName,
        nextLevelName: item.nextLevelName,
        categoryName: item.categoryName,
        cursor: cursor,
        page: currentPage
      },
      color: 'secondary'
    }).row();
  }

  // Навигация
  if (cursor > 0) {
    keyboard.callbackButton({
      label: `←`,
      payload: { 
        command: 'upgrade_prev_action', 
        cursor: Math.max(0, cursor - ITEMS_PER_PAGE)
      },
      color: 'secondary'
    });
  }
  if (cursor + ITEMS_PER_PAGE < totalItems) {
    keyboard.callbackButton({
      label: `→`,
      payload: { 
        command: 'upgrade_next_action', 
        cursor: cursor + ITEMS_PER_PAGE
      },
      color: 'secondary'
    });
  }
  if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalItems) {
    keyboard.row();
  }

  keyboard.callbackButton({ 
    label: '🚫 Выход', 
    payload: { 
      command: 'upgrade_exit_action',
      cmid: context.conversationMessageId
    }, 
    color: 'secondary' 
  }).row();

  await Send_Message(context.peerId, text, keyboard);
}