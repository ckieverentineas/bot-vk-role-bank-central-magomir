import { Account, Alliance, AllianceCoin, BalanceFacult, Monitor, User } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, SECRET_KEY, timer_text, vk } from "../../../..";
import { Confirm_User_Success, Fixed_Number_To_Five, Input_Number, Input_Text, Keyboard_Index, Logger, Select_Alliance_Coin, Send_Message, Send_Message_Question } from "../../../core/helper";
import { Person_Get } from "../person/person";
import * as CryptoJS from 'crypto-js';
import { ico_list } from "../data_center/icons_lib";
import { button_alliance_return } from "../data_center/standart";
import { getTerminology } from "../alliance/terminology_helper"

async function Alliance_Monitor_Get(cursor: number, alliance: Alliance) {
    // ✅ Оптимизированная версия с использованием Prisma пагинации
    return await prisma.monitor.findMany({
        where: { id_alliance: alliance.id },
        take: 5,
        skip: cursor,
        orderBy: { id: 'asc' }
    })
}

export async function Alliance_Monitor_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    if (!user) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        
        // Получаем мониторы для текущей страницы
        const monitors = await Alliance_Monitor_Get(cursor, alliance!)
        for await (const monitor of monitors) {
            const coins = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0 } })
            keyboard.textButton({ label: `${ico_list['edit'].ico} ${monitor.id}-${monitor.name.slice(0,30)}`, payload: { command: 'alliance_coin_edit', cursor: cursor, id_alliance_coin: monitor.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['delete'].ico}`, payload: { command: 'alliance_coin_delete', cursor: cursor, id_alliance_coin: monitor.id }, color: 'secondary' }).row()
            event_logger +=`${ico_list['monitor'].ico} ${monitor.name}: id${monitor.id}\n🧷 Ссылка: https://vk.com/club${monitor.idvk}\n${coins?.smile} Валюта: ${coins?.name}\n🚧 Лимиты: ${monitor.lim_like}${ico_list['like'].ico} ${monitor.lim_comment}${ico_list['message'].ico} ♾${ico_list['post'].ico}\n💰 Стоимость: ${monitor.cost_like}${ico_list['like'].ico} ${monitor.cost_comment}${ico_list['message'].ico} ${monitor.cost_post}${ico_list['post'].ico}\n⚙ Статус: ${monitor.like_on}${ico_list['like'].ico} ${monitor.comment_on}${ico_list['message'].ico} ${monitor.wall_on}${ico_list['post'].ico}\n\n`
        }
        
        // ✅ ИСПРАВЛЕНО: считаем МОНИТОРЫ, а не валюты
        const monitors_count = await prisma.monitor.count({ where: { id_alliance: alliance!.id! } })
        
        // Навигация
        if (cursor >= 5) { 
            keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) 
        }
        if (5 + cursor < monitors_count) { 
            keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) 
        }
        
        // Кнопки действий
        keyboard.textButton({ label: `${ico_list['add'].ico}`, payload: { command: 'alliance_coin_create', cursor: cursor }, color: 'secondary' }).row()
        .textButton({ label: `${ico_list['stop'].ico}`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        
        // ✅ ИСПРАВЛЕНО: показываем правильное количество
        event_logger += `\n ${1 + cursor} из ${monitors_count}`
        
        const allicoin_bt: any = await context.question(`${ico_list['monitor'].ico} Выберите подключенную группу к ${alliance?.name}:\n\n${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора подключенной группы для проекта ${alliance?.name} истекло!`) }
        
        const config: any = {
            'alliance_coin_edit': Alliance_Monitor_Edit,
            'alliance_coin_create': Alliance_Monitor_Create,
            'alliance_coin_next': Alliance_Monitor_Next,
            'alliance_coin_back': Alliance_Monitor_Back,
            'alliance_coin_return': Alliance_Monitor_Return,
            'alliance_coin_delete': Alliance_Monitor_Delete
        }
        if (allicoin_bt?.payload?.command in config) {
            const commandHandler = config[allicoin_bt.payload.command];
            const ans = await commandHandler(context, allicoin_bt.payload, alliance, user)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        } else {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
        }
    }
    await Keyboard_Index(context, `${ico_list['help'].ico} Нужно построить зиккурат!`)
}

