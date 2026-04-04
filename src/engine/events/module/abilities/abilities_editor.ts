// engine/events/module/abilities/abilities_editor.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, chat_id } from "../../../..";
import { 
  Confirm_User_Success, 
  Send_Message_Question, 
  Send_Message_Smart,
  Send_Message
} from "../../../core/helper";
import { ico_list } from "../data_center/icons_lib";
import { getLevelName, deductAbilityCost, getAllianceLevels } from "./abilities_helper";
import { Fixed_Number_To_Five } from "../../../core/helper";

// Локальная версия карусели без лишних переносов
async function CompactCarouselSelector<T>(
  context: any, 
  prompt: string, 
  items: T[], 
  infoExtractor: (item: T) => Promise<string>, 
  labelExtractor: (item: T) => string, 
  payloadExtractor: (item: T, index: number) => any
): Promise<number | null> {
  let item_check = false;
  let item_sel: number | null = null;
  let id_builder_sent = 0;

  if (items.length > 0) {
    while (!item_check) {
      const keyboard = new KeyboardBuilder();
      id_builder_sent = await Fixed_Number_To_Five(id_builder_sent);
      let event_logger = `${ico_list['question'].ico} ${prompt}:\n`;
      const limiter = 5;

      if (items.length > 0) {
        let counter = 0;
        for (let i = id_builder_sent; i < items.length && counter < limiter; i++) {
          const item = items[i];
          const label = labelExtractor(item);
          const payload = payloadExtractor(item, i);
          const info = await infoExtractor(item);
          keyboard.textButton({ label, payload, color: 'secondary' }).row();
          event_logger += `${info}\n`;
          counter++;
        }
        event_logger += `\n~~~~ ${Math.min(id_builder_sent + limiter, items.length)} из ${items.length} ~~~~`;

        if (items.length > limiter && id_builder_sent > limiter - 1) {
          keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'item_control_multi', id_item_sent: id_builder_sent - limiter }, color: 'secondary' });
        }
        if (items.length > limiter && id_builder_sent < items.length - limiter) {
          keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'item_control_multi', id_item_sent: id_builder_sent + limiter }, color: 'secondary' });
        }
      } else {
        event_logger = `${ico_list['warn'].ico} У вас еще нет элементов.`;
      }

      const answer: any = await context.question(event_logger, { keyboard: keyboard.inline(), answerTimeLimit });

      if (answer.isTimeout) {
        await context.send(`${ico_list['time'].ico} Время ожидания выбора элемента истекло!`);
        return null;
      }

      if (!answer.payload) {
        await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`);
      } else {
        if (answer.text === `${ico_list['next'].ico}` || answer.text === `${ico_list['back'].ico}`) {
          id_builder_sent = answer.payload.id_item_sent;
        } else {
          item_sel = answer.payload.id_item;
          item_check = true;
        }
      }
    }
  }
  return item_sel;
}

/**
 * Редактирование способностей персонажа (для админа через !опсоло)
 */
export async function UserAbilities_Editor(context: any, userId: number, user_adm: any) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) {
    await context.send(`${ico_list['warn'].ico} Пользователь не найден!`);
    return;
  }

  const allianceId = user.id_alliance;
  if (!allianceId || allianceId <= 0) {
    await context.send(`${ico_list['warn'].ico} Персонаж не состоит в альянсе!`);
    return;
  }

  // Получаем все уровни альянса
  const levels = await getAllianceLevels(allianceId);
  if (levels.length === 0) {
    await context.send(`${ico_list['warn'].ico} В альянсе не настроены уровни! Сначала настройте уровни через !уровни настроить`);
    return;
  }

  // ========== ШАГ 1: ВЫБОР КАТЕГОРИИ ==========
  const categoriesList = await prisma.abilityCategory.findMany({
    where: { allianceId, hidden: false },
    orderBy: { name: 'asc' }
  });

  if (categoriesList.length === 0) {
    await context.send(`${ico_list['warn'].ico} В альянсе нет категорий способностей!`);
    return;
  }

  const selectedCategoryId = await CompactCarouselSelector(
    context,
    `Выберите категорию способностей для персонажа ${user.name} (UID: ${user.id})`,
    categoriesList,
    async (item) => `📁 ${item.name}`,
    (item) => item.name,
    (item, index) => ({ 
      command: 'select_ability_category', 
      id_item_sent: index, 
      id_item: item.id 
    })
  );

  if (!selectedCategoryId) {
    await context.send(`${ico_list['stop'].ico} Выбор категории отменен.`);
    return;
  }

  // ========== ШАГ 2: ПОЛУЧАЕМ СПОСОБНОСТИ ВЫБРАННОЙ КАТЕГОРИИ ==========
  const category = await prisma.abilityCategory.findFirst({
    where: { id: selectedCategoryId, allianceId },
    include: {
      abilities: {
        where: { hidden: false },
        include: {
          currency: true
        },
        orderBy: { name: 'asc' }
      }
    }
  });

  if (!category || category.abilities.length === 0) {
    await context.send(`${ico_list['warn'].ico} В выбранной категории нет способностей!`);
    return;
  }

  // Собираем способности в список
  const allAbilities: any[] = [];
  for (const ability of category.abilities) {
    allAbilities.push({
      id: ability.id,
      name: ability.name,
      description: ability.description,
      categoryId: ability.categoryId,
      categoryName: category.name,
      currencyId: ability.currencyId,
      currency: ability.currency,
      prices: ability.prices,
      maxLevelId: ability.maxLevelId,
      order: ability.order,
      hidden: ability.hidden
    });
  }

  // Получаем текущие способности пользователя
  const userAbilities = await prisma.userAbility.findMany({
    where: { userId: user.id }
  });
  const userAbilityMap = new Map(userAbilities.map(ua => [ua.abilityId, ua.levelId]));

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 7;

  while (!exit) {
    const pageAbilities = allAbilities.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalAbilities = allAbilities.length;
    const totalPages = Math.ceil(totalAbilities / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Способности персонажа ${user.name} (UID: ${user.id}) в категории "${category.name}":\n\n`;
    text += `✅ — есть способность, ❌ — нет\n`;
    text += `💰 Валюта: ${category.abilities[0]?.currency?.smile || '?'}\n\n`;

    for (let i = 0; i < pageAbilities.length; i++) {
      const ability = pageAbilities[i];
      const hasAbility = userAbilityMap.has(ability.id);
      const currentLevelId = userAbilityMap.get(ability.id);
      const currentLevelName = currentLevelId ? await getLevelName(currentLevelId) : "—";
      
      text += `${hasAbility ? '✅' : '❌'} ${ability.name}`;
      if (hasAbility) {
        text += `: ${currentLevelName}`;
      }
      text += `\n`;
    }

    text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    text += `💡 Нажмите на способность, чтобы добавить/удалить.`;

    const keyboard = new KeyboardBuilder();

    for (const ability of pageAbilities) {
      const hasAbility = userAbilityMap.has(ability.id);
      const label = `${hasAbility ? '🔄' : '➕'} ${ability.name.slice(0, 25)}`;
      
      keyboard.textButton({
        label: label,
        payload: { 
          command: 'edit_user_ability', 
          abilityId: ability.id, 
          hasAbility,
          userId: user.id,
          cursor,
          abilityName: ability.name,
          currencySmile: ability.currency.smile,
          currencyId: ability.currencyId,
          categoryId: selectedCategoryId
        },
        color: hasAbility ? 'secondary' : 'positive'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `←`,
        payload: { command: 'abilities_editor_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE), categoryId: selectedCategoryId },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalAbilities) {
      keyboard.textButton({
        label: `→`,
        payload: { command: 'abilities_editor_next', cursor: cursor + ITEMS_PER_PAGE, categoryId: selectedCategoryId },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalAbilities) {
      keyboard.row();
    }

    keyboard.textButton({
      label: `🔙 Выбрать другую категорию`,
      payload: { command: 'abilities_back_to_categories', userId: user.id },
      color: 'secondary'
    }).row();

    const response = await Send_Message_Question(context, text, keyboard.oneTime());

    if (response.exit) {
      exit = true;
      continue;
    }

    if (!response.payload) continue;

    const payload = response.payload;

    if (payload.command === 'edit_user_ability') {
      await handleEditUserAbility(
        context, 
        payload.abilityId, 
        payload.hasAbility,
        payload.userId,
        payload.cursor,
        payload.abilityName,
        payload.currencySmile,
        payload.currencyId,
        user_adm,
        user,
        levels,
        category.name
      );
      // Обновляем карту после изменений
      const updatedUserAbilities = await prisma.userAbility.findMany({
        where: { userId: user.id }
      });
      userAbilityMap.clear();
      updatedUserAbilities.forEach(ua => userAbilityMap.set(ua.abilityId, ua.levelId));
    } else if (payload.command === 'abilities_editor_prev') {
      cursor = payload.cursor;
    } else if (payload.command === 'abilities_editor_next') {
      cursor = payload.cursor;
    } else if (payload.command === 'abilities_back_to_categories') {
      await UserAbilities_Editor(context, userId, user_adm);
      exit = true;
    }
  }
}

/**
 * Обработка добавления/удаления/изменения уровня способности
 */
async function handleEditUserAbility(
  context: any,
  abilityId: number,
  hasAbility: boolean,
  userId: number,
  cursor: number,
  abilityName: string,
  currencySmile: string,
  currencyId: number,
  user_adm: any,
  targetUser: any,
  levels: any[],
  categoryName: string
) {
  const ability = await prisma.ability.findFirst({
    where: { id: abilityId },
    include: { currency: true, category: true }
  });
  if (!ability) {
    await context.send(`❌ Способность не найдена!`);
    return;
  }

  const prices: Record<number, number> = ability.prices ? JSON.parse(ability.prices) : {};

  if (hasAbility) {
    // ===== УДАЛЕНИЕ СПОСОБНОСТИ =====
    
    // Получаем текущий уровень перед удалением
    const currentUserAbility = await prisma.userAbility.findFirst({
      where: { userId: targetUser.id, abilityId: ability.id }
    });
    const currentLevelName = currentUserAbility?.levelId ? await getLevelName(currentUserAbility.levelId) : '?';
    
    const confirm = await Confirm_User_Success(
      context,
      `удалить способность "${ability.name}" (${currentLevelName}) у игрока ${targetUser.name}?\n\n` +
      `⚠️ ВНИМАНИЕ! Уровень способности будет сброшен, средства НЕ возвращаются!`
    );
    
    if (!confirm.status) {
      await context.send(`❌ Удаление отменено.`);
      return;
    }
    
    await prisma.userAbility.deleteMany({
      where: { userId: targetUser.id, abilityId: ability.id }
    });
    
    // Уведомление игроку об удалении
    await Send_Message(
      targetUser.idvk,
      `❌ ${targetUser.name} (UID: ${targetUser.id}), у вас удалена способность "${ability.name}" уровня ${currentLevelName}!\n` +
      `📁 Категория: "${categoryName}"\n` +
      `Уровень способности сброшен.`
    );
    
    // Логируем в чат ролевой
    const alliance = await prisma.alliance.findFirst({ where: { id: targetUser.id_alliance ?? 0 } });
    const deleteLogMessage = `❌ @id${user_adm.idvk}(${user_adm.name}) удалил способность "${ability.name}" (${currentLevelName}) из категории "${categoryName}" у игрока @id${targetUser.idvk}(${targetUser.name}) (UID: ${targetUser.id})`;
    
    if (alliance?.id_chat && alliance.id_chat > 0) {
      await Send_Message(alliance.id_chat, deleteLogMessage);
    } else {
      await Send_Message(chat_id, deleteLogMessage);
    }
    
    await context.send(`✅ Способность "${ability.name}" удалена у игрока ${targetUser.name}`);
    
  } else {
    // ===== ДОБАВЛЕНИЕ СПОСОБНОСТИ =====
    
    // Фильтруем уровни, для которых есть цены
    const availableLevels = levels.filter(level => prices[level.id] !== undefined);
    
    if (availableLevels.length === 0) {
      await context.send(`❌ Для способности "${ability.name}" не настроены цены! Сначала настройте цены в админ-меню.`);
      return;
    }
    
    // Показываем выбор уровня
    const levelKeyboard = new KeyboardBuilder();
    for (const level of availableLevels) {
      const price = prices[level.id];
      levelKeyboard.textButton({
        label: `${level.name} — ${price}${ability.currency.smile}`,
        payload: { 
          command: 'select_ability_level', 
          targetLevelId: level.id, 
          price,
          abilityId: ability.id,
          abilityName: ability.name,
          currencySmile: ability.currency.smile,
          currencyId: ability.currencyId,
          categoryName: categoryName
        },
        color: 'secondary'
      }).row();
    }
    levelKeyboard.textButton({ label: '🚫 Отмена', payload: { command: 'cancel' }, color: 'negative' });
    
    const levelAnswer = await context.question(
      `⚡ Выберите уровень для способности "${ability.name}":\n\n` +
      `💰 Валюта: ${ability.currency.smile} ${ability.currency.name}\n` +
      `👤 Игрок: ${targetUser.name} (UID: ${targetUser.id})`,
      { keyboard: levelKeyboard.oneTime().inline(), answerTimeLimit }
    );
    
    if (levelAnswer.isTimeout || levelAnswer.payload?.command === 'cancel') {
      await context.send(`❌ Добавление способности отменено.`);
      return;
    }
    
    const { targetLevelId, price, abilityId: selectedAbilityId, currencyId: selectedCurrencyId } = levelAnswer.payload;
    
    // Проверяем цену
    if (price > 0) {
      const confirm = await Confirm_User_Success(
        context,
        `добавить способность "${ability.name}" уровня ${await getLevelName(targetLevelId)} игроку ${targetUser.name}?\n\n` +
        `💰 Стоимость: ${price}${ability.currency.smile}\n` +
        `💳 Средства будут списаны со счета игрока!`
      );
      
      if (!confirm.status) {
        await context.send(`❌ Добавление отменено.`);
        return;
      }
      
      // Списываем средства
      const success = await deductAbilityCost(targetUser.id, selectedCurrencyId, price, context);
      if (!success) {
        await context.send(`❌ Недостаточно средств у игрока ${targetUser.name}!`);
        return;
      }
      
      await context.send(`💰 Списано: ${price}${ability.currency.smile} со счета ${targetUser.name}`);
    } else {
      const confirm = await Confirm_User_Success(
        context,
        `добавить способность "${ability.name}" уровня ${await getLevelName(targetLevelId)} игроку ${targetUser.name}? (БЕСПЛАТНО)`
      );
      if (!confirm.status) {
        await context.send(`❌ Добавление отменено.`);
        return;
      }
    }
    
    // Добавляем способность
    await prisma.userAbility.create({
      data: { 
        userId: targetUser.id, 
        abilityId: selectedAbilityId, 
        levelId: targetLevelId 
      }
    });

    // Получаем баланс пользователя для отображения
    const balance = await prisma.balanceCoin.findFirst({
      where: { id_coin: ability.currencyId, id_user: targetUser.id }
    });

    // Уведомление игроку о выдаче способности
    let userNotification = `⚡ ${targetUser.name} (UID: ${targetUser.id}), вам выдана способность "${ability.name}" уровня ${await getLevelName(targetLevelId)}!\n` +
      `📁 Категория: "${categoryName}"\n`;

    if (price > 0 && balance) {
      const oldBalance = balance.amount + price;
      userNotification += `💰 Списано: ${price}${ability.currency.smile}\n💬 ${oldBalance} - ${price} = ${balance.amount}${ability.currency.smile}`;
    } else if (price > 0) {
      userNotification += `💰 Списано: ${price}${ability.currency.smile}`;
    } else {
      userNotification += `💰 Бесплатно`;
    }

    await Send_Message(targetUser.idvk, userNotification);

    // Логируем в чат ролевой
    const alliance = await prisma.alliance.findFirst({ where: { id: targetUser.id_alliance ?? 0 } });
    let logMessage = `⚡ @id${user_adm.idvk}(${user_adm.name}) добавил способность "${ability.name}" (${await getLevelName(targetLevelId)}) из категории "${categoryName}" игроку @id${targetUser.idvk}(${targetUser.name}) (UID: ${targetUser.id})`;

    if (price > 0 && balance) {
      const oldBalance = balance.amount + price;
      logMessage += `\n💰 ${ability.currency.smile} ${ability.currency.name}: ${oldBalance} - ${price} = ${balance.amount}`;
    } else if (price > 0) {
      logMessage += `\n💰 Списано: ${price}${ability.currency.smile}`;
    } else {
      logMessage += `\n💰 Бесплатно`;
    }

    if (alliance?.id_chat && alliance.id_chat > 0) {
      await Send_Message(alliance.id_chat, logMessage);
    } else {
      await Send_Message(chat_id, logMessage);
    }

    await context.send(`✅ Способность "${ability.name}" (${await getLevelName(targetLevelId)}) добавлена игроку ${targetUser.name}`);
  }
}