import { AllianceCoin, User } from "@prisma/client";
import { Person_Get } from "./person";
import prisma from "../prisma_client";
import { Logger } from "../../../core/helper";

async function Person_Coin_Finder(data: Array<{ id: number, amount: number }>, target: AllianceCoin) {
    let find = false
    for (const dat of data) {
        if (target.id == dat.id) {
            find = true
        }
    }
    if (!find) {
        try {
            data.push({ id: target.id, amount: 0 })
        } catch(e) {
            await Logger(`Error fatality with add new coin ${e}`)
            data = []
        }
    }
    return data
}

export async function Person_Coin_Printer(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let res = ``
    for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user.id_alliance! } })) {
        const coin_check = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user.id }})
        if (!coin_check) {
            const coin_init = await prisma.balanceCoin.create({ data: { id_coin: Number(coin.id), id_user: Number(user.id), amount: 0 } })
            res += `${coin.smile} ${coin.name}: ${coin_init.amount}\n`
            await Logger(`In database, init balance coin: ${coin.smile} ${coin.name} by user ${context.senderId}`)
        } else {
            res += `${coin.smile} ${coin.name}: ${coin_check.amount}\n`
        }
    }
    return res
}