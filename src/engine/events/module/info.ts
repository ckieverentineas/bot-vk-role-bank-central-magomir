import { KeyboardBuilder } from "vk-io"
import prisma from "./prisma_client"
import { vk } from "../../.."
import { Alliance, AllianceFacult, User } from "@prisma/client"
import { Image_Text_Add_Card } from "../../core/imagecpu"
import { Person_Get } from "./person/person"
import { Accessed, Logger, Send_Message } from "../../core/helper"
import { Person_Coin_Printer } from "./person/person_coin"
import { Facult_Rank_Printer } from "./alliance/facult_rank"
import { image_admin } from "./data_center/system_image"
import { getTerminology } from "./alliance/terminology_helper"
import { Get_Person_Monitor_Status } from "./person/monitor_select"

export async function Card_Enter(context:any) {
    //console.log(`[DEBUG Card_Enter] START: senderId=${context.senderId}, userId=${context.userId}, peerId=${context.peerId}`);
    
    const get_user: User | null | undefined = await Person_Get(context)
    if (get_user) {
        //console.log(`[DEBUG Card_Enter] User found: ${get_user.id} - ${get_user.name}, alliance: ${get_user.id_alliance}, idvk: ${get_user.idvk}, id_account: ${get_user.id_account}`);
        
        // ВАЖНО: Используем id_account из пользователя, а не ищем по idvk
        const account = await prisma.account.findFirst({ 
            where: { id: get_user.id_account }  // Используем id_account из User
        });
        
        //console.log(`[DEBUG Card_Enter] Account by user.id_account (${get_user.id_account}): ${account?.id}, idvk: ${account?.idvk}, monitor_select_user: ${account?.monitor_select_user}`);
        
        if (!account) {
            //console.log(`[DEBUG Card_Enter] ERROR: Account not found for id ${get_user.id_account}`);
            await Send_Message(context.peerId, "Ошибка: аккаунт не найден");
            return;
        }
        
        const isMonitorSelected = account?.monitor_select_user === get_user.id;
        //console.log(`[DEBUG Card_Enter] isMonitorSelected: ${isMonitorSelected} (account.monitor_select_user=${account.monitor_select_user}, user.id=${get_user.id})`);
        
        // Получаем статус мониторов
        const monitorStatus = await Get_Person_Monitor_Status(
            account.id, 
            get_user.id, 
            get_user.id_alliance
        );
        
        //console.log(`[DEBUG Card_Enter] Monitor status: ${monitorStatus.status}, description: ${monitorStatus.description}`);
        
        const attached = await Image_Text_Add_Card(context, 50, 650, get_user)
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ where: { id: Number(get_user.id_facult) } })
        
        // Получаем отдельные значения
        const singular = await getTerminology(alli_get?.id || 0, 'singular');
        const genitive = await getTerminology(alli_get?.id || 0, 'genitive');

        // Используем их
        const facultTerminology = singular.charAt(0).toUpperCase() + singular.slice(1);
        const withoutFaculty = `Без ${genitive}`;

        const text = `✉ Вы достали свою карточку: \n\n💳 UID: ${get_user.id} \n🕯 GUID: ${get_user.id_account} \n🔘 Жетоны: ${get_user.medal} \n🌕 S-coins: ${get_user.scoopins} \n👤 Имя: ${get_user.name} \n👑 Статус: ${get_user.class}  \n🔨 Профессия: ${get_user?.spec} \n🏠 Ролевая: ${get_user.id_alliance == 0 ? `Соло` : get_user.id_alliance == -1 ? `Не союзник` : alli_get?.name} \n${facult_get ? facult_get.smile : `🔮`} ${facultTerminology}: ${facult_get ? facult_get.name : withoutFaculty}\n${coin}\n\n${monitorStatus.description}`
        
        const keyboard = new KeyboardBuilder()
            .textButton({ label: '➕👤 Добавить персонажа', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
        
        if (await prisma.user.count({ where: { idvk: get_user.idvk } }) > 1) {
            keyboard.textButton({ label: '🔃👥 Сменить персонажа', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
        }
        
        // Добавляем кнопку выбора для мониторов, только если персонаж в альянсе
        if (get_user.id_alliance && get_user.id_alliance > 0) {
            keyboard.callbackButton({ 
                label: isMonitorSelected ? '✅👥 Выбран для мониторов' : '👥 Выбрать для мониторов', 
                payload: { command: 'monitor_select_person', personId: get_user.id }, 
                color: isMonitorSelected ? 'positive' : 'secondary' 
            }).row()
        }
        
        keyboard.callbackButton({ label: '🏆', payload: { command: 'rank_enter' }, color: 'secondary' })
            .callbackButton({ label: '💬', payload: { command: 'comment_person_enter' }, color: 'secondary' }).row()
            .textButton({ label: '🔔 Уведомления', payload: { command: 'notification_controller' }, color: 'secondary' })
            .callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
        
        await Logger(`In a private chat, the card is viewed by user ${get_user.idvk}`)
        
        // Проверяем, есть ли у пользователя другие персонажи в этом альянсе
        const otherPersonsInAlliance = await prisma.user.count({
            where: { 
                id_account: get_user.id_account,
                id_alliance: get_user.id_alliance,
                NOT: { id: get_user.id }
            }
        });
        
        let snackbarText = `В общем, вы ${get_user.medal > 100 ? "при жетонах" : "без жетонов"}.`;
        
        if (otherPersonsInAlliance > 0 && get_user.id_alliance && get_user.id_alliance > 0) {
            if (!isMonitorSelected) {
                snackbarText += ` У вас ${otherPersonsInAlliance} других персонажей в этом альянсе. Выберите этого для мониторов?`;
            } else {
                snackbarText += ` Этот персонаж получает начисления от мониторов альянса.`;
            }
        }
        
        await Send_Message(context.peerId, text, keyboard, attached)
        
        if (context?.eventPayload?.command == "card_enter") {
            await vk?.api.messages.sendMessageEventAnswer({
                event_id: context.eventId,
                user_id: context.userId,
                peer_id: context.peerId,
                event_data: JSON.stringify({
                    type: "show_snackbar",
                    text: `🔔 ${snackbarText}`
                })
            })
        }
    }
}

export async function Admin_Enter(context: any) {
    const attached = image_admin//await Image_Random(context, "admin")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let puller = '🏦 Полный спектр рабов... \n'
    if (await Accessed(context) != 1) {
        const admar = await prisma.role.findFirst({ where: { name: `root` } })
        const usersr = await prisma.user.findMany({ where: { id_role: admar?.id } })
        for (const i in usersr) { puller += `\n😎 ${usersr[i].id} - @id${usersr[i].idvk}(${usersr[i].name})` }
        const adma = await prisma.role.findFirst({ where: { name: `admin` } })
        const users = await prisma.user.findMany({ where: { id_role: adma?.id } })
        for (const i in users) { puller += `\n👤 ${users[i].id} - @id${users[i].idvk}(${users[i].name})` }
    } else {
        puller += `\n🚫 Доступ запрещен\n`
    }
    const keyboard = new KeyboardBuilder().callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await Send_Message(context.peerId, puller, keyboard, attached)
    await Logger(`In a private chat, the list administrators is viewed by admin ${user.idvk}`)
    await vk?.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: `🔔 Им бы еще черные очки, и точно люди в черном!`
        })
    })
}

