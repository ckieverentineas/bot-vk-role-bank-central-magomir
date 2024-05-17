import { Alliance, AllianceCoin } from "@prisma/client";
import prisma from "./prisma_client";
import { Person_Get } from "./person/person";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, timer_text_oper } from "../../..";
import { Confirm_User_Success, Keyboard_Index, Logger } from "../../core/helper";


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

export async function Alliance_Coin_Converter_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: user?.id_alliance!}})
    if (!alliance) { return }
    if (!user) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance!)) {
            keyboard.textButton({ label: `🧬 ${alliance_coin.id}-${alliance_coin.name.slice(0,30)}`, payload: { command: 'alliance_coin_edit', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row()
            //.textButton({ label: `⛔`, payload: { command: 'alliance_coin_delete', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row()
            //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\nРейтинговая валюта: ${alliance_coin?.point == true ? "✅" : "⛔"}\n Курс конвертации: ${alliance_coin.course_medal}🔘 --> ${alliance_coin.course_coin}${alliance_coin.smile}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `←`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_coin_counter) { keyboard.textButton({ label: `→`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) }
        //keyboard.textButton({ label: `➕`, payload: { command: 'alliance_coin_create', cursor: cursor }, color: 'secondary' }).row()
        keyboard.textButton({ label: `🚫`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_coin_counter}`
        const allicoin_bt = await context.question(`🧷 Выберите валюту ${alliance?.name}:\n\n ${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`⏰ Время ожидания выбора валюты ${alliance?.name} истекло!`) }
        if (!allicoin_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            const config: any = {
                'alliance_coin_edit': Alliance_Coin_Edit,
                'alliance_coin_next': Alliance_Coin_Next,
                'alliance_coin_back': Alliance_Coin_Back,
                'alliance_coin_return': Alliance_Coin_Return,
            }
            const ans = await config[allicoin_bt.payload.command](context, allicoin_bt.payload, alliance)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        }
    }
    await Keyboard_Index(context, '💡 Конвертируем вашу жизнь в ее лучшую версию!')
}

async function Alliance_Coin_Return(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`Вы отменили меню конвертации валют ролевого проекта ${alliance.id}-${alliance.name}`)
    return res
}

async function Alliance_Coin_Edit(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    let money_check = false
    const user = await Person_Get(context)
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    let coi = user!.medal
    let calc = 0
    while (money_check == false) {
        calc = Math.floor(coi/alliance_coin_check?.course_medal!*alliance_coin_check?.course_coin!)
        const gold: any = await context.question(`🧷 Вы можете cконвертировать ${user?.medal}🔘:\n⚖ Будет сконвертированно: \n ${coi}🔘-->${calc}${alliance_coin_check?.smile}\n⚠ Введите желаемое количество жетонов для конвертации:`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: '!подтвердить', payload: { command: 'student' }, color: 'secondary' })
                .textButton({ label: '!отмена', payload: { command: 'citizen' }, color: 'secondary' })
                .oneTime().inline()
            }, timer_text_oper
        ) 
        if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание количества валюты конвертации истекло!`); return res }
        if (gold.text == '!подтвердить') {
            money_check = true
        } else {
            if (gold.text == '!отмена') {
                return res
            }
            if (typeof Number(gold.text) === "number") {
                const input = Number(gold.text)
                if (input < 0) {
                    await context.send(`⚠ Введите положительное количество жетонов!`);
                    continue
                }
                if (input > user!.medal) {
                    await context.send(`⚠ У вас нет столько жетонов на балансе, вы можете ввести до ${user!.medal}🔘 включительно!`);
                    continue
                }
                if (Number.isNaN(input)) {
                    await context.send(`⚠ Не ну реально, ты дурак/дура или как? Число напиши нафиг!`);
                    continue
                }
                coi = Math.floor(input)
            } 
        }
    }
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `сконвертировать ${coi} [🔘 Жетоны] в  ${calc} [${alliance_coin_check?.smile} ${alliance_coin_check?.name}]?`)
    await context.send(`${rank_check.text}`)
    const balance_check = await prisma.balanceCoin.findFirst({ where: { id_coin: alliance_coin_check?.id, id_user: user?.id } })
    if (rank_check.status && balance_check) {
        const quest_up = await prisma.balanceCoin.update({ where: { id: balance_check.id }, data: { amount: { increment: calc } } })
        const medal_down = await prisma.user.update({ where: { id: user?.id }, data: { medal: { decrement: coi } } })
        if (quest_up && medal_down) {
            await Logger(`Converted, coin: ${alliance_coin_check?.name}-${alliance_coin_check?.smile} 🔘 --> ${user?.medal} - ${coi} = ${medal_down.medal} ${alliance_coin_check?.smile} --> ${balance_check.amount} + ${calc} = ${quest_up.amount} by player ${context.senderId}`)
            await context.send(`⚙ Вы успешно сконвертировали валюту. Ваш баланс поменялся следующим образом:\n\n🔘 --> ${user?.medal} - ${coi} = ${medal_down.medal} \n${alliance_coin_check?.smile} --> ${balance_check.amount} + ${calc} = ${quest_up.amount}`)
        }
    }
    return res
}

async function Alliance_Coin_Next(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Coin_Back(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor-5 }
    return res
}