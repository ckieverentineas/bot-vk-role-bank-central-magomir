import prisma from "../prisma_client";
import { SkillLevel } from "@prisma/client";

/**
 * Получить название уровня по ID
 */
export async function getLevelName(levelId: number | null): Promise<string> {
  if (!levelId) return "❌";
  const level = await prisma.skillLevel.findFirst({ where: { id: levelId } });
  return level?.name || "❌";
}

/**
 * Получить все уровни альянса (отсортированные по order)
 */
export async function getAllianceLevels(allianceId: number): Promise<SkillLevel[]> {
  return await prisma.skillLevel.findMany({
    where: { allianceId },
    orderBy: { order: 'asc' }
  });
}

/**
 * Получить цену для достижения определенного уровня
 */
export async function getAbilityPrice(abilityId: number, targetLevelId: number): Promise<number> {
  const ability = await prisma.ability.findFirst({
    where: { id: abilityId }
  });
  
  if (!ability?.prices) return 0;
  
  const prices: Record<number, number> = JSON.parse(ability.prices);
  return prices[targetLevelId] || 0;
}

/**
 * Получить все цены способности
 */
export async function getAbilityPrices(abilityId: number, id: number): Promise<Record<number, number>> {
  const ability = await prisma.ability.findFirst({
    where: { id: abilityId }
  });
  
  if (!ability?.prices) return {};
  return JSON.parse(ability.prices);
}

export async function deductAbilityCost(
  userId: number,
  currencyId: number,
  amount: number,
  context?: any
): Promise<{ success: boolean; oldBalance: number; newBalance: number }> {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) return { success: false, oldBalance: 0, newBalance: 0 };
  
  const currency = await prisma.allianceCoin.findFirst({ where: { id: currencyId } });
  if (!currency) return { success: false, oldBalance: 0, newBalance: 0 };
  
  const balance = await prisma.balanceCoin.findFirst({
    where: { id_coin: currencyId, id_user: userId }
  });
  
  if (!balance || balance.amount < amount) {
    if (context) {
      await context.send(`❌ Недостаточно ${currency.smile} ${currency.name}! Нужно: ${amount}, у вас: ${balance?.amount || 0}`);
    }
    return { success: false, oldBalance: balance?.amount || 0, newBalance: balance?.amount || 0 };
  }
  
  const oldAmount = balance.amount;
  const newAmount = oldAmount - amount;
  
  await prisma.balanceCoin.update({
    where: { id: balance.id },
    data: { amount: newAmount }
  });
  
  // Если валюта рейтинговая — списываем с факультета
  if (currency.point && user.id_facult) {
    const facultBalance = await prisma.balanceFacult.findFirst({
      where: { id_coin: currencyId, id_facult: user.id_facult }
    });
    
    if (facultBalance) {
      await prisma.balanceFacult.update({
        where: { id: facultBalance.id },
        data: { amount: { decrement: amount } }
      });
    }
  }
  
  return { success: true, oldBalance: oldAmount, newBalance: newAmount };
}