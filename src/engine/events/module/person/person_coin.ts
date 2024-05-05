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
export async function Person_Coin_Init(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let coin_get: Array<{ id: number, amount: number }> = user?.coin ? JSON.parse(user?.coin) : []
    if (coin_get) {
        for (const coi of await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })) {
            console.log(coi)
            coin_get = await Person_Coin_Finder(coin_get, coi)
        }
    } else {
        console.log(`Ошибка дед`)
    }
    const data = await prisma.user.update({ where: { id: user.id }, data: { coin: JSON.stringify(coin_get) }})
    return coin_get
}

async function Person_Coin_Init_Target(target: number) {
    const user = await prisma.user.findFirst({ where: { id: target } })
    if (!user) { return }
    let coin_get: Array<{ id: number, amount: number }> = user?.coin ? JSON.parse(user?.coin) : []
    if (coin_get) {
        for (const coi of await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })) {
            console.log(coi)
            coin_get = await Person_Coin_Finder(coin_get, coi)
        }
    } else {
        console.log(`Ошибка дед`)
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
export async function Person_Coin_Change(context: any, data: { coin: AllianceCoin | null, operation: String | null, amount: number }, target: number) {
    const user = await prisma.user.findFirst({ where: { id: target } })
    let coin_get: Array<{ id: number, amount: number }> | undefined = await Person_Coin_Init_Target(target)
    if (!coin_get) { return }
    switch (data.operation) {
        case '+':
            for (const dat of coin_get) {
                if (data.coin?.id == dat.id) {
                    dat.amount += data.amount
                }
            }
            break;
        case '-':
            for (const dat of coin_get) {
                if (data.coin?.id == dat.id) {
                    dat.amount -= data.amount
                }
            }
            break;
    
        default:
            break;
    }
    return coin_get
}