// engine/events/module/skills/user_skill_editor.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { Confirm_User_Success, Fixed_Number_To_Five, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { ico_list } from "../data_center/icons_lib";
import { Simply_Carusel_Selector } from "../../../core/simply_carusel_selector";

async function Simply_Carusel_Selector_Compact<T>(
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
      let event_logger = `${ico_list['question'].ico} ${prompt}:\n\n`;
      const limiter = 5;

      if (items.length > 0) {
        let counter = 0;
        for (let i = id_builder_sent; i < items.length && counter < limiter; i++) {
          const item = items[i];
          const label = labelExtractor(item);
          const payload = payloadExtractor(item, i);
          const info = await infoExtractor(item);
          keyboard.textButton({ label, payload, color: 'secondary' }).row();
          event_logger += `\n${info}`;  // ← ОДИН перенос, а не два
          counter++;
        }
        event_logger += `\n\n${items.length > 1 ? `~~~~ ${Math.min(id_builder_sent + limiter, items.length)} из ${items.length} ~~~~` : ''}`;

        if (items.length > limiter && id_builder_sent > limiter - 1) {
          keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'item_control_multi', id_item_sent: id_builder_sent - limiter }, color: 'secondary' });
        }
        if (items.length > limiter && id_builder_sent < items.length - limiter) {
          keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'item_control_multi', id_item_sent: id_builder_sent + limiter }, color: 'secondary' });
        }
      } else {
        event_logger = `${ico_list['warn'].ico} У вас еще нет элементов.`;
      }

      const answer: any = await context.question(`${event_logger}`, { keyboard: keyboard.inline(), answerTimeLimit });

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

// Редактирование списка навыков персонажа (только какие навыки есть)
export async function UserSkill_Editor(context: any, userId: number, allianceId: number) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) {
    await context.send(`${ico_list['warn'].ico} Пользователь не найден!`);
    return;
  }

  // ========== ШАГ 1: ВЫБОР КАТЕГОРИИ ==========
  const categories = await prisma.skillCategory.findMany({
    where: { allianceId, hidden: false },
    orderBy: { name: 'asc' }
  });

  if (categories.length === 0) {
    await context.send(`${ico_list['warn'].ico} В альянсе нет категорий навыков!`);
    return;
  }

  const selectedCategory = await Simply_Carusel_Selector_Compact(
    context,
    `Выберите категорию навыков для персонажа ${user.name} (UID: ${user.id})`,
    categories,
    async (item) => `📁 ${item.name}`,
    (item) => item.name,
    (item, index) => ({ 
      command: 'select_skill_category', 
      id_item_sent: index, 
      id_item: item.id 
    })
  );

  if (!selectedCategory) {
    await context.send(`${ico_list['stop'].ico} Выбор категории отменен.`);
    return;
  }

  // ========== ШАГ 2: ПОКАЗ НАВЫКОВ В ВЫБРАННОЙ КАТЕГОРИИ ==========
  // Получаем все НЕскрытые навыки выбранной категории, отсортированные по алфавиту
  let allSkills = await prisma.skill.findMany({
    where: { 
      allianceId, 
      hidden: false,
      categoryId: selectedCategory
    },
    include: { category: true },
    orderBy: { name: 'asc' }
  });

  // Получаем текущие навыки персонажа
  const userSkills = await prisma.userSkill.findMany({
    where: { userId: user.id },
    select: { skillId: true }
  });
  const userSkillIds = new Set(userSkills.map(us => us.skillId));

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 6;

  while (!exit) {
    const pageSkills = allSkills.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalSkills = allSkills.length;
    const totalPages = Math.ceil(totalSkills / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Навыки персонажа ${user.name} (UID: ${user.id}) в категории "${allSkills[0]?.category?.name || '?'}":\n\n`;
    text += `✅ — навык есть, ❌ — навыка нет\n\n`;

    for (let i = 0; i < pageSkills.length; i++) {
      const skill = pageSkills[i];
      const hasSkill = userSkillIds.has(skill.id);
      text += `${cursor + i + 1}. ${skill.name} [${hasSkill ? '✅' : '❌'}]\n`;
    }

    text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    text += `💡 Нажмите на навык чтобы добавить/удалить.`;

    const keyboard = new KeyboardBuilder();

    for (const skill of pageSkills) {
      const hasSkill = userSkillIds.has(skill.id);
      keyboard.textButton({
        label: `${hasSkill ? '✅' : '➕'} ${skill.name.slice(0, 25)}`,
        payload: { command: 'toggle_skill', skillId: skill.id, hasSkill, userId: user.id, categoryId: selectedCategory },
        color: hasSkill ? 'positive' : 'secondary'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `←`,
        payload: { command: 'skills_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE), categoryId: selectedCategory },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalSkills) {
      keyboard.textButton({
        label: `→`,
        payload: { command: 'skills_next', cursor: cursor + ITEMS_PER_PAGE, categoryId: selectedCategory },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalSkills) {
      keyboard.row();
    }

    keyboard.textButton({
      label: `🔙 Выбрать другую категорию`,
      payload: { command: 'skills_back_to_categories', userId: user.id },
      color: 'secondary'
    }).row();

    const response = await Send_Message_Question(context, text, keyboard.oneTime());

    if (response.exit) {
      exit = true;
      continue;
    }

    if (!response.payload) continue;

    const payload = response.payload;

    if (payload.command === 'toggle_skill') {
      const skillId = payload.skillId;
      const hadSkill = payload.hasSkill;
      
      if (hadSkill) {
        await prisma.userSkill.deleteMany({ where: { userId: user.id, skillId } });
        userSkillIds.delete(skillId);
        await context.send(`❌ Навык удалён`);
      } else {
        await prisma.userSkill.create({ data: { userId: user.id, skillId, progress: 0 } });
        userSkillIds.add(skillId);
        await context.send(`✅ Навык добавлен`);
      }
    } else if (payload.command === 'skills_prev') {
      cursor = payload.cursor;
    } else if (payload.command === 'skills_next') {
      cursor = payload.cursor;
    } else if (payload.command === 'skills_back_to_categories') {
      // Возвращаемся к выбору категории
      await UserSkill_Editor(context, payload.userId, allianceId);
      exit = true;
    } else if (payload.command === 'exit_editor') {
      exit = true;
    }
  }
}