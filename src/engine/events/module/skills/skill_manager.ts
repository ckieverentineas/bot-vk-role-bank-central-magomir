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
        payload: { command: 'skill_requirements', skillId: skill.id, cursor },  // <-- сюда ведёт 📊
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
        await setupSkillRequirements(context, payload.skillId, user.id_alliance, levels, payload.cursor);
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
      // description и image не запрашиваем и не сохраняем
    }
  });

  await context.send(`${ico_list['save'].ico} Навык "${newSkill.name}" создан!`);
  
  // Сразу запускаем настройку требований
  await setupSkillRequirements(context, newSkill.id, allianceId, levels, cursor);
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

  // Описание и картинку НЕ ЗАПРАШИВАЕМ

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
  
  // Определяем уже выбранные характеристики из существующих требований
  let selectedCoins: number[] = [];
  for (const levelReqs of Object.values(currentReqs)) {
    for (const coinId of Object.keys(levelReqs)) {
      const coinIdNum = parseInt(coinId);
      if (!selectedCoins.includes(coinIdNum)) {
        selectedCoins.push(coinIdNum);
      }
    }
  }
  
  // Получаем все валюты альянса
  const allCoins = await prisma.allianceCoin.findMany({
    where: { id_alliance: allianceId }
  });
  
  if (allCoins.length === 0) {
    await context.send(`${ico_list['warn'].ico} В альянсе нет валют! Сначала создайте валюты.`);
    return;
  }
  
  // ========== ШАГ 1: ВЫБОР ХАРАКТЕРИСТИК (если нет выбранных или админ хочет изменить) ==========
  let coinSelectionDone = selectedCoins.length > 0;
  let modifySelection = false;
    
  // Если уже есть выбранные характеристики, спрашиваем, хочет ли админ их менять
  if (selectedCoins.length > 0) {
    // Формируем текст с текущими порогами (с подписью характеристик)
    let currentThresholds = '';
    for (const level of levels) {
      const levelReqs = currentReqs[level.id];
      if (levelReqs && Object.keys(levelReqs).length > 0) {
        const parts: string[] = [];
        for (const coinId of selectedCoins) {
          const value = levelReqs[coinId] || 0;
          const coin = allCoins.find(c => c.id === coinId);
          parts.push(`${value} ${coin?.smile || '💰'}`);
        }
        currentThresholds += `\n  🏆 ${level.name}: ${parts.join(', ')}`;
      } else {
        currentThresholds += `\n  🏆 ${level.name}: без требований`;
      }
    }
    
    const text = `📊 Текущие настройки навыка "${skill.name}":\n\n` +
      `🎯 Характеристики: ${selectedCoins.map(id => {
        const coin = allCoins.find(c => c.id === id);
        return `${coin?.smile} ${coin?.name}`;
      }).join(', ')}\n` +
      `📈 Пороги:${currentThresholds}\n\n` +
      `Хотите изменить набор характеристик?\n\n` +
      `• Да — изменить характеристики\n` +
      `• Нет — изменить только значения`
    
    const keyboard = new KeyboardBuilder()
      .textButton({ label: '✅ Да', payload: { command: 'yes' }, color: 'positive' })
      .textButton({ label: '❌ Нет', payload: { command: 'no' }, color: 'negative' })
      .row()
      .textButton({ label: '↩️ Назад', payload: { command: 'back' }, color: 'secondary' })
      .oneTime().inline();
    
    const answer = await context.question(text, { keyboard, answerTimeLimit });
    
    if (answer.isTimeout) {
      await context.send(`⏰ Время истекло.`);
      return;
    }
    
    if (!answer.payload) {
      await context.send(`❌ Редактирование отменено.`);
      return;
    }
    
    if (answer.payload.command === 'back') {
      await context.send(`↩️ Возврат назад.`);
      return;
    }
    
    if (answer.payload.command === 'yes') {
      modifySelection = true;
      coinSelectionDone = false;
      selectedCoins = [];
    } else {
      // Оставляем текущие характеристики
      coinSelectionDone = true;
    }
  }
  
  while (!coinSelectionDone) {
    let text = `${ico_list['config'].ico} Выберите характеристики (валюты), от которых зависит навык "${skill.name}":\n\n`;
    text += `💡 Можно выбрать несколько. Текущий выбор:\n`;
    
    if (selectedCoins.length === 0) {
      text += `  ❌ пока ничего не выбрано\n\n`;
    } else {
      for (const coinId of selectedCoins) {
        const coin = allCoins.find(c => c.id === coinId);
        text += `  ✅ ${coin?.smile} ${coin?.name}\n`;
      }
      text += `\n`;
    }
    
    text += `Доступные валюты:\n`;
    
    const keyboard = new KeyboardBuilder();
    
    for (let i = 0; i < allCoins.length; i += 2) {
      const coin1 = allCoins[i];
      const isSelected1 = selectedCoins.includes(coin1.id);
      
      keyboard.textButton({
        label: `${isSelected1 ? '✅' : '➕'} ${coin1.smile} ${coin1.name.slice(0, 15)}`,
        payload: { command: 'toggle_coin', coinId: coin1.id },
        color: isSelected1 ? 'positive' : 'secondary'
      });
      
      if (i + 1 < allCoins.length) {
        const coin2 = allCoins[i + 1];
        const isSelected2 = selectedCoins.includes(coin2.id);
        keyboard.textButton({
          label: `${isSelected2 ? '✅' : '➕'} ${coin2.smile} ${coin2.name.slice(0, 15)}`,
          payload: { command: 'toggle_coin', coinId: coin2.id },
          color: isSelected2 ? 'positive' : 'secondary'
        });
      }
      keyboard.row();
    }
    
    keyboard.textButton({
      label: selectedCoins.length > 0 ? '✅ Далее' : '⏭️ Пропустить (без требований)',
      payload: { command: 'next_step' },
      color: 'positive'
    }).row();
    
    const response = await Send_Message_Question(context, text, keyboard.oneTime());
    
    if (response.exit || !response.payload) {
      return;
    }
    
    if (response.payload.command === 'cancel') {
      await context.send(`❌ Настройка требований отменена.`);
      return;
    }
    
    if (response.payload.command === 'toggle_coin') {
      const coinId = response.payload.coinId;
      if (selectedCoins.includes(coinId)) {
        selectedCoins = selectedCoins.filter(id => id !== coinId);
      } else {
        selectedCoins.push(coinId);
      }
      continue;
    }
    
    if (response.payload.command === 'next_step') {
      coinSelectionDone = true;
    }
  }
  
  // Если характеристики не выбраны — сохраняем пустые требования и выходим
  if (selectedCoins.length === 0) {
    await prisma.skill.update({
      where: { id: skillId },
      data: { requirements: null }
    });
    await context.send(`${ico_list['save'].ico} Навык "${skill.name}" сохранён без требований (доступен всем).`);
    return;
  }
  
  // ========== ШАГ 2: НАСТРОЙКА ПОРОГОВ ДЛЯ КАЖДОГО УРОВНЯ ==========
  await context.send(`${ico_list['config'].ico} Теперь настройте пороговые значения для каждого уровня.\n`);
  await context.send(`📊 Выбранные характеристики: ${selectedCoins.map(id => {
    const coin = allCoins.find(c => c.id === id);
    return `${coin?.smile} ${coin?.name}`;
  }).join(', ')}\n\n💡 Для каждого уровня введите числа через пробел в том же порядке.`);
  
  const newReqs: ParsedSkillRequirements = {};
  
  for (const level of levels) {
    let levelConfigured = false;
    
    while (!levelConfigured) {
      const currentValues = currentReqs[level.id] || {};
      
      let text = `🏆 Уровень: "${level.name}" (порядок: ${level.order})\n\n`;
      text += `Введите минимальные значения для каждой характеристики через пробел:\n`;
      
      for (let i = 0; i < selectedCoins.length; i++) {
        const coinId = selectedCoins[i];
        const coin = allCoins.find(c => c.id === coinId);
        const currentVal = currentValues[coinId] || 0;
        text += `${i + 1}. ${coin?.smile} ${coin?.name}: ${currentVal}\n`;
      }
      
      text += `\n📝 Пример: "13 15 10" — если выбрано 3 характеристики\n`;
      text += `💡 Введите "пропустить" чтобы оставить как есть\n`;
      text += `💡 Введите "0" для всех чтобы убрать требования к этому уровню`;
      
      const valueResponse = await context.question(text, { answerTimeLimit });
      
      if (valueResponse.isTimeout) {
        await context.send(`⏰ Время истекло. Настройка уровня "${level.name}" пропущена.`);
        break;
      }
      
      const input = valueResponse.text.trim();
      
      if (input.toLowerCase() === 'пропустить') {
        if (Object.keys(currentValues).length > 0) {
          newReqs[level.id] = { ...currentValues };
        }
        levelConfigured = true;
        continue;
      }
      
      if (input === '0') {
        levelConfigured = true;
        continue;
      }
      
      const parts = input.split(/\s+/).map(Number);
      
      if (parts.length !== selectedCoins.length) {
        await context.send(`❌ Ожидается ${selectedCoins.length} чисел, получено ${parts.length}. Попробуйте снова.`);
        continue;
      }
      
      if (parts.some(isNaN)) {
        await context.send(`❌ Все значения должны быть числами. Попробуйте снова.`);
        continue;
      }
      
      const levelReqs: Record<number, number> = {};
      for (let i = 0; i < selectedCoins.length; i++) {
        levelReqs[selectedCoins[i]] = parts[i];
      }
      newReqs[level.id] = levelReqs;
      levelConfigured = true;
      
      await context.send(`✅ Для уровня "${level.name}" установлены требования: ${parts.join(', ')}`);
    }
  }
  
  await prisma.skill.update({
    where: { id: skillId },
    data: { requirements: serializeSkillRequirements(newReqs) }
  });
  
  await context.send(`${ico_list['save'].ico} Навык "${skill.name}" полностью настроен!`);
}

async function editSkillRequirements(context: any, skillId: number, allianceId: number, levels: any[], cursor: number) {
  await setupSkillRequirements(context, skillId, allianceId, levels, cursor);
}

async function getCoinSmile(coinId: number): Promise<string> {
  const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });
  return coin?.smile || '💰';
}