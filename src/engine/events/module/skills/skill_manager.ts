// engine/events/module/skills/skill_manager.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { Confirm_User_Success, Input_Text, Input_Number, Get_Url_Picture, Send_Message_Question, Send_Message_Smart, Select_Alliance_Coin } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";
import { parseSkillRequirements, serializeSkillRequirements, ParsedSkillRequirements } from "./skill_types";

// ===================== УПРАВЛЕНИЕ НАВЫКАМИ =====================

export async function Skill_Manager(context: any, categoryId: number, parentCursor: number) {
  const user = await Person_Get(context);
  if (!user || !user.id_alliance || user.id_alliance <= 0) {
    await context.send(`${ico_list['warn'].ico} Вы не состоите в альянсе!`);
    return;
  }

  const category = await prisma.skillCategory.findFirst({
    where: { id: categoryId, allianceId: user.id_alliance }
  });
  if (!category) {
    await context.send(`${ico_list['warn'].ico} Категория не найдена!`);
    return;
  }

  // Получаем уровни для выбора
  const levels = await prisma.skillLevel.findMany({
    where: { allianceId: user.id_alliance },
    orderBy: { order: 'asc' }
  });

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 5;

  while (!exit) {
    const skills = await prisma.skill.findMany({
      where: { categoryId, allianceId: user.id_alliance },
      orderBy: { order: 'asc' }
    });

    const totalSkills = skills.length;
    const pageSkills = skills.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalSkills / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Управление навыками в категории "${category.name}":\n\n`;
    
    if (skills.length === 0) {
      text += "📭 Нет навыков в этой категории.\n\n";
      text += "➕ Создайте первый навык\n\n";
    } else {
      text += "📊 Существующие навыки:\n\n";
      for (let i = 0; i < pageSkills.length; i++) {
        const skill = pageSkills[i];
        const itemNumber = cursor + i + 1;
        const reqCount = skill.requirements ? Object.keys(JSON.parse(skill.requirements)).length : 0;
        text += `${itemNumber}. ⚔️ ${skill.name} ${skill.hidden ? '(скрыт)' : ''} (${reqCount} уровней настроено)\n`;
      }
      text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    }

    text += `💡 Для каждого навыка можно настроить зависимость от валют.\n`;
    text += `📈 При достижении нужных значений валют уровень навыка повышается автоматически.`;

    const keyboard = new KeyboardBuilder();

    // Кнопки навыков
    for (const skill of pageSkills) {
      keyboard.textButton({
        label: `⚔️ ${skill.name.slice(0, 25)}`,
        payload: { command: 'skill_edit', skillId: skill.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: `📊`,
        payload: { command: 'skill_requirements', skillId: skill.id, cursor },
        color: 'secondary'
      });
      keyboard.textButton({
        label: skill.hidden ? `👁️` : `🚫`,
        payload: { command: 'skill_toggle_hide', skillId: skill.id, cursor },
        color: skill.hidden ? 'positive' : 'negative'
      });
      keyboard.textButton({
        label: `❌`,
        payload: { command: 'skill_delete', skillId: skill.id, cursor },
        color: 'negative'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `← Назад`,
        payload: { command: 'skills_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalSkills) {
      keyboard.textButton({
        label: `Вперед →`,
        payload: { command: 'skills_next', cursor: cursor + ITEMS_PER_PAGE },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalSkills) {
      keyboard.row();
    }

    // Кнопка создания
    keyboard.textButton({
      label: `➕ Создать навык`,
      payload: { command: 'skill_create', cursor },
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
      case 'skill_edit':
        await editSkill(context, payload.skillId, user.id_alliance, levels, payload.cursor);
        break;
      case 'skill_requirements':
        await editSkillRequirements(context, payload.skillId, user.id_alliance, levels, payload.cursor);
        break;
      case 'skill_toggle_hide':
        await toggleSkillHide(context, payload.skillId, user.id_alliance, payload.cursor);
        break;
      case 'skill_delete':
        await deleteSkill(context, payload.skillId, user.id_alliance, payload.cursor);
        break;
      case 'skill_create':
        await createSkill(context, categoryId, user.id_alliance, levels, payload.cursor);
        break;
      case 'skills_prev':
        cursor = payload.cursor;
        break;
      case 'skills_next':
        cursor = payload.cursor;
        break;
      case 'skills_exit':
        exit = true;
        break;
    }
  }
}

async function createSkill(context: any, categoryId: number, allianceId: number, levels: any[], cursor: number) {
  const name = await Input_Text(context, `Введите название навыка (например: "Стрельба", "Рукопашный бой"):`, 50);
  if (!name) return;

  const existing = await prisma.skill.findFirst({
    where: { categoryId, name }
  });
  if (existing) {
    await context.send(`${ico_list['warn'].ico} Навык с названием "${name}" уже существует в этой категории!`);
    return;
  }

  const orderCount = await prisma.skill.count({ where: { categoryId } });

  const newSkill = await prisma.skill.create({
    data: {
      allianceId,
      categoryId,
      name,
      order: orderCount
      // description и image пропускаем
    }
  });

  await context.send(`${ico_list['save'].ico} Навык "${newSkill.name}" создан!`);
  
  // Предлагаем сразу настроить требования
  const setupReqs = await Confirm_User_Success(context, `настроить требования к уровням для навыка "${newSkill.name}"?`);
  if (setupReqs.status) {
    await setupSkillRequirements(context, newSkill.id, allianceId, levels, cursor);
  }
}

async function editSkill(context: any, skillId: number, allianceId: number, levels: any[], cursor: number) {
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, allianceId }
  });
  if (!skill) {
    await context.send(`${ico_list['warn'].ico} Навык не найден!`);
    return;
  }

  const newName = await Input_Text(
    context,
    `Текущее название: "${skill.name}"\nВведите новое название (или "пропустить"):`,
    50
  );
  if (newName && newName.toLowerCase() !== 'пропустить') {
    const existing = await prisma.skill.findFirst({
      where: { categoryId: skill.categoryId, name: newName, id: { not: skillId } }
    });
    if (existing) {
      await context.send(`${ico_list['warn'].ico} Навык с названием "${newName}" уже существует в этой категории!`);
      return;
    }
    await prisma.skill.update({
      where: { id: skillId },
      data: { name: newName }
    });
    await context.send(`✅ Название навыка изменено на "${newName}"`);
  }

  const newDescription = await Input_Text(
    context,
    `Текущее описание: ${skill.description || 'нет'}\nВведите новое описание (или "пропустить"):`,
    300
  );
  if (newDescription && newDescription.toLowerCase() !== 'пропустить') {
    await prisma.skill.update({
      where: { id: skillId },
      data: { description: newDescription || null }
    });
    await context.send(`✅ Описание навыка обновлено`);
  }

  const imageResponse = await context.question(
    `📷 Вставьте новую ссылку на изображение (или "нет" чтобы пропустить, "удалить" чтобы удалить):`,
    { answerTimeLimit }
  );
  if (!imageResponse.isTimeout && imageResponse.text) {
    if (imageResponse.text.toLowerCase() === 'удалить') {
      await prisma.skill.update({
        where: { id: skillId },
        data: { image: null }
      });
      await context.send(`✅ Изображение навыка удалено`);
    } else if (imageResponse.text.toLowerCase() !== 'нет') {
      const imageUrl = Get_Url_Picture(imageResponse.text) || '';
      if (imageUrl) {
        await prisma.skill.update({
          where: { id: skillId },
          data: { image: imageUrl }
        });
        await context.send(`✅ Изображение навыка обновлено`);
      }
    }
  }

  await context.send(`${ico_list['save'].ico} Изменения сохранены.`);
}

async function toggleSkillHide(context: any, skillId: number, allianceId: number, cursor: number) {
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, allianceId }
  });
  if (!skill) {
    await context.send(`${ico_list['warn'].ico} Навык не найден!`);
    return;
  }

  const newHidden = !skill.hidden;
  await prisma.skill.update({
    where: { id: skillId },
    data: { hidden: newHidden }
  });

  await Send_Message_Smart(
    context,
    `Навык "${skill.name}" ${newHidden ? 'скрыт' : 'показан'}`,
    'admin_solo'
  );
}

async function deleteSkill(context: any, skillId: number, allianceId: number, cursor: number) {
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, allianceId }
  });
  if (!skill) {
    await context.send(`${ico_list['warn'].ico} Навык не найден!`);
    return;
  }

  // Проверяем, есть ли у кого-то этот навык
  const userSkillsCount = await prisma.userSkill.count({
    where: { skillId }
  });

  let warningText = `удалить навык "${skill.name}"`;
  if (userSkillsCount > 0) {
    warningText += `?\n\n⚠️ ВНИМАНИЕ! Этот навык есть у ${userSkillsCount} персонажей. При удалении навыка весь прогресс по нему будет потерян!`;
  } else {
    warningText += `?`;
  }

  const confirm = await Confirm_User_Success(context, warningText);
  if (!confirm.status) {
    await context.send(`❌ Удаление отменено.`);
    return;
  }

  await prisma.skill.delete({ where: { id: skillId } });

  await Send_Message_Smart(context, `Удалён навык: "${skill.name}"`, 'admin_solo');
}

async function setupSkillRequirements(context: any, skillId: number, allianceId: number, levels: any[], cursor: number) {
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, allianceId }
  });
  if (!skill) {
    await context.send(`${ico_list['warn'].ico} Навык не найден!`);
    return;
  }

  if (levels.length === 0) {
    await context.send(`${ico_list['warn'].ico} Сначала настройте уровни навыков (!уровни настроить)!`);
    return;
  }

  const currentReqs = parseSkillRequirements(skill.requirements);
  let modified = false;

  for (const level of levels) {
    const currentReqForLevel = currentReqs[level.id] || {};
    
    let text = `🏆 Настройка требований для уровня "${level.name}":\n\n`;
    text += `Текущие требования:\n`;
    
    if (Object.keys(currentReqForLevel).length === 0) {
      text += `  ❌ Нет требований (уровень доступен всем)\n\n`;
    } else {
      for (const [coinId, minValue] of Object.entries(currentReqForLevel)) {
        const coin = await prisma.allianceCoin.findFirst({ where: { id: parseInt(coinId) } });
        text += `  • ${coin?.smile || '💰'} ${coin?.name || 'Валюта'}: минимум ${minValue}\n`;
      }
      text += `\n`;
    }

    text += `Что вы хотите сделать?`;

    const actionKeyboard = new KeyboardBuilder()
      .textButton({ label: `➕ Добавить валюту`, payload: { command: 'add_coin', levelId: level.id }, color: 'positive' })
      .textButton({ label: `🗑️ Очистить всё`, payload: { command: 'clear_all', levelId: level.id }, color: 'negative' })
      .row()
      .textButton({ label: `⏭️ Пропустить`, payload: { command: 'skip', levelId: level.id }, color: 'secondary' })
      .oneTime();

    const actionResponse = await Send_Message_Question(context, text, actionKeyboard);
    
    if (actionResponse.exit) break;
    if (!actionResponse.payload) continue;

    if (actionResponse.payload.command === 'add_coin') {
      const coinId = await Select_Alliance_Coin(context, allianceId);
      if (coinId) {
        const minValue = await Input_Number(context, `Введите минимальное значение ${await getCoinSmile(coinId)} для получения уровня "${level.name}":`, true);
        if (minValue !== false && minValue > 0) {
          currentReqs[level.id] = { ...currentReqs[level.id], [coinId]: minValue };
          modified = true;
          await context.send(`✅ Добавлено требование: ${await getCoinSmile(coinId)} >= ${minValue}`);
        }
      }
    } else if (actionResponse.payload.command === 'clear_all') {
      delete currentReqs[level.id];
      modified = true;
      await context.send(`🗑️ Требования для уровня "${level.name}" удалены`);
    }
  }

  if (modified) {
    await prisma.skill.update({
      where: { id: skillId },
      data: { requirements: serializeSkillRequirements(currentReqs) }
    });
    await context.send(`${ico_list['save'].ico} Требования для навыка "${skill.name}" сохранены!`);
  }
}

async function editSkillRequirements(context: any, skillId: number, allianceId: number, levels: any[], cursor: number) {
  await setupSkillRequirements(context, skillId, allianceId, levels, cursor);
}

async function getCoinSmile(coinId: number): Promise<string> {
  const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });
  return coin?.smile || '💰';
}