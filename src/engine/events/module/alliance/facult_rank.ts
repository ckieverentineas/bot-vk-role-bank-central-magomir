import { AllianceCoin, User } from "@prisma/client";
import prisma from "../prisma_client";
import { Logger } from "../../../core/helper";
import { Person_Get } from "../person/person";

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

export async function Facult_Rank_Printer(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let res = ``
    for (const facult of await prisma.allianceFacult.findMany({ where: { id_alliance: user.id_alliance! } })) {
        res += `${facult.smile} ${facult.name}\n`
        for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user.id_alliance! } })) {
            if (coin.point) {
                const coin_check = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: facult.id }})
                if (!coin_check) {
                    const coin_init = await prisma.balanceFacult.create({ data: { id_coin: Number(coin.id), id_facult: Number(facult.id), amount: 0 } })
                    res += `${coin.smile} ${coin.name}: ${coin_init.amount}\n`
                    await Logger(`In database, init balance facult: ${coin.smile} ${coin.name} for facult ${facult.smile} ${facult.name} by user ${user.idvk}`)
                } else {
                    res += `${coin.smile} ${coin.name}: ${coin_check.amount}\n`
                }
            }
        }
        res += `\n`
        
    }
    return res
}

export async function Facult_Coin_Printer_Self(context: any, id: number) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: id } })
    if (!user) { return }
    let res = { text: '', smile: '' }
    for (const facult of await prisma.allianceFacult.findMany({ where: { id_alliance: user.id_alliance! } })) {
        res.text += `${facult.smile} ${facult.name} -->\n`
        for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user.id_alliance! } })) {
            if (coin.point) {
                const coin_check = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: facult.id }})
                if (!coin_check) {
                    const coin_init = await prisma.balanceFacult.create({ data: { id_coin: Number(coin.id), id_facult: Number(facult.id), amount: 0 } })
                    res.text += `${coin.smile} ${coin.name}: ${coin_init.amount}\n`
                    await Logger(`In database, init balance facult: ${coin.smile} ${coin.name} for facult ${facult.smile} ${facult.name} by user ${user.idvk}`)
                } else {
                    res.text += `${coin.smile} ${coin.name}: ${coin_check.amount}\n`
                }
            }
        }
        res.smile += `${facult.smile}`
        res.text += `\n`
        
    }
    return res
}