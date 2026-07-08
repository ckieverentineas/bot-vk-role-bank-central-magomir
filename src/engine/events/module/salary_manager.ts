// engine/events/module/salary_manager.ts
import { KeyboardBuilder } from "vk-io";
import { User } from "@prisma/client";
import { answerTimeLimit, chat_id } from "../../..";
import { 
  Confirm_User_Success, 
  Input_Number, 
  Keyboard_Index, 
  Logger, 
  Send_Message,
  Select_Alliance_Coin,
  Accessed
} from "../../core/helper";
import { Person_Get } from "./person/person";
import prisma from "./prisma_client";
import { ico_list } from "./data_center/icons_lib";
import { button_alliance_return } from "./data_center/standart";

// ============================================================
// ГЛАВНОЕ МЕНЮ УПРАВЛЕНИЯ ЗАРПЛАТАМИ
// ============================================================

export async function Salary_Manager_Menu(context: any) {
  const admin = await Person_Get(context);
  if (!admin) {
    await context.send(`❌ Сначала выберите персонажа (!банк).`);
    return;
  }

  if (await Accessed(context) === 1) {
    await context.send(`❌ Нет прав администратора.`);
    return;
  }

  if (!admin.id_alliance || admin.id_alliance <= 0) {
    await context.send(`❌ Вы не состоите в ролевой.`);
    return;
  }

  let globalCoinId: number | null = null;
  let globalCoin: any = null;
  
  const firstSalary = await prisma.user.findFirst({
    where: {
      id_alliance: admin.id_alliance,
      salary_coin_id: { not: null }
    },
    select: { salary_coin_id: true }
  });
  
  if (firstSalary?.salary_coin_id) {
    globalCoinId = firstSalary.salary_coin_id;
    globalCoin = await prisma.allianceCoin.findFirst({ where: { id: globalCoinId } });
  }

  let exit = false;
  let cursor = 0;
  const ITEMS_PER_PAGE = 2;

  while (!exit) {
    // ===== ПОЛУЧАЕМ ВСЕХ ПЕРСОНАЖЕЙ АЛЬЯНСА =====
    const allUsers = await prisma.user.findMany({
      where: {
        id_alliance: admin.id_alliance
      }
    });

    // ===== СОРТИРУЕМ: СНАЧАЛА АКТИВНЫЕ, ПОТОМ НЕАКТИВНЫЕ =====
    const usersWithActivity = [];
    for (const user of allUsers) {
      const isActive = await checkUserActivityThisWeek(user.id);
      usersWithActivity.push({
        ...user,
        isActive: isActive
      });
    }

    usersWithActivity.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });

    // ===== ФОРМИРУЕМ ДАННЫЕ ДЛЯ ОТОБРАЖЕНИЯ =====
    const displayData = [];
    for (const user of usersWithActivity) {
      const coin = user.salary_coin_id 
        ? await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id } })
        : null;
      
      const hasSalary = user.salary_coin_id && user.salary_amount && user.salary_amount > 0;
      
      displayData.push({
        id: user.id,
        name: user.name,
        idvk: user.idvk,
        salary_coin_id: user.salary_coin_id,
        salary_coin_smile: coin?.smile || '💰',
        salary_coin_name: coin?.name || 'нет валюты',
        salary_amount: user.salary_amount || 0,
        isActive: user.isActive,
        hasSalary: hasSalary
      });
    }

    const totalUsers = displayData.length;
    const pageUsers = displayData.slice(cursor, cursor + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);
    const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;

    let text = `💰 Управление зарплатами\n\n`;
    
    if (globalCoin) {
      text += `💱 Текущая валюта: ${globalCoin.smile} ${globalCoin.name}\n`;
    } else {
      text += `💱 Валюта не выбрана\n`;
    }
    text += `📊 Всего персонажей: ${totalUsers} | 📄 ${currentPage}/${totalPages}\n\n`;
    
    if (totalUsers === 0) {
      text += `📭 В ролевой нет персонажей.\n\n`;
    } else {
      for (const user of pageUsers) {
        const salaryIcon = user.hasSalary ? '✅' : '❌';
        const activityIcon = user.isActive ? '✅' : '⏸️';
        const activityText = user.isActive ? 'активен' : 'неактивен';
        const amount = user.salary_amount;
        const coin = user.salary_coin_smile;
        
        text += `${user.name} (UID: ${user.id})\n`;
        text += `  ${amount}${coin} | ${salaryIcon} зарплата | ${activityIcon} ${activityText}\n\n`;
      }
    }

    const keyboard = new KeyboardBuilder();

    // ===== СТРОКА 1: ВАЛЮТА =====
    keyboard.textButton({
      label: `💱 Выбрать валюту`,
      payload: { command: 'salary_set_global_coin' },
      color: 'secondary'
    }).row();

    // ===== СТРОКИ 2-5: ПОЛЬЗОВАТЕЛИ =====
    for (const user of pageUsers) {
      const shortName = user.name.length > 12 ? user.name.slice(0, 10) + '..' : user.name;
      
      if (user.hasSalary) {
        keyboard.textButton({
          label: `✏️ ${shortName}`,
          payload: { command: 'salary_edit', userId: user.id, cursor: cursor },
          color: 'secondary'
        });
        keyboard.textButton({
          label: `💰⬆️`,
          payload: { command: 'salary_pay', userId: user.id, cursor: cursor },
          color: user.isActive ? 'positive' : 'negative'
        });
      } else {
        keyboard.textButton({
          label: `➕ ${shortName}`,
          payload: { command: 'salary_add_user', userId: user.id, cursor: cursor },
          color: 'positive'
        });
        keyboard.textButton({
          label: `·`,
          payload: { command: 'noop' },
          color: 'secondary'
        });
      }
      keyboard.row();
    }

    // ===== СТРОКА 6: НАВИГАЦИЯ =====
    if (totalUsers > ITEMS_PER_PAGE) {
      if (cursor > 0) {
        keyboard.textButton({
          label: `←`,
          payload: { command: 'salary_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
          color: 'secondary'
        });
      }
      
      if (cursor + ITEMS_PER_PAGE < totalUsers) {
        keyboard.textButton({
          label: `→`,
          payload: { command: 'salary_next', cursor: cursor + ITEMS_PER_PAGE },
          color: 'secondary'
        });
      }
      
      keyboard.row();
    }

    // ===== СТРОКА 7: ДЕЙСТВИЯ =====
    keyboard.textButton({
      label: `💰 Всем`,
      payload: { command: 'salary_pay_all' },
      color: 'positive'
    });

    keyboard.textButton({
      label: `💰 Активным`,
      payload: { command: 'salary_pay_active' },
      color: 'secondary'
    });

    keyboard.textButton({
      label: `🚫 Выход`,
      payload: { command: 'salary_exit' },
      color: 'secondary'
    }).row().oneTime().inline();

    try {
      const response = await context.question(text, { keyboard, answerTimeLimit });

      if (response.isTimeout) {
        await context.send(`⏰ Время истекло.`);
        return;
      }

      if (!response.payload) {
        await context.send(`💡 Жмите на кнопки.`);
        continue;
      }

      const payload = response.payload;

      if (payload.command === 'noop') {
        continue;
      }

      switch (payload.command) {
        case 'salary_set_global_coin':
          await setGlobalSalaryCoin(context, admin.id_alliance);
          const updatedCoin = await prisma.user.findFirst({
            where: {
              id_alliance: admin.id_alliance,
              salary_coin_id: { not: null }
            },
            select: { salary_coin_id: true }
          });
          if (updatedCoin?.salary_coin_id) {
            globalCoinId = updatedCoin.salary_coin_id;
            globalCoin = await prisma.allianceCoin.findFirst({ where: { id: globalCoinId } });
          }
          break;

        case 'salary_edit':
          await editUserSalary(context, payload.userId);
          break;

        case 'salary_pay':
          await paySalaryToUser(context, payload.userId);
          break;

        case 'salary_add_user':
          await addSalaryToUser(context, payload.userId);
          break;

        case 'salary_pay_all':
          await paySalaryToAll(context);
          break;

        case 'salary_pay_active':
          await paySalaryToActiveOnly(context);
          break;

        case 'salary_prev':
          cursor = payload.cursor;
          break;

        case 'salary_next':
          cursor = payload.cursor;
          break;

        case 'salary_exit':
          exit = true;
          await context.send(`✅ Выход.`, { keyboard: button_alliance_return });
          break;

        default:
          await context.send(`❌ Неизвестная команда.`);
      }
    } catch (error) {
      console.error('Error in Salary_Manager:', error);
      await context.send(`⚠️ Ошибка. Попробуйте снова.`);
    }
  }

  await Keyboard_Index(context, `💡 Готово.`);
}

