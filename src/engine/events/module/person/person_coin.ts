import { AllianceCoin, User } from "@prisma/client";
import { Person_Get } from "./person";
import prisma from "../prisma_client";

async function Person_Coin_Finder(context: any, data: Array<{ id: number, amount: number }>, target: AllianceCoin) {
    let find = false
    for (const dat of data) {
        if (target.id == dat.id) {
            find = true
        }
    }
    if (!find) {
        data.push({ id: target.id, amount: 0 })
    }
    return data
}
export async function Person_Coin_Init(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let coin_get: Array<{ id: number, amount: number }> = user?.coin ? JSON.parse(user?.coin) : []
    if (coin_get) {
        for (const coi of await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })) {
            console.log(coi)
            coin_get = await Person_Coin_Finder(context, coin_get, coi)
        }
    }
    const data = await prisma.user.update({ where: { id: user.id }, data: { coin: JSON.stringify(coin_get) }})
    return coin_get
}

export async function Person_Coin_Printer(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let coin_get: Array<{ id: number, amount: number }> | null | undefined = await Person_Coin_Init(context)
    let res = ``
    if (coin_get) {
        for (const coi of coin_get) {
            const coi_get = await prisma.allianceCoin.findFirst({ where: { id: Number(coi.id) } })
            res += `${coi_get?.smile} ${coi_get?.name}: ${coi.amount}\n`
        }
    }
    return res
}