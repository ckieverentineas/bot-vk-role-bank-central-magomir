// engine/events/module/skills/skill_categories_manager.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { Confirm_User_Success, Input_Text, Get_Url_Picture, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";
import { Skill_Manager } from "./skill_manager";

// ===================== УПРАВЛЕНИЕ КАТЕГОРИЯМИ НАВЫКОВ =====================

export async function SkillCategories_Manager(context: any) {
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

  // Проверяем, настроены ли уровни
  const levelsCount = await prisma.skillLevel.count({
    where: { allianceId: alliance.id }
  });
  if (levelsCount === 0) {
    await context.send(
      `${ico_list['warn'].ico} Сначала настройте уровни навыков!\n\n` +
      `Без уровней нельзя создавать навыки.`
    );
    return;
  }

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 5;

  while (!exit) {
    const categories = await prisma.skillCategory.findMany({
      where: { allianceId: alliance.id },
      orderBy: { order: 'asc' }
    });

    const totalCategories = categories.length;
    const pageCategories = categories.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalCategories / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Управление категориями навыков для "${alliance.name}":\n\n`;
    
    if (categories.length === 0) {
      text += "📭 Нет категорий навыков.\n\n";
      text += "➕ Создайте первую категорию (например: Боевые, Социальные, Крафт)\n\n";
    } else {
      text += "📊 Существующие категории:\n\n";
      for (let i = 0; i < pageCategories.length; i++) {
        const cat = pageCategories[i];
        const itemNumber = cursor + i + 1;
        text += `${itemNumber}. 📁 ${cat.name} ${cat.hidden ? '(скрыта)' : ''}\n`;
      }
      text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    }

    text += `💡 Категории нужны для группировки навыков (Боевые, Социальные, Крафт и т.д.)`;

    const keyboard = new KeyboardBuilder();

    // Кнопки категорий
    for (const cat of pageCategories) {
      keyboard.textButton({
        label: `📁 ${cat.name.slice(0, 25)}`,
        payload: { command: 'skill_category_select', categoryId: cat.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: `✏️`,
        payload: { command: 'skill_category_edit', categoryId: cat.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: cat.hidden ? `👁️` : `🚫`,
        payload: { command: 'skill_category_toggle_hide', categoryId: cat.id, cursor },
        color: cat.hidden ? 'positive' : 'negative'
      });
      keyboard.textButton({
        label: `❌`,
        payload: { command: 'skill_category_delete', categoryId: cat.id, cursor },
        color: 'negative'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `← Назад`,
        payload: { command: 'skill_categories_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalCategories) {
      keyboard.textButton({
        label: `Вперед →`,
        payload: { command: 'skill_categories_next', cursor: cursor + ITEMS_PER_PAGE },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalCategories) {
      keyboard.row();
    }

    // Кнопка создания
    keyboard.textButton({
      label: `➕ Создать категорию`,
      payload: { command: 'skill_category_create', cursor },
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
      case 'skill_category_select':
        await Skill_Manager(context, payload.categoryId, payload.cursor);
        break;
      case 'skill_category_edit':
        await editSkillCategory(context, payload.categoryId, alliance.id, payload.cursor);
        break;
      case 'skill_category_toggle_hide':
        await toggleSkillCategoryHide(context, payload.categoryId, alliance.id, payload.cursor);
        break;
      case 'skill_category_delete':
        await deleteSkillCategory(context, payload.categoryId, alliance.id, payload.cursor);
        break;
      case 'skill_category_create':
        await createSkillCategory(context, alliance.id, payload.cursor);
        break;
      case 'skill_categories_prev':
        cursor = payload.cursor;
        break;
      case 'skill_categories_next':
        cursor = payload.cursor;
        break;
      case 'skill_categories_exit':
        exit = true;
        break;
    }
  }
}

async function createSkillCategory(context: any, allianceId: number, cursor: number) {
  const name = await Input_Text(context, `Введите название категории навыков (например: "Боевые", "Социальные"):`, 50);
  if (!name) return;

  const existing = await prisma.skillCategory.findFirst({
    where: { allianceId, name }
  });
  if (existing) {
    await context.send(`${ico_list['warn'].ico} Категория с названием "${name}" уже существует!`);
    return;
  }

  const orderCount = await prisma.skillCategory.count({ where: { allianceId } });

  const newCategory = await prisma.skillCategory.create({
    data: {
      allianceId,
      name,
      order: orderCount
      // description и image не запрашиваем
    }
  });

  await Send_Message_Smart(
    context,
    `Создана категория навыков: "${newCategory.name}"`,
    'admin_solo'
  );
}

async function editSkillCategory(context: any, categoryId: number, allianceId: number, cursor: number) {
  const category = await prisma.skillCategory.findFirst({
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
    const existing = await prisma.skillCategory.findFirst({
      where: { allianceId, name: newName, id: { not: categoryId } }
    });
    if (existing) {
      await context.send(`${ico_list['warn'].ico} Категория с названием "${newName}" уже существует!`);
      return;
    }
    await prisma.skillCategory.update({
      where: { id: categoryId },
      data: { name: newName }
    });
    await context.send(`✅ Название категории изменено на "${newName}"`);
  }

  // Описание и картинку НЕ ЗАПРАШИВАЕМ

  await context.send(`${ico_list['save'].ico} Изменения сохранены.`);
}

async function toggleSkillCategoryHide(context: any, categoryId: number, allianceId: number, cursor: number) {
  const category = await prisma.skillCategory.findFirst({
    where: { id: categoryId, allianceId }
  });
  if (!category) {
    await context.send(`${ico_list['warn'].ico} Категория не найдена!`);
    return;
  }

  const newHidden = !category.hidden;
  await prisma.skillCategory.update({
    where: { id: categoryId },
    data: { hidden: newHidden }
  });

  await Send_Message_Smart(
    context,
    `Категория "${category.name}" ${newHidden ? 'скрыта' : 'показана'}`,
    'admin_solo'
  );
}

async function deleteSkillCategory(context: any, categoryId: number, allianceId: number, cursor: number) {
  const category = await prisma.skillCategory.findFirst({
    where: { id: categoryId, allianceId },
    include: { skills: true }
  });
  if (!category) {
    await context.send(`${ico_list['warn'].ico} Категория не найдена!`);
    return;
  }

  const skillsCount = category.skills.length;
  let warningText = `удалить категорию "${category.name}"`;
  if (skillsCount > 0) {
    warningText += `?\n\n⚠️ ВНИМАНИЕ! В этой категории ${skillsCount} навыков. При удалении категории все эти навыки и прогресс персонажей по ним будут удалены!`;
  } else {
    warningText += `?`;
  }

  const confirm = await Confirm_User_Success(context, warningText);
  if (!confirm.status) {
    await context.send(`❌ Удаление отменено.`);
    return;
  }

  // Удаляем все навыки категории (каскадно удалятся userSkill)
  await prisma.skill.deleteMany({
    where: { categoryId }
  });

  await prisma.skillCategory.delete({ where: { id: categoryId } });

  await Send_Message_Smart(context, `Удалена категория навыков: "${category.name}"`, 'admin_solo');
}