import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { 
  Confirm_User_Success, 
  Send_Message_Question, 
  Send_Message_Smart,
  Send_Message
} from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";

/**
 * Настройка порядка отображения валют в альянсе
 */
export async function AllianceCoinOrder_Manager(context: any) {
  const user = await Person_Get(context);
  if (!user || !user.id_alliance || user.id_alliance <= 0) {
    await context.send(`${ico_list['warn'].ico} Вы не состоите в альянсе!`);
    return;
  }

  const alliance = await prisma.alliance.findFirst({
    where: { id: user.id_alliance }
  });
  if (!alliance) {
    await context.send(`${ico_list['warn'].ico} Альянс не найден!`);
    return;
  }

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 6;

  while (!exit) {
    // Получаем валюты с сортировкой по order
    let coins = await prisma.allianceCoin.findMany({
      where: { id_alliance: alliance.id },
      orderBy: { order: 'asc' }
    });

    // Если у валют нет order, присваиваем по id
    if (coins.length > 0 && coins.some(c => c.order === 0)) {
      for (let i = 0; i < coins.length; i++) {
        await prisma.allianceCoin.update({
          where: { id: coins[i].id },
          data: { order: i + 1 }
        });
      }
      // Обновляем список
      coins = await prisma.allianceCoin.findMany({
        where: { id_alliance: alliance.id },
        orderBy: { order: 'asc' }
      });
    }

    const totalCoins = coins.length;
    const pageCoins = coins.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalCoins / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `${ico_list['config'].ico} Настройка порядка валют в альянсе "${alliance.name}":\n\n`;
    text += `💰 Текущий порядок:\n\n`;

    for (let i = 0; i < pageCoins.length; i++) {
      const coin = pageCoins[i];
      const globalNumber = cursor + i + 1;
      text += `${globalNumber}. ${coin.smile} ${coin.name} ${coin.point ? '(рейтинговая)' : ''}\n`;
    }

    text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
    text += `💡 Нажмите на валюту, чтобы изменить её позицию.\n`;
    text += `💰 Порядок влияет на отображение в карточках персонажей.\n`;
    text += `🔼 Чем меньше номер, тем выше в списке.\n\n`;
    text += `🎯 Для перемещения валюты выберите её, затем укажите новую позицию.`;

    const keyboard = new KeyboardBuilder();

    // Кнопки валют
    for (let i = 0; i < pageCoins.length; i++) {
      const coin = pageCoins[i];
      const globalNumber = cursor + i + 1;
      
      keyboard.textButton({
        label: `${globalNumber}. ${coin.smile} ${coin.name.slice(0, 20)}`,
        payload: { 
          command: 'coin_order_select', 
          coinId: coin.id, 
          currentOrder: coin.order,
          currentPosition: globalNumber,
          cursor: cursor
        },
        color: 'secondary'
      }).row();
    }

    // Навигация
    if (cursor > 0) {
      keyboard.textButton({
        label: `←`,
        payload: { command: 'coin_order_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
        color: 'secondary'
      });
    }
    if (cursor + ITEMS_PER_PAGE < totalCoins) {
      keyboard.textButton({
        label: `→`,
        payload: { command: 'coin_order_next', cursor: cursor + ITEMS_PER_PAGE },
        color: 'secondary'
      });
    }
    if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalCoins) {
      keyboard.row();
    }

    keyboard.textButton({
      label: `🚫 Выход`,
      payload: { command: 'coin_order_exit' },
      color: 'secondary'
    }).row();

    const response = await Send_Message_Question(context, text, keyboard.oneTime());

    if (response.exit) {
      exit = true;
      continue;
    }

    if (!response.payload) continue;

    const payload = response.payload;

    if (payload.command === 'coin_order_select') {
      await changeCoinOrder(context, payload, alliance.id);
      // После изменения порядка возвращаемся в меню
      continue;
    } else if (payload.command === 'coin_order_prev') {
      cursor = payload.cursor;
    } else if (payload.command === 'coin_order_next') {
      cursor = payload.cursor;
    } else if (payload.command === 'coin_order_exit') {
      exit = true;
    }
  }

  await context.send(`✅ Настройка порядка валют завершена.`);
}

/**
 * Изменение порядка валюты
 */
async function changeCoinOrder(context: any, payload: any, allianceId: number) {
  const { coinId, currentOrder, currentPosition, cursor } = payload;
  
  // Получаем валюту
  const coin = await prisma.allianceCoin.findFirst({
    where: { id: coinId, id_alliance: allianceId }
  });
  
  if (!coin) {
    await context.send(`❌ Валюта не найдена!`);
    return;
  }
  
  // Получаем все валюты альянса
  const allCoins = await prisma.allianceCoin.findMany({
    where: { id_alliance: allianceId },
    orderBy: { order: 'asc' }
  });
  
  const maxPosition = allCoins.length;
  
  // Запрашиваем новую позицию
  const newPositionAnswer = await context.question(
    `🔄 Перемещение валюты "${coin.smile} ${coin.name}"\n\n` +
    `Текущая позиция: ${currentPosition}\n` +
    `Доступные позиции: от 1 до ${maxPosition}\n\n` +
    `Введите новую позицию (номер):`,
    { answerTimeLimit }
  );
  
  if (newPositionAnswer.isTimeout) {
    await context.send(`⏰ Время истекло.`);
    return;
  }
  
  const newPosition = parseInt(newPositionAnswer.text);
  
  if (isNaN(newPosition) || newPosition < 1 || newPosition > maxPosition) {
    await context.send(`❌ Некорректная позиция! Введите число от 1 до ${maxPosition}`);
    return;
  }
  
  if (newPosition === currentPosition) {
    await context.send(`ℹ️ Позиция не изменилась.`);
    return;
  }
  
  // Переупорядочиваем валюты
  const oldOrder = coin.order;
  
  if (newPosition < currentPosition) {
    // Перемещаем вверх: сдвигаем все валюты между newPosition и currentPosition вниз
    const coinsToUpdate = allCoins.filter(c => c.order >= newPosition && c.order < oldOrder);
    for (const c of coinsToUpdate) {
      await prisma.allianceCoin.update({
        where: { id: c.id },
        data: { order: c.order + 1 }
      });
    }
    await prisma.allianceCoin.update({
      where: { id: coinId },
      data: { order: newPosition }
    });
  } else {
    // Перемещаем вниз: сдвигаем все валюты между currentPosition и newPosition вверх
    const coinsToUpdate = allCoins.filter(c => c.order > oldOrder && c.order <= newPosition);
    for (const c of coinsToUpdate) {
      await prisma.allianceCoin.update({
        where: { id: c.id },
        data: { order: c.order - 1 }
      });
    }
    await prisma.allianceCoin.update({
      where: { id: coinId },
      data: { order: newPosition }
    });
  }
  
  await context.send(`✅ Валюта "${coin.smile} ${coin.name}" перемещена на позицию ${newPosition}!`);
  
  // Показываем обновлённый порядок
  const updatedCoins = await prisma.allianceCoin.findMany({
    where: { id_alliance: allianceId },
    orderBy: { order: 'asc' }
  });
  
  let orderText = `📋 Новый порядок валют:\n\n`;
  for (let i = 0; i < updatedCoins.length; i++) {
    orderText += `${i + 1}. ${updatedCoins[i].smile} ${updatedCoins[i].name}\n`;
  }
  
  await context.send(orderText);
}