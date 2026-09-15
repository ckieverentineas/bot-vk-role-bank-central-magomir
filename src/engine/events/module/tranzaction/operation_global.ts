import { User } from "@prisma/client"
import { Keyboard } from "vk-io"
import { OperationCancelledError } from "../../../core/helper"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"
import { timer_text_oper } from "../../../.."


//Модуль вовзврата
export async function Back(id: number, context: any, user_adm: User) {
    console.log(`Admin ${context.senderId} canceled operation for user UID: ${id}`)
    await context.send(`⚙ Операция отменена пользователем.`)
}

function backKeyboard() {
    return Keyboard.builder()
        .textButton({ label: '🔙 Назад', payload: { command: 'back' }, color: 'secondary' })
        .oneTime().inline()
}

//Модуль обработки ввода пользователем 
export async function Ipnut_Gold(context: any, operation: string) {
    let golden: number = 0
    let money_check = false
    while (money_check == false) {
        const gold: any = await context.question(`🧷 Введите количество для операции ${operation}: `, { ...timer_text_oper, keyboard: backKeyboard() })
        if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание количества ${operation} истекло!`); return golden }
        if (gold.payload?.command === 'back') { throw new OperationCancelledError() }
        const parsed = Number(gold.text)
        if (Number.isFinite(parsed)) {
            money_check = true
            golden = parsed
        } 
    }
    return golden
}
export async function Ipnut_Message(context: any, operation: string) {
    let golden = ''
    let money_check = false
    let page = 0
    while (money_check == false) {
        const user = await Person_Get(context)
        const templates = user?.id_alliance ? await prisma.notificationTemplate.findMany({
            where: { allianceId: user.id_alliance }, orderBy: { name: 'asc' }
        }) : []
        const keyboard = Keyboard.builder()
        const pageSize = 8
        const start = page * pageSize
        const visible = templates.slice(start, start + pageSize)
        if (visible.length) {
            for (let index = 0; index < visible.length; index += 2) {
                const first = visible[index]
                keyboard.textButton({ label: `📝 ${first.name.slice(0, 25)}`, payload: { command: 'notification_template_select', id: first.id }, color: 'secondary' })
                const second = visible[index + 1]
                if (second) {
                    keyboard.textButton({ label: `📝 ${second.name.slice(0, 25)}`, payload: { command: 'notification_template_select', id: second.id }, color: 'secondary' })
                }
                keyboard.row()
            }
        }
        if (templates.length > pageSize) {
            if (page > 0) keyboard.textButton({ label: '◀️', payload: { command: 'notification_template_prev' }, color: 'secondary' })
            if (start + pageSize < templates.length) keyboard.textButton({ label: '▶️', payload: { command: 'notification_template_next' }, color: 'secondary' })
            keyboard.row()
        }
        const gold = await context.question(`🧷 Введите уведомление пользователю по операции ${operation}:`, { ...timer_text_oper, keyboard })
        if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание уведомления пользователю ${operation} истекло!`); return "Отсутствует." }
        if (gold.payload?.command === 'back') { throw new OperationCancelledError() }
        if (gold.payload?.command === 'notification_template_prev') { page = Math.max(0, page - 1); continue }
        if (gold.payload?.command === 'notification_template_next') { page = Math.min(Math.ceil(templates.length / pageSize) - 1, page + 1); continue }
        if (gold.payload?.command === 'notification_template_select') {
            const selected = user?.id_alliance ? await prisma.notificationTemplate.findFirst({
                where: { id: Number(gold.payload.id), allianceId: user.id_alliance }
            }) : null
            if (selected) {
                money_check = true
                golden = selected.text
            }
        } else if (gold.text) {
            money_check = true
            golden = gold.text
        } 
    }
    return golden
}
