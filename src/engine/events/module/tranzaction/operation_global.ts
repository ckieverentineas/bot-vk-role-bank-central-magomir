import { User } from "@prisma/client"
import { Keyboard } from "vk-io"
import { OperationCancelledError } from "../../../core/helper"
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
        if (typeof Number(gold.text) == "number") {
            money_check = true
            golden = Number(gold.text)
        } 
    }
    return golden
}
export async function Ipnut_Message(context: any, operation: string) {
    let golden = ''
    let money_check = false
    while (money_check == false) {
        const gold = await context.question(`🧷 Введите уведомление пользователю по операции ${operation}:`, { ...timer_text_oper, keyboard: backKeyboard() })
        if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание уведомления пользователю ${operation} истекло!`); return "Отсутствует." }
        if (gold.payload?.command === 'back') { throw new OperationCancelledError() }
        if (gold.text) {
            money_check = true
            golden = gold.text
        } 
    }
    return golden
}