export async function Statistics_Enter(context: any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const stats = await prisma.analyzer.findFirst({ where: { id_user: user.id }})
    let text = ''
    const keyboard = new KeyboardBuilder()
    text = `⚙ Конфиденциальная информация:\n\n🍺 Сливочное: ${stats?.beer}/20000\n🍵 Бамбуковое: ${stats?.beer_premiun}/1000\n🎁 Дни Рождения: ${stats?.birthday}/15\n🛒 Покупок: ${stats?.buying}/20000\n🧙 Конвертаций МО: ${stats?.convert_mo}/20000\n📅 Получено ЕЗ: ${stats?.quest}/20000\n👙 Залогов: ${stats?.underwear}/20000\n`
    console.log(`User ${context.peerId} get statistics information`)
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await vk?.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, /*attachment: attached?.toString()*/}) 
}
export async function Comment_Person_Enter(context: any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const stats = await prisma.analyzer.findFirst({ where: { id_user: user.id }})
    let text = ''
    const keyboard = new KeyboardBuilder()
    text = `⚙ Комментарий к вашему персонажу:\n\n ${user.comment ? user.comment : 'Пока что для вашего персонажа дополнительной информации нет...'}`
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await Send_Message(context.peerId,`${text}`, keyboard, /*attachment: attached?.toString()*/) 
}
export async function Rank_Enter(context: any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const stats = await prisma.analyzer.findFirst({ where: { id_user: user.id }})
    let text = '⚙ Рейтинг персонажей:\n\n'
    const keyboard = new KeyboardBuilder()


    const stat: { rank: number, text: string, score: number, me: boolean }[] = []
    let counter = 1
    for (const userok of await prisma.user.findMany()) {
        const ach_counter = await prisma.achievement.count({ where: { id_user: userok.id }})
        stat.push({
            rank: counter,
            text: `- [https://vk.com/id${userok.idvk}|${userok.name.slice(0, 20)}] --> ${userok.medal}🔘\n`,
            score: userok.medal,
            me: userok.idvk == user.idvk ? true : false
        })
        counter++
    }
    stat.sort(function(a, b){
        return b.score - a.score;
    });
    let counter_last = 1
    let trig_find_me = false
    for (const stat_sel of stat) {
        if (counter_last <= 10) {
            text += `${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            if (stat_sel.me) { trig_find_me = true }
        }
        if (counter_last > 10 && !trig_find_me) {
            if (stat_sel.me) {
                text += `\n\n${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            }
        }
        counter_last++
    }
    text += `\n\n☠ В статистике участвует ${counter-1} персонажей`
    await Logger(`In a private chat, the rank information is viewed by user ${user.idvk}`)
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await Send_Message(context.peerId, text, keyboard)
}