import { Account } from "@prisma/client"
import { Context, Keyboard } from "vk-io"
import prisma from "../prisma_client"
import { Confirm_User_Success, Input_Number, Input_Text, Select_Alliance_Coin, Send_Message, Send_Message_Smart } from "../../../core/helper"
import { ico_list } from "../data_center/icons_lib"
import { answerTimeLimit } from "../../../.."

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
    if (coin.sbp_on == false) { return await context.send(`Для валюты не разрешена СБП администраторами вашей ролевой`) }
    
    // проверяем баланс
    const coin_me = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user_check.id } })
    if (!coin_me) { return await context.send(`У вас не открыт счет по данной валюте`) }
    const coin_other = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: person_goten_check.id } })
    if (!coin_other) { return await context.send(`У получателя не открыт счет по данной валюте`) }
    
    // ввод суммы
    const count_coin = await Input_Number(context, `Введите количество ${coin.name} для перевода, у вас на балансе [${coin_me.amount}${coin.smile}]:\n`, true)
    if (!count_coin) { await context.send(`Деньги не найден`); return }
    if (coin_me.amount < count_coin || coin_me.amount < 0) {
        return await context.send(`Перевести не получится, у вас не хватает денег!`)
    }
    
    // ВВОД КОММЕНТАРИЯ
    let comment = "";
    const want_comment = await context.question(
        `💬 Хотите добавить комментарий к переводу?`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '✅ Да', payload: { command: 'add_comment' }, color: 'positive' })
                .textButton({ label: '❌ Нет', payload: { command: 'no_comment' }, color: 'negative' })
                .oneTime().inline(),
            answerTimeLimit
        }
    );
    
    if (want_comment.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return;
    }
    
    if (want_comment.payload?.command === 'add_comment') {
        const comment_input = await Input_Text(context, 
            `💬 Введите комментарий к переводу (максимум 200 символов):`,
            200
        );
        
        if (comment_input) {
            comment = comment_input;
        }
    }
    
    // ПОДТВЕРЖДЕНИЕ С КОММЕНТАРИЕМ
    let confirm_message = `перевести "${coin.name}" в размере [${count_coin}${coin.smile}] игроку ${person_goten_check.name} со счета своего персонажа ${user_check.name}?`;
    
    if (comment) {
        confirm_message += `\n💬 Комментарий: "${comment}"`;
    }
    
    const confirm_gift: { status: boolean, text: string } = await Confirm_User_Success(context, confirm_message);
    
    if (!confirm_gift.status) {
        await context.send(`❌ Перевод отменен.`);
        return;
    }
    
    // Выполнение перевода
    const coin_other_change = await prisma.balanceCoin.update({ 
        where: { id: coin_other.id }, 
        data: { amount: { increment: count_coin } } 
    });
    
    if (!coin_other_change) { 
        await context.send(`❌ Ошибка при зачислении средств получателю`); 
        return; 
    }
    
    const coin_me_change = await prisma.balanceCoin.update({ 
        where: { id: coin_me.id }, 
        data: { amount: { decrement: count_coin } } 
    });
    
    if (!coin_me_change) { 
        // Откат первой операции, если вторая не удалась
        await prisma.balanceCoin.update({ 
            where: { id: coin_other.id }, 
            data: { amount: { decrement: count_coin } } 
        });
        await context.send(`❌ Ошибка при списании средств`); 
        return; 
    }
    
    // СООБЩЕНИЕ ОТПРАВИТЕЛЮ (видит только свой баланс)
    const sender_notif = `"💷СБП" --> совершен перевод в валюте "${coin.name}":\n👤 Отправитель @id${user_check.idvk}(${user_check.name}) (UID: ${user_check.id}) --> ${coin_me.amount} - ${count_coin} = ${coin_me_change.amount}${coin.smile}\n👥 Получатель: @id${person_goten_check.idvk}(${person_goten_check.name}) (UID: ${person_goten_check.id})${comment ? `\n💬 Комментарий: "${comment}"` : ''}`;

    await Send_Message(user_check.idvk, sender_notif);
    
    // СООБЩЕНИЕ ПОЛУЧАТЕЛЮ (формат как в примере)
    const receiver_notif = `🔔 Уведомление для @id${person_goten_check.idvk}(${person_goten_check.name}) (UID: ${person_goten_check.id})\n💷 Вам перевели ${count_coin}${coin.smile} от @id${user_check.idvk}(${user_check.name}) (UID: ${user_check.id})\n💰 Ваш баланс: ${coin_other.amount} + ${count_coin} = ${coin_other_change.amount}${coin.smile}${comment ? `\n💬 Комментарий: "${comment}"` : ''}`;

    await Send_Message(person_goten_check.idvk, receiver_notif);

    // ЛОГ В ЧАТ АЛЬЯНСА (полная информация)
    const log_message = `"💷СБП" --> совершен перевод в валюте "${coin.name}":\n👤 Отправитель @id${user_check.idvk}(${user_check.name}) (UID: ${user_check.id}) --> ${coin_me.amount} - ${count_coin} = ${coin_me_change.amount}${coin.smile}\n👥 Получатель: @id${person_goten_check.idvk}(${person_goten_check.name}) (UID: ${person_goten_check.id}) --> ${coin_other.amount} + ${count_coin} = ${coin_other_change.amount}${coin.smile}${comment ? `\n💬 Комментарий: "${comment}"` : ''}`;

    // Отправка в финансовый чат альянса
    const alliance = await prisma.alliance.findFirst({ where: { id: user_check.id_alliance ?? 0 } });
    if (alliance?.id_chat && alliance.id_chat > 0) {
        await Send_Message(alliance.id_chat, log_message);
    }
    
    // Финальное сообщение отправителю
    await context.send(`✅ Перевод успешно выполнен!${comment ? `\n💬 Комментарий: "${comment}"` : ''}`);
}