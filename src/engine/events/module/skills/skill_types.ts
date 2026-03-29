// engine/events/module/skills/skill_types.ts
import { AllianceCoin, SkillLevel, User } from "@prisma/client";

export interface SkillRequirement {
  levelId: number;
  requirements: Record<number, number>; // coinId -> minValue
}

export interface ParsedSkillRequirements {
  [levelId: number]: {
    [coinId: number]: number;
  };
}

export interface UserSkillWithDetails {
  id: number;
  skillId: number;
  skillName: string;
  skillDescription: string | null;
  skillImage: string | null;
  levelId: number | null;
  levelName: string | null;
  levelOrder: number;
  progress: number;
  categoryId: number;
  categoryName: string;
  currentValue: number; // вычисленное значение на основе валют
  nextLevelId: number | null;
  nextLevelName: string | null;
  requirementsForNext: Record<number, number> | null;
  missingRequirements: Record<number, { current: number; required: number }> | null;
}

export function parseSkillRequirements(requirementsJson: string | null): ParsedSkillRequirements {
  if (!requirementsJson) return {};
  try {
    return JSON.parse(requirementsJson);
  } catch {
    return {};
  }
}

export function serializeSkillRequirements(requirements: ParsedSkillRequirements): string | null {
  if (Object.keys(requirements).length === 0) return null;
  return JSON.stringify(requirements);
}

// Вычисляет текущий уровень навыка на основе балансов валют
export function calculateSkillLevel(
  requirements: ParsedSkillRequirements,
  levels: SkillLevel[],
  userBalances: Map<number, number>
): { levelId: number | null; levelName: string | null; progress: number; nextLevelId: number | null; nextLevelName: string | null; missing: Record<number, { current: number; required: number }> | null } {
  
  if (levels.length === 0) {
    return { levelId: null, levelName: null, progress: 0, nextLevelId: null, nextLevelName: null, missing: null };
  }

  // Сортируем уровни по order
  const sortedLevels = [...levels].sort((a, b) => a.order - b.order);
  
  let currentLevel: SkillLevel | null = null;
  let nextLevel: SkillLevel | null = null;
  let missingRequirements: Record<number, { current: number; required: number }> | null = null;

  // Находим максимальный уровень, который满足了 все требования
  for (let i = 0; i < sortedLevels.length; i++) {
    const level = sortedLevels[i];
    const levelReqs = requirements[level.id];
    
    if (!levelReqs || Object.keys(levelReqs).length === 0) {
      // Нет требований - уровень доступен
      currentLevel = level;
      continue;
    }
    
    let meetsAll = true;
    const missing: Record<number, { current: number; required: number }> = {};
    
    for (const [coinId, requiredValue] of Object.entries(levelReqs)) {
      const coinIdNum = parseInt(coinId);
      const currentValue = userBalances.get(coinIdNum) || 0;
      if (currentValue < requiredValue) {
        meetsAll = false;
        missing[coinIdNum] = { current: currentValue, required: requiredValue };
      }
    }
    
    if (meetsAll) {
      currentLevel = level;
    } else {
      nextLevel = level;
      missingRequirements = missing;
      break;
    }
  }

  // Если достигнут максимальный уровень
  if (currentLevel && currentLevel.id === sortedLevels[sortedLevels.length - 1].id) {
    return {
      levelId: currentLevel.id,
      levelName: currentLevel.name,
      progress: 100,
      nextLevelId: null,
      nextLevelName: null,
      missing: null
    };
  }

  // Вычисляем прогресс до следующего уровня
  let progress = 0;
  if (nextLevel && missingRequirements) {
    const nextReqs = requirements[nextLevel.id];
    if (nextReqs) {
      let totalRequired = 0;
      let totalCurrent = 0;
      for (const [coinId, required] of Object.entries(nextReqs)) {
        const coinIdNum = parseInt(coinId);
        const current = userBalances.get(coinIdNum) || 0;
        totalRequired += required;
        totalCurrent += Math.min(current, required);
      }
      if (totalRequired > 0) {
        progress = (totalCurrent / totalRequired) * 100;
      }
    }
  }

  return {
    levelId: currentLevel?.id || null,
    levelName: currentLevel?.name || null,
    progress: Math.min(99, Math.floor(progress)),
    nextLevelId: nextLevel?.id || null,
    nextLevelName: nextLevel?.name || null,
    missing: missingRequirements
  };
}