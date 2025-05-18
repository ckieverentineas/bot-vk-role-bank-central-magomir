import { Keyboard, KeyboardBuilder } from "vk-io"
import { Accessed, Logger, Send_Message, Send_Message_Detected } from "../../../core/helper"
import { answerTimeLimit, chat_id } from "../../../.."
import prisma from "../prisma_client"
import { ico_list } from "../data_center/icons_lib"
import { Back } from "./operation_global"
import { Editor } from "./person_editor"
import { User } from "@prisma/client"

//Модуль доп клавиатуры
export async function Sub_Menu(id: number, context: any, user_adm: User) {
    const keyboard = new KeyboardBuilder()
    keyboard.textButton({ label: '✏', payload: { command: 'editor' }, color: 'secondary' })
    .textButton({ label: '👁👜', payload: { command: 'inventory_show' }, color: 'secondary' }).row()
    .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
    .textButton({ label: '👠', payload: { command: 'user_drop' }, color: 'secondary' }).row()
    if (await Accessed(context) == 3) { keyboard.textButton({ label: '☠', payload: { command: 'user_delete' }, color: 'secondary' }) }
    const ans_again: any = await context.question( `✉ Доступны следующие операции с 💳UID: ${id}`, { keyboard: keyboard.oneTime().inline(), answerTimeLimit })
    await Logger(`In a private chat, the sub menu for user ${id} is viewed by admin ${context.senderId}`)
    if (ans_again.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${id} истекло!`) }
    const config: any = {
        'back': Back,
        'inventory_show': Inventory_Show,
        'user_delete': User_delete,
        'user_drop': User_Drop,
        'editor': Editor,
    }
    if (ans_again?.payload?.command in config) {
        const commandHandler = config[ans_again.payload.command];
        const answergot = await commandHandler(Number(id), context, user_adm)
    } else {
        await context.send(`⚙ Операция отменена пользователем.`)
    }
}

async function User_Drop(id: number, context: any, user_adm: User) {
    const user_get: any = await prisma.user.findFirst({ where: { id: id } })
    const confirmq = await context.question(`⁉ Вы уверены, что хотите выпнуть с ролевого проекта ${user_get.name}`,
        {
            keyboard: Keyboard.builder()
            .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
            .textButton({ label: 'Нет', payload: { command: 'gold_down' }, color: 'secondary' })
            .oneTime().inline(),
            answerTimeLimit
        }
    )
    if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на подтверждение пинка для ${user_get.name} истекло!`) }
    if (confirmq.payload.command === 'confirm' && user_get) {
        if (user_get) {
            // модуль принятия решения с баллами
            let answer_check = false
            let rank_action = null
            while (answer_check == false) {
                const answer_selector = await context.question(`🧷 Укажите что будем делать с баллами ученика инвестированными в факультет за текущий учебный год:`,
                    {	
                        keyboard: Keyboard.builder()
                        .textButton({ label: 'Ничего не делать', payload: { command: 'student' }, color: 'secondary' }).row()
                        .textButton({ label: 'Обнулить', payload: { command: 'professor' }, color: 'secondary' }).row()
                        .oneTime().inline(), answerTimeLimit
                    }
                )
                if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
                if (!answer_selector.payload) {
                    await context.send(`💡 Жмите только по кнопкам с иконками!`)
                } else {
                    rank_action = answer_selector.text
                    answer_check = true
                }
            }
            const alli_get = await prisma.alliance.findFirst({ where: { id: Number(id) } })
            const user_del = await prisma.user.update({ where: { id: id }, data: { id_alliance: 0, id_facult: 0, id_role: 1 } })
            await context.send(`❗ Выпнут пользователь ${user_del.name}`)
            const notif_ans = await Send_Message_Detected(user_del.idvk, `❗ Ваш персонаж 💳UID: ${user_del.id} больше не состоит в ролевой.`)
            !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_del.name} не доставлено`) : await context.send(`⚙ Операция пинка пользователю завершена успешно.`)
            const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "👠👤" > исключает из ролевого проекта ролевика @id${user_del.idvk}(${user_del.name})`
            if (alli_get) { await Send_Message(alli_get.id_chat, ans_log) }
            await Send_Message(chat_id, ans_log)
            await Logger(`In database, updated status user: ${user_del.idvk}-${user_del.id} on SOLO by admin ${context.senderId}`)
            // Движок модуля принятия решений с баллами
            const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user_get.id_facult! } })
            switch (rank_action) {
                case 'Ничего не делать':
                    break;
                case 'Обнулить':
                    for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user_get.id_alliance! } })) {
                        if (coin.point == false) { continue }
                        const bal_fac = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: user_get.id_facult! }})
                        const bal_usr = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user_get.id }})
                        if ( !bal_fac || !bal_usr) { continue }
                        const bal_fac_ch = await prisma.balanceFacult.update({ where: { id: bal_fac.id }, data: { amount: { decrement: bal_usr.amount } } })
                        const bal_usr_ch = await prisma.balanceCoin.update({ where: { id: bal_usr.id }, data: { amount: 0 } })
                        const ans_log = `🌐 "${rank_action}${coin.smile}" > ${bal_fac.amount} - ${bal_usr.amount} = ${bal_fac_ch.amount} для Факультета [${alli_fac!.smile} ${alli_fac!.name}], баланс: ${bal_usr_ch.amount}${coin.smile} из-за крота @id${user_get.idvk}(${user_get.name})`
                        const notif_ans_chat = await Send_Message_Detected(alli_get?.id_chat ?? 0, ans_log)
                        if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) } 
                    }
                    break;
                default:
                    break;
            }
        } 
    } else {
        await context.send(`⚙ Пинок ролевика ${user_get.name} отменен.`)
    }
}