// ============================================================
// УСТАНОВКА ГЛОБАЛЬНОЙ ВАЛЮТЫ ДЛЯ ВСЕХ
// ============================================================

async function setGlobalSalaryCoin(context: any, allianceId: number) {
  const selectedCoinId = await Select_Alliance_Coin(context, allianceId);
  if (!selectedCoinId) {
    await context.send(`❌ Выбор валюты прерван.`);
    return;
  }

  const coin = await prisma.allianceCoin.findFirst({ where: { id: selectedCoinId } });
  if (!coin) {
    await context.send(`❌ Валюта не найдена.`);
    return;
  }

  const updated = await prisma.user.updateMany({
    where: {
      id_alliance: allianceId,
      salary_coin_id: null
    },
    data: {
      salary_coin_id: selectedCoinId
    }
  });

  await context.send(`✅ Валюта установлена для ${updated.count} персонажей: ${coin.smile} ${coin.name}`);
}

// ============================================================
// ДОБАВЛЕНИЕ ЗАРПЛАТЫ КОНКРЕТНОМУ ПОЛЬЗОВАТЕЛЮ
// ============================================================

async function addSalaryToUser(context: any, userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId }
  });

  if (!user) {
    await context.send(`❌ Пользователь не найден.`);
    return;
  }

  if (!user.salary_coin_id) {
    const coinId = await Select_Alliance_Coin(context, user.id_alliance || 0);
    if (!coinId) {
      await context.send(`❌ Выбор валюты прерван.`);
      return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { salary_coin_id: coinId }
    });
    user.salary_coin_id = coinId;
  }

  const amount = await Input_Number(
    context,
    `💰 Введите сумму зарплаты для ${user.name}:`,
    true
  );

  if (amount === false) {
    await context.send(`❌ Отменено.`);
    return;
  }

  if (amount < 0) {
    await context.send(`❌ Сумма не может быть отрицательной.`);
    return;
  }

  if (amount === 0) {
    await context.send(`❌ Сумма не может быть 0.`);
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { salary_amount: amount }
  });

  const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id || 0 } });
  await context.send(`✅ Зарплата добавлена ${user.name}: ${amount}${coin?.smile || '💰'}`);
}

