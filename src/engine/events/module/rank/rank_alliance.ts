import { Alliance, AllianceCoin, BalanceFacult, User } from "@prisma/client";

import { Keyboard, KeyboardBuilder } from "vk-io";
import { Person_Coin_Printer_Self } from "../person/person_coin";
import { Carusel_Selector, Fixed_Number_To_Five, Keyboard_Index, Logger } from "../../../core/helper";
import { title } from "process";
import prisma from "../prisma_client";
import { Person_Get } from "../person/person";
import { answerTimeLimit } from "../../../..";


//контроллер управления валютами альянса
async function Alliance_Coin_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    let counter = 0
    let limiter = 0
    let res: AllianceCoin[] = []
    for (const allicoin of await prisma.allianceCoin.findMany({ where: { id_alliance: alliance.id } })) {
        if ((cursor <= counter && batchSize+cursor >= counter) && limiter < batchSize) {
            res.push(allicoin)
            limiter++
        }
        counter++
    }
    
   return res
}

export async function Alliance_Coin_Rank_Admin_Printer(context: any) {
    const user = await Person_Get(context)
    if (!user) { return }
    const alliance = await prisma.alliance.findFirst({ where: { id: user?.id_alliance ?? 0 }})
    if (!alliance) { return }
    const allicoin = await prisma.allianceCoin.findMany({ where: { id_alliance: alliance.id } })
    const coin = await Carusel_Selector(context, { message_title: `Выберите ролевую валюту`, menu: allicoin, smile: `smile`, name: `name`, title: `Ролевая валюта`})
    if (!coin.status) { return await context.send(`⚠ Ролевая валюта не выбрана!`)}
    const allifacult = await prisma.allianceFacult.findMany({ where: { id_alliance: alliance.id } })
    const facult = await Carusel_Selector(context, { message_title: `Выберите ролевой факультет`, menu: allifacult, smile: `smile`, name: `name`, title: `Ролевой факультет`})
    if (!facult.status) { return await context.send(`⚠ Ролевой факультет не выбран!`)}
    const facult_sel = await prisma.allianceFacult.findFirst({ where: { id: facult.id, id_alliance: Number(user.id_alliance) } })
    const coin_sel = await prisma.allianceCoin.findFirst({ where: { id: coin.id, id_alliance: Number(user.id_alliance) }})
    const keyboard = new KeyboardBuilder()
    const stat: { rank: number, text: string, score: number, me: boolean }[] = []
    let counter = 1
    for (const userok of await prisma.user.findMany({ where: { id_alliance: alliance.id, id_facult: facult.id } })) {
        const info_coin = await Person_Coin_Printer_Self(context, userok.id)
        const user_balance = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: userok.id } })
        if (user_balance) {
            stat.push({
                rank: counter,
                text: `- UID-${userok.id} @id${userok.idvk}(${userok.name.slice(0, 20)}) --> ${user_balance.amount}${coin_sel?.smile}\n`,
                score: user_balance.amount,
                me: userok.idvk == user.idvk ? true : false
            })
            counter++
        }
    }
    stat.sort(function(a, b){
        return b.score - a.score;
    });
    let allicoin_tr = false
    let cursor = 0
    let counter_init = 0
    const counter_go = counter
    while (!allicoin_tr) {
        let text = `⚙ Рейтинг персонажей по ролевой валюте [${coin_sel?.name}${coin_sel?.smile}] в ролевом проекте [${alliance?.name}] на факультете [${facult_sel?.name}${facult_sel?.smile}]:\n\n`
        let counter_last = 1
        let counter_limit = 0
        let trig_find_me = false
        for (const stat_sel of stat) {
            if (counter_last >= counter_init && counter_limit <= 10) {
                text += `${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
                if (stat_sel.me) { trig_find_me = true }
                counter_limit++
            }
            if ((counter_last <= counter_init || counter_limit > 10)) {
                if (stat_sel.me) {
                    text += `\n\n${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
                }

            }
            counter_last++
        }
        text += `\n\n☠ В статистике участвует ${counter_go-1} персонажей`
        const keyboard = new KeyboardBuilder()
        if (-10+counter_init >= 0 && -10+counter_init < stat.length) {
            keyboard.textButton({ label: '<', payload: { command: 'alliance_coin_enter', counter_init: -10+counter_init }, color: 'secondary' })
        }
        if (10+counter_init < stat.length) {
            keyboard.textButton({ label: '>', payload: { command: 'alliance_coin_enter', counter_init: 10+counter_init }, color: 'secondary', })
        }
        keyboard.textButton({ label: '🚫', payload: { command: 'alliance_coin_return' }, color: 'secondary' }).inline().oneTime()
        
        const allicoin_bt = await context.question(`${text}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`⏰ Время ожидания выбора валюты ${alliance?.name} истекло!`) }
        if (!allicoin_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            const config: any = {
                'alliance_coin_next': Alliance_Coin_Rank_Admin_Next,
                'alliance_coin_back': Alliance_Coin_Rank_Admin_Back,
                'alliance_coin_return': Alliance_Coin_Rank_Admin_Return,
            }
            const ans = await config[allicoin_bt.payload.command](context, allicoin_bt.payload, alliance)
            counter_init = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        }
    }
    
    await Keyboard_Index(context, '💡 Конвертируем вашу жизнь в ее лучшую версию!')
}

async function Alliance_Coin_Rank_Admin_Return(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`⚠ Вы отменили меню рейтингов валют ролевого проекта ${alliance.id}-${alliance.name} по факультетам`, { keyboard: Keyboard.builder().callbackButton({ label: '🌐 В ролевую', payload: { command: 'alliance_enter' }, color: 'primary' }).inline() })
    return res
}

async function Alliance_Coin_Rank_Admin_Next(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor+10 }
    return res
}

async function Alliance_Coin_Rank_Admin_Back(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor-10 }
    return res
}

