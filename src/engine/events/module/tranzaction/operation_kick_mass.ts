import { Keyboard, KeyboardBuilder } from "vk-io"
import { Accessed, Confirm_User_Success, Fixed_Number_To_Five, Logger, Send_Message, Send_Message_Smart } from "../../../core/helper"
import { answerTimeLimit, chat_id, timer_text } from "../../../.."
import prisma from "../prisma_client"
import { Person_Coin_Printer_Self } from "../person/person_coin"
import { Back, Ipnut_Message } from "./operation_global"
import { AllianceCoin, BalanceCoin, BalanceFacult, User } from "@prisma/client"
import { Facult_Coin_Printer_Self } from "../alliance/facult_rank"
import { ico_list } from "../data_center/icons_lib"
import { getTerminology } from "../alliance/terminology_helper"

// Тип для удобной работы с валютами
interface LightAllianceCoin {
    id: number;
    name: string;
    smile: string;
    point: boolean;
    converted: boolean;
    converted_point: boolean;
    sbp_on: boolean;
    course_medal: number;
    course_coin: number;
}

export async function Operation_Kick_Mass(context: any) {
    if (context.peerType == 'chat') { return }
    if (await Accessed(context) == 1) { return } // Только для админов

    let name_check = false
    let uids_prefab = null

    // === ШАГ 1: Ввод списка UID ===
    while (name_check == false) {
        const uid: any = await context.question( 
            `🧷 Введите список 💳UID банковских счетов для исключения формата:\n"UID1 UID2 .. UIDN"`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
        if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковских счетов истекло!')}
        
        if (uid.text === "0") {
            await context.send(`⚙ Кастомные массовые пинки пока в разработке. Введите UID через пробел.`)
            continue
        }
        
        if (/(?:^|\s)(\d+)(?=\s|$)/g.test(uid.text)) {
            uids_prefab = uid.text.match(/(?:^|\s)(\d+)(?=\s|$)/g)
            await context.send(`⚙ Подготовка к массовым пинкам, товарищ палач!`)
            name_check = true
        } else {
            if (uid.text == "🚫Отмена") { 
                await context.send(`💡 Операции прерваны пользователем!`) 
                return
            }
            await context.send(`💡 Необходимо ввести корректные UID!`)
        }
    }

    // === ШАГ 2: Получаем информацию об админе ===
    const account_adm = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    if (!account_adm) { return }
    const person_adm = await prisma.user.findFirst({ where: { id: account_adm.select_user } })
    if (!person_adm) { return }

    // === ШАГ 3: Фильтруем UID ===
    let uids: Array<number> = []
    for (const ui of uids_prefab) {
        const user_gt = await prisma.user.findFirst({ where: { id: Number(ui) } })
        if (!user_gt) { 
            await Send_Message(context.senderId, `⚠ Персонаж с UID${ui} не найден`); 
            continue 
        }
        if (user_gt.id_alliance != person_adm.id_alliance) {
            await Send_Message(context.senderId, `⚠ Персонаж с UID${ui} не состоит в вашей ролевой`); 
            if (await Accessed(context) != 3) { continue }
        }
        uids.push(Number(ui))
    }

    if (uids.length === 0) {
        await context.send(`❌ Нет валидных UID для выполнения операции.`)
        return
    }

    // === ШАГ 4: Выбор действия с баллами ===
    const alli_get = await prisma.alliance.findFirst({ where: { id: person_adm.id_alliance ?? 0 } })
    const singular = await getTerminology(alli_get?.id || 0, 'singular')
    const genitive = await getTerminology(alli_get?.id || 0, 'genitive')

    let rank_action = null
    let action_check = false
    while (action_check == false) {
        const answer_selector = await context.question(
            `🧷 Укажите, что будем делать с валютами исключаемых игроков:`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: 'Ничего не делать', payload: { command: 'student' }, color: 'secondary' }).row()
                .textButton({ label: 'Обнулить (только рейтинговые)', payload: { command: 'professor' }, color: 'secondary' }).row()
                .textButton({ label: 'Ограбить (все валюты)', payload: { command: 'rob' }, color: 'secondary' }).row()
                .oneTime().inline(), 
                answerTimeLimit
            }
        )
        if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора действия истекло!`) }
        if (!answer_selector.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            rank_action = answer_selector.payload.command
            action_check = true
        }
    }

    // === ШАГ 5: Сбор сводки для подтверждения ===
    let summaryMessage = `бескомпромиссно покикать следующих игроков?\n\n`
    let totalPlayers = 0

    for (const uid of uids) {
        const user = await prisma.user.findFirst({ where: { id: uid } })
        if (!user) continue

        totalPlayers++
        summaryMessage += `👤 ${user.name} (UID: ${user.id}):\n`

        let userHasCoins = false
        for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user.id_alliance! } })) {
            const bal_usr = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user.id }})
            if (!bal_usr || bal_usr.amount == 0) { continue }

            userHasCoins = true
            summaryMessage += `   ${coin.smile} ${coin.name}: ${bal_usr.amount}\n`
            
            if (rank_action === 'rob' && coin.point && user.id_facult) {
                const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult } })
                if (alli_fac) {
                    summaryMessage += `      ➡️ Будет снято с ${alli_fac.smile} ${alli_fac.name}\n`
                }
            }
        }
        if (!userHasCoins) {
            summaryMessage += `   Нет валют для изъятия.\n`
        }
    }

    summaryMessage += `\nВсего игроков: ${totalPlayers}\n\n⚠️ Это действие нельзя отменить!`

    const finalConfirm = await Confirm_User_Success(context, summaryMessage)
    if (!finalConfirm.status) {
        await context.send(`⚙ Массовое исключение отменено.`)
        return
    }

    let successCount = 0
    let failCount = 0

    // Логируем начало операции
    await Logger(`Mass kick started by admin ${context.senderId}: ${uids.length} players, action: ${rank_action}`)

    for (const uid of uids) {
        try {
            const user_get = await prisma.user.findFirst({ where: { id: uid } })
            if (!user_get) { 
                await context.send(`⛔ Банковская карточка с 💳UID ${uid} не найдена`)
                failCount++
                continue 
            }

            // Сохраняем старые значения для лога
            const oldAlliance = user_get.id_alliance
            const oldFacult = user_get.id_facult

            // Выполняем исключение
            const user_del = await prisma.user.update({ 
                where: { id: uid }, 
                data: { id_alliance: 0, id_facult: 0, id_role: 1 } 
            })

            // Обработка баллов согласно выбранному действию
            const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user_get.id_facult! } })
            
            // Собираем информацию о списаниях для лога
            let coinsLog = ''

            switch (rank_action) {
                case 'professor': // Обнулить
                    for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user_get.id_alliance! } })) {
                        if (coin.point == false) { continue }
                        const bal_fac = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: user_get.id_facult! }})
                        const bal_usr = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user_get.id }})
                        if ( !bal_fac || !bal_usr) { continue }
                        
                        await prisma.balanceFacult.update({ 
                            where: { id: bal_fac.id }, 
                            data: { amount: { decrement: bal_usr.amount } } 
                        })
                        await prisma.balanceCoin.update({ 
                            where: { id: bal_usr.id }, 
                            data: { amount: 0 } 
                        })
                        coinsLog += `${bal_usr.amount}${coin.smile} обнулено (рейтинг)\n`
                    }
                    break

                case 'rob': // Ограбить
                    for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user_get.id_alliance! } })) {
                        const bal_usr = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user_get.id }})
                        if (!bal_usr || bal_usr.amount == 0) { continue }
                        
                        if (coin.point && user_get.id_facult) {
                            const bal_fac = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: user_get.id_facult! }})
                            if (bal_fac) {
                                await prisma.balanceFacult.update({ 
                                    where: { id: bal_fac.id }, 
                                    data: { amount: { decrement: bal_usr.amount } } 
                                })
                            }
                        }
                        
                        await prisma.balanceCoin.update({ 
                            where: { id: bal_usr.id }, 
                            data: { amount: 0 } 
                        })
                        coinsLog += `${bal_usr.amount}${coin.smile} изъято\n`
                    }
                    break
            }

            // === ЛОГ ПО КАЖДОМУ ИГРОКУ ===
            const actionText = rank_action === 'professor' ? 'Обнулить' : 
                              rank_action === 'rob' ? 'Ограбить' : 'Ничего'
            
            // Сообщение админу
            const adminMessage = `⚙ Игрок ${user_get.name} (UID: ${user_get.id}) исключён.`
            await Send_Message(context.senderId, adminMessage)
            
            // Лог в основной чат
            const logMessage = `⚙ @id${context.senderId}(${person_adm.name}) > "👠👤" > исключён @id${user_get.idvk}(${user_get.name}).`
            await Send_Message(chat_id, logMessage)
            
            await Logger(`User ${user_get.idvk} kicked by admin ${context.senderId}. Action: ${actionText}`)

            // Уведомление исключённому игроку
            await Send_Message(user_get.idvk, 
                `❗ Ваш персонаж 💳UID: ${user_get.id} исключён из ролевого проекта.`
            )

            successCount++

        } catch (error) {
            console.error(`Error kicking user ${uid}:`, error)
            await context.send(`⚠ Ошибка при исключении UID ${uid}`)
            failCount++
        }
    }

    // === ШАГ 7: Итоговый отчёт админу ===
    const actionText = rank_action === 'professor' ? 'Обнулить (только рейтинговые)' : 
                      rank_action === 'rob' ? 'Ограбить (все валюты)' : 'Ничего не делать'
    
    const resultMessage = `✅ Массовое исключение завершено!\n\n` +
        `✅ Успешно исключено: ${successCount}\n` +
        `❌ Ошибок: ${failCount}\n` +
        `🧷 Действие: ${actionText}`

    await context.send(resultMessage)

    await Logger(`Mass kick completed by admin ${context.senderId}: ${successCount}/${uids.length} successful`)
}