// ============================================================
// НАЧИСЛЕНИЕ ЗАРПЛАТЫ ОДНОМУ
// ============================================================

async function paySalaryToUser(context: any, userId: number) {
  const admin = await Person_Get(context);
  if (!admin) return;

  const alliance = await prisma.alliance.findFirst({
    where: { id: admin.id_alliance }
  });

  const user = await prisma.user.findFirst({
    where: { id: userId }
  });

  if (!user) {
    await context.send(`❌ Пользователь не найден.`);
    return;
  }

  if (!user.salary_coin_id || !user.salary_amount || user.salary_amount <= 0) {
    await context.send(`❌ У ${user.name} нет зарплаты.`);
    return;
  }

  const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id } });
  const isActive = await checkUserActivityThisWeek(user.id);

  if (!isActive) {
    const confirm = await Confirm_User_Success(
      context,
      `${user.name}, неактивному на этой неделе, начислить ${user.salary_amount}${coin?.smile || '💰'}?`
    );
    if (!confirm.status) {
      await context.send(`❌ Отменено.`);
      return;
    }
  }

  const success = await processSalaryPayment(user);
  if (success) {
    await context.send(`✅ Начислено ${user.name}: ${user.salary_amount}${coin?.smile || '💰'}`);
    
    if (alliance?.id_chat && alliance.id_chat > 0) {
      await Send_Message(alliance.id_chat,
        `💰 НАЧИСЛЕНИЕ ЗАРПЛАТЫ\n` +
        `👤 Админ: @id${admin.idvk}(${admin.name}) (UID: ${admin.id})\n` +
        `👤 Получатель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
        `💳 Сумма: +${user.salary_amount}${coin?.smile || '💰'}\n` +
        `📅 Неделя: ${getWeekDateRange()}\n` +
        `${isActive ? '✅ Активен' : '⏸️ Неактивен (принудительно)'}`
      );
    }
  } else {
    await context.send(`❌ Ошибка при начислении.`);
  }
}

// ============================================================
// НАЧИСЛЕНИЕ ВСЕМ
// ============================================================

async function paySalaryToAll(context: any) {
  const admin = await Person_Get(context);
  if (!admin) return;

  const alliance = await prisma.alliance.findFirst({
    where: { id: admin.id_alliance }
  });

  // ИСПРАВЛЕНО: убрал `not: null` для salary_amount
  const usersWithSalary = await prisma.user.findMany({
    where: {
      id_alliance: admin.id_alliance,
      salary_coin_id: { not: null },
      salary_amount: { not: null }
    }
  });

  const filteredUsers = usersWithSalary.filter(u => (u.salary_amount || 0) > 0);

  if (filteredUsers.length === 0) {
    await context.send(`❌ Нет персонажей с зарплатой.`);
    return;
  }

  let message = `💰 Начисление зарплаты ВСЕМ персонажам\n\n`;
  message += `📊 Всего: ${filteredUsers.length}\n\n`;
  
  for (const user of filteredUsers) {
    const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id || 0 } });
    const isActive = await checkUserActivityThisWeek(user.id);
    message += `  • ${user.name} (UID: ${user.id}): ${user.salary_amount}${coin?.smile || '💰'} ${isActive ? '✅' : '⏸️'}\n`;
  }

  const confirm = await Confirm_User_Success(context, message);
  if (!confirm.status) {
    await context.send(`❌ Отменено.`);
    return;
  }

  let successCount = 0;
  let failCount = 0;
  const results = [];
  const logDetails = [];

  for (const user of filteredUsers) {
    const success = await processSalaryPayment(user);
    const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id || 0 } });
    if (success) {
      successCount++;
      results.push(`✅ ${user.name}: +${user.salary_amount}${coin?.smile || '💰'}`);
      logDetails.push(`@id${user.idvk}(${user.name}) (UID: ${user.id}) +${user.salary_amount}${coin?.smile || '💰'}`);
    } else {
      failCount++;
      results.push(`❌ ${user.name}: ошибка`);
    }
  }

  const resultMessage = `💰 Начисление завершено!\n\n` +
    `✅ Успешно: ${successCount}\n` +
    `❌ Ошибок: ${failCount}\n\n` +
    results.join('\n');

  if (resultMessage.length > 3900) {
    for (let i = 0; i < resultMessage.length; i += 3900) {
      await context.send(resultMessage.slice(i, i + 3900));
    }
  } else {
    await context.send(resultMessage);
  }

  const logMessage = 
    `💰 НАЧИСЛЕНИЕ ЗАРПЛАТЫ ВСЕМ\n` +
    `👤 Администратор: @id${admin.idvk}(${admin.name}) (UID: ${admin.id})\n` +
    `📅 Неделя: ${getWeekDateRange()}\n` +
    `📊 Всего: ${filteredUsers.length}\n` +
    `✅ Успешно: ${successCount}\n` +
    `❌ Ошибок: ${failCount}\n\n` +
    `📋 Получатели:\n${logDetails.join('\n')}`;

  if (alliance?.id_chat && alliance.id_chat > 0) {
    await Send_Message(alliance.id_chat, logMessage);
  } else {
    await Logger(`Финансовый чат не привязан. Лог зарплаты:\n${logMessage}`);
  }
}

// ============================================================
// НАЧИСЛЕНИЕ ТОЛЬКО АКТИВНЫМ
// ============================================================

async function paySalaryToActiveOnly(context: any) {
  const admin = await Person_Get(context);
  if (!admin) return;

  const alliance = await prisma.alliance.findFirst({
    where: { id: admin.id_alliance }
  });

  // ИСПРАВЛЕНО: убрал `not: null` для salary_amount
  const usersWithSalary = await prisma.user.findMany({
    where: {
      id_alliance: admin.id_alliance,
      salary_coin_id: { not: null },
      salary_amount: { not: null }
    }
  });

  const filteredUsers = usersWithSalary.filter(u => (u.salary_amount || 0) > 0);

  if (filteredUsers.length === 0) {
    await context.send(`❌ Нет персонажей с зарплатой.`);
    return;
  }

  const activeUsers = [];
  const inactiveUsers = [];

  for (const user of filteredUsers) {
    const isActive = await checkUserActivityThisWeek(user.id);
    if (isActive) {
      activeUsers.push(user);
    } else {
      inactiveUsers.push(user);
    }
  }

  if (activeUsers.length === 0) {
    await context.send(`❌ Нет активных персонажей.`);
    return;
  }

  let message = `💰 Начисление зарплаты ТОЛЬКО АКТИВНЫМ\n\n`;
  message += `📊 Всего с зарплатой: ${filteredUsers.length}\n`;
  message += `✅ Активных: ${activeUsers.length}\n`;
  message += `⏸️ Неактивных: ${inactiveUsers.length}\n\n`;
  
  message += `✅ Активные (получат):\n`;
  for (const user of activeUsers) {
    const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id || 0 } });
    message += `  • ${user.name} (UID: ${user.id}): ${user.salary_amount}${coin?.smile || '💰'}\n`;
  }
  
  if (inactiveUsers.length > 0) {
    message += `\n⏸️ Неактивные (НЕ получат):\n`;
    for (const user of inactiveUsers) {
      const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id || 0 } });
      message += `  • ${user.name} (UID: ${user.id}): ${user.salary_amount}${coin?.smile || '💰'}\n`;
    }
  }

  const confirm = await Confirm_User_Success(context, message);
  if (!confirm.status) {
    await context.send(`❌ Отменено.`);
    return;
  }

  let successCount = 0;
  let failCount = 0;
  const results = [];
  const logDetails = [];

  for (const user of activeUsers) {
    const success = await processSalaryPayment(user);
    const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id || 0 } });
    if (success) {
      successCount++;
      results.push(`✅ ${user.name}: +${user.salary_amount}${coin?.smile || '💰'}`);
      logDetails.push(`@id${user.idvk}(${user.name}) (UID: ${user.id}) +${user.salary_amount}${coin?.smile || '💰'}`);
    } else {
      failCount++;
      results.push(`❌ ${user.name}: ошибка`);
    }
  }

  const resultMessage = `💰 Начисление завершено!\n\n` +
    `✅ Успешно: ${successCount}\n` +
    `❌ Ошибок: ${failCount}\n\n` +
    results.join('\n');

  if (resultMessage.length > 3900) {
    for (let i = 0; i < resultMessage.length; i += 3900) {
      await context.send(resultMessage.slice(i, i + 3900));
    }
  } else {
    await context.send(resultMessage);
  }

  const logMessage = 
    `💰 НАЧИСЛЕНИЕ ЗАРПЛАТЫ АКТИВНЫМ\n` +
    `👤 Администратор: @id${admin.idvk}(${admin.name}) (UID: ${admin.id})\n` +
    `📅 Неделя: ${getWeekDateRange()}\n` +
    `📊 Всего: ${filteredUsers.length} | Активных: ${activeUsers.length} | Неактивных: ${inactiveUsers.length}\n` +
    `✅ Успешно: ${successCount}\n` +
    `❌ Ошибок: ${failCount}\n\n` +
    `📋 Получатели:\n${logDetails.join('\n')}`;

  if (alliance?.id_chat && alliance.id_chat > 0) {
    await Send_Message(alliance.id_chat, logMessage);
  } else {
    await Logger(`Финансовый чат не привязан. Лог зарплаты:\n${logMessage}`);
  }
}

// ============================================================
// РЕДАКТИРОВАНИЕ ЗАРПЛАТЫ
// ============================================================

async function editUserSalary(context: any, userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId }
  });

  if (!user) {
    await context.send(`❌ Пользователь не найден.`);
    return;
  }

  const currentCoin = user.salary_coin_id 
    ? await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id } })
    : null;
  const currentAmount = user.salary_amount || 0;

  let exit = false;
  while (!exit) {
    const keyboard = new KeyboardBuilder()
      .textButton({
        label: currentCoin ? `💱 ${currentCoin.smile} ${currentCoin.name}` : `💱 Выбрать валюту`,
        payload: { command: 'edit_coin' },
        color: 'secondary'
      })
      .textButton({
        label: `💰 ${currentAmount}`,
        payload: { command: 'edit_amount' },
        color: 'secondary'
      }).row()
      .textButton({
        label: '🔙 Назад',
        payload: { command: 'edit_back' },
        color: 'secondary'
      }).oneTime().inline();

    const text = `✏️ ${user.name} (UID: ${user.id})\n\n` +
      `💱 Валюта: ${currentCoin ? `${currentCoin.smile} ${currentCoin.name}` : 'Не выбрана'}\n` +
      `💰 Сумма: ${currentAmount}\n\n` +
      `Выберите действие:`;

    const answer = await context.question(text, { keyboard, answerTimeLimit });

    if (answer.isTimeout) {
      await context.send(`⏰ Время истекло.`);
      return;
    }

    if (!answer.payload) {
      await context.send(`💡 Жмите на кнопки.`);
      continue;
    }

    switch (answer.payload.command) {
      case 'edit_coin':
        const newCoinId = await Select_Alliance_Coin(context, user.id_alliance || 0);
        if (newCoinId) {
          await prisma.user.update({
            where: { id: userId },
            data: { salary_coin_id: newCoinId }
          });
          await context.send(`✅ Валюта обновлена.`);
        }
        break;

      case 'edit_amount':
        const newAmount = await Input_Number(
          context,
          `💰 Сумма для ${user.name}:\n` +
          `Текущая: ${currentAmount}\n` +
          `Введите 0 для удаления:`,
          true
        );

        if (newAmount === false) {
          await context.send(`❌ Отменено.`);
          break;
        }

        if (newAmount < 0) {
          await context.send(`❌ Не может быть отрицательной.`);
          break;
        }

        if (newAmount === 0) {
          const confirm = await Confirm_User_Success(context, `удалить зарплату у ${user.name}?`);
          if (confirm.status) {
            await prisma.user.update({
              where: { id: userId },
              data: { salary_coin_id: null, salary_amount: null }
            });
            await context.send(`✅ Зарплата удалена.`);
            exit = true;
          }
        } else {
          await prisma.user.update({
            where: { id: userId },
            data: { salary_amount: newAmount }
          });
          await context.send(`✅ Сумма обновлена: ${newAmount}`);
        }
        break;

      case 'edit_back':
        exit = true;
        break;

      default:
        await context.send(`❌ Неизвестно.`);
    }
  }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function checkUserActivityThisWeek(userId: number): Promise<boolean> {
  const startOfWeek = getStartOfWeek();
  
  const postCount = await prisma.postStatistic.count({
    where: {
      userId: userId,
      date: {
        gte: startOfWeek
      }
    }
  });

  return postCount > 0;
}

async function processSalaryPayment(user: User): Promise<boolean> {
  try {
    if (!user.salary_coin_id || !user.salary_amount || user.salary_amount <= 0) {
      return false;
    }

    const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id } });
    if (!coin) return false;

    // ===== ОБНОВЛЯЕМ БАЛАНС ПОЛЬЗОВАТЕЛЯ =====
    let balance = await prisma.balanceCoin.findFirst({
      where: { id_coin: coin.id, id_user: user.id }
    });

    if (!balance) {
      balance = await prisma.balanceCoin.create({
        data: {
          id_coin: coin.id,
          id_user: user.id,
          amount: 0
        }
      });
    }

    const oldAmount = balance.amount;
    const newAmount = oldAmount + user.salary_amount;

    await prisma.balanceCoin.update({
      where: { id: balance.id },
      data: { amount: newAmount }
    });

    // ===== ФОРМИРУЕМ УВЕДОМЛЕНИЕ =====
    let message = `🔔 Уведомление для ${user.name} (UID: ${user.id})\n`;

    // Если валюта рейтинговая и есть факультет — показываем только факультет
    if (coin.point && user.id_facult) {
      const alli_fac = await prisma.allianceFacult.findFirst({ 
        where: { id: user.id_facult } 
      });
      
      if (alli_fac) {
        let facultBalance = await prisma.balanceFacult.findFirst({
          where: { 
            id_coin: coin.id, 
            id_facult: user.id_facult 
          }
        });

        if (!facultBalance) {
          facultBalance = await prisma.balanceFacult.create({
            data: {
              id_coin: coin.id,
              id_facult: user.id_facult,
              amount: 0
            }
          });
        }

        const oldFacultAmount = facultBalance.amount;
        const newFacultAmount = oldFacultAmount + user.salary_amount;

        await prisma.balanceFacult.update({
          where: { id: facultBalance.id },
          data: { amount: newFacultAmount }
        });

        message += `🌐 "${coin.smile}" > ${oldFacultAmount} + ${user.salary_amount} = ${newFacultAmount} для факультета [${alli_fac.smile} ${alli_fac.name}]\n`;
        message += `🧷 Сообщение: Начисление зарплаты`;
      } else {
        // Факультет не найден, но валюта рейтинговая — показываем баланс
        message += `💬 "+ ${user.salary_amount}${coin.smile}" --> ${oldAmount}${coin.smile} + ${user.salary_amount}${coin.smile} = ${newAmount}${coin.smile}\n`;
        message += `🧷 Сообщение: Начисление зарплаты`;
      }
    } else {
      // Нерейтинговая валюта или нет факультета — показываем баланс
      message += `💬 "+ ${user.salary_amount}${coin.smile}" --> ${oldAmount}${coin.smile} + ${user.salary_amount}${coin.smile} = ${newAmount}${coin.smile}\n`;
      message += `🧷 Сообщение: Начисление зарплаты`;
    }

    await Send_Message(user.idvk, message);

    return true;
  } catch (error) {
    console.error('Salary payment error:', error);
    return false;
  }
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDateRange(): string {
  const start = getStartOfWeek();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };
  
  return `${formatDate(start)} - ${formatDate(end)}`;
}