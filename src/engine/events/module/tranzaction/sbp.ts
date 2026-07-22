// engine/events/module/tranzaction/sbp.ts
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
    
    // ===== ВВОД UID (поддержка нескольких через пробел) =====
    let targetUids: number[] = [];
    
    const person_goten_input = await context.question(
        `🧷 Введите UID персонажа (или несколько через пробел), кому будет совершен перевод от вашего персонажа ${user_check.name}:\n`,
        { answerTimeLimit }
    );
    
    if (person_goten_input.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return;
    }
    
    const uidParts = person_goten_input.text.trim().split(/\s+/);
    for (const part of uidParts) {
        const uid = parseInt(part);
        if (!isNaN(uid) && uid > 0) {
            targetUids.push(uid);
        }
    }
    
    if (targetUids.length === 0) {
        await context.send(`❌ Не удалось распознать UID.`);
        return;
    }
    
    // Проверяем каждого получателя
    const validRecipients = [];
    for (const uid of targetUids) {
        if (uid === user_check.id) {
            await context.send(`⚠️ UID ${uid} — это вы сами. Пропускаем.`);
            continue;
        }
        
        const person_goten_check = await prisma.user.findFirst({ where: { id: uid } });
        if (!person_goten_check) {
            await context.send(`⚠️ Персонаж с UID ${uid} не найден. Пропускаем.`);
            continue;
        }
        
        if (person_goten_check.id_alliance !== user_check.id_alliance) {
            await context.send(`⚠️ Персонаж с UID ${uid} не в вашей ролевой. Пропускаем.`);
            continue;
        }
        
        validRecipients.push(person_goten_check);
    }
    
    if (validRecipients.length === 0) {
        await context.send(`❌ Нет валидных получателей.`);
        return;
    }
    
    // ===== ВЫБОР ВАЛЮТЫ (ТОЛЬКО С РАЗРЕШЕННОЙ СБП) =====
    // [!] ИЗМЕНЕНИЕ: Передаем true для фильтрации только валют с sbp_on: true
    const selectedCoinId = await Select_Alliance_Coin(context, user_check.id_alliance ?? 0, true);
    if (!selectedCoinId) {
        await context.send(`${ico_list['warn'].ico} Выбор валюты прерван.`);
        return;
    }
    
    const coin = await prisma.allianceCoin.findFirst({ where: { id: selectedCoinId } });
    if (!coin) {
        await context.send(`❌ Валюта не найдена.`);
        return;
    }
    
    // Дополнительная проверка на всякий случай
    if (coin.sbp_on == false) {
        await context.send(`❌ Для валюты "${coin.name}" не разрешена СБП.\n\n` +
            `💡 Обратитесь к администратору, чтобы включить СБП для этой валюты.\n` +
            `💡 Администратор может включить СБП в меню: !валюты настроить → выбрать валюту → 💸 СБП`);
        return;
    }
    
    // ===== ПРОВЕРКА БАЛАНСА ОТПРАВИТЕЛЯ =====
    const coin_me = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: user_check.id } });
    if (!coin_me) {
        await context.send(`❌ У вас не открыт счет по данной валюте.`);
        return;
    }
    
    // ===== ВВОД СУММЫ (РАЗНАЯ ДЛЯ КАЖДОГО) =====
    let amounts: number[] = [];

    if (validRecipients.length === 1) {
        // Если один получатель — просим одну сумму
        const amount = await Input_Number(
            context,
            `💰 Введите сумму для перевода:\n` +
            `👤 Получатель: ${validRecipients[0].name} (UID: ${validRecipients[0].id})\n` +
            `💱 Валюта: ${coin.smile} ${coin.name}\n` +
            `💳 Ваш баланс: ${coin_me.amount}${coin.smile}`,
            true
        );
        
        if (!amount) {
            await context.send(`❌ Ввод суммы отменен.`);
            return;
        }
        
        amounts = [amount];
    } else {
        // Несколько получателей — спрашиваем сумму для каждого
        await context.send(
            `💰 Введите сумму для КАЖДОГО получателя:\n` +
            `👥 Получателей: ${validRecipients.length}\n` +
            `💱 Валюта: ${coin.smile} ${coin.name}\n` +
            `💳 Ваш баланс: ${coin_me.amount}${coin.smile}\n\n` +
            `📝 Введите суммы через пробел в том же порядке, что и UID:\n` +
            validRecipients.map((r, i) => `  ${i+1}. ${r.name} (UID: ${r.id})`).join('\n') +
            `\n\nПример: 50 30 100`
        );
        
        const amountInput = await context.question(
            `Введите суммы через пробел:`,
            { answerTimeLimit }
        );
        
        if (amountInput.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            return;
        }
        
        const parts = amountInput.text.trim().split(/\s+/);
        
        if (parts.length !== validRecipients.length) {
            await context.send(`❌ Количество сумм (${parts.length}) не совпадает с количеством получателей (${validRecipients.length}).`);
            return;
        }
        
        for (const part of parts) {
            const num = parseFloat(part);
            if (isNaN(num) || num <= 0) {
                await context.send(`❌ Некорректная сумма: "${part}". Все суммы должны быть положительными числами.`);
                return;
            }
            amounts.push(num);
        }
    }

    // Проверяем общую сумму
    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);

    if (coin_me.amount < totalAmount) {
        await context.send(`❌ Недостаточно средств! Нужно: ${totalAmount}${coin.smile}, у вас: ${coin_me.amount}${coin.smile}`);
        return;
    }
    
    // ===== КОММЕНТАРИЙ =====
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
    
    // ===== ПОДТВЕРЖДЕНИЕ =====
    let confirm_message = `перевести валюту "${coin.name}"?\n\n`;
    confirm_message += `📊 Получатели и суммы:\n`;
    for (let i = 0; i < validRecipients.length; i++) {
        confirm_message += `  • ${validRecipients[i].name} (UID: ${validRecipients[i].id}): +${amounts[i]}${coin.smile}\n`;
    }
    confirm_message += `\n💰 Всего: ${totalAmount}${coin.smile}`;
    
    if (comment) {
        confirm_message += `\n💬 Комментарий: "${comment}"`;
    }
    
    const confirm_gift: { status: boolean, text: string } = await Confirm_User_Success(context, confirm_message);
    
    if (!confirm_gift.status) {
        await context.send(`❌ Перевод отменен.`);
        return;
    }
    
    // ===== ВЫПОЛНЯЕМ ПЕРЕВОД =====
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    // Сначала списываем с отправителя общую сумму
    const updatedSenderBalance = await prisma.balanceCoin.update({
        where: { id: coin_me.id },
        data: { amount: { decrement: totalAmount } }
    });
    
    // Отправляем каждому получателю
    for (let i = 0; i < validRecipients.length; i++) {
        const recipient = validRecipients[i];
        const amount = amounts[i];
        
        try {
            // Проверяем баланс получателя
            let recipientBalance = await prisma.balanceCoin.findFirst({
                where: { id_coin: coin.id, id_user: recipient.id }
            });
            
            if (!recipientBalance) {
                recipientBalance = await prisma.balanceCoin.create({
                    data: {
                        id_coin: coin.id,
                        id_user: recipient.id,
                        amount: 0
                    }
                });
            }
            
            const oldRecipientAmount = recipientBalance.amount;
            const newRecipientAmount = oldRecipientAmount + amount;
            
            await prisma.balanceCoin.update({
                where: { id: recipientBalance.id },
                data: { amount: newRecipientAmount }
            });
            
            successCount++;
            results.push(`✅ ${recipient.name} (UID: ${recipient.id}): +${amount}${coin.smile} (${oldRecipientAmount} → ${newRecipientAmount})`);
            
            // Уведомление получателю
            await Send_Message(recipient.idvk,
                `🔔 Уведомление для ${recipient.name} (UID: ${recipient.id})\n` +
                `💷 Вам перевели ${amount}${coin.smile} от @id${user_check.idvk}(${user_check.name}) (UID: ${user_check.id})\n` +
                `💰 Ваш баланс: ${oldRecipientAmount} + ${amount} = ${newRecipientAmount}${coin.smile}${comment ? `\n💬 Комментарий: "${comment}"` : ''}`
            );
            
        } catch (error) {
            console.error(`Error sending to UID ${recipient.id}:`, error);
            failCount++;
            results.push(`❌ ${recipient.name} (UID: ${recipient.id}): ошибка`);
        }
    }
    
    // ===== ОТЧЕТ =====
    const resultMessage = `✅ Массовый перевод завершен!\n\n` +
        `✅ Успешно: ${successCount}\n` +
        `❌ Ошибок: ${failCount}\n` +
        `💰 Всего отправлено: ${totalAmount}${coin.smile}\n` +
        `💱 Валюта: ${coin.smile} ${coin.name}\n\n` +
        results.join('\n');
    
    if (resultMessage.length > 3900) {
        for (let i = 0; i < resultMessage.length; i += 3900) {
            await context.send(resultMessage.slice(i, i + 3900));
        }
    } else {
        await context.send(resultMessage);
    }
    
    // ===== УВЕДОМЛЕНИЕ ОТПРАВИТЕЛЮ =====
    await Send_Message(user_check.idvk,
        `🔔 Уведомление для ${user_check.name} (UID: ${user_check.id})\n` +
        `💷 Вы перевели ${totalAmount}${coin.smile}\n` +
        `💰 Ваш баланс: ${coin_me.amount} - ${totalAmount} = ${updatedSenderBalance.amount}${coin.smile}${comment ? `\n💬 Комментарий: "${comment}"` : ''}`
    );
    
    // ===== ЛОГ В ЧАТ АЛЬЯНСА =====
    const alliance = await prisma.alliance.findFirst({ where: { id: user_check.id_alliance ?? 0 } });
    const logMessage = 
        `💸 МАССОВЫЙ ПЕРЕВОД ВАЛЮТЫ\n` +
        `👤 Отправитель: @id${user_check.idvk}(${user_check.name}) (UID: ${user_check.id})\n` +
        `💱 Валюта: ${coin.smile} ${coin.name}\n` +
        `💰 Всего: ${totalAmount}${coin.smile}\n` +
        `✅ Получателей: ${successCount}\n` +
        `❌ Ошибок: ${failCount}\n` +
        `${comment ? `💬 Комментарий: "${comment}"` : ''}`;
    
    if (alliance?.id_chat && alliance.id_chat > 0) {
        await Send_Message(alliance.id_chat, logMessage);
    }
}