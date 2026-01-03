import { Logger, Send_Message } from "./core/helper";
import prisma from "./events/module/prisma_client";
import { chat_id } from ".."; // Импортируем chat_id для логов

const express = require('express')

const app = express();
const PORT = 3001;
const domen = `localhost`

// === API для опроса через fetch ===
app.get('/ping', async (req: any, res: any) => {
  res.json({ status: 'alive', message: ' Центробанк Магомира: Я жив!', timestamp: Date.now(), uptime: process.uptime().toFixed(2) + ' сек', });
});

// Добавим новый endpoint для обработки переводов
app.post('/transfer', express.json(), async (req: any, res: any) => {
  try {
    const { vk_id, amount, uid, type } = req.body;
    
    // Проверяем обязательные поля
    if (!vk_id || !amount || !uid || type !== 'scoopins_transfer') {
      return res.status(400).json({
        approved: false,
        reason: "Неверный формат запроса"
      });
    }
    
    // ===== ИСПРАВЛЕННЫЙ БЛОК =====
    // Проверяем, принадлежит ли UID пользователю
    const user = await prisma.user.findFirst({
      where: { 
        AND: [
          { idvk: vk_id },  // VK ID должен совпадать
          { id: uid }       // И UID должен совпадать
        ]
      }
    });
    
    if (!user) {
      // Проверяем, есть ли пользователь вообще с таким VK ID
      const userExists = await prisma.user.findFirst({
        where: { idvk: vk_id }
      });
      
      if (!userExists) {
        return res.status(404).json({
          approved: false,
          reason: "Пользователь не найден в системе банке"
        });
      }
      
      // Пользователь есть, но указанный UID ему не принадлежит
      return res.status(403).json({
        approved: false,
        reason: "Указанный счет не принадлежит отправителю"
      });
    }
    // ===== КОНЕЦ ИСПРАВЛЕННОГО БЛОКА =====
    
    // Проверяем доступ к банку
    if (user.id_alliance === -1) {
      return res.status(403).json({
        approved: false,
        reason: "Нет доступа к банковским операциям"
      });
    }
    
    // Проверяем сумму
    if (amount <= 0 || amount > 10000) {
      return res.status(400).json({
        approved: false,
        reason: "Недопустимая сумма перевода"
      });
    }
    
    // Генерируем ID транзакции
    const transaction_id = `SCP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Сохраняем старый баланс для логов
    const oldBalance = user.scoopins;
    
    // ВАЖНО: ПОПОЛНЕНИЕ счета в банке
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { 
        scoopins: { 
          increment: amount
        } 
      }
    });
    
    // ЛАКОНИЧНЫЙ лог в консоль - с ПРЕДЫДУЩИМ значением и ссылкой
    await Logger(`🌕 @id${vk_id}(${user.name}) (UID: ${user.id}) "+🌕" > ${oldBalance}🌕 + ${amount}🌕 = ${updatedUser.scoopins}🌕`);
    
    // ЛАКОНИЧНОЕ сообщение в лог-чат с ПРЕДЫДУЩИМ значением и ССЫЛКОЙ
    if (chat_id) {
      const chatMessage = `🌕 @id${vk_id}(${user.name}) (UID: ${user.id}) "+🌕" > ${oldBalance}🌕 + ${amount}🌕 = ${updatedUser.scoopins}🌕`;
      await Send_Message(chat_id, chatMessage);
    }
    
    // Уведомление пользователю в формате как в примере
    const userMessage = 
      `🔔 Уведомление для ${user.name} (UID: ${user.id})\n` +
      `💬 "+ ${amount}🌕" --> ${oldBalance}🌕 + ${amount}🌕 = ${updatedUser.scoopins}🌕\n` +
      `🧷 Сообщение: Перевод S-coins в банк`;
    
    await Send_Message(vk_id, userMessage);
    
    res.json({
      approved: true,
      transaction_id,
      amount,
      uid,
      user_name: user.name,
      user_id: user.id,
      old_balance: oldBalance,
      new_balance: updatedUser.scoopins,
      fee: 0,
      timestamp: new Date().toISOString(),
      message: "Перевод S-coins успешно зачислен"
    });
    
  } catch (error) {
    console.error('Transfer error:', error);
    await Logger(`❌ Ошибка перевода S-coins: ${error}`);
    
    res.status(500).json({
      approved: false,
      reason: "Внутренняя ошибка банка"
    });
  }
});

// Ping для мониторинга
app.get('/bank/ping', async (req: any, res: any) => {
  res.json({ 
    status: 'bank_online', 
    message: 'Центробанк Магомира: банковские операции доступны',
    timestamp: Date.now(),
    service: 'scoopins_transfer'
  });
});

export async function Start_Worker_API_Bot() {
    app.listen(PORT, async () => {
      await Logger(`Worker бот слушает на http://${domen}:${PORT}`);
    });
}