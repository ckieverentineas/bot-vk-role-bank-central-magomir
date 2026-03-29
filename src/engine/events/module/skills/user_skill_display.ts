// engine/events/module/skills/user_skill_display.ts
import prisma from "../prisma_client";
import { parseSkillRequirements, calculateSkillLevel } from "./skill_types";

export interface DisplaySkill {
  skillId: number;
  skillName: string;
  skillDescription: string | null;
  categoryId: number;
  categoryName: string;
  levelName: string | null;
  progress: number;
  nextLevelName: string | null;
  missingRequirements: Record<number, { current: number; required: number }> | null;
}

// Получить все навыки персонажа с ВЫЧИСЛЕННЫМИ на лету уровнями
export async function getUserSkillsForDisplay(userId: number, allianceId: number): Promise<DisplaySkill[]> {
  // 1. Получаем уровни альянса
  const levels = await prisma.skillLevel.findMany({
    where: { allianceId },
    orderBy: { order: 'asc' }
  });

  if (levels.length === 0) return [];

  // 2. Получаем все навыки, которые есть у персонажа (только те, что добавлены админом)
  const userSkills = await prisma.userSkill.findMany({
    where: { userId },
    include: {
      skill: {
        include: {
          category: true
        }
      }
    }
  });

  if (userSkills.length === 0) return [];

  // 3. Получаем текущие балансы валют пользователя (ОДИН ЗАПРОС!)
  const balances = await prisma.balanceCoin.findMany({
    where: { id_user: userId }
  });
  const balanceMap = new Map<number, number>();
  for (const b of balances) {
    balanceMap.set(b.id_coin, b.amount);
  }

  // 4. Вычисляем уровень каждого навыка на лету
  const result: DisplaySkill[] = [];

  for (const us of userSkills) {
    const skill = us.skill;
    const requirements = parseSkillRequirements(skill.requirements);
    
    const levelInfo = calculateSkillLevel(requirements, levels, balanceMap);
    
    result.push({
      skillId: skill.id,
      skillName: skill.name,
      skillDescription: skill.description,
      categoryId: skill.categoryId,
      categoryName: skill.category.name,
      levelName: levelInfo.levelName,
      progress: levelInfo.progress,
      nextLevelName: levelInfo.nextLevelName,
      missingRequirements: levelInfo.missing
    });
  }

  // Сортируем по категориям
  result.sort((a, b) => {
    if (a.categoryId !== b.categoryId) return a.categoryId - b.categoryId;
    return a.skillId - b.skillId;
  });

  return result;
}