//Модуль уничтожения персонажа
async function User_delete(id: number, context: any, user_adm: User) {
    const user_get: any = await prisma.user.findFirst({ where: { id: id } })
    const confirmq = await context.question(`⁉ Вы уверены, что хотите удалить клиента ${user_get.name}`,
        {
            keyboard: Keyboard.builder()
            .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
            .textButton({ label: 'Нет', payload: { command: 'gold_down' }, color: 'secondary' })
            .oneTime().inline(),
            answerTimeLimit
        }
    )
    if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на подтверждение удаления ${user_get.name} истекло!`) }
    if (confirmq.payload.command === 'confirm' && user_get) {
        if (user_get) {
            const user_del = await prisma.user.delete({ where: { id: id } })
            await context.send(`❗ Удален пользователь ${user_del.name}`)
            if (user_del) {
                const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: user_del.idvk } })
                if (!check_bbox) {
                    const add_bbox = await prisma.blackBox.create({ data: { idvk: user_del.idvk } })
                    add_bbox ? await context.send(`⚙ @id${user_del.idvk}(${user_del.name}) теперь является нелегалом.`) : await context.send(`⚙ @id${user_del.idvk}(${user_del.name}) не смог стать нелегалом.`)
                } else {
                    await context.send(`⚙ @id${user_del.idvk}(${user_del.name}) депортируется НА РОДИНУ уже не в первый раз.`)
                }
                const notif_ans = await Send_Message_Detected(user_del.idvk, `❗ Ваш персонаж 💳UID: ${user_del.id} больше не обслуживается. Спасибо, что пользовались Центробанком Магомира Онлайн 🏦, ${user_del.name}. Возвращайтесь к нам снова!`)
                !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_del.name} не доставлено`) : await context.send(`⚙ Операция удаления пользователя завершена успешно.`)
                const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "🚫👤" > удаляется из банковской системы карточка @id${user_del.idvk}(${user_del.name})`
                await Send_Message(chat_id, ans_log)
            }
            await Logger(`In database, deleted user: ${user_del.idvk}-${user_del.id} by admin ${context.senderId}`)
        } 
    } else {
        await context.send(`⚙ Удаление ${user_get.name} отменено.`)
    }
}

async function Inventory_Show(id: number, context: any, user_adm: User) { 
    const artefact = await prisma.inventory.findMany({ where: { id_user: id } })
    if (artefact.length > 0) {
        for(const element of artefact) {
            const item: any = await prisma.item.findFirst({ where: { id: element.id_item }, include: { category: true } })
            await context.send(`💬: ${item.name}-${element.id} \n 🔧: ${item.category.name}-${item.price}${ico_list.medal.ico}`,
                {
                    keyboard: Keyboard.builder()
                    .textButton({ label: 'Удалить👜', payload: { command: `${element.id}` }, color: 'secondary' })
                    .oneTime().inline()
                }
            )
        }
    } else {
        await context.send(`✉ Товары отсутствуют =(`)
    }
    await Logger(`In private chat, the inventory user uid ${id} is viewed by admin ${context.senderId}`)
}