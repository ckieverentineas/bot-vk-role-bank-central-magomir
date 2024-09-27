
import { randomInt } from "crypto"
import { Keyboard, KeyboardBuilder, PhotoAttachment, VK } from "vk-io"
import { answerTimeLimit, chat_id, group_id, root, starting_date, timer_text, vk } from "../.."
import { Image_Interface, Image_Random } from "./imagecpu"
import { promises as fsPromises } from 'fs'
import { MessagesGetHistoryResponse, MessagesSendResponse } from "vk-io/lib/api/schemas/responses"
import prisma from "../events/module/prisma_client"
import { User } from "@prisma/client"
import { Person_Get } from "../events/module/person/person"
import { ico_list } from "../events/module/data_center/icons_lib"

export function Sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function Gen_Inline_Button(context: any, weapon_type: any) {
    let checker = false
    let counter = 0
    let current = 0
    let modif = 0
    let skill:any = {}
    while (checker == false) {
        let keyboard = Keyboard.builder()
        counter = 0
        current = modif
        const limit = 6
        let weapon_list = ''
        while (current < weapon_type.length && counter < limit ) {
            keyboard.textButton({
                label: weapon_type[current].label,
                payload: {
                    command: weapon_type[current].id
                },
                color: 'primary'
            })
            weapon_list += `- ${weapon_type[current].description} \n`
            counter++
            current++
            if (counter%2 == 0) {
                keyboard.row()
            }
        }
        keyboard.row()
        .textButton({
            label: '<',
            payload: {
                command: "left"
            },
            color: 'primary'
        })
        .textButton({
            label: 'назад',
            payload: {
                command: 'back'
            },
            color: 'primary'
        })
        .textButton({
            label: '>',
            payload: {
                command: 'right'
            },
            color: 'primary'
        })
        
        skill = await context.question(`${weapon_list}`, { keyboard: keyboard.inline(), answerTimeLimit } )
        if (skill.isTimeout) { return await context.send(`⏰ Время ожидания вашей активности истекло!`) }
        if (!skill.payload) {
            context.send('Жмите по inline кнопкам!')
        } else {
            if (skill.payload.command == 'back') {
                context.send('Вы нажали назад')
                modif = 0
                continue
            }
            if (skill.payload.command == 'left') {
                modif-limit >= 0 && modif < weapon_type.length ? modif-=limit : context.send('Позади ничего нет!')
                continue
            }
            if (skill.payload.command == 'right') {
                console.log('test ' + modif + ' total:' + weapon_type.length)
                modif+limit < weapon_type.length ? modif+=limit: context.send('Впереди ничего нет')
                continue
            }
            checker = true
            return skill
        }
    }
}

export async function Accessed(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const adm = await prisma.role.findFirst({ where: { id: user.id_role } })
    const role = adm?.name ?? `user`
    let ans = role == `root` ? 3 : role == `admin` ? 2 : 1
    return ans
}

export async function Book_Random_String(filename: string) {
    try {
        const contents = await fsPromises.readFile(filename, 'utf-8');
        const arr: any = contents.split(/\r?\n/);
        const clear = await arr.filter((value: any) => value !== undefined && value.length > 5);
        return clear[randomInt(0, clear.length - 1)];
    } catch (err) {
        console.log(err);
    }
}
export async function Keyboard_Index(context: any, messa: any) {
    const user_check: User | null | undefined = await Person_Get(context)
    if (!user_check) { return }
    const keyboard = new KeyboardBuilder()
    if (user_check.idvk == root) {
        keyboard.textButton({ label: 'Лютный переулок', payload: { command: 'sliz' }, color: 'positive' }).row()
    }
    if (await Accessed(context) != 1) {
        keyboard.textButton({ label: '!права', payload: { command: 'sliz' }, color: 'negative' }).row()
        keyboard.textButton({ label: '!операции', payload: { command: 'sliz' }, color: 'positive' }).row()
        keyboard.textButton({ label: '!операция', payload: { command: 'sliz' }, color: 'negative' }).row()
    } 
    keyboard.textButton({ label: '!банк', payload: { command: 'sliz' }, color: 'positive' }).row().oneTime()
    // Отправляем клавиатуру без сообщения
    await vk.api.messages.send({ peer_id: context.senderId, random_id: 0, message: `${messa}\u00A0`, keyboard: keyboard })
    .then(async (response: MessagesSendResponse) => { 
        await Sleep(1000)
        return vk.api.messages.delete({ message_ids: [response], delete_for_all: 1 }) })
    .then(() => { Logger(`In a private chat, succes get keyboard is viewed by user ${context.senderId}`) })
    .catch((error) => { console.error(`User ${context.senderId} fail get keyboard: ${error}`) });

    // Получаем последнее сообщение из истории беседы
  const [lastMessage] = (await vk.api.messages.getHistory({
    peer_id: context.peerId,
    count: 1,
  })).items;

  // Если последнее сообщение от пользователя и не содержит текст "!банк",
  // помечаем беседу как "говорит"
  if (lastMessage.from_id !== group_id && lastMessage.text !== '!банк') {
    await vk.api.messages.setActivity({
      type: 'typing',
      peer_id: context.peerId,
    });
  } else {
    // Иначе отправляем событие, что бот прочитал сообщение
    await vk.api.messages.markAsRead({
      peer_id: context.peerId,
    });
  }

}

