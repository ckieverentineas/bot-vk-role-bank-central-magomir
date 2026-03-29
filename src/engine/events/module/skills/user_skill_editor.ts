// engine/events/module/skills/user_skill_editor.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { Confirm_User_Success, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { ico_list } from "../data_center/icons_lib";

// Редактирование списка навыков персонажа (только какие навыки есть)
export async function UserSkill_Editor(context: any, userId: number, allianceId: number) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) {
    await context.send(`${ico_list['warn'].ico} Пользователь не найден!`);
    return;
  }

  // Получаем все НЕскрытые навыки альянса
  const allSkills = await prisma.skill.findMany({
    where: { allianceId, hidden: false },
    include: { category: true },
    orderBy: [{ categoryId: 'asc' }, { order: 'asc' }]
  });

  // Получаем текущие навыки персонажа
  const userSkills = await prisma.userSkill.findMany({
    where: { userId },
    select: { skillId: true }
  });
  const userSkillIds = new Set(userSkills.map(us => us.skillId));

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 8;

  while (!exit) {
    const pageSkills = allSkills.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalSkills = allSkills.length;
    const totalPages = Math.ceil(totalSkills / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Навыки персонажа ${user.name} (UID: ${user.id}):\n\n`;
    text += `✅ — навык есть, ❌ — навыка нет\n\n`;

    for (let i = 0; i < pageSkills.length; i++) {
      const skill = pageSkills[i];
      const hasSkill = userSkillIds.has(skill.id);
      text += `${cursor + i + 1}. ${skill.category.name} → ${skill.name} [${hasSkill ? '✅' : '❌'}]\n`;
    }

    text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    text += `💡 Нажмите на навык чтобы добавить/удалить.`;

    const keyboard = new KeyboardBuilder();

    for (const skill of pageSkills) {
      const hasSkill = userSkillIds.has(skill.id);
      keyboard.textButton({
        label: `${hasSkill ? '✅' : '➕'} ${skill.name.slice(0, 25)}`,
        payload: { command: 'toggle_skill', skillId: skill.id, hasSkill },
        color: hasSkill ? 'positive' : 'secondary'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `←`,
        payload: { command: 'skills_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalSkills) {
      keyboard.textButton({
        label: `→`,
        payload: { command: 'skills_next', cursor: cursor + ITEMS_PER_PAGE },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalSkills) {
      keyboard.row();
    }

    const response = await Send_Message_Question(context, text, keyboard.oneTime());

    if (response.exit) {
      exit = true;
      continue;
    }

    if (!response.payload) continue;

    if (response.payload.command === 'toggle_skill') {
      const skillId = response.payload.skillId;
      const hadSkill = response.payload.hasSkill;
      
      if (hadSkill) {
        await prisma.userSkill.deleteMany({ where: { userId, skillId } });
        userSkillIds.delete(skillId);
        await context.send(`❌ Навык удалён`);
      } else {
        await prisma.userSkill.create({ data: { userId, skillId, progress: 0 } });
        userSkillIds.add(skillId);
        await context.send(`✅ Навык добавлен`);
      }
    } else if (response.payload.command === 'skills_prev') {
      cursor = response.payload.cursor;
    } else if (response.payload.command === 'skills_next') {
      cursor = response.payload.cursor;
    } else if (response.payload.command === 'exit_editor') {
      exit = true;
    }
  }
}