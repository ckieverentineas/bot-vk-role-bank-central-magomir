import { Context, Keyboard, KeyboardBuilder, MessageContext, PhotoAttachment, VK } from "vk-io"
import { answerTimeLimit, chat_id, root, starting_date, timer_text, vk } from "../.."
import prisma from "../events/module/prisma_client"
import { AllianceCoin, User } from "@prisma/client"
import { Person_Get } from "../events/module/person/person"
import { ico_list } from "../events/module/data_center/icons_lib"

export function Sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function Accessed(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const adm = await prisma.role.findFirst({ where: { id: user.id_role } })
    const role = adm?.name ?? `user`
    let ans = role == `root` ? 3 : role == `admin` ? 2 : 1
    return ans
}

export async function Keyboard_Index(context: any, messa: any) {
    const user_check: User | null | undefined = await Person_Get(context)
    if (!user_check) { return }
    const keyboard = new KeyboardBuilder()
    if (user_check.idvk == root) {
        keyboard.textButton({ label: '!Лютный переулок', payload: { command: 'sliz' }, color: 'positive' }).row()
    }
    if (await Accessed(context) != 1) {
        keyboard.textButton({ label: '!права', payload: { command: 'sliz' }, color: 'negative' }).row()
        keyboard.textButton({ label: '!опсоло', payload: { command: 'sliz' }, color: 'positive' })
        keyboard.textButton({ label: '!опмасс', payload: { command: 'sliz' }, color: 'negative' }).row()
    } 
    keyboard.textButton({ label: '!банк', payload: { command: 'sliz' }, color: 'positive' }).row().oneTime()
    keyboard.textButton({ label: '!помощь', payload: { command: 'sliz' }, color: 'secondary' }).row()
    .textButton({ label: '!СБП', payload: { command: 'sliz' }, color: 'secondary' })
    // Отправляем клавиатуру без сообщения
    await vk?.api.messages.send({ peer_id: context.senderId, random_id: 0, message: `${messa}\u00A0`, keyboard: keyboard })
    .then(async (response) => { 
        await Sleep(1000)
        return await vk!.api.messages.delete({ message_ids: [response], delete_for_all: 1 }) })
    .then(() => { Logger(`In a private chat, succes get keyboard is viewed by user ${context.senderId}`) })
    .catch((error) => { console.error(`User ${context.senderId} fail get keyboard: ${error}`) });
}

export async function Fixed_Number_To_Five(num: number) {
    let res = 0
    res = num < 5 ? 0 : Math.floor(num / 5) * 5
    //console.log(`${num} --> ${res}`)
	return res
}
export async function Worker_Checker() {
    await vk?.api.messages.send({
        peer_id: chat_id,
        random_id: 0,
        message: `✅ Все ок! ${await Up_Time()}\n🗿 Поставьте здесь свою реакцию о том, как прошел ваш день!`,
    })
}
export async function Worker_Online_Setter(group_id: number) {
    try {
		await Sleep(1000)
        console.log(group_id)
		await vk?.api.groups.enableOnline({ group_id: group_id }) 
	} catch(e) {
		await Logger(`${e}`)
	}
}
async function Up_Time() {
    const now = new Date();
    const diff = now.getTime() - starting_date.getTime();
    const timeUnits = [
        { unit: "дней", value: Math.floor(diff / 1000 / 60 / 60 / 24) },
        { unit: "часов", value: Math.floor((diff / 1000 / 60 / 60) % 24) },
        { unit: "минут", value: Math.floor((diff / 1000 / 60) % 60) },
        { unit: "секунд", value: Math.floor((diff / 1000) % 60) },
    ];
    return `Время работы: ${timeUnits.filter(({ value }) => value > 0).map(({ unit, value }) => `${value} ${unit}`).join(" ")}`
}


export async function Logger(text: String) {
    const project_name = `Magomir Central Bank`
    /*const options = {
        era: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        timeZone: 'UTC',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    };*/
    console.log(`[${project_name}] --> ${text} <-- (${new Date().toLocaleString("ru"/*, options*/)})`)
}