async function Searcher(data: any, target: number) {
    let counter = 0
    while (data.length != counter) {
        if (data[counter].id_item == target) {
            return true
        }
        counter++
    }
    return false
}

export async function Gen_Inline_Button_Item(category: any, context: any) {
    await context.send(`⌛ Вы оказались в ${category.name}`)
    const user: any = await prisma.user.findFirst({ where: {    idvk: context.senderId  }   })
    const data: any= await prisma.item.findMany({   where: {    id_category: Number(category.id)    }   })
    let stopper = false
	let modif: number = 0
	const lim = 3 
    while (stopper == false) {
        let i = modif
        let counter = 0
        const inventory: any = await prisma.inventory.findMany({    where: {    id_user: user.id    }   })
        const item_render = []
        for (let j = modif; j < modif+3 && j < data.length; j++) {
            item_render.push({ name: data[j].name, price: `${data[j].price}G` })
        }
        await Image_Interface(item_render, context)
        let keyboard = Keyboard.builder()
        while (i < data.length && counter <lim) {
            const checker = await Searcher(inventory, data[i].id)
            
            if (checker && data[i].type != 'unlimited') {
                const text = `✅${data[i].name}`
                keyboard
                .textButton({   label: text.slice(0,40),
                                payload: {  command: `null`, operation: 'cant byuing'  },
                                color: 'positive'                           })
                .row()
            } else {
                const text = `🛒${data[i].price}💰 - ${data[i].name}`
                keyboard
                .textButton({   label: text.slice(0,40),
                                payload: {  command: `${i}`, operation: 'byuing'  },
                                color: 'secondary'                          })
                .row()
            }
            counter++
            i++
        }
        await context.send(`🛍 Чего желаете?`, { keyboard: keyboard.oneTime().inline() } )
        const  push = await context.question('🧷 Быстрый доступ',
            { keyboard: Keyboard.builder()
                .textButton({   label: '<',
                                payload: { command: "left" },
                                color: 'primary'              })
                .textButton({   label: `${(modif+3)/3}/${Math.round(data.length/3)}`,
                                payload: { command: "terminal" },
                                color: 'primary'              })
                .textButton({   label: '>',
                                payload: { command: 'right' },
                                color: 'primary'              }).row()
                .textButton({   label: 'Назад',
                                payload: { command: 'back' },
                                color: 'primary'              })
                .textButton({   label: 'Закончить',
                                payload: { command: 'end' },
                                color: 'primary'              })
                .oneTime(), answerTimeLimit
            }
        )
        if (push.isTimeout) { await context.send('⏰ Время ожидания выбора товаров истекло!'); return true }
        if (push.payload) {
            if (push.payload.operation == 'byuing') {
                const user: User | null = await prisma.user.findFirst({ where: { idvk: context.senderId } })
                const item_buy:any = data[push.payload.command]
                const item_inventory:any = await prisma.inventory.findFirst({ where: { id_item: item_buy.id, id_user: user!.id } })
                if ((!item_inventory || item_buy.type == 'unlimited') && user!.medal >= item_buy.price) {
                    const money = await prisma.user.update({ data: { medal: user!.medal - item_buy.price }, where: { id: user!.id } })
                    await context.send(`⚙ С вашего счета списано ${item_buy.price}💰, остаток: ${money.medal}💰`)
                    const inventory = await prisma.inventory.create({ data: { id_user: user!.id, id_item: item_buy.id } })
                    console.log(`User ${context.senderId} bought new item ${item_buy.id}`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🛍 @id${user!.idvk}(${user!.name}) покупает "${item_buy.name}" в "${category.name}" Косого переулка`
                    })
                    await context.send(`⚙ Ваша покупка доставится в течение нескольких секунд: ${item_buy.name}`)
                } else {
                    console.log(`User ${context.senderId} can't buy new item ${item_buy.id}`)
                    !item_inventory ? context.send(`💡 У вас  недостаточно средств для покупки ${item_buy.name}!!`) : context.send(`💡 У вас уже есть ${item_buy.name}!`)
                }
            }
            if (push.payload.command == 'back') { await context.send(`⌛ Возврат в Косой переулок...`); return false }
            if (push.payload.command == 'end') { await context.send(`⌛ Шоппинг успешно завершен`); return true }
            if (push.payload.command == 'right') { if (modif+lim < data.length) { modif += lim } }
            if (push.payload.command == 'left') { if (modif-lim >= 0) { modif -= lim } }
        }
    }
}

export async function Gen_Inline_Button_Category(context: any, weapon_type: any, mesa: string) {
    await Image_Random(context, "shop")
    let checker = false
    let counter = 0
    let current = 0
    let modif = 0
    while (checker == false) {
        let keyboard = Keyboard.builder()
        counter = 0
        current = modif
        const limit = 5
        let weapon_list = ''
        while (current < weapon_type.length && counter < limit ) {
            keyboard.textButton({   label: weapon_type[current].name,
                                    payload: {  command: weapon_type[current]   },
                                    color: 'primary'
            }).row()
            weapon_list += `⚓${weapon_type[current].id} ${weapon_type[current].name} \n`
            counter++
            current++
        }
        keyboard.row()
        .textButton({   label: '<',
                        payload: { command: "left" },
                        color: 'primary'              })
        .textButton({   label: 'Вернуться',
                        payload: { command: 'back' },
                        color: 'primary'              })
        .textButton({   label: '>',
                        payload: { command: 'right' },
                        color: 'primary'              })
        const skill = await context.question( `✉ ${mesa}\n${weapon_list}`, { keyboard: keyboard.inline(), answerTimeLimit } )
        if (skill.isTimeout) { await context.send('⏰ Время ожидания выбора места посещения истекло!'); return false }
        if (!skill.payload) {
            await context.send('💡 Жмите по inline кнопкам!')
        } else {
            if (skill.payload.command == 'back') {
                await context.send('💡 Шоппинг успешно отменен')
                modif = 0
                return false
            }
            if (skill.payload.command == 'left') {
                modif-limit >= 0 && modif < weapon_type.length ? modif-=limit : await context.send('💡 Позади ничего нет!')
                continue
            }
            if (skill.payload.command == 'right') {
                modif+limit < weapon_type.length ? modif+=limit: await context.send('💡 Впереди ничего нет')
                continue
            }
            checker = true
            return skill.payload.command
        }
    }
}

export async function Fixed_Number_To_Five(num: number) {
    let res = 0
    res = num < 5 ? 0 : Math.floor(num / 5) * 5
    //console.log(`${num} --> ${res}`)
	return res
}
export async function Worker_Checker() {
    await vk.api.messages.send({
        peer_id: chat_id,
        random_id: 0,
        message: `✅ Все ок! ${await Up_Time()}\n🗿 Поставьте здесь свою реакцию о том, как прошел ваш день!`,
    })
}
export async function Worker_Online_Setter(group_id: number) {
    try {
		await Sleep(1000)
        console.log(group_id)
		await vk.api.groups.enableOnline({ group_id: group_id }) 
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

export async function Send_Message(idvk: number, message: string, keyboard?: Keyboard) {
    message = message ? message : 'invalid message'
    try {
        keyboard ? await vk.api.messages.send({ peer_id: idvk, random_id: 0, message: `${message}`, keyboard: keyboard } ) : await vk.api.messages.send({ peer_id: idvk, random_id: 0, message: `${message}` } )
    } catch (e) {
        console.log(`Ошибка отправки сообщения: ${e}`)
    }
}
export async function Edit_Message(context: any, message: string, keyboard?: Keyboard, attached?: PhotoAttachment | null) {
    message = message ? message : 'invalid message'
    try {
        if (keyboard && attached) {
            await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`, keyboard: keyboard, attachment: attached.toString()})
        }
        if (!keyboard && attached) {
            await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`, attachment: attached.toString()})
        }
        if (keyboard && !attached) {
            await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`, keyboard: keyboard})
        }
        if (!keyboard && !attached) {
            await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${message}`})
        }
    } catch (e) {
        const err = `Ошибка редактирования сообщения, попробуйте через 1-15 минут, в зависимости от ошибки: ${e}`
        console.log(`Ошибка редактирования сообщения, попробуйте через 1-15 минут, в зависимости от ошибки: ${e}`)
        try {
            await vk.api.messages.send({
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
	const [group] = await vk.api.groups.getById(vk);
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
				.textButton({ label: `${ico_list['success'].ico} Да`, color: 'positive' })
				.textButton({ label: `${ico_list['cancel'].ico} Нет`, color: 'negative' }).row()
                .textButton({ label: `${ico_list['cancel'].ico} Назад`, color: 'primary' })
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