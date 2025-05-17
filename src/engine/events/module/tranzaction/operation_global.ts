import { timer_text_oper } from "../../../.."


//Модуль вовзврата
export async function Back(id: number, context: any) {
    console.log(`Admin ${context.senderId} canceled operation for user UID: ${id}`)
    await context.send(`⚙ Операция отменена пользователем.`)
}

//Модуль обработки ввода пользователем 
export async function Ipnut_Gold(context: any, operation: string) {
    let golden: number = 0
    let money_check = false
    while (money_check == false) {
        const gold: any = await context.question(`🧷 Введите количество для операции ${operation}: `, timer_text_oper)
        if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание количества ${operation} истекло!`); return golden }
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
        const gold = await context.question(`🧷 Введите уведомление пользователю по операции ${operation}:`, timer_text_oper)
        if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание уведомления пользователю ${operation} истекло!`); return "Отсутствует." }
        if (gold.text) {
            money_check = true
            golden = gold.text
        } 
    }
    return golden
}