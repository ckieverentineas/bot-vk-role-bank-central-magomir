// engine/events/module/skills/skill_levels_manager.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { Confirm_User_Success, Input_Text, Input_Number, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";

// ===================== УПРАВЛЕНИЕ УРОВНЯМИ НАВЫКОВ =====================

export async function SkillLevels_Manager(context: any) {
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

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 5;

  while (!exit) {
    const levels = await prisma.skillLevel.findMany({
      where: { allianceId: alliance.id },
      orderBy: { order: 'asc' }
    });

    const totalLevels = levels.length;
    const pageLevels = levels.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalLevels / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Управление уровнями навыков для "${alliance.name}":\n\n`;
    
    if (levels.length === 0) {
      text += "📭 Нет настроенных уровней.\n\n";
      text += "➕ Создайте первый уровень (например: Неофит, Адепт, Мастер)\n\n";
    } else {
      text += "📊 Существующие уровни:\n\n";
      for (let i = 0; i < pageLevels.length; i++) {
        const level = pageLevels[i];
        const itemNumber = cursor + i + 1;
        text += `${itemNumber}. 🏆 ${level.name} (порядок: ${level.order})\n`;
      }
      text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    }

    text += `💡 Уровни используются для определения прогресса навыков.\n`;
    text += `⚠️ При удалении уровня все навыки, привязанные к нему у персонажей, сбросятся!`;

    const keyboard = new KeyboardBuilder();

    // Кнопки уровней (выбор для редактирования)
    for (const level of pageLevels) {
      keyboard.textButton({
        label: `✏️ ${level.name.slice(0, 25)}`,
        payload: { command: 'skill_level_edit', levelId: level.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: `❌`,
        payload: { command: 'skill_level_delete', levelId: level.id, cursor },
        color: 'negative'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `← Назад`,
        payload: { command: 'skill_levels_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalLevels) {
      keyboard.textButton({
        label: `Вперед →`,
        payload: { command: 'skill_levels_next', cursor: cursor + ITEMS_PER_PAGE },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalLevels) {
      keyboard.row();
    }

    // Кнопка создания
    keyboard.textButton({
      label: `➕ Создать уровень`,
      payload: { command: 'skill_level_create', cursor },
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
      case 'skill_level_edit':
        await editSkillLevel(context, payload.levelId, alliance.id, payload.cursor);
        break;
      case 'skill_level_delete':
        await deleteSkillLevel(context, payload.levelId, alliance.id, payload.cursor);
        break;
      case 'skill_level_create':
        await createSkillLevel(context, alliance.id, payload.cursor);
        break;
      case 'skill_levels_prev':
        cursor = payload.cursor;
        break;
      case 'skill_levels_next':
        cursor = payload.cursor;
        break;
      case 'skill_levels_exit':
        exit = true;
        break;
    }
  }
}

async function createSkillLevel(context: any, allianceId: number, cursor: number) {
  const name = await Input_Text(context, `Введите название уровня (например: "Неофит", "Адепт", "Мастер"):`, 50);
  if (!name) return;

  // Проверяем уникальность
  const existing = await prisma.skillLevel.findFirst({
    where: { allianceId, name }
  });
  if (existing) {
    await context.send(`${ico_list['warn'].ico} Уровень с названием "${name}" уже существует!`);
    return;
  }

  const orderInput = await Input_Number(context, `Введите порядковый номер уровня (чем меньше число, тем ниже уровень):`, true);
  if (orderInput === false) return;
  const order = orderInput;

  const newLevel = await prisma.skillLevel.create({
    data: { allianceId, name, order }
  });

  await Send_Message_Smart(
    context,
    `Создан уровень навыков: "${newLevel.name}" (порядок: ${newLevel.order})`,
    'admin_solo'
  );
}

async function editSkillLevel(context: any, levelId: number, allianceId: number, cursor: number) {
  const level = await prisma.skillLevel.findFirst({
    where: { id: levelId, allianceId }
  });
  if (!level) {
    await context.send(`${ico_list['warn'].ico} Уровень не найден!`);
    return;
  }

  const newName = await Input_Text(
    context,
    `Текущее название: "${level.name}"\nВведите новое название (или "пропустить"):`,
    50
  );
  if (newName && newName.toLowerCase() !== 'пропустить') {
    const existing = await prisma.skillLevel.findFirst({
      where: { allianceId, name: newName, id: { not: levelId } }
    });
    if (existing) {
      await context.send(`${ico_list['warn'].ico} Уровень с названием "${newName}" уже существует!`);
      return;
    }
    await prisma.skillLevel.update({
      where: { id: levelId },
      data: { name: newName }
    });
    await context.send(`✅ Название уровня изменено на "${newName}"`);
  }

  const newOrder = await Input_Number(
    context,
    `Текущий порядок: ${level.order}\nВведите новый порядковый номер (или 0 чтобы пропустить):`,
    true
  );
  if (newOrder !== false && newOrder > 0) {
    await prisma.skillLevel.update({
      where: { id: levelId },
      data: { order: newOrder }
    });
    await context.send(`✅ Порядок уровня изменён на ${newOrder}`);
  }

  await context.send(`${ico_list['save'].ico} Изменения сохранены.`);
}

async function deleteSkillLevel(context: any, levelId: number, allianceId: number, cursor: number) {
  const level = await prisma.skillLevel.findFirst({
    where: { id: levelId, allianceId }
  });
  if (!level) {
    await context.send(`${ico_list['warn'].ico} Уровень не найден!`);
    return;
  }

  // Проверяем, есть ли навыки персонажей с этим уровнем
  const userSkillsWithLevel = await prisma.userSkill.count({
    where: { levelId }
  });

  let warningText = `удалить уровень "${level.name}"`;
  if (userSkillsWithLevel > 0) {
    warningText += `?\n\n⚠️ ВНИМАНИЕ! Этот уровень используется у ${userSkillsWithLevel} персонажей. После удаления уровня у них сбросится прогресс навыков!`;
  } else {
    warningText += `?`;
  }

  const confirm = await Confirm_User_Success(context, warningText);
  if (!confirm.status) {
    await context.send(`❌ Удаление отменено.`);
    return;
  }

  // Снимаем привязку уровня у всех пользовательских навыков
  await prisma.userSkill.updateMany({
    where: { levelId },
    data: { levelId: null, progress: 0 }
  });

  await prisma.skillLevel.delete({ where: { id: levelId } });

  await Send_Message_Smart(context, `Удалён уровень навыков: "${level.name}"`, 'admin_solo');
}