async function Alliance_Monitor_Delete(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const alliance_coin_check = await prisma.monitor.findFirst({ where: { id: data.id_alliance_coin } })
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `удалить монитор ${alliance_coin_check?.id}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }
    if (alliance_coin_check) {
        const alliance_coin_del = await prisma.monitor.delete({ where: { id: alliance_coin_check.id } })
        if (alliance_coin_del) {
            await Logger(`In database, deleted alliance monitor: ${alliance_coin_del.id} by admin ${context.senderId}`)
            await context.send(`${ico_list['delete'].ico} Вы удалили монитор: ${alliance_coin_del.id} для ролевой ${alliance.name}!`)
            await Send_Message(chat_id, `🎥 Удален монитор ${alliance_coin_del.name}-${alliance_coin_del.id} для ролевой ${alliance.name}-${alliance.id}`)
            Send_Message(chat_id, `${ico_list['delete'].ico} Удален монитор \n${ico_list['message'].ico} Сообщение: ${alliance_coin_del.name}-${alliance_coin_del.id}\n${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n${ico_list['alliance'].ico} ${alliance.name}`)
        }
    }
    return res
}

async function Alliance_Monitor_Return(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`${ico_list['stop'].ico} Вы отменили меню управления мониторами ролевого проекта ${alliance.id}-${alliance.name}`, { keyboard: button_alliance_return })
    return res
}

async function Alliance_Monitor_Edit_Name(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const monitor = await prisma.monitor.findFirst({ where: { id: data.id_monitor, id_alliance: alliance.id } })
    if (!monitor) { return res }

    const newName = await Input_Text(context, 
        `✏️ Редактирование названия монитора\n\n` +
        `Текущее название: ${monitor.name}\n` +
        `${ico_list['help'].ico} Введите новое название или "отмена" для отмены:`
    )
    
    if (!newName || newName.toLowerCase() === 'отмена') { 
        return res 
    }
    
    if (newName.length < 1 || newName.length > 100) {
        await context.send(`${ico_list['warn'].ico} Название должно быть от 1 до 100 символов!`)
        return res
    }

    const monitor_up = await prisma.monitor.update({ 
        where: { id: monitor.id }, 
        data: { name: newName.trim() } 
    })
    
    await Notify_Monitor_Update(context, alliance, user, monitor_up, `Название: "${monitor.name}" --> "${newName.trim()}"`)
    return res
}

async function Alliance_Monitor_Edit(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }

    while (true) {
        const monitor = await prisma.monitor.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
        if (!monitor) { return res }

        const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0 } })
        const keyboard = new KeyboardBuilder()
            .textButton({ label: '✏️ Название', payload: { command: 'monitor_edit_name', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' })
            .textButton({ label: '💱 Валюта', payload: { command: 'monitor_edit_coin', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' }).row()
            .textButton({ label: `${ico_list['like'].ico} Лимит`, payload: { command: 'monitor_edit_lim_like', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['like'].ico} Цена`, payload: { command: 'monitor_edit_cost_like', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' }).row()
            .textButton({ label: `${ico_list['message'].ico} Лимит`, payload: { command: 'monitor_edit_lim_comment', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['message'].ico} Цена`, payload: { command: 'monitor_edit_cost_comment', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' }).row()
            .textButton({ label: `${ico_list['post'].ico} Цена`, payload: { command: 'monitor_edit_cost_post', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' }).row()
            .textButton({ label: `${ico_list['run'].ico} Запуск`, payload: { command: 'monitor_toggle_starting', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['like'].ico} Лайки`, payload: { command: 'monitor_toggle_like_on', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' }).row()
            .textButton({ label: `${ico_list['message'].ico} Комменты`, payload: { command: 'monitor_toggle_comment_on', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['post'].ico} Посты`, payload: { command: 'monitor_toggle_wall_on', cursor: data.cursor, id_monitor: monitor.id }, color: 'secondary' }).row()

        const text =
            `${ico_list['edit'].ico} Редактирование монитора ${monitor.id}-${monitor.name}\n\n` +
            `${ico_list['attach'].ico} Ссылка: https://vk.com/club${monitor.idvk}\n` +
            `${coin?.smile ?? '💰'} Валюта: ${coin?.name ?? 'не выбрана'}\n` +
            `${ico_list['limit'].ico} Лимиты: ${monitor.lim_like}${ico_list['like'].ico} ${monitor.lim_comment}${ico_list['message'].ico}\n` +
            `${ico_list['money'].ico} Стоимость: ${monitor.cost_like}${ico_list['like'].ico} ${monitor.cost_comment}${ico_list['message'].ico} ${monitor.cost_post}${ico_list['post'].ico}\n` +
            `${ico_list['config'].ico} Статус: запуск ${Format_Monitor_Status(monitor.starting)}, лайки ${Format_Monitor_Status(monitor.like_on)}, комментарии ${Format_Monitor_Status(monitor.comment_on)}, посты ${Format_Monitor_Status(monitor.wall_on)}\n\n` +
            `Выберите, что изменить:`

        const answer = await Send_Message_Question(context, text, keyboard)
        if (answer.exit) { return res }

        const config: any = {
            'monitor_edit_name': Alliance_Monitor_Edit_Name,        // ✅ ДОБАВЛЕНО
            'monitor_edit_coin': Alliance_Monitor_Edit_Coin,
            'monitor_edit_lim_like': Alliance_Monitor_Edit_Like_Limit,
            'monitor_edit_cost_like': Alliance_Monitor_Edit_Like_Cost,
            'monitor_edit_lim_comment': Alliance_Monitor_Edit_Comment_Limit,
            'monitor_edit_cost_comment': Alliance_Monitor_Edit_Comment_Cost,
            'monitor_edit_cost_post': Alliance_Monitor_Edit_Post_Cost,
            'monitor_toggle_starting': Alliance_Monitor_Toggle_Starting,
            'monitor_toggle_like_on': Alliance_Monitor_Toggle_Like,
            'monitor_toggle_comment_on': Alliance_Monitor_Toggle_Comment,
            'monitor_toggle_wall_on': Alliance_Monitor_Toggle_Wall
        }

        if (answer.payload?.command in config) {
            await config[answer.payload.command](context, answer.payload, alliance, user)
        }
    }
}

function Format_Monitor_Status(value: boolean) {
    return value ? "✅" : "⛔"
}

async function Notify_Monitor_Update(context: any, alliance: Alliance, user: User, monitor: Monitor, changes: string) {
    await Logger(`In database, updated monitor: ${monitor.id}-${monitor.name} by admin ${context.senderId}`)
    await context.send(`${ico_list['reconfig'].ico} Вы обновили конфигурацию монитора ${monitor.id}-${monitor.name}.\n${changes}\n\nЧтобы изменения вступили в силу, перезапустите мониторы через ${ico_list['stop'].ico} !моники_off --> ${ico_list['run'].ico} !моники_on.`)
    await Send_Message(chat_id, `${ico_list['reconfig'].ico} Изменение конфигурации ролевого монитора\n${ico_list['message'].ico} Сообщение: ${monitor.id}-${monitor.name}\n${changes}\n${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n${ico_list['alliance'].ico} ${alliance.name}`)
}

async function Update_Monitor_Number_Field(context: any, data: any, alliance: Alliance, user: User, field: string, label: string, icon: string, float = false) {
    const res = { cursor: data.cursor }
    const monitor = await prisma.monitor.findFirst({ where: { id: data.id_monitor, id_alliance: alliance.id } })
    if (!monitor) { return res }

    const currentValue = (monitor as any)[field]
    const newValue = await Input_Number(context, `Вы редактируете ${label}, сейчас ${currentValue}${icon}.\n${ico_list['help'].ico}Отправьте новое значение:`, float)
    if (newValue === false) { return res }

    const updateData: any = {}
    updateData[field] = newValue
    const monitor_up = await prisma.monitor.update({ where: { id: monitor.id }, data: updateData })
    await Notify_Monitor_Update(context, alliance, user, monitor_up, `${label}: ${currentValue} --> ${newValue}`)
    return res
}

async function Toggle_Monitor_Boolean_Field(context: any, data: any, alliance: Alliance, user: User, field: string, label: string) {
    const res = { cursor: data.cursor }
    const monitor = await prisma.monitor.findFirst({ where: { id: data.id_monitor, id_alliance: alliance.id } })
    if (!monitor) { return res }

    const currentValue = Boolean((monitor as any)[field])
    const nextValue = !currentValue
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `переключить "${label}" для монитора ${monitor.name}: ${Format_Monitor_Status(currentValue)} --> ${Format_Monitor_Status(nextValue)}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }

    const updateData: any = {}
    updateData[field] = nextValue
    const monitor_up = await prisma.monitor.update({ where: { id: monitor.id }, data: updateData })
    await Notify_Monitor_Update(context, alliance, user, monitor_up, `${label}: ${Format_Monitor_Status(currentValue)} --> ${Format_Monitor_Status(nextValue)}`)
    return res
}

async function Alliance_Monitor_Edit_Coin(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const monitor = await prisma.monitor.findFirst({ where: { id: data.id_monitor, id_alliance: alliance.id } })
    if (!monitor) { return res }

    const selectedCoinId = await Select_Alliance_Coin(context, alliance.id)
    if (!selectedCoinId) { return res }

    const oldCoin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0 } })
    const newCoin = await prisma.allianceCoin.findFirst({ where: { id: selectedCoinId, id_alliance: alliance.id } })
    if (!newCoin) { return res }

    const monitor_up = await prisma.monitor.update({ where: { id: monitor.id }, data: { id_coin: selectedCoinId } })
    await Notify_Monitor_Update(context, alliance, user, monitor_up, `Валюта: ${oldCoin ? `${oldCoin.smile} ${oldCoin.name}` : 'не выбрана'} --> ${newCoin.smile} ${newCoin.name}`)
    return res
}

async function Alliance_Monitor_Edit_Like_Limit(context: any, data: any, alliance: Alliance, user: User) {
    return await Update_Monitor_Number_Field(context, data, alliance, user, 'lim_like', 'лимит лайков в день', ico_list['like'].ico)
}

async function Alliance_Monitor_Edit_Like_Cost(context: any, data: any, alliance: Alliance, user: User) {
    return await Update_Monitor_Number_Field(context, data, alliance, user, 'cost_like', 'стоимость лайка', ico_list['like'].ico)
}

async function Alliance_Monitor_Edit_Comment_Limit(context: any, data: any, alliance: Alliance, user: User) {
    return await Update_Monitor_Number_Field(context, data, alliance, user, 'lim_comment', 'лимит комментариев в день', ico_list['message'].ico)
}

async function Alliance_Monitor_Edit_Comment_Cost(context: any, data: any, alliance: Alliance, user: User) {
    return await Update_Monitor_Number_Field(context, data, alliance, user, 'cost_comment', 'стоимость комментария', ico_list['message'].ico)
}

async function Alliance_Monitor_Edit_Post_Cost(context: any, data: any, alliance: Alliance, user: User) {
    return await Update_Monitor_Number_Field(context, data, alliance, user, 'cost_post', 'стоимость поста', ico_list['post'].ico)
}

async function Alliance_Monitor_Toggle_Starting(context: any, data: any, alliance: Alliance, user: User) {
    return await Toggle_Monitor_Boolean_Field(context, data, alliance, user, 'starting', 'запланированный запуск')
}

async function Alliance_Monitor_Toggle_Like(context: any, data: any, alliance: Alliance, user: User) {
    return await Toggle_Monitor_Boolean_Field(context, data, alliance, user, 'like_on', 'работа с лайками')
}

async function Alliance_Monitor_Toggle_Comment(context: any, data: any, alliance: Alliance, user: User) {
    return await Toggle_Monitor_Boolean_Field(context, data, alliance, user, 'comment_on', 'работа с комментариями')
}

async function Alliance_Monitor_Toggle_Wall(context: any, data: any, alliance: Alliance, user: User) {
    return await Toggle_Monitor_Boolean_Field(context, data, alliance, user, 'wall_on', 'работа с постами')
}

async function Alliance_Monitor_Next(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Monitor_Back(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor-5 }
    return res
}

async function Alliance_Monitor_Create(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const monik = { token: ``, id_alliance: alliance.id, alliance: alliance.name, id_coin: 0, coin: ``, name: `zero`, idvk_group: 0 }
    
    // воод ссылки на группу
    const targeta = await Input_Text(context, `Введите ссылку на сообщество нового монитора\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`)
    if (!targeta) { return res}
    const temp = targeta.replace(/.*[/]/, "");
    try {
        const [group] = await vk!.api.groups.getById({ group_id: temp });
        if (!group) { return }
        const alli_check = await prisma.monitor.findFirst({ where: { idvk: group.id } })
        if (!alli_check) {
            monik.name = group.name!
            monik.idvk_group = group.id!
        } else {
            await Logger(`In database already created monitor idvk ${group.id}`)
            return await context.send(`⚙ Монитор уже был создан:\n💬 ${alli_check.id} - ${alli_check.name}\n 🧷 Ссылка: https://vk.com/club${alli_check.idvk}\n🌐 Альянс: ${alliance.name}`)
        }
    } catch (e) {
        return await context.send(`⛔ Такой группы не найдено! Монитор не установлен!`)
    }
    
    // Локальная функция для ввода токена без подтверждения
    async function Input_Text_NoConfirm(context: any, prompt: string, limit: number = 300): Promise<string | null> {
        const answer = await context.question(`${prompt}\n\n⚠ Допустимый лимит символов: ${limit}`, timer_text);
        
        if (answer.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время ожидания ввода истекло!`);
            return null;
        }
        
        const user_text = answer.text?.trim();
        
        if (!user_text || user_text.length === 0) {
            await context.send(`${ico_list['help'].ico} Текст не может быть пустым!`);
            return null;
        }
        
        if (user_text.length > limit) {
            await context.send(`${ico_list['warn'].ico} Превышен лимит символов! Максимум: ${limit}`);
            return null;
        }
        
        return user_text;
    }
    
    // воод токен группы БЕЗ подтверждения от Input_Text
    const group_token = await Input_Text_NoConfirm(context, `Введите токен группы.\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`, 600)
    if (!group_token) { return res }

    // Кастомное подтверждение без показа токена
    const keyboard = new KeyboardBuilder()
        .textButton({ label: '✅ Да', payload: { command: 'confirm' }, color: 'positive' })
        .textButton({ label: '❌ Нет', payload: { command: 'cancel' }, color: 'negative' })

    const confirm = await context.question(
        `⁉ Вы ввели токен (${group_token.length} символов).\nВы уверены?`,
        { keyboard: keyboard.inline(), answerTimeLimit }
    )

    if (confirm.isTimeout || confirm.payload?.command !== 'confirm') {
        return await context.send('❌ Ввод токена отменен')
    }

    monik.token = Encrypt_Data(group_token)
    await context.send(`${ico_list['warn'].ico} Токен принят, удалите отправку своего токена из чата в целях безопасности, в базе данных он будет храниться в зашифрованном виде!`)
    
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(alliance.id) }, orderBy: { order: 'asc' } })
    if (!coin_pass) { return await context.send(`${ico_list['warn'].ico} Валют ролевых пока еще нет, чтобы начать=)`) }
    let coin_check = false
    let id_builder_sent1 = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent1 = await Fixed_Number_To_Five(id_builder_sent1)
        let event_logger = `${ico_list['money'].ico} Выберите валюту, с которой будем делать отчисления:\n\n`
        const builder_list: AllianceCoin[] = coin_pass
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent1; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent1: i, id_coin: builder.id, coin: builder.name }, color: 'secondary' }).row()
                event_logger += `\n\n${ico_list['message'].ico} ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                counter++
            }
            event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent1+limiter : limiter-(builder_list.length-id_builder_sent1)} из ${builder_list.length} ~~~~` : ''}`
            //предыдущий офис
            if (builder_list.length > limiter && id_builder_sent1 > limiter-1 ) {
                keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1-limiter}, color: 'secondary' })
            }
            //следующий офис
            if (builder_list.length > limiter && id_builder_sent1 < builder_list.length-limiter) {
                keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1+limiter }, color: 'secondary' })
            }
        } else {
            event_logger = `${ico_list['warn'].ico} Админы ролевой еще не создали ролевые валюты`
            return context.send(`${event_logger}`)
        }
        const answer1: any = await context.question(`${event_logger}`,
            {    
                keyboard: keyboard.inline(), answerTimeLimit
            }
        )
        if (answer1.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора статуса истекло!`) }
        if (!answer1.payload) {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.text == `${ico_list['next'].ico}` || answer1.text == `${ico_list['back'].ico}`) {
                id_builder_sent1 = answer1.payload.id_builder_sent1
            } else {
                monik.coin = answer1.payload.coin
                monik.id_coin = answer1.payload.id_coin
                coin_check = true
            }
        }
    }
    const starting_check: { status: boolean, text: String } = await Confirm_User_Success(context, `запланировать запуск бота для группы ${monik.alliance}?`)
    await context.send(`${starting_check.text}`)
    const monitor_cr = await prisma.monitor.create({ data: { token: monik.token, id_alliance: monik.id_alliance, id_coin: monik.id_coin, name: monik.name, idvk: monik.idvk_group, starting: starting_check.status } })
    if (monitor_cr) {
        await Logger(`In database, created monitor for group ${monik.alliance} by admin ${context.senderId}`)
        await context.send(`${ico_list['reconfig'].ico} Вы добавили новый монитор ${monitor_cr.id} для ролевой ${monik.alliance}\n Чтобы его поднять на пятый этаж, пройдемтесь по пути !банк --> ${ico_list['alliance'].ico} ${alliance.name} --> ${ico_list['config'].ico} Админам --> ${ico_list['config'].ico} !мониторы настроить --> ${ico_list['run'].ico} !моники_on`)
        await Send_Message(chat_id, `${ico_list['save'].ico} Сохранение нового ролевого монитора\n${ico_list['message'].ico} Сообщение: ${monitor_cr.name}-${monitor_cr.id}\n${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n${ico_list['alliance'].ico} ${alliance.name}`)
    }
    return res
}

// Функция для шифрования данных
function Encrypt_Data(data: string): string {
    const encryptedData = CryptoJS.AES.encrypt(data, SECRET_KEY ?? '').toString();
    return encryptedData;
}

export async function User_Bonus_Check(idvk: number, monitor: Monitor) {
    const account: Account | null = await prisma.account.findFirst({ where: { idvk: idvk } })
    if (!account) { return false; }
    
    // ПРИОРИТЕТ 1: Если указан персонаж для мониторов в ЭТОМ альянсе
    const monitorSelection = await prisma.monitorSelection.findFirst({
        where: {
            accountId: account.id,
            allianceId: monitor.id_alliance
        },
        include: {
            user: true
        }
    })
    
    if (monitorSelection) {
        // Проверяем, что персонаж все еще в этом альянсе
        if (monitorSelection.user.id_alliance === monitor.id_alliance) {
            return monitorSelection.user;
        } else {
            // Персонаж был переведен в другой альянс, нужно удалить выбор
            await prisma.monitorSelection.delete({
                where: { id: monitorSelection.id }
            });
            // Продолжаем со стандартной логикой
        }
    }
    
    // ПРИОРИТЕТ 2: Текущий выбранный персонаж (старая логика)
    let user = await prisma.user.findFirst({ 
        where: { 
            id: account.select_user, 
            id_alliance: monitor.id_alliance,
            id_account: account.id
        } 
    })
    
    // ПРИОРИТЕТ 3: Любой персонаж в альянсе (старая логика)
    if (!user) {
        user = await prisma.user.findFirst({ 
            where: { 
                id_account: account.id, 
                id_alliance: monitor.id_alliance 
            } 
        });
    }
    
    if (!user) { return false; }
    return user;
}

export async function Calc_Bonus_Activity(idvk: number, operation: '+' | '-', reward: number, target: string, link: string, monitor: Monitor) {
    const answer = { status: false, message: '', console: '', logging: '' } // ответ
    const user = await User_Bonus_Check(idvk, monitor);
    if (!user) { 
        //console.log(`[DEBUG] Calc_Bonus_Activity: User not found for idvk ${idvk} in alliance ${monitor.id_alliance}`);
        return answer; 
    }
    
    //console.log(`[DEBUG] Calc_Bonus_Activity: Using user ${user.id} - ${user.name} for monitor ${monitor.id}`);
    
    // Получаем аккаунт для уведомлений
    const account = await prisma.account.findFirst({ where: { idvk: idvk } })
    if (!account) { return answer; }
    
    const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
    if (!balance) { return answer; }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0, id_alliance: monitor.id_alliance }})
    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })
    const alliance = await prisma.alliance.findFirst({ where: { id: monitor.id_alliance } })
    const balance_facult_check = await prisma.balanceFacult.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_facult: user.id_facult ?? 0 } })
    const singular = await getTerminology(alliance?.id || 0, 'singular');
    const genitive = await getTerminology(alliance?.id || 0, 'genitive');

    switch (operation) {
        case '+':
            const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: reward } } })
            if (!balance_up) { return answer; }
            answer.message += `📰 ${user.name} (UID: ${user.id}), вам начислено за добавленный ${target} ${reward} ${coin?.name}\n🧷 Ссылка: ${link}\n💳 Ваш баланс: ${balance.amount} ${operation} ${reward} = ${balance_up.amount}${coin?.smile}\n`
            answer.console += `(monitor) ~ user ${user.idvk} ${target} and got ${reward} ${coin?.name}, link ${link}, balance ${balance.amount} ${operation} ${reward} = ${balance_up.amount}${coin?.smile} by <monitor> №${monitor.id}`
            answer.status = true
            if (coin?.point == true && balance_facult_check) {
                const balance_facult_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: balance_facult_check.id }, data: { amount: { increment: reward } } })
                if (balance_facult_plus) {
                    answer.message += `\n🌐 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для ${genitive} [${alli_fac?.smile} ${alli_fac?.name}]`
                    
                    // Используем название монитора вместо номера
                    const monitorDisplay = getMonitorDisplayName(alliance?.name, monitor.name);
                    const monitorPart = monitorDisplay ? ` --> (${monitorDisplay})` : '';
                    answer.logging += `🌐 [${alliance?.name}]${monitorPart}:\n👤 @id${account.idvk}(${user.name}) (UID: ${user.id}) --> ✅${target}\n🔮 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для ${genitive} [${alli_fac?.smile} ${alli_fac?.name}]`
                }
            }
            break;
        case '-':
            const balance_down = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { decrement: reward } } })
            if (!balance_down) { return answer; }
            answer.message += `📰 ${user.name} (UID: ${user.id}), с вас снято за удаленный ${target} ${reward} ${coin?.name}\n🧷 Ссылка: ${link}\n💳 Ваш баланс: ${balance.amount} ${operation} ${reward} = ${balance_down.amount}${coin?.smile}\n`
            answer.console += `(monitor) ~ user ${user.idvk} ${target} and lost ${reward} ${coin?.name}, link ${link}, balance ${balance.amount} ${operation} ${reward} = ${balance_down.amount}${coin?.smile} by <monitor> №${monitor.id}`
            answer.status = true
            if (coin?.point == true && balance_facult_check) {
                const balance_facult_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: balance_facult_check.id }, data: { amount: { decrement: reward } } })
                if (balance_facult_plus) {
                    answer.message += `\n🌐 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для ${genitive} [${alli_fac?.smile} ${alli_fac?.name}]`
                    
                    // Используем название монитора вместо номера
                    const monitorDisplay = getMonitorDisplayName(alliance?.name, monitor.name);
                    const monitorPart = monitorDisplay ? ` --> (${monitorDisplay})` : '';
                    answer.logging += `🌐 [${alliance?.name}]${monitorPart}:\n👤 @id${account.idvk}(${user.name}) (UID: ${user.id}) --> ⛔${target}\n🔮 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для ${genitive} [${alli_fac?.smile} ${alli_fac?.name}]`
                }
            }
            break;
        default:
            break;
    }
    if (!answer.status) { return answer; }
    if (user.notification) { await Send_Message(account.idvk, answer.message) } 
    if (coin?.point == false) {
        const notif_ans_chat = await Send_Message(alliance?.id_chat_monitor ?? 0, `👤 Для ${user.name} (UID: ${user.id}) -->\n ${answer.message}`)
        if (!notif_ans_chat) { await Send_Message(chat_id, answer.message) } 
    }
    await Logger(answer.console)
    if (answer.logging) {
        const notif_ans_chat = await Send_Message(alliance?.id_chat_monitor ?? 0, answer.logging)
        if (!notif_ans_chat) { await Send_Message(chat_id, answer.logging) } 
    }
    
    // ✅ ВАЖНО: возвращаем answer
    return answer;
}

function getMonitorDisplayName(allianceName: string | undefined, monitorName: string | undefined): string {
    if (!allianceName || !monitorName) {
        return monitorName || '';
    }
    
    const cleanAllianceName = allianceName.trim();
    const cleanMonitorName = monitorName.trim();
    
    // Если название совпадает — возвращаем пустую строку (не показываем монитор)
    if (cleanMonitorName.toLowerCase() === cleanAllianceName.toLowerCase()) {
        return '';  // ✅ пустая строка
    }
    
    return cleanMonitorName;
}