export async function Send_Message(idvk: number, message: string, keyboard?: Keyboard, attachment?: string | PhotoAttachment | null) {
    message = message ? message.slice(0, 3900) : 'invalid message'
    try {
        if (!attachment && !keyboard) { await vk?.api.messages.send({ peer_id: idvk, random_id: 0, message: `${message}` } ) }
        if (attachment && !keyboard) { await vk?.api.messages.send({ peer_id: idvk, random_id: 0, message: `${message}`, attachment: attachment.toString() } ) }
        if (!attachment && keyboard) { await vk?.api.messages.send({ peer_id: idvk, random_id: 0, message: `${message}`, keyboard: keyboard } ) }
        if (attachment && keyboard) { await vk?.api.messages.send({ peer_id: idvk, random_id: 0, message: `${message}`, keyboard: keyboard, attachment: attachment.toString() } ) }
        return true
    } catch (e) {
        await Logger(`Ошибка отправки сообщения: ${e}`)
        return false
    }
}
export async function Edit_Message_Pro(context: any, message: string, keyboard?: Keyboard, attached?: PhotoAttachment | null) {
    message = message ? message : 'invalid message'
    try {
        if (keyboard && attached) {
            await vk?.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`, keyboard: keyboard, attachment: attached.toString()})
        }
        if (!keyboard && attached) {
            await vk?.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`, attachment: attached.toString()})
        }
        if (keyboard && !attached) {
            await vk?.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`, keyboard: keyboard})
        }
        if (!keyboard && !attached) {
            await vk?.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`})
        }
    } catch (e) {
        const err = `Ошибка редактирования сообщения, попробуйте через 1-15 минут, в зависимости от ошибки: ${e}`
        console.log(`Ошибка редактирования сообщения, попробуйте через 1-15 минут, в зависимости от ошибки: ${e}`)
        try {
            await vk?.api.messages.send({
                peer_id: context.senderId ?? context.peerId,
                random_id: 0,
                message: err.slice(0,250)
            })
        } catch {
            console.log(`Ошибка редактирования сообщения в квадрате: ${e}`)
        }
        
    }
}
export async function Confirm_User_Success(context: any, text: string) {
    let res = { status: false, text: `` }
    const confirmq = await context.question(`⁉ Вы уверены, что хотите ${text}`,
        {
            keyboard: Keyboard.builder()
            .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
            .textButton({ label: 'Нет', payload: { command: 'not' }, color: 'secondary' })
            .oneTime().inline(),
            answerTimeLimit
        }
    )
    if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на подтверждение операции ${text} истекло!`) }
    if (confirmq?.payload?.command === 'confirm') {
        res.status = true
        res.text = `✅ Success agree: ${text}`
    } else {
        res.text = `🚫 Success denied: ${text}`
    }
    return res
}

export async function Carusel_Selector(context: any, data: { message_title: string, menu: Array<any>, smile: string, name: string, title: string }) {
    const ans = { id: null, status: false }
    let carusel_work = true
    let id_builder_sent = 0
    while (carusel_work) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
        let event_logger = `❄ ${data.message_title}:\n\n`
        const builder_list: Array<any> = data.menu
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ label: `${builder[data.smile]} №${i}-${builder[data.name].slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder.id }, color: 'secondary' }).row()
                event_logger += `\n\n🔒 ${data.title} №${i} <--\n📜 ID: ${builder.id}\n${builder[data.smile]} Название: ${builder[data.name]}`
                counter++
            }
            event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
            //предыдущие ролевые
            if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
            }
            //следующие ролевые
            if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
            }
        } else {
            event_logger = `⚠ [${data.title}] пока что нет...`
            carusel_work = false
            continue
        }
        const answer1: any = await context.question(`${event_logger}`, { keyboard: keyboard.inline(), answerTimeLimit })
        if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора [${data.title}] истекло!`) }
		if (!answer1.payload) {
			await context.send(`💡 Жмите только по кнопкам с иконками!`)
		} else {
            if (answer1.text == '→' || answer1.text =='←') {
                id_builder_sent = answer1.payload.id_builder_sent
            } else {
                ans.id = answer1.payload.target
                ans.status = true
                carusel_work = false
            }
		}
    }
    return ans
}

export async function Group_Id_Get(token: string) {
	const vk = new VK({ token: token, apiLimit: 1 });
	const [group] = await vk?.api.groups.getById(vk);
	const groupId = group.id;
	return groupId
}

export async function Input_Text(context: any, prompt: string, limit?: number) {
    limit = limit ?? 300
    let input_tr = false
    let input = ''
	while (input_tr == false) {
		const name = await context.question( `${ico_list['attach'].ico} ${prompt}\n\n${ico_list['warn'].ico} Допустимый лимит символов: ${limit}`, timer_text)
		if (name.isTimeout) { await context.send(`${ico_list['time'].ico} Время ожидания ввода истекло!`); return false }
		if (name.text.length <= limit && name.text.length > 0) {
            const confirma = await context.question( `${ico_list['question'].ico} Вы ввели: ${name.text}\n Вы уверены?`, {	
				keyboard: Keyboard.builder()
				.textButton({ label: `${ico_list['success'].ico} Да`, color: 'positive' }).row()
                .textButton({ label: `${ico_list['cancel'].ico} Назад`, color: 'negative' })
				.oneTime().inline(), answerTimeLimit
			})
		    if (confirma.isTimeout) { await context.send(`${ico_list['time'].ico} Время ожидания подтверждения ввода истекло!`); return false }
            if (confirma.text == `${ico_list['success'].ico} Да`) {
                input = `${name.text}`
                input_tr = true
            } else {
                if (confirma.text == `${ico_list['cancel'].ico} Назад`) { await context.send(`${ico_list['cancel'].ico} Ввод прерван пользователем`); return false }
                continue
            }
		} else { 
            await context.send(`${ico_list['warn'].ico} Вы превысили лимит символов: ${name.text.length}/${limit}`)
        }
	}
    return input
}
export async function Input_Number(context: any, prompt: string, float: boolean, limit?: number) {
    limit = limit ?? 300
    let input_tr = false
    let input = 0
	while (input_tr == false) {
		const name = await context.question( `${ico_list['attach'].ico} ${prompt}\n\n${ico_list['warn'].ico} Допустимый лимит символов: ${limit}`, timer_text)
		if (name.isTimeout) { await context.send(`${ico_list['time'].ico} Время ожидания ввода истекло!`); return false }
		if (name.text.length <= limit && name.text.length > 0) {
            const confirma = await context.question( `${ico_list['question'].ico} Вы ввели: ${name.text}\n Вы уверены?`, {	
				keyboard: Keyboard.builder()
				.textButton({ label: `${ico_list['success'].ico} Да`, color: 'positive' }).row()
                .textButton({ label: `${ico_list['cancel'].ico} Назад`, color: 'negative' })
				.oneTime().inline(), answerTimeLimit
			})
		    if (confirma.isTimeout) { await context.send(`${ico_list['time'].ico} Время ожидания подтверждения ввода истекло!`); return false }
            if (confirma.text == `${ico_list['success'].ico} Да`) {
                if (typeof Number(name.text) === "number") {
                    const inputer = float ? Number(name.text) : Math.floor(Number(name.text))
                    if (inputer < 0) {
                        await context.send(`${ico_list['warn'].ico} Введите положительное число!`);
                        continue
                    }
                    if (Number.isNaN(inputer)) {
                        await context.send(`${ico_list['warn'].ico} Не ну реально, ты дурак/дура или как? Число напиши нафиг!`);
                        continue
                    }
                    input = inputer
                    input_tr = true
                } else {
                    await context.send(`${ico_list['warn'].ico} Необходимо ввести число!`);
                    continue
                }
                
            } else {
                if (confirma.text == `${ico_list['cancel'].ico} Назад`) { await context.send(`${ico_list['cancel'].ico} Ввод прерван пользователем`); return false }
                continue
            }
		} else { 
            await context.send(`${ico_list['warn'].ico} Вы превысили лимит символов: ${name.text.length}/${limit}`)
        }
	}
    return input
}

export function Format_Number_Correction(num: any): number | string {
    try {
        if (typeof num !== 'number' || isNaN(num)) {
            throw new Error('Некорректный ввод: ожидается число');
        }
        if (Number.isInteger(num)) {
            return num;
        } else {
            return parseFloat(num.toFixed(3));
        }
    } catch (error: any) {
        console.warn('Ошибка форматирования:', error.message);
        return 'Ошибка';
    }
}

/**
 * Парсит VK-фото ID из разных форматов ссылок
 * @param url Ссылка (чистая или в параметрах)
 * @returns строка вида "photo-..._..." или null
 */
export function Get_Url_Picture(url: string): string | null {
    // Проверяем, есть ли в URL параметр z=...
    const zMatch = /z=(photo-\d+_\d+)/.exec(url);
    if (zMatch) {
        return zMatch[1];
    }

    // Проверяем, является ли это прямой ссылкой на фото
    const directMatch = /photo-\d+_\d+/.exec(url);
    if (directMatch) {
        return directMatch[0];
    }

    // Для альбомов и других форматов
    const albumMatch = /z=(photo\d+_\d+)%2Falbum/.exec(url);
    if (albumMatch) {
        return `${albumMatch[1]}`;
    }

    // Если фото через feed или другую страницу
    const feedMatch = /z=photo(\d+)_(\d+)/.exec(url);
    if (feedMatch) {
        return `photo${feedMatch[1]}_${feedMatch[2]}`;
    }

    return null;
}

/**
 * Типы уведомлений
 */
type NotificationType = 'admin_and_client' | 'admin_solo' | 'client_solo' | 'client_callback';

/**
 * Универсальная функция отправки уведомлений
 * @param context VK.IO контекст
 * @param message Сообщение для пользователя / чата
 * @param type Тип уведомления
 * @param user_target Целевой пользователь (если есть)
 */
export async function Send_Message_Smart(
    context: any,
    message: string,
    type: NotificationType,
    user_target?: User | null,
): Promise<void> {

    const finalLogMessage = message || 'Уведомление обработано';

    switch (type) {
        case 'admin_solo':
            // Для админа, который делает действие
            const admin: User | null | undefined = await Person_Get(context)
            const alliance_admin = await prisma.alliance.findFirst({ where: { id: admin?.id_alliance ?? 0 } })
            await context.send(`✅ ${message}`)
            const notif_ans_chat = await Send_Message(alliance_admin?.id_chat ?? 0, `🌐 Ответственное лицо @id${admin?.idvk}(${admin?.name})\n🔧 ${message}`)
            if (!notif_ans_chat ) { await Send_Message(chat_id, `🌐 Ответственное лицо @id${admin?.idvk}(${admin?.name})\n🔧 ${message}`) }
            await Logger(`🌐 Ответственное лицо @id${admin?.idvk}(${admin?.name})\n🔧 ${message}`);
            break;

        case 'client_callback':
            // Для целевого пользователя
            const alliance_user_target = await prisma.alliance.findFirst({ where: { id: user_target?.id_alliance ?? 0 } })
            await Send_Message(user_target?.idvk ?? 0, `🔔 Уведомление для ${user_target?.name}\n💬 ${message}`)
            const notif_ans_chat1 = await Send_Message(alliance_user_target?.id_chat ?? 0, `👤 Клиент @id${user_target?.idvk}(${user_target?.name})\n🔧 ${message}`)
            if (!notif_ans_chat1 ) { await Send_Message(chat_id, `👤 Клиент @id${user_target?.idvk}(${user_target?.name})\n🔧 ${message}`) }
            await Logger(`👤 Клиент @id${user_target?.idvk}(${user_target?.name})\n🔧 ${message}`);
            break;
        
        case 'client_solo':
            // Для клиента
            const client: User | null | undefined = await Person_Get(context)
            const alliance_client = await prisma.alliance.findFirst({ where: { id: client?.id_alliance ?? 0 } })
            await Send_Message(client?.idvk ?? 0, `💬 ${message}`)
            const notif_ans_chat2 = await Send_Message(alliance_client?.id_chat ?? 0, `👤 Клиент @id${client?.idvk}(${client?.name})\n🔧 ${message}`)
            if (!notif_ans_chat2 ) { await Send_Message(chat_id, `👤 Клиент @id${client?.idvk}(${client?.name})\n🔧 ${message}`) }
            await Logger(`👤 Клиент @id${client?.idvk}(${client?.name})\n🔧 ${message}`);
            break;

        case 'admin_and_client':
            // Общий тип: отправка и пользователю, и в чат
            const alliance = await prisma.alliance.findFirst({ where: { id: user_target?.id_alliance ?? 0 } })
            const user_adm: User | null | undefined = await Person_Get(context)
            const notif_ans = await Send_Message(user_target?.idvk ?? 0, `🔔 Уведомление для ${user_target?.name}\n💬 ${message}`)
            !notif_ans ? await context.send(`⚠ Сообщение пользователю ${user_target?.name} не доставлено\n💬 ${message}`) : await context.send(`⚙ Операция завершена успешно для ${user_target?.name}\n💬 ${message}`)
            const notif_ans_chat3 = await Send_Message(alliance?.id_chat ?? 0, `🌐 Ответственное лицо @id${context.senderId}(${user_adm?.name})\n👤 Клиент @id${user_target?.idvk}(${user_target?.name})\n💬 ${message}`)
            if (!notif_ans_chat3 ) { await Send_Message(chat_id, `🌐 Ответственное лицо @id${context.senderId}(${user_adm?.name})\n👤 Клиент @id${user_target?.idvk}(${user_target?.name})\n💬 ${message}`) }
            break;
        default:
            //
            break;
    }
}


/**
 * Функция выбора валюты из списка альянса
 * @param context VK.IO контекст
 * @param id_alliance ID альянса, чьи валюты показываем
 * @returns ID выбранной валюты или null
 */
export async function Select_Alliance_Coin(context: any, id_alliance: number): Promise<number | null> {
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({
        where: { id_alliance: Number(id_alliance) }
    });

    if (!coin_pass || coin_pass.length === 0) {
        await context.send(`${ico_list['warn'].ico} Админы ещё не создали ролевые валюты.`);
        return null;
    }

    let coin_check = false;
    let id_builder_sent1 = 0;

    while (!coin_check) {
        const keyboard = new KeyboardBuilder();
        id_builder_sent1 = await Fixed_Number_To_Five(id_builder_sent1);
        let event_logger = `${ico_list['money'].ico} Выберите валюту:\n\n`;

        const limiter = 5;
        let counter = 0;

        for (let i = id_builder_sent1; i < coin_pass.length && counter < limiter; i++) {
            const builder = coin_pass[i];
            keyboard.textButton({
                label: `${builder.smile}-${builder.name.slice(0, 30)}`,
                payload: { command: 'select_coin', id_builder_sent1: i, id_coin: builder.id, coin: builder.name },
                color: 'secondary'
            }).row();

            event_logger += `\n${ico_list['message'].ico} ${builder.smile} -> ${builder.id} - ${builder.name}`;
            counter++;
        }

        event_logger += `\n\n${coin_pass.length > 1 ? `~~~~ ${Math.min(id_builder_sent1 + limiter, coin_pass.length)} из ${coin_pass.length} ~~~~` : ''}`;

        // Навигация ← →
        if (id_builder_sent1 > 0) {
            keyboard.textButton({
                label: `${ico_list['back'].ico}`,
                payload: { command: 'select_coin_back', id_builder_sent1 },
                color: 'secondary'
            });
        }

        if (id_builder_sent1 + limiter < coin_pass.length) {
            keyboard.textButton({
                label: `${ico_list['next'].ico}`,
                payload: { command: 'select_coin_next', id_builder_sent1 },
                color: 'secondary'
            });
        }

        // Запрос у пользователя
        const answer = await context.question(event_logger, {
            keyboard: keyboard.inline(),
            answerTimeLimit
        });

        if (answer.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время истекло!`);
            return null;
        }

        if (!answer.payload) {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам!`);
            continue;
        }

        const cmd = answer.payload.command;
        if (cmd === 'select_coin') {
            // Пользователь выбрал валюту
            return answer.payload.id_coin;
        } else if (cmd === 'select_coin_back') {
            // Предыдущая страница
            id_builder_sent1 = answer.payload.id_builder_sent1;
        } else if (cmd === 'select_coin_next') {
            // Следующая страница
            id_builder_sent1 = answer.payload.id_builder_sent1;
        }
    }

    return null;
}

const message_events: String[] = [];
export async function Antivirus_VK(context: MessageContext) {
    //if (Date.now() - new Date(context.createdAt).getTime() > 1 * 86400000) { return; }
    //console.log(context)
    if (message_events.includes(`${context.conversationMessageId}_${context.senderId}`)) {
        await Logger(`🔁 Пропущено повторное сообщение [${message_events.length}]: ${context.peerId} --> ${context.conversationMessageId}_${context.senderId}`);
        return true;
    }
    message_events.push(`${context.conversationMessageId}_${context.senderId}`);
    return false
}

/**
 * Универсальная функция для вопросов с кнопками
 * @param context VK.IO контекст
 * @param message Текст сообщения
 * @param keyboard Клавиатура (опционально)
 * @param attachment Вложение (опционально)
 * @param timeoutTime Время ожидания ответа (по умолчанию 5 мин)
 * @returns { timeout: boolean, notButton: boolean, payload: any }
 */
export async function Send_Message_Question(
    context: Context,
    message: string,
    keyboard?: KeyboardBuilder,
    attachment?: string,
    timeoutTime: number = 300_000 // 5 минут по умолчанию
): Promise<{ 
    exit: boolean, 
    payload?: any 
}> {
    let payload = null
    let exit = false
    try {
        while (true) {
            const response = await context.question(message.slice(0, 3900), {
                ...(keyboard && { keyboard: keyboard.textButton({ label: '🚫', payload: { command: 'exit' }, color: 'positive' }).oneTime() }),
                ...(attachment && { attachment }),
                answerTimeLimit: timeoutTime
            });
    
            if (response.isTimeout) {
                await context.send('⏰ Время истекло');
                exit = true
                break
            }
            if (!response.payload) {
                await context.send('💡 Жмите только по кнопкам!');
                continue
            }
            if (response.payload.command === 'exit') {
                await context.send('❌ Возвращаемся назад');
                exit = true
                break
            }
            payload = response.payload
            break
        }
    } catch (error) {
        await Logger(`⚠ Ошибка при отправке вопроса для ответа пользователю: ${error}`);
        await context.send('⚠ Произошла ошибка. Повторите попытку.');
    }
    return { exit, payload };
}