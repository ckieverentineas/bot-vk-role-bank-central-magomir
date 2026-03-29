// engine/events/module/info.ts
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
import { CardSystem } from "../../core/card_system"
import { getUserSkillsForDisplay } from "./skills/user_skill_display"

// Вспомогательная функция для прогресс-бара
function getProgressBar(progress: number): string {
  if (progress <= 0) return '';
  return ``;
}

export async function Card_Enter(context: any) {
  const get_user: User | null | undefined = await Person_Get(context)
  if (get_user) {
    const account = await prisma.account.findFirst({ 
      where: { id: get_user.id_account }
    })
    
    if (!account) {
      await Send_Message(context.peerId, "Ошибка: аккаунт не найден")
      return
    }
    
    const isMonitorSelected = account?.monitor_select_user === get_user.id
    
    const monitorStatus = await Get_Person_Monitor_Status(
      account.id, 
      get_user.id, 
      get_user.id_alliance
    )
    
    // Используем систему карточек
    let attached = await CardSystem.getUserCard(get_user)
    
    if (!attached) {
      console.error('[CARD_ENTER] Failed to get card from CardSystem')
      attached = ''
    }
    
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ 
      where: { id: Number(get_user.id_alliance) } 
    })
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ 
      where: { id: Number(get_user.id_facult) } 
    })
    
    // Получаем терминологию
    const singular = await getTerminology(alli_get?.id || 0, 'singular')
    const genitive = await getTerminology(alli_get?.id || 0, 'genitive')
    const facultTerminology = singular.charAt(0).toUpperCase() + singular.slice(1)
    const withoutFaculty = `Без ${genitive}`

    // Базовый текст карточки
    let text = `✉ Вы достали свою карточку: \n\n` +
      `💳 UID: ${get_user.id} \n` +
      `🕯 GUID: ${get_user.id_account} \n` +
      `🔘 Жетоны: ${get_user.medal} \n` +
      `🌕 S-coins: ${get_user.scoopins} \n` +
      `👤 Имя: ${get_user.name} \n` +
      `👑 Статус: ${get_user.class} \n` +
      `🔨 Профессия: ${get_user?.spec} \n` +
      `🏠 Ролевая: ${get_user.id_alliance == 0 ? `Соло` : get_user.id_alliance == -1 ? `Не союзник` : alli_get?.name} \n` +
      `${facult_get ? facult_get.smile : `🔮`} ${facultTerminology}: ${facult_get ? facult_get.name : withoutFaculty}\n` +
      `${coin}\n\n` +
      `🔔 Мониторы: ${get_user.notification ? '✅' : '❌'} | 🔔 РП-посты: ${get_user.notification_topic ? '✅' : '❌'}\n` +
      `${monitorStatus.description}`

    // ===================== НАВЫКИ (вычисляются на лету) =====================
    let skillsText = ''
    if (get_user.id_alliance && get_user.id_alliance > 0) {
      const displaySkills = await getUserSkillsForDisplay(get_user.id, get_user.id_alliance)
      
      if (displaySkills.length > 0) {
        skillsText = `\n`
        let currentCategory = ''
        
        for (const skill of displaySkills) {
          if (skill.categoryName !== currentCategory) {
            currentCategory = skill.categoryName
            skillsText += `\n📁 ${currentCategory}:\n`
          }
          
          const progressBar = getProgressBar(skill.progress)
          const levelDisplay = skill.levelName || '❌ нет уровня'
          skillsText += `  ⚔️ ${skill.skillName}: ${levelDisplay} ${progressBar}\n`
          
          // Показываем требования для следующего уровня
          if (skill.missingRequirements && Object.keys(skill.missingRequirements).length > 0 && skill.nextLevelName) {
            const missingParts = []
            for (const [coinId, { current, required }] of Object.entries(skill.missingRequirements)) {
              const coin = await prisma.allianceCoin.findFirst({ where: { id: parseInt(coinId) } })
              missingParts.push(`${coin?.smile || '💰'} ${current}/${required}`)
            }
            if (missingParts.length > 0) {
              skillsText += `     📈 до ${skill.nextLevelName}: ${missingParts.join(', ')}\n`
            }
          }
        }
      }
    }
    
    // Добавляем навыки в текст
    text += skillsText
    
    // ===================== КЛАВИАТУРА =====================
    const keyboard = new KeyboardBuilder()
      .textButton({ label: '➕👤 Добавить персонажа', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
    
    if (await prisma.user.count({ where: { idvk: get_user.idvk } }) > 1) {
      keyboard.textButton({ label: '🔃👥 Сменить персонажа', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
    }
    
    if (get_user.id_alliance && get_user.id_alliance > 0) {
      keyboard.callbackButton({ 
        label: isMonitorSelected ? '✅👥 Выбран для мониторов' : '👥 Выбрать для мониторов', 
        payload: { command: 'monitor_select_person', personId: get_user.id }, 
        color: isMonitorSelected ? 'positive' : 'secondary' 
      }).row()
    }
    
    keyboard
      .callbackButton({ label: '🏆', payload: { command: 'rank_enter' }, color: 'secondary' })
      .callbackButton({ label: '💬', payload: { command: 'comment_person_enter' }, color: 'secondary' }).row()
      .textButton({ label: '🔔 Мониторы', payload: { command: 'notification_controller' }, color: 'secondary' })
      .textButton({ label: '📝 Обсуждения', payload: { command: 'topic_notification_controller' }, color: 'secondary' }).row()
      .callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    
    await Logger(`In a private chat, the card is viewed by user ${get_user.idvk}`)
    
    const otherPersonsInAlliance = await prisma.user.count({
      where: { 
        id_account: get_user.id_account,
        id_alliance: get_user.id_alliance,
        NOT: { id: get_user.id }
      }
    })
    
    let snackbarText = `В общем, вы ${get_user.medal > 100 ? "при жетонах" : "без жетонов"}.`
    
    if (otherPersonsInAlliance > 0 && get_user.id_alliance && get_user.id_alliance > 0) {
      if (!isMonitorSelected) {
        snackbarText += ` У вас ${otherPersonsInAlliance} других персонажей в этом альянсе. Выберите этого для мониторов?`
      } else {
        snackbarText += ` Этот персонаж получает начисления от мониторов альянса.`
      }
    }
    
    // Отправляем сообщение с карточкой
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
  const attached = image_admin
  const user: User | null | undefined = await Person_Get(context)
  
  if (!user) { return }
  
  let puller = '🏦 Полный спектр рабов... \n'
  const keyboard = new KeyboardBuilder()
  
  const currentUserRole = await prisma.role.findUnique({
    where: { id: user.id_role }
  })
  
  const isRootOrSuperadmin = currentUserRole?.name === 'root' || 
                              currentUserRole?.name === 'superadmin'
  
  if (isRootOrSuperadmin) {
    const rootRole = await prisma.role.findFirst({ where: { name: 'root' } })
    const rootUsers = rootRole ? await prisma.user.findMany({ 
      where: { id_role: rootRole.id } 
    }) : []
    
    for (const rootUser of rootUsers) {
      puller += `\n😎 ${rootUser.id} - @id${rootUser.idvk}(${rootUser.name})`
    }
    
    const superadminRole = await prisma.role.findFirst({ where: { name: 'superadmin' } })
    const superadminUsers = superadminRole ? await prisma.user.findMany({ 
      where: { id_role: superadminRole.id } 
    }) : []
    
    for (const superadminUser of superadminUsers) {
      puller += `\n😎 ${superadminUser.id} - @id${superadminUser.idvk}(${superadminUser.name})`
    }
    
    const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } })
    const adminUsers = adminRole ? await prisma.user.findMany({ 
      where: { id_role: adminRole.id } 
    }) : []
    
    for (const adminUser of adminUsers) {
      puller += `\n👤 ${adminUser.id} - @id${adminUser.idvk}(${adminUser.name})`
    }
  } 
  else if (currentUserRole?.name === 'admin' && user.id_alliance && user.id_alliance > 0) {
    puller += `\n👥 Администраторы вашего альянса:\n`
    
    const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } })
    if (adminRole) {
      const allianceAdmins = await prisma.user.findMany({ 
        where: { 
          id_role: adminRole.id,
          id_alliance: user.id_alliance
        } 
      })
      
      if (allianceAdmins.length > 0) {
        for (const adminUser of allianceAdmins) {
          puller += `\n👤 ${adminUser.id} - @id${adminUser.idvk}(${adminUser.name})`
        }
      } else {
        puller += `\n📭 В вашем альянсе нет других администраторов`
      }
    }
  } 
  else {
    puller += `\n🚫 Доступ запрещен\n`
    
    if (currentUserRole?.name === 'admin' && (!user.id_alliance || user.id_alliance <= 0)) {
      puller += `\nℹ Вы являетесь администратором, но не состоите в альянсе.\nПрисоединитесь к альянсу, чтобы увидеть список администраторов.`
    }
  }
  
  keyboard.callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
  
  await Send_Message(context.peerId, puller, keyboard, attached)
  await Logger(`In a private chat, the list administrators is viewed by ${currentUserRole?.name} ${user.idvk}`)
  
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
  const user: User | null | undefined = await Person_Get(context)
  if (!user) { return }
  const stats = await prisma.analyzer.findFirst({ where: { id_user: user.id }})
  let text = ''
  const keyboard = new KeyboardBuilder()
  text = `⚙ Конфиденциальная информация:\n\n🍺 Сливочное: ${stats?.beer}/20000\n🍵 Бамбуковое: ${stats?.beer_premiun}/1000\n🎁 Дни Рождения: ${stats?.birthday}/15\n🛒 Покупок: ${stats?.buying}/20000\n🧙 Конвертаций МО: ${stats?.convert_mo}/20000\n📅 Получено ЕЗ: ${stats?.quest}/20000\n👙 Залогов: ${stats?.underwear}/20000\n`
  console.log(`User ${context.peerId} get statistics information`)
  keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
  await vk?.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard}) 
}

export async function Comment_Person_Enter(context: any) {
  const user: User | null | undefined = await Person_Get(context)
  if (!user) { return }
  let text = ''
  const keyboard = new KeyboardBuilder()
  text = `⚙ Комментарий к вашему персонажу:\n\n ${user.comment ? user.comment : 'Пока что для вашего персонажа дополнительной информации нет...'}`
  keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
  await Send_Message(context.peerId,`${text}`, keyboard) 
}

export async function Rank_Enter(context: any) {
  const user: User | null | undefined = await Person_Get(context)
  if (!user) { return }
  let text = '⚙ Рейтинг персонажей:\n\n'
  const keyboard = new KeyboardBuilder()

  const stat: { rank: number, text: string, score: number, me: boolean }[] = []
  let counter = 1
  for (const userok of await prisma.user.findMany()) {
    stat.push({
      rank: counter,
      text: `- [https://vk.com/id${userok.idvk}|${userok.name.slice(0, 20)}] --> ${userok.medal}🔘\n`,
      score: userok.medal,
      me: userok.idvk == user.idvk ? true : false
    })
    counter++
  }
  stat.sort(function(a, b){
    return b.score - a.score
  })
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