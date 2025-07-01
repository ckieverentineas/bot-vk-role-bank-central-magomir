import { Account } from "@prisma/client"
import { Context } from "vk-io"
import prisma from "../prisma_client"
import { Confirm_User_Success, Input_Number, Select_Alliance_Coin, Send_Message, Send_Message_Smart } from "../../../core/helper"
import { ico_list } from "../data_center/icons_lib"

export async function Operation_SBP(context: Context) {
    // проверяем отправителя
    const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    if (!account) { return }
	const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
	if (!user_check) { return }
    // проверяем получателя
    const person_goten = await Input_Number(context, `Введите UID персонажа, которому будет совершен перевод от вашего персонажа ${user_check.name}:\n`, true)
    if (!person_goten) { await context.send(`Получатель не найден`); return }
    if (person_goten == user_check.id) { await context.send(`Самому себе вы не можете переводить:)`); return}
    const person_goten_check = await prisma.user.findFirst({ where: { id: person_goten } })
    if (!person_goten_check) { await context.send(`Такого персонажа не числится!`); return }
    // выбираем валюту
    const selectedCoinId = await Select_Alliance_Coin(context, user_check.id_alliance ?? 0);
    if (!selectedCoinId) {
        await context.send(`${ico_list['warn'].ico} Выбор валюты прерван.`);
        return;
    }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: selectedCoinId } })
    if (!coin) { return await context.send(`Валюта не найдена`)}
    if (coin.point) { return await context.send(`Рейтинговую валюту перевести нельзя`) }
    if (coin.sbp_on == false) { return await context.send(`Для валюты не разрешено СБП администраторами вашей ролевой`) }
    // проверяем баланс
    const coin_me = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user_check.id } })
    if (!coin_me) { return await context.send(`У вас не открыт счет по данной валюте`) }
    const coin_other = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: person_goten_check.id } })
    if (!coin_other) { return await context.send(`У получателя не открыт счет по данной валюте`) }
    const count_coin = await Input_Number(context, `Введите количество ${coin.name} для перевода, у вас на балансе [${coin_me.amount}${coin.smile}]:\n`, true)
    if (!count_coin) { await context.send(`Деньги не найден`); return }
    if (coin_me.amount < count_coin || coin_me.amount < 0) {
        return await context.send(`Перевести не получится, у вас не хватает денег!`)
    }
    const confirm_gift: { status: boolean, text: string } = await Confirm_User_Success(context, `перевести "${coin.name}" в размере [${count_coin}${coin.smile}] игроку ${person_goten_check.name} со счета своего персонажа ${user_check.name}?`);
    //await context.send(confirm.text);
    if (!confirm_gift.status) return;
    const coin_other_change = await prisma.balanceCoin.update({ where: { id: coin_other.id }, data: { amount: { increment: count_coin } } })
    if (!coin_other_change) { return await context.send(`Ошибка перевода`) }
    const coin_me_change = await prisma.balanceCoin.update({ where: { id: coin_me.id }, data: { amount: { decrement: count_coin } } })
    if (!coin_me_change) { return await context.send(`Ошибка перевода`) }
    const notif = `"💷СБП" --> совершен перевод в валюте "${coin.name}":\n👤 Отправитель @id${user_check.idvk}(${user_check.name}) --> ${coin_me.amount} - ${count_coin} = ${coin_me_change.amount}${coin.smile}\n👥 Получатель: @id${person_goten_check.idvk}(${person_goten_check.name}) --> ${coin_other.amount} + ${count_coin} = ${coin_other_change.amount}${coin.smile}\n`
    await Send_Message_Smart(context, notif, 'client_callback', person_goten_check)
    await Send_Message(user_check.idvk, notif)
}