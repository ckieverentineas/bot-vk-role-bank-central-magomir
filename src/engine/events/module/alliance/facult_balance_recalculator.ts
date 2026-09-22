import prisma from "../prisma_client";

/** Rebuilds faculty balances from the balances of users currently assigned to it. */
export async function RecalculateFacultyBalances(allianceId?: number): Promise<{ faculties: number; currencies: number }> {
  const faculties = await prisma.allianceFacult.findMany({
    where: allianceId === undefined ? undefined : { id_alliance: allianceId },
    include: { alliance: { include: { AllianceCoin: true } } }
  });

  let currencies = 0;
  for (const faculty of faculties) {
    const users = await prisma.user.findMany({ where: { id_alliance: faculty.id_alliance, id_facult: faculty.id } });
    for (const coin of faculty.alliance.AllianceCoin) {
      if (!coin.point) continue;
      const balances = users.length
        ? await prisma.balanceCoin.findMany({ where: { id_coin: coin.id, id_user: { in: users.map(user => user.id) } } })
        : [];
      const amount = balances.reduce((sum, balance) => sum + balance.amount, 0);
      const current = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: faculty.id } });
      if (current) {
        if (current.amount !== amount) await prisma.balanceFacult.update({ where: { id: current.id }, data: { amount } });
      } else if (amount !== 0) {
        await prisma.balanceFacult.create({ data: { id_coin: coin.id, id_facult: faculty.id, amount } });
      }
      currencies++;
    }
  }
  return { faculties: faculties.length, currencies };
}

export type FacultyBalanceChange = {
  faculty: string;
  currency: string;
  before: number;
  after: number;
};

export async function RecalculateFacultyBalancesWithChanges(allianceId?: number): Promise<{
  faculties: number;
  currencies: number;
  changes: FacultyBalanceChange[];
}> {
  const faculties = await prisma.allianceFacult.findMany({
    where: allianceId === undefined ? undefined : { id_alliance: allianceId },
    include: { alliance: { include: { AllianceCoin: true } } }
  });
  const changes: FacultyBalanceChange[] = [];
  let currencies = 0;
  for (const faculty of faculties) {
    const users = await prisma.user.findMany({ where: { id_alliance: faculty.id_alliance, id_facult: faculty.id } });
    const userIds = users.map(user => user.id);
    for (const coin of faculty.alliance.AllianceCoin) {
      if (!coin.point) continue;
      const balances = userIds.length
        ? await prisma.balanceCoin.findMany({ where: { id_coin: coin.id, id_user: { in: userIds } } })
        : [];
      const amount = balances.reduce((sum, balance) => sum + balance.amount, 0);
      const current = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: faculty.id } });
      const before = current?.amount ?? 0;
      if (current) {
        if (before !== amount) await prisma.balanceFacult.update({ where: { id: current.id }, data: { amount } });
      } else if (amount !== 0) {
        await prisma.balanceFacult.create({ data: { id_coin: coin.id, id_facult: faculty.id, amount } });
      }
      if (before !== amount) changes.push({ faculty: `${faculty.smile} ${faculty.name}`, currency: `${coin.smile} ${coin.name}`, before, after: amount });
      currencies++;
    }
  }
  return { faculties: faculties.length, currencies, changes };
}

export async function RecalculateFacultyBalance(facultyId: number): Promise<void> {
  const faculty = await prisma.allianceFacult.findUnique({
    where: { id: facultyId },
    include: { alliance: { include: { AllianceCoin: true } } }
  });
  if (!faculty) return;
  const users = await prisma.user.findMany({ where: { id_alliance: faculty.id_alliance, id_facult: faculty.id } });
  const userIds = users.map(user => user.id);
  for (const coin of faculty.alliance.AllianceCoin) {
    if (!coin.point) continue;
    const balances = userIds.length
      ? await prisma.balanceCoin.findMany({ where: { id_coin: coin.id, id_user: { in: userIds } } })
      : [];
    const amount = balances.reduce((sum, balance) => sum + balance.amount, 0);
    const current = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: faculty.id } });
    if (current) await prisma.balanceFacult.update({ where: { id: current.id }, data: { amount } });
    else if (amount !== 0) await prisma.balanceFacult.create({ data: { id_coin: coin.id, id_facult: faculty.id, amount } });
  }
}
