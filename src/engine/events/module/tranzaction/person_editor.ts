import { Alliance, AllianceFacult, User } from "@prisma/client"
import prisma from "../prisma_client"
import { Keyboard, KeyboardBuilder } from "vk-io"
import { Accessed, Fixed_Number_To_Five, Logger, Send_Message } from "../../../core/helper"
import { answerTimeLimit, chat_id, timer_text } from "../../../.."
import { Ipnut_Gold } from "./operation_global"
import { getTerminology } from "../alliance/terminology_helper"
import { getClassOptions, getClassSettings } from "../alliance/alliance_class_settings"
import { ico_list } from "../data_center/icons_lib"

//Модуль редактирования персонажей
export async function Editor(id: number, context: any, user_adm: User) {
    const user: User | null = await prisma.user.findFirst({ where: { id: id } })
    if (!user) { return }
    let answer_check = false
    while (answer_check == false) {
        const keyboard = new KeyboardBuilder()
        const singular = await getTerminology(user.id_alliance || 0, 'singular');
        keyboard.textButton({ label: '✏Положение', payload: { command: 'edit_class' }, color: 'secondary' }).row()
        .textButton({ label: '✏Специализация', payload: { command: 'edit_spec' }, color: 'secondary' }).row()
        .textButton({ label: '✏ФИО', payload: { command: 'edit_name' }, color: 'secondary' }).row()
        .textButton({ label: `✏${singular.charAt(0).toUpperCase() + singular.slice(1)}`, payload: { command: 'edit_facult' }, color: 'secondary' }).row()
        if (await Accessed(context) == 3 || user.id_alliance == 0 || user.id_alliance == -1 ) { keyboard.textButton({ label: '✏Альянс', payload: { command: 'edit_alliance' }, color: 'secondary' }).row() }
        keyboard.textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).oneTime().inline()
        const answer1: any = await context.question(`⌛ Переходим в режим редактирования данных, выберите сие злодейство: `, { keyboard: keyboard, answerTimeLimit })
        if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания на корректировку данных юзера истекло!`) }
        if (!answer1.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.payload && answer1.payload.command != 'back') {
                answer_check = true
                const config: any = {
                    'edit_class': Edit_Class,
                    'edit_spec': Edit_Spec,
                    'edit_name': Edit_Name,
                    'edit_alliance': Edit_Alliance,
                    'edit_facult': Edit_Facult
                }
                await config[answer1.payload.command](id, context, user_adm)
            } else {
                answer_check = true
                await context.send(`⚙ Отмена редактирования`)
            }
        }
    }
}

async function Edit_Name(id: number, context: any, user_adm: User){
    const user: User | null = await prisma.user.findFirst({ where: { id: id } })
    if (!user) { return }
    let name_check = false
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user.id_alliance) } })
    const alli_sel = `${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get?.name}`
    while (name_check == false) {
        const name: any = await context.question(`🧷 Укажите имя в ${alli_sel}. Для ${user.name}. Введите новое имя до 64 символов:`, timer_text)
        if (name.isTimeout) { return await context.send(`⏰ Время ожидания на изменение имени для ${user.name} истекло!`) }
        if (name.text.length <= 64) {
            name_check = true
            
            // ==== ДОБАВЛЕНО: Удаляем старую карточку перед сменой имени ====
            try {
                await prisma.userCard.delete({
                    where: { user_id: user.id }
                }).catch(() => {
                    // Игнорируем ошибку если карточки не существует
                    console.log(`[EDIT_NAME] Card not found for user ${user.id}, skipping deletion`);
                });
                console.log(`[EDIT_NAME] Deleted old card for user ${user.id} before name change`);
            } catch (error) {
                console.error(`[EDIT_NAME] Error deleting card for user ${user.id}:`, error);
            }
            // ================================================================
            
            const update_name = await prisma.user.update({ where: { id: user.id }, data: { name: name.text } })
            if (update_name) {
                await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена имени с ${user.name} на ${update_name.name}. Карточка пользователя будет перегенерирована с новым именем при следующем запросе.`)
                
                const notif_ans = await Send_Message(user.idvk, `⚙ Ваше имя в ${alli_sel} изменилось с ${user.name} на ${update_name.name}.`)
                !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция смены имени пользователя завершена успешно.`)
                const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "✏👤ФИО" > имя изменилось с ${user.name} на ${update_name.name} для @id${user.idvk}(${user.name})`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) } 
                await Logger(`In a private chat, changed name user from ${user.name} on ${update_name.name} for ${update_name.idvk} by admin ${context.senderId}`)
            }
            if (name.text.length > 32) {
                await context.send(`⚠ Новые инициалы не влезают на стандартный бланк (32 символа)! Придется использовать бланк повышенной ширины, с доплатой 1G за каждый не поместившийся символ.`)
            }
        } else {
            await context.send(`⛔ Новое ФИО не влезают на бланк повышенной ширины (64 символа), и вообще, запрещены магическим законодательством! Заставим его/ее выплатить штраф в 30G или с помощию ОМОНА переехать в Азкабан.`)
        }
    }
}
async function Edit_Class(id: number, context: any, user_adm: User){
    const user: any = await prisma.user.findFirst({ where: { id: id } })
    if (!user) { return }
    
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user.id_alliance) } })
    const alli_sel = `${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get?.name}`
    
    // Проверяем, состоит ли персонаж в альянсе
    if (!user.id_alliance || user.id_alliance <= 0) {
        // Для персонажей не в альянсе используем стандартные опции
        const options = ['Ученик', 'Житель', 'Профессор', 'Декан', 'Бизнесвумен(мэн)', 'Другое'];
        let answer_check = false;
        
        while (answer_check == false) {
            const keyboard = new KeyboardBuilder();
            
            // Создаем клавиатуру из стандартных опций
            for (let i = 0; i < options.length; i += 2) {
                keyboard.textButton({ 
                    label: options[i], 
                    payload: { command: 'select_class', class: options[i] }, 
                    color: 'secondary' 
                });
                
                if (options[i + 1]) {
                    keyboard.textButton({ 
                        label: options[i + 1], 
                        payload: { command: 'select_class', class: options[i + 1] }, 
                        color: 'secondary' 
                    });
                }
                
                if (i + 2 < options.length) {
                    keyboard.row();
                }
            }
            
            const answer1: any = await context.question(
                `🧷 Укажите положение в ${alli_sel} для ${user.name}, имеющего текущий статус: ${user.class}.`,
                { keyboard: keyboard.inline(), answerTimeLimit }
            )
            
            if (answer1.isTimeout) { 
                return await context.send(`⏰ Время ожидания на изменение положения для ${user.name} истекло!`) 
            }
            
            if (!answer1.payload) {
                await context.send(`💡 Жмите только по кнопкам с иконками!`)
            } else {
                const update_class = await prisma.user.update({ 
                    where: { id: user.id }, 
                    data: { class: answer1.payload.class } 
                })
                
                if (update_class) {
                    await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена положения с ${user.class} на ${update_class.class}.`)
                    const notif_ans = await Send_Message(user.idvk, `⚙ Ваше положение в ${alli_sel} изменилось с ${user.class} на ${update_class.class}.`)
                    !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция смены положения пользователя завершена успешно.`)
                    const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "✏👤Положение" > положение изменилось с ${user.class} на ${update_class.class} для @id${user.idvk}(${user.name})`
                    const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                    if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) } 
                    await Logger(`In a private chat, changed status user from ${user.class} on ${update_class.class} for ${update_class.idvk} by admin ${context.senderId}`)
                }
                answer_check = true
            }
        }
    } else {
        // Для персонажей в альянсе используем настройки альянса
        const settings = await getClassSettings(user.id_alliance);
        
        if (settings.mode === 'free') {
            // Режим произвольного ввода
            const answer1: any = await context.question(
                `🧷 Укажите положение в ${alli_sel} для ${user.name} (текущее: ${user.class}).\n${ico_list['help'].ico} Введите новое положение:`, 
                timer_text
            )
            
            if (answer1.isTimeout) { 
                return await context.send(`⏰ Время ожидания на изменение положения для ${user.name} истекло!`) 
            }
            
            if (!answer1.text || answer1.text.trim() === '') {
                return await context.send(`⛔ Положение не может быть пустым!`)
            }
            
            if (answer1.text.length > 32) {
                return await context.send(`⛔ Название положения слишком длинное (максимум 32 символа)!`)
            }
            
            const update_class = await prisma.user.update({ 
                where: { id: user.id }, 
                data: { class: answer1.text } 
            })
            
            if (update_class) {
                await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена положения с ${user.class} на ${update_class.class}.`)
                const notif_ans = await Send_Message(user.idvk, `⚙ Ваше положение в ${alli_sel} изменилось с ${user.class} на ${update_class.class}.`)
                !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция смены положения пользователя завершена успешно.`)
                const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "✏👤Положение" > положение изменилось с ${user.class} на ${update_class.class} для @id${user.idvk}(${user.name})`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) } 
                await Logger(`In a private chat, changed status user from ${user.class} on ${update_class.class} for ${update_class.idvk} by admin ${context.senderId}`)
            }
        } else {
            // Режим с кнопками (default или custom)
            const options = await getClassOptions(user.id_alliance);
            
            if (options.length === 0) {
                return await context.send(`${ico_list['warn'].ico} Для альянса "${alli_sel}" не настроены опции положений!`);
            }
            
            let answer_check = false;
            
            while (answer_check == false) {
                const keyboard = new KeyboardBuilder();
                
                // Создаем клавиатуру из настроек
                for (let i = 0; i < options.length; i += 2) {
                    if (options[i]) {
                        keyboard.textButton({ 
                            label: options[i], 
                            payload: { command: 'select_class', class: options[i] }, 
                            color: 'secondary' 
                        });
                    }
                    
                    if (options[i + 1]) {
                        keyboard.textButton({ 
                            label: options[i + 1], 
                            payload: { command: 'select_class', class: options[i + 1] }, 
                            color: 'secondary' 
                        });
                    }
                    
                    if (i + 2 < options.length) {
                        keyboard.row();
                    }
                }
                
                const answer1: any = await context.question(
                    `🧷 Укажите положение в ${alli_sel} для ${user.name}, имеющего текущий статус: ${user.class}.`,
                    { keyboard: keyboard.inline(), answerTimeLimit }
                )
                
                if (answer1.isTimeout) { 
                    return await context.send(`⏰ Время ожидания на изменение положения для ${user.name} истекло!`) 
                }
                
                if (!answer1.payload) {
                    await context.send(`💡 Жмите только по кнопкам с иконками!`)
                } else {
                    const update_class = await prisma.user.update({ 
                        where: { id: user.id }, 
                        data: { class: answer1.payload.class } 
                    })
                    
                    if (update_class) {
                        await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена положения с ${user.class} на ${update_class.class}.`)
                        const notif_ans = await Send_Message(user.idvk, `⚙ Ваше положение в ${alli_sel} изменилось с ${user.class} на ${update_class.class}.`)
                        !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция смены положения пользователя завершена успешно.`)
                        const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "✏👤Положение" > положение изменилось с ${user.class} на ${update_class.class} для @id${user.idvk}(${user.name})`
                        const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                        if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) } 
                        await Logger(`In a private chat, changed status user from ${user.class} on ${update_class.class} for ${update_class.idvk} by admin ${context.senderId}`)
                    }
                    answer_check = true
                }
            }
        }
    }
}
async function Edit_Spec(id: number, context: any, user_adm: User){
    const user: any = await prisma.user.findFirst({ where: { id: id } })
    let spec_check = false
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user.id_alliance) } })
    const alli_sel = `${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get?.name}`
    const accusative = await getTerminology(user.id_alliance || 0, 'accusative');
    while (spec_check == false) {
        const spec: any = await context.question(`🧷 Укажите специализацию в ${alli_sel}. Для ${user.name}. Если он/она профессор/житель, введите должность. Если студент(ка), укажите направление, специализацию, но не ${accusative}. \nТекущая специализация: ${user.spec}\nВведите новую:`, timer_text)
        if (spec.isTimeout) { return await context.send(`⏰ Время ожидания на изменение специализации для ${user.name} истекло!`) }
        if (spec.text.length <= 150) {
            spec_check = true
            const update_spec = await prisma.user.update({ where: { id: user.id }, data: { spec: spec.text } })
            if (update_spec) {
                await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена специализации с ${user.spec} на ${update_spec.spec}.`)
                const notif_ans = await Send_Message(user.idvk, `⚙ Ваша специализация в ${alli_sel} изменилась с ${user.spec} на ${update_spec.spec}.`)
                !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция смены специализации пользователя завершена успешно.`)
                const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "✏👤Специализация" > специализация изменилась с ${user.spec} на ${update_spec.spec} для @id${user.idvk}(${user.name})`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) }
                await Logger(`In a private chat, changed specialization user from ${user.spec} on ${update_spec.spec} for ${update_spec.idvk} by admin ${context.senderId}`)
            }
        } else {
            await context.send(`💡 Введите до 32 символов включительно!`)
        }
    }
}
async function Edit_Alliance(id: number, context: any, user_adm: User){
    const user: User | null = await prisma.user.findFirst({ where: { id: id } })
    if (!user) { return await context.send(`⚠ Ролевик под UID${id} не был обнаружен в системе!`)}
    const person: { id_alliance: null | number, alliance: null | string,  } = { id_alliance: null, alliance: null }
    let answer_check = false
    while (answer_check == false) {
        const answer_selector = await context.question(`🧷 Укажите статус для ${user.name}-${user.id}:`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: 'Союзник Кнопки', payload: { command: 'student' }, color: 'secondary' }).row()
                .textButton({ label: 'Союзник Номер', payload: { command: 'student' }, color: 'secondary' }).row()
                .textButton({ label: 'Не союзник', payload: { command: 'professor' }, color: 'secondary' })
                .textButton({ label: 'Соло', payload: { command: 'citizen' }, color: 'secondary' })
                .oneTime().inline(), answerTimeLimit
            }
        )
        if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer_selector.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            person.alliance = answer_selector.text
            if (answer_selector.text == 'Не союзник') { person.id_alliance = -1 }
            if (answer_selector.text == 'Соло') { person.id_alliance = 0 }
			answer_check = true
        }
    }
    let alliance_check = false
    if (person.alliance == 'Союзник Кнопки') {
        let id_builder_sent = 0
        while (!alliance_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            let event_logger = `❄ Выберите союзный ролевой проект, к которому принадлежит ${user.name}-${user.id}:\n\n`
            const builder_list: Alliance[] = await prisma.alliance.findMany({})

            if (builder_list.length > 0) {
                const limiter = 5
                let counter = 0
                for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                    const builder = builder_list[i]
                    keyboard.textButton({ label: `🌐 №${i}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                    event_logger += `\n\n🔒 Ролевой проект №${i} <--\n📜 AUID: ${builder.id}\n🌐 Название: ${builder.name}\n🧷 Ссылка: https://vk.com/club${builder.idvk}`
                    counter++
                }
                event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
                //предыдущий офис
                if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                    keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
                }
                //следующий офис
                if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                    keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
                }
            } else {
                event_logger = `💬 Ролевых проектов не обнаружено!`
            }
            const answer1: any = await context.question(`${event_logger}`,
                {	
                    keyboard: keyboard.inline(), answerTimeLimit
                }
            )
            if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора ролевого проекта истекло!`) }
            if (!answer1.payload) {
                await context.send(`💡 Жмите только по кнопкам с иконками!`)
            } else {
                if (answer1.text == '→' || answer1.text =='←') {
                    id_builder_sent = answer1.payload.id_builder_sent
                } else {
                    person.alliance = answer1.payload.target.name
                    person.id_alliance = answer1.payload.target.id
                    alliance_check = true
                }
            }
        }
    }
    if (person.alliance == 'Союзник Номер') {
        // ДОБАВЛЕНО: Показываем список союзных проектов перед запросом AUID
        let alli_list = ''
        const alliances = await prisma.alliance.findMany({})
        for (const alli of alliances) {
            alli_list += `${alli.id} - ${alli.name}\n`
        }
        
        if (alli_list) {
            await context.send(`📋 Текущие союзные ролевые проекты и их уникальные идентификаторы:\n${alli_list}`)
        } else {
            await context.send(`📋 Список союзных проектов пуст.`)
        }

        const input_alliance = await Ipnut_Gold(context, 'ввода уникального идентификатора ролевого проекта AUID (укажите номер)📜')
        const alliance = await prisma.alliance.findFirst({ where: { id: Number(input_alliance) } })
        if (!alliance) { 
            await context.send(`❌ Альянс под AUID ${input_alliance} не найден! Повторите регистрацию заново с нуля.`)
            return 
        }
        person.alliance = alliance.name
        person.id_alliance = alliance.id
    }
    const alli_get_was: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user.id_alliance) } })
    const update_alliance = await prisma.user.update({ where: { id: user.id }, data: { id_alliance: person.id_alliance, id_facult: 0 } })
    const alli_get_be: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(update_alliance.id_alliance) } })
    if (update_alliance) {
        await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена ролевой с ${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get_was?.name} на ${update_alliance.id_alliance == 0 ? `Соло` : update_alliance.id_alliance == -1 ? `Не союзник` : alli_get_be?.name}.`)
        const notif_ans = await Send_Message(user.idvk, `⚙ Ваша принадлежность ролевой сменилась с ${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get_was?.name} на ${update_alliance.id_alliance == 0 ? `Соло` : update_alliance.id_alliance == -1 ? `Не союзник` : alli_get_be?.name}.`)
        !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция смены альянса пользователя завершена успешно.`)
        const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "✏👤Альянс" > Ролевая изменилась с ${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get_was?.name} на ${update_alliance.id_alliance == 0 ? `Соло` : update_alliance.id_alliance == -1 ? `Не союзник` : alli_get_be?.name} для @id${user.idvk}(${user.name})`
        let tr = 0
        if (alli_get_was) {
            alli_get_was.id_chat ? await Send_Message(alli_get_was.id_chat, ans_log) : tr++
        }
        if (alli_get_be) {
            alli_get_be.id_chat ? await Send_Message(alli_get_be.id_chat, ans_log) : tr++
        }
        if (tr == 2) { await Send_Message(chat_id, ans_log) }
        await Logger(`In a private chat, changed alliance user from ${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get_was?.name} on ${update_alliance.id_alliance == 0 ? `Соло` : update_alliance.id_alliance == -1 ? `Не союзник` : alli_get_be?.name} for ${update_alliance.idvk} by admin ${context.senderId}`)
    }
}
async function Edit_Facult(id: number, context: any, user_adm: User){
    const user: User | null = await prisma.user.findFirst({ where: { id: id } })
    if (!user) { return }
    const person: { id_facult: null | number, facult: null | string, rank_action: string | null } = { id_facult: null, facult: null, rank_action: null }
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user.id_alliance) } })
    const alli_sel = `${user.id_alliance == 0 ? `Соло` : user.id_alliance == -1 ? `Не союзник` : alli_get?.name}`
    const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ where: { id: Number(user.id_facult) } })
    const singular = await getTerminology(user.id_alliance || 0, 'singular');
    const genitive = await getTerminology(user.id_alliance || 0, 'genitive');
    const plural = await getTerminology(user.id_alliance || 0, 'plural');
    const accusative = await getTerminology(user.id_alliance || 0, 'accusative');
    const facult_sel = `${facult_get ? facult_get.name : `Без ${genitive}`}`
    let facult_check = false
    if (await prisma.allianceFacult.findFirst({ where: { id_alliance: Number(user.id_alliance) } })) {
        let id_builder_sent = 0
        while (!facult_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            let event_logger = `❄ Выберите ${accusative} для ${user.name} в ${alli_sel}, сейчас его(ее) ${singular} ${facult_sel}:\n\n`
            const builder_list: AllianceFacult[] = await prisma.allianceFacult.findMany({ where: { id_alliance: Number(user.id_alliance) } })
            if (builder_list.length > 0) {
                const limiter = 5
                let counter = 0
                for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                    const builder = builder_list[i]
                    keyboard.textButton({ label: `${builder.smile} №${i}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                    //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
                    event_logger += `\n\n🔮 Ролевой(ая) ${singular} №${i} <--\n📜 FUID: ${builder.id}\n${builder.smile} Название: ${builder.name}`
                    /*
                    const services_ans = await Builder_Lifer(user, builder, id_planet)*/
                    counter++
                }
                event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
                //предыдущий офис
                if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                    keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
                }
                //следующий офис
                if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                    keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
                }
                keyboard.textButton({ label: 'Нафиг учебу', payload: { command: 'builder_control_multi', target: { id: 0, name: `Без ${genitive}`, smile: '🔥', id_alliance: user.id_alliance } }, color: 'secondary' })
            } else {
                event_logger = `💬 Вы еще не построили здания, как насчет что-то построить??`
            }
            const answer1: any = await context.question(`${event_logger}`,
                {	
                    keyboard: keyboard.inline(), answerTimeLimit
                }
            )
            if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
            if (!answer1.payload) {
                await context.send(`💡 Жмите только по кнопкам с иконками!`)
            } else {
                if (answer1.text == '→' || answer1.text =='←') {
                    id_builder_sent = answer1.payload.id_builder_sent
                } else {
                    person.facult = answer1.payload.target.name
                    person.id_facult = answer1.payload.target.id
                    facult_check = true
                }
            }
        }
    } else {
        return await context.send(`⛔ В ролевом проекте еще не инициализированы ${plural}`)
    }
    // модуль принятия решения с баллами
    let answer_check = false
    while (answer_check == false) {
        const answer_selector = await context.question(`🧷 Укажите, что будем делать с баллами игрока, инвестированными в ${accusative} за текущий учебный год:`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: 'Ничего не делать', payload: { command: 'student' }, color: 'secondary' }).row()
                .textButton({ label: 'Перенести', payload: { command: 'citizen' }, color: 'secondary' }).row()
                .textButton({ label: 'Обнулить', payload: { command: 'professor' }, color: 'secondary' }).row()
                //.textButton({ label: 'Ограбить', payload: { command: 'rob' }, color: 'secondary' }).row() // НОВАЯ КНОПКА
                .oneTime().inline(), answerTimeLimit
            }
        )
        if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer_selector.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            person.rank_action = answer_selector.text
            answer_check = true
        }
    }
    // обновление факультета
    const update_facult = await prisma.user.update({ where: { id: user.id }, data: { id_facult: person.id_facult } })
    if (update_facult) {
        await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена ${genitive} с ${facult_sel} на ${person.facult}.`)
        const notif_ans = await Send_Message(user.idvk, `⚙ Ваш(а) ${singular} ролевой сменился(лась) с ${facult_sel} на ${person.facult}.`)
        !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция смены ${genitive} пользователя завершена успешно.`)
        const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "✏👤${singular.charAt(0).toUpperCase() + singular.slice(1)}" > ${singular.charAt(0).toUpperCase() + singular.slice(1)} изменился(лась) с ${facult_sel} на ${person.facult} для @id${user.idvk}(${user.name})`
        const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
        if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) }
        await Logger(`In a private chat, changed facult user from ${facult_sel} on ${person.facult} for ${update_facult.idvk} by admin ${context.senderId}`)
    }
    // Движок модуля принятия решений с баллами
    const alli_fac = user.id_facult ? await prisma.allianceFacult.findFirst({ where: { id: user.id_facult } }) : null
    const alli_fac_tar = person.id_facult ? await prisma.allianceFacult.findFirst({ where: { id: person.id_facult } }) : null

    switch (person.rank_action) {
        
        case 'Ничего не делать':
            break;
        case 'Обнулить':
            for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: update_facult.id_alliance! } })) {
                if (coin.point == false) { continue }
                const bal_usr = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: update_facult.id }})
                if (!bal_usr || bal_usr.amount == 0) { continue }
                
                // Если был факультет - вычитаем из него
                if (alli_fac) {
                    const bal_fac = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: user.id_facult! }})
                    if (bal_fac) {
                        const bal_fac_ch = await prisma.balanceFacult.update({ 
                            where: { id: bal_fac.id }, 
                            data: { amount: { decrement: bal_usr.amount } } 
                        })
                    }
                }
                
                // Обнуляем счет пользователя
                const bal_usr_ch = await prisma.balanceCoin.update({ 
                    where: { id: bal_usr.id }, 
                    data: { amount: 0 } 
                })
                
                // Получаем терминологию
                const currentAlliance = await prisma.alliance.findFirst({ 
                    where: { id: user.id_alliance ?? 0 } 
                });
                const singular = await getTerminology(currentAlliance?.id || 0, 'singular');
                const genitive = await getTerminology(currentAlliance?.id || 0, 'genitive');
                
                const ans_log = `🌐 "${person.rank_action}${coin.smile}" > ${alli_fac ? `${singular.charAt(0).toUpperCase() + singular.slice(1)} [${alli_fac.smile} ${alli_fac.name}] уменьшен(а) на ${bal_usr.amount}` : `Без вычета из ${genitive}`}, баланс пользователя: ${bal_usr_ch.amount}${coin.smile} для @id${user.idvk}(${user.name})`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) }
            }
            break;
        case 'Перенести':
            for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: update_facult.id_alliance! } })) {
                if (coin.point == false) { continue }
                const bal_usr = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: update_facult.id }})
                if (!bal_usr || bal_usr.amount == 0) { continue }
                
                // Получаем терминологию перед использованием
                const currentAlliance = await prisma.alliance.findFirst({ 
                    where: { id: user.id_alliance ?? 0 } 
                });
                const singular = await getTerminology(currentAlliance?.id || 0, 'singular');
                const genitive = await getTerminology(currentAlliance?.id || 0, 'genitive');
                
                // Если был факультет - вычитаем из старого
                if (alli_fac) {
                    const bal_fac = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: user.id_facult! }})
                    if (bal_fac) {
                        const bal_fac_ch = await prisma.balanceFacult.update({ 
                            where: { id: bal_fac.id }, 
                            data: { amount: { decrement: bal_usr.amount } } 
                        })
                    }
                }
                
                // Если есть новый факультет - зачисляем на него
                if (alli_fac_tar) {
                    const bal_fac_tar = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: update_facult.id_facult! }})
                    if (bal_fac_tar) {
                        const bal_fac_tar_ch = await prisma.balanceFacult.update({ 
                            where: { id: bal_fac_tar.id }, 
                            data: { amount: { increment: bal_usr.amount } } 
                        })
                    } else {
                        // Создаем запись баланса для нового факультета, если её нет
                        const bal_fac_tar_ch = await prisma.balanceFacult.create({
                            data: {
                                id_coin: coin.id,
                                id_facult: update_facult.id_facult!,
                                amount: bal_usr.amount
                            }
                        })
                    }
                }
                
                const ans_log = `🌐 "${person.rank_action}${coin.smile}" >\n${alli_fac ? `Старый(ая) ${singular} уменьшен(а) на ${bal_usr.amount}` : `Не было ${genitive}`},\n${alli_fac_tar ? `Новый(ая) ${singular} увеличен(а) на ${bal_usr.amount}` : `Без зачисления на/в ${singular}`} \nдля @id${user.idvk}(${user.name})`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat) { await Send_Message(chat_id, ans_log) }
            }
            break;
        default:
            break;
        }
}