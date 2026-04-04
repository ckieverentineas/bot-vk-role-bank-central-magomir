import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { 
  Confirm_User_Success, 
  Input_Text, 
  Input_Number,
  Send_Message_Question, 
  Send_Message_Smart,
  Select_Alliance_Coin
} from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";
import { getAllianceLevels } from "./abilities_helper";

// ===================== УПРАВЛЕНИЕ КАТЕГОРИЯМИ СПОСОБНОСТЕЙ =====================

export async function Abilities_Admin_Menu(context: any) {
  const user = await Person_Get(context);
  if (!user || !user.id_alliance || user.id_alliance <= 0) {
    await context.send(`${ico_list['warn'].ico} Вы не состоите в альянсе!`);
    return;
  }

  const alliance = await prisma.alliance.findFirst({
    where: { id: user.id_alliance }
  });
  if (!alliance) {
    await context.send(`${ico_list['warn'].ico} Альянс не найден!`);
    return;
  }

  // Проверяем, есть ли уровни
  const levelsCount = await prisma.skillLevel.count({
    where: { allianceId: alliance.id }
  });
  if (levelsCount === 0) {
    await context.send(
      `${ico_list['warn'].ico} Сначала настройте уровни навыков!\n\n` +
      `Без уровней нельзя создавать способности.`
    );
    return;
  }

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 5;

  while (!exit) {
    const categories = await prisma.abilityCategory.findMany({
      where: { allianceId: alliance.id },
      orderBy: { order: 'asc' }
    });

    const totalCategories = categories.length;
    const pageCategories = categories.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalCategories / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Управление категориями способностей для "${alliance.name}":\n\n`;
    
    if (categories.length === 0) {
      text += "📭 Нет категорий способностей.\n\n";
      text += "➕ Создайте первую категорию (например: Боевые, Защитные, Исцеляющие)\n\n";
    } else {
      text += "📊 Существующие категории:\n\n";
      for (let i = 0; i < pageCategories.length; i++) {
        const cat = pageCategories[i];
        const itemNumber = cursor + i + 1;
        text += `${itemNumber}. 📁 ${cat.name} ${cat.hidden ? '(скрыта)' : ''}\n`;
      }
      text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    }

    text += `💡 Категории нужны для группировки способностей.`;

    const keyboard = new KeyboardBuilder();

    // Кнопки категорий
    for (const cat of pageCategories) {
      keyboard.textButton({
        label: `📁 ${cat.name.slice(0, 25)}`,
        payload: { command: 'ability_category_select', categoryId: cat.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: `✏️`,
        payload: { command: 'ability_category_edit', categoryId: cat.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: cat.hidden ? `👁️` : `🚫`,
        payload: { command: 'ability_category_toggle_hide', categoryId: cat.id, cursor },
        color: cat.hidden ? 'positive' : 'negative'
      });
      keyboard.textButton({
        label: `❌`,
        payload: { command: 'ability_category_delete', categoryId: cat.id, cursor },
        color: 'negative'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `← Назад`,
        payload: { command: 'ability_categories_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalCategories) {
      keyboard.textButton({
        label: `Вперед →`,
        payload: { command: 'ability_categories_next', cursor: cursor + ITEMS_PER_PAGE },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalCategories) {
      keyboard.row();
    }

    // Кнопка создания
    keyboard.textButton({
      label: `➕ Создать категорию`,
      payload: { command: 'ability_category_create', cursor },
      color: 'positive'
    }).row();

    const response = await Send_Message_Question(context, text, keyboard.oneTime());

    if (response.exit) {
      exit = true;
      continue;
    }

    if (!response.payload) {
      continue;
    }

    const payload = response.payload;

    switch (payload.command) {
      case 'ability_category_select':
        await Abilities_In_Category_Manager(context, payload.categoryId, payload.cursor);
        break;
      case 'ability_category_edit':
        await editAbilityCategory(context, payload.categoryId, alliance.id, payload.cursor);
        break;
      case 'ability_category_toggle_hide':
        await toggleAbilityCategoryHide(context, payload.categoryId, alliance.id, payload.cursor);
        break;
      case 'ability_category_delete':
        await deleteAbilityCategory(context, payload.categoryId, alliance.id, payload.cursor);
        break;
      case 'ability_category_create':
        await createAbilityCategory(context, alliance.id, payload.cursor);
        break;
      case 'ability_categories_prev':
        cursor = payload.cursor;
        break;
      case 'ability_categories_next':
        cursor = payload.cursor;
        break;
    }
  }
}

// ===================== УПРАВЛЕНИЕ СПОСОБНОСТЯМИ В КАТЕГОРИИ =====================

async function Abilities_In_Category_Manager(context: any, categoryId: number, parentCursor: number) {
  const user = await Person_Get(context);
  if (!user || !user.id_alliance || user.id_alliance <= 0) return;

  const category = await prisma.abilityCategory.findFirst({
    where: { id: categoryId, allianceId: user.id_alliance }
  });
  if (!category) {
    await context.send(`${ico_list['warn'].ico} Категория не найдена!`);
    return;
  }

  // Получаем уровни для выбора максимального
  const levels = await getAllianceLevels(user.id_alliance);

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 5;

  while (!exit) {
    const abilities = await prisma.ability.findMany({
      where: { categoryId },
      include: { currency: true },
      orderBy: { order: 'asc' }
    });

    const totalAbilities = abilities.length;
    const pageAbilities = abilities.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalAbilities / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Управление способностями в категории "${category.name}":\n\n`;
    
    if (abilities.length === 0) {
      text += "📭 Нет способностей в этой категории.\n\n";
      text += "➕ Создайте первую способность\n\n";
    } else {
      text += "📊 Существующие способности:\n\n";
      for (let i = 0; i < pageAbilities.length; i++) {
        const ability = pageAbilities[i];
        const itemNumber = cursor + i + 1;
        const prices = ability.prices ? Object.keys(JSON.parse(ability.prices)).length : 0;
        text += `${itemNumber}. ⚡ ${ability.name} ${ability.hidden ? '(скрыта)' : ''} (${prices} уровней настроено)\n`;
      }
      text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    }

    text += `💡 Для каждой способности нужно настроить цены за уровни.`;

    const keyboard = new KeyboardBuilder();

    // Кнопки способностей
    for (const ability of pageAbilities) {
      keyboard.textButton({
        label: `⚡ ${ability.name.slice(0, 25)}`,
        payload: { command: 'ability_edit', abilityId: ability.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: `💰`,
        payload: { command: 'ability_set_prices', abilityId: ability.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: ability.hidden ? `👁️` : `🚫`,
        payload: { command: 'ability_toggle_hide', abilityId: ability.id, cursor },
        color: ability.hidden ? 'positive' : 'negative'
      });
      keyboard.textButton({
        label: `❌`,
        payload: { command: 'ability_delete', abilityId: ability.id, cursor },
        color: 'negative'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `← Назад`,
        payload: { command: 'abilities_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalAbilities) {
      keyboard.textButton({
        label: `Вперед →`,
        payload: { command: 'abilities_next', cursor: cursor + ITEMS_PER_PAGE },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalAbilities) {
      keyboard.row();
    }

    // Кнопка создания
    keyboard.textButton({
      label: `➕ Создать способность`,
      payload: { command: 'ability_create', cursor },
      color: 'positive'
    }).row();

    // Кнопка назад к категориям
    keyboard.textButton({
      label: `← Назад к категориям`,
      payload: { command: 'back_to_categories', cursor: parentCursor },
      color: 'secondary'
    }).row();

    const response = await Send_Message_Question(context, text, keyboard.oneTime());

    if (response.exit) {
      exit = true;
      continue;
    }

    if (!response.payload) {
      continue;
    }

    const payload = response.payload;

    switch (payload.command) {
      case 'ability_edit':
        await editAbility(context, payload.abilityId, user.id_alliance, levels, payload.cursor);
        break;
      case 'ability_set_prices':
        await setupAbilityPrices(context, payload.abilityId, levels, payload.cursor);
        break;
      case 'ability_toggle_hide':
        await toggleAbilityHide(context, payload.abilityId, payload.cursor);
        break;
      case 'ability_delete':
        await deleteAbility(context, payload.abilityId, payload.cursor);
        break;
      case 'ability_create':
        await createAbility(context, categoryId, user.id_alliance, levels, payload.cursor);
        break;
      case 'abilities_prev':
        cursor = payload.cursor;
        break;
      case 'abilities_next':
        cursor = payload.cursor;
        break;
      case 'back_to_categories':
        exit = true;
        break;
    }
  }
}

// ===================== ФУНКЦИИ ДЛЯ КАТЕГОРИЙ =====================

async function createAbilityCategory(context: any, allianceId: number, cursor: number) {
  const name = await Input_Text(context, `Введите название категории способностей (например: "Боевые", "Защитные"):`, 50);
  if (!name) return;

  const existing = await prisma.abilityCategory.findFirst({
    where: { allianceId, name }
  });
  if (existing) {
    await context.send(`${ico_list['warn'].ico} Категория с названием "${name}" уже существует!`);
    return;
  }

  const orderCount = await prisma.abilityCategory.count({ where: { allianceId } });

  const newCategory = await prisma.abilityCategory.create({
    data: { allianceId, name, order: orderCount }
  });

  await Send_Message_Smart(
    context,
    `Создана категория способностей: "${newCategory.name}"`,
    'admin_solo'
  );
}

async function editAbilityCategory(context: any, categoryId: number, allianceId: number, cursor: number) {
  const category = await prisma.abilityCategory.findFirst({
    where: { id: categoryId, allianceId }
  });
  if (!category) {
    await context.send(`${ico_list['warn'].ico} Категория не найдена!`);
    return;
  }

  const newName = await Input_Text(
    context,
    `Текущее название: "${category.name}"\nВведите новое название (или "пропустить"):`,
    50
  );
  if (newName && newName.toLowerCase() !== 'пропустить') {
    const existing = await prisma.abilityCategory.findFirst({
      where: { allianceId, name: newName, id: { not: categoryId } }
    });
    if (existing) {
      await context.send(`${ico_list['warn'].ico} Категория с названием "${newName}" уже существует!`);
      return;
    }
    await prisma.abilityCategory.update({
      where: { id: categoryId },
      data: { name: newName }
    });
    await context.send(`✅ Название категории изменено на "${newName}"`);
  }

  await context.send(`${ico_list['save'].ico} Изменения сохранены.`);
}

async function toggleAbilityCategoryHide(context: any, categoryId: number, allianceId: number, cursor: number) {
  const category = await prisma.abilityCategory.findFirst({
    where: { id: categoryId, allianceId }
  });
  if (!category) {
    await context.send(`${ico_list['warn'].ico} Категория не найдена!`);
    return;
  }

  const newHidden = !category.hidden;
  await prisma.abilityCategory.update({
    where: { id: categoryId },
    data: { hidden: newHidden }
  });

  await Send_Message_Smart(
    context,
    `Категория "${category.name}" ${newHidden ? 'скрыта' : 'показана'}`,
    'admin_solo'
  );
}

async function deleteAbilityCategory(context: any, categoryId: number, allianceId: number, cursor: number) {
  const category = await prisma.abilityCategory.findFirst({
    where: { id: categoryId, allianceId },
    include: { abilities: true }
  });
  if (!category) {
    await context.send(`${ico_list['warn'].ico} Категория не найдена!`);
    return;
  }

  const abilitiesCount = category.abilities.length;
  let warningText = `удалить категорию "${category.name}"`;
  if (abilitiesCount > 0) {
    warningText += `?\n\n⚠️ ВНИМАНИЕ! В этой категории ${abilitiesCount} способностей. При удалении категории все эти способности и прогресс персонажей по ним будут удалены!`;
  } else {
    warningText += `?`;
  }

  const confirm = await Confirm_User_Success(context, warningText);
  if (!confirm.status) {
    await context.send(`❌ Удаление отменено.`);
    return;
  }

  // Удаляем все способности категории (каскадно удалятся userAbility)
  await prisma.ability.deleteMany({
    where: { categoryId }
  });

  await prisma.abilityCategory.delete({ where: { id: categoryId } });

  await Send_Message_Smart(context, `Удалена категория способностей: "${category.name}"`, 'admin_solo');
}

// ===================== ФУНКЦИИ ДЛЯ СПОСОБНОСТЕЙ =====================

async function createAbility(context: any, categoryId: number, allianceId: number, levels: any[], cursor: number) {
  const name = await Input_Text(context, `Введите название способности (например: "Огненный шар", "Исцеление"):`, 50);
  if (!name) return;

  const existing = await prisma.ability.findFirst({
    where: { categoryId, name }
  });
  if (existing) {
    await context.send(`${ico_list['warn'].ico} Способность с названием "${name}" уже существует в этой категории!`);
    return;
  }

  // Выбираем валюту
  const selectedCoinId = await Select_Alliance_Coin(context, allianceId);
  if (!selectedCoinId) {
    await context.send(`${ico_list['warn'].ico} Выбор валюты прерван.`);
    return;
  }

  const orderCount = await prisma.ability.count({ where: { categoryId } });
  const maxLevelId = levels.length > 0 ? levels[levels.length - 1].id : null;

  const newAbility = await prisma.ability.create({
    data: {
      categoryId,
      name,
      currencyId: selectedCoinId,
      maxLevelId,
      order: orderCount
    }
  });

  await context.send(`${ico_list['save'].ico} Способность "${newAbility.name}" создана!`);
  
  // Сразу запускаем настройку цен
  await setupAbilityPrices(context, newAbility.id, levels, cursor);
}

async function editAbility(context: any, abilityId: number, allianceId: number, levels: any[], cursor: number) {
  const ability = await prisma.ability.findFirst({
    where: { id: abilityId },
    include: { currency: true }
  });
  if (!ability) {
    await context.send(`${ico_list['warn'].ico} Способность не найдена!`);
    return;
  }

  const newName = await Input_Text(
    context,
    `Текущее название: "${ability.name}"\nВведите новое название (или "пропустить"):`,
    50
  );
  if (newName && newName.toLowerCase() !== 'пропустить') {
    const existing = await prisma.ability.findFirst({
      where: { categoryId: ability.categoryId, name: newName, id: { not: abilityId } }
    });
    if (existing) {
      await context.send(`${ico_list['warn'].ico} Способность с названием "${newName}" уже существует в этой категории!`);
      return;
    }
    await prisma.ability.update({
      where: { id: abilityId },
      data: { name: newName }
    });
    await context.send(`✅ Название способности изменено на "${newName}"`);
  }

  // Можно сменить валюту
  const changeCurrency = await Confirm_User_Success(context, `сменить валюту для способности? Текущая валюта: ${ability.currency.smile} ${ability.currency.name}`);
  if (changeCurrency.status) {
    const newCurrencyId = await Select_Alliance_Coin(context, allianceId);
    if (newCurrencyId) {
      await prisma.ability.update({
        where: { id: abilityId },
        data: { currencyId: newCurrencyId }
      });
      await context.send(`✅ Валюта способности изменена`);
    }
  }

  await context.send(`${ico_list['save'].ico} Изменения сохранены.`);
}

async function setupAbilityPrices(context: any, abilityId: number, levels: any[], cursor: number) {
  const ability = await prisma.ability.findFirst({
    where: { id: abilityId },
    include: { currency: true }
  });
  if (!ability) {
    await context.send(`${ico_list['warn'].ico} Способность не найдена!`);
    return;
  }

  if (levels.length === 0) {
    await context.send(`${ico_list['warn'].ico} Сначала настройте уровни навыков!`);
    return;
  }

  const prices: Record<number, number> = {};

  await context.send(`💰 Настройка цен для способности "${ability.name}"\nВалюта: ${ability.currency.smile} ${ability.currency.name}\n\n`);

  for (const level of levels) {
    const price = await Input_Number(
      context,
      `🏆 Уровень: "${level.name}"\n` +
      `💰 Цена за достижение этого уровня:\n` +
      `💡 Введите 0, если бесплатно\n` +
      `💡 Введите "пропустить", чтобы пропустить этот уровень`,
      true
    );

    if (price === false) continue;
    prices[level.id] = price;
    
    if (price === 0) {
      await context.send(`✅ Уровень "${level.name}" — БЕСПЛАТНО`);
    } else {
      await context.send(`✅ Уровень "${level.name}" — ${price}${ability.currency.smile}`);
    }
  }

  await prisma.ability.update({
    where: { id: abilityId },
    data: { 
      prices: JSON.stringify(prices),
      maxLevelId: levels[levels.length - 1].id
    }
  });

  await context.send(`${ico_list['save'].ico} Цены для способности "${ability.name}" сохранены!`);
}

async function toggleAbilityHide(context: any, abilityId: number, cursor: number) {
  const ability = await prisma.ability.findFirst({
    where: { id: abilityId }
  });
  if (!ability) {
    await context.send(`${ico_list['warn'].ico} Способность не найдена!`);
    return;
  }

  const newHidden = !ability.hidden;
  await prisma.ability.update({
    where: { id: abilityId },
    data: { hidden: newHidden }
  });

  await Send_Message_Smart(
    context,
    `Способность "${ability.name}" ${newHidden ? 'скрыта' : 'показана'}`,
    'admin_solo'
  );
}

async function deleteAbility(context: any, abilityId: number, cursor: number) {
  const ability = await prisma.ability.findFirst({
    where: { id: abilityId }
  });
  if (!ability) {
    await context.send(`${ico_list['warn'].ico} Способность не найдена!`);
    return;
  }

  // Проверяем, есть ли у кого-то эта способность
  const userAbilitiesCount = await prisma.userAbility.count({
    where: { abilityId }
  });

  let warningText = `удалить способность "${ability.name}"`;
  if (userAbilitiesCount > 0) {
    warningText += `?\n\n⚠️ ВНИМАНИЕ! Эта способность есть у ${userAbilitiesCount} персонажей. При удалении способности весь прогресс по ней будет потерян!`;
  } else {
    warningText += `?`;
  }

  const confirm = await Confirm_User_Success(context, warningText);
  if (!confirm.status) {
    await context.send(`❌ Удаление отменено.`);
    return;
  }

  await prisma.ability.delete({ where: { id: abilityId } });

  await Send_Message_Smart(context, `Удалена способность: "${ability.name}"`, 'admin_solo');
}