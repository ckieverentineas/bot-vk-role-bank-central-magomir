// engine/events/module/salary_manager.ts
import { KeyboardBuilder } from "vk-io";
import { User } from "@prisma/client";
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
import { answerTimeLimit } from "../../..";

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

  const ITEMS_PER_PAGE = 3;

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
    globalCoin = await prisma.allianceCoin.findFirst({ 
      where: { id: globalCoinId ?? 0 } 
    });
  }

  let activitySettings = await prisma.salarySettings.findFirst({
    where: { allianceId: admin.id_alliance }
  });

  if (!activitySettings) {
    activitySettings = await prisma.salarySettings.create({
      data: {
        allianceId: admin.id_alliance,
        mode: 'auto',
        activeUsers: '[]'
      }
    });
  }

  let exit = false;
  let cursor = 0;

  while (!exit) {
    const allUsers = await prisma.user.findMany({
      where: {
        id_alliance: admin.id_alliance
      }
    });

    const usersWithActivity = [];
    for (const user of allUsers) {
      const isActive = await checkUserActivityThisWeek(user.id, activitySettings);
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

    const displayData = [];
    for (const user of usersWithActivity) {
      const coin = user.salary_coin_id 
        ? await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id ?? 0 } })
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
      text += `💱 Валюта: ${globalCoin.smile} ${globalCoin.name}\n`;
    } else {
      text += `💱 Валюта не выбрана\n`;
    }
    
    let activeUsers: number[] = [];
    try {
      activeUsers = JSON.parse(activitySettings.activeUsers || '[]');
    } catch {
      activeUsers = [];
    }
    
    const modeText = activitySettings.mode === 'auto' ? 'авто (рп-активность)' : 'ручной';
    text += `📊 Режим активности: ${modeText}\n`;
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

    // Строка 1: Настройки
    keyboard.textButton({
      label: `⚙ Настройки`,
      payload: { command: 'salary_settings' },
      color: 'primary'
    });
    keyboard.row();

    // Строки с пользователями
    for (const user of pageUsers) {
      const shortName = user.name.length > 14 ? user.name.slice(0, 12) + '..' : user.name;
      
      if (user.hasSalary) {
        keyboard.textButton({
          label: `✏️ ${shortName}`,
          payload: { command: 'salary_edit', userId: user.id, cursor: cursor },
          color: 'secondary'
        });
        keyboard.textButton({
          label: `💰 ${user.salary_amount}${user.salary_coin_smile}`,
          payload: { command: 'salary_pay', userId: user.id, cursor: cursor },
          color: user.isActive ? 'positive' : 'secondary'
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

      if (activitySettings.mode === 'manual') {
        keyboard.textButton({
          label: user.isActive ? `✅` : `⏸️`,
          payload: { 
            command: 'salary_toggle_active', 
            userId: user.id, 
            cursor: cursor,
            currentStatus: user.isActive
          },
          color: user.isActive ? 'positive' : 'secondary'
        });
      }

      keyboard.row();
    }

    // Навигация
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

    // Действия
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
    });

    keyboard.oneTime();

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
        case 'salary_settings':
          await salarySettingsMenu(context, admin.id_alliance);
          activitySettings = await prisma.salarySettings.findFirst({
            where: { allianceId: admin.id_alliance }
          });
          if (!activitySettings) {
            activitySettings = await prisma.salarySettings.create({
              data: {
                allianceId: admin.id_alliance,
                mode: 'auto',
                activeUsers: '[]'
              }
            });
          }
          break;

        case 'salary_toggle_active':
          await toggleUserActive(context, payload.userId, admin.id_alliance, !payload.currentStatus);
          activitySettings = await prisma.salarySettings.findFirst({
            where: { allianceId: admin.id_alliance }
          });
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
// МЕНЮ НАСТРОЕК ЗАРПЛАТ
// ============================================================

async function salarySettingsMenu(context: any, allianceId: number) {
  let settings = await prisma.salarySettings.findFirst({
    where: { allianceId }
  });

  if (!settings) {
    settings = await prisma.salarySettings.create({
      data: {
        allianceId,
        mode: 'auto',
        activeUsers: '[]'
      }
    });
  }

  // Получаем текущую валюту
  let currentCoin = null;
  const firstSalary = await prisma.user.findFirst({
    where: {
      id_alliance: allianceId,
      salary_coin_id: { not: null }
    },
    select: { salary_coin_id: true }
  });
  
  if (firstSalary?.salary_coin_id) {
    currentCoin = await prisma.allianceCoin.findFirst({ 
      where: { id: firstSalary.salary_coin_id ?? 0 } 
    });
  }

  let activeUsers: number[] = [];
  try {
    activeUsers = JSON.parse(settings.activeUsers || '[]');
  } catch {
    activeUsers = [];
  }

  let exit = false;
  while (!exit) {
    const modeText = settings.mode === 'auto' ? 'авто (рп-активность)' : 'ручной';
    const activeCount = activeUsers.length;
    
    let text = `⚙ Настройки зарплат\n\n`;
    text += `💱 Валюта: ${currentCoin ? `${currentCoin.smile} ${currentCoin.name}` : 'не выбрана'}\n`;
    text += `📊 Режим определения активности: ${modeText}\n`;
    if (settings.mode === 'manual') {
      text += `👥 Вручную отмечено активных: ${activeCount}\n`;
    }
    text += `\nВыберите действие:`;

    const keyboard = new KeyboardBuilder()
      .textButton({
        label: `💱 Сменить валюту`,
        payload: { command: 'salary_change_coin' },
        color: 'secondary'
      })
      .row()
      .textButton({
        label: `🤖 Авто (рп-активность)`,
        payload: { command: 'salary_mode_auto' },
        color: settings.mode === 'auto' ? 'positive' : 'secondary'
      })
      .row()
      .textButton({
        label: `✋ Ручной`,
        payload: { command: 'salary_mode_manual' },
        color: settings.mode === 'manual' ? 'positive' : 'secondary'
      })
      .row()
      .textButton({
        label: `↩️ Назад`,
        payload: { command: 'salary_settings_back' },
        color: 'secondary'
      })
      .oneTime().inline();

    const response = await context.question(text, { keyboard, answerTimeLimit });

    if (response.isTimeout) {
      await context.send(`⏰ Время истекло.`);
      return;
    }

    if (!response.payload) {
      await context.send(`💡 Жмите на кнопки.`);
      continue;
    }

    switch (response.payload.command) {
      case 'salary_change_coin':
        const selectedCoinId = await Select_Alliance_Coin(context, allianceId);
        if (selectedCoinId) {
          await prisma.user.updateMany({
            where: {
              id_alliance: allianceId,
              salary_coin_id: null
            },
            data: {
              salary_coin_id: selectedCoinId
            }
          });
          
          await prisma.user.updateMany({
            where: {
              id_alliance: allianceId,
              salary_coin_id: { not: null }
            },
            data: {
              salary_coin_id: selectedCoinId
            }
          });
          
          currentCoin = await prisma.allianceCoin.findFirst({ where: { id: selectedCoinId } });
          await context.send(`✅ Валюта изменена на: ${currentCoin?.smile} ${currentCoin?.name}`);
        }
        break;

      case 'salary_mode_auto':
        await prisma.salarySettings.update({
          where: { allianceId },
          data: { mode: 'auto', activeUsers: '[]' }
        });
        settings = await prisma.salarySettings.findFirst({ where: { allianceId } });
        activeUsers = [];
        await context.send(`✅ Режим изменен на "Авто (рп-активность)"`);
        break;

      case 'salary_mode_manual':
        await prisma.salarySettings.update({
          where: { allianceId },
          data: { mode: 'manual' }
        });
        settings = await prisma.salarySettings.findFirst({ where: { allianceId } });
        await context.send(`✅ Режим изменен на "Ручной"\nТеперь можно вручную отмечать активных игроков кнопками ✅/⏸️`);
        break;

      case 'salary_settings_back':
        exit = true;
        break;

      default:
        await context.send(`❌ Неизвестная команда.`);
    }
  }
}

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ АКТИВНОСТИ (РУЧНОЙ РЕЖИМ)
// ============================================================

async function toggleUserActive(context: any, userId: number, allianceId: number, newStatus: boolean) {
  const settings = await prisma.salarySettings.findFirst({
    where: { allianceId }
  });

  if (!settings || settings.mode !== 'manual') {
    await context.send(`❌ Ручной режим не активен.`);
    return;
  }

  let activeUsers: number[] = [];
  try {
    activeUsers = JSON.parse(settings.activeUsers || '[]');
  } catch {
    activeUsers = [];
  }
  
  if (newStatus) {
    if (!activeUsers.includes(userId)) {
      activeUsers.push(userId);
    }
  } else {
    activeUsers = activeUsers.filter(id => id !== userId);
  }

  await prisma.salarySettings.update({
    where: { allianceId },
    data: { activeUsers: JSON.stringify(activeUsers) }
  });

  const user = await prisma.user.findFirst({ where: { id: userId } });
  await context.send(`✅ ${user?.name} ${newStatus ? 'отмечен активным' : 'отмечен неактивным'}`);
}

// ============================================================
// ФУНКЦИЯ ПРОВЕРКИ АКТИВНОСТИ (С УЧЕТОМ РЕЖИМА)
// ============================================================

async function checkUserActivityThisWeek(userId: number, settings: any): Promise<boolean> {
  if (settings.mode === 'manual') {
    let activeUsers: number[] = [];
    try {
      activeUsers = JSON.parse(settings.activeUsers || '[]');
    } catch {
      activeUsers = [];
    }
    return activeUsers.includes(userId);
  }

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

// ============================================================
// ОСТАЛЬНЫЕ ФУНКЦИИ
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

async function addSalaryToUser(context: any, userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId }
  });

  if (!user) {
    await context.send(`❌ Пользователь не найден.`);
    return;
  }

  if (!user.salary_coin_id) {
    const globalCoin = await prisma.user.findFirst({
      where: {
        id_alliance: user.id_alliance,
        salary_coin_id: { not: null }
      },
      select: { salary_coin_id: true }
    });

    if (!globalCoin?.salary_coin_id) {
      await context.send(`❌ Сначала выберите глобальную валюту.`);
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { salary_coin_id: globalCoin.salary_coin_id }
    });
    user.salary_coin_id = globalCoin.salary_coin_id;
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

  const coin = await prisma.allianceCoin.findFirst({ where: { id: user.salary_coin_id ?? 0 } });
  await context.send(`✅ Зарплата добавлена ${user.name}: ${amount}${coin?.smile || '💰'}`);
}

async function editUserSalary(context: any, userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId }
  });

  if (!user) {
    await context.send(`❌ Пользователь не найден.`);
    return;
  }

  if (!user.salary_coin_id) {
    const globalCoin = await prisma.user.findFirst({
      where: {
        id_alliance: user.id_alliance,
        salary_coin_id: { not: null }
      },
      select: { salary_coin_id: true }
    });

    if (!globalCoin?.salary_coin_id) {
      await context.send(`❌ Сначала выберите глобальную валюту.`);
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { salary_coin_id: globalCoin.salary_coin_id }
    });
    user.salary_coin_id = globalCoin.salary_coin_id;
  }

  const currentAmount = user.salary_amount || 0;

  const newAmount = await Input_Number(
    context,
    `💰 Сумма для ${user.name}:\nТекущая: ${currentAmount}\nВведите 0 для удаления:`,
    true
  );

  if (newAmount === false) {
    await context.send(`❌ Отменено.`);
    return;
  }

  if (newAmount < 0) {
    await context.send(`❌ Не может быть отрицательной.`);
    return;
  }

  if (newAmount === 0) {
    const confirm = await Confirm_User_Success(context, `удалить зарплату у ${user.name}?`);
    if (confirm.status) {
      await prisma.user.update({
        where: { id: userId },
        data: { salary_coin_id: null, salary_amount: null }
      });
      await context.send(`✅ Зарплата удалена.`);
    }
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { salary_amount: newAmount }
    });
    await context.send(`✅ Сумма обновлена: ${newAmount}`);
  }
}

async function paySalaryToUser(context: any, userId: number) {
  const admin = await Person_Get(context);
  if (!admin) return;

  if (admin.id_alliance == null) {
    await context.send(`❌ Вы не состоите в альянсе.`);
    return;
  }

  const alliance = await prisma.alliance.findFirst({
    where: { id: admin.id_alliance as number }
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

  const coin = await prisma.allianceCoin.findFirst({ 
    where: { id: user.salary_coin_id ?? 0 } 
  });
  const settings = await prisma.salarySettings.findFirst({
    where: { allianceId: admin.id_alliance }
  });
  const isActive = await checkUserActivityThisWeek(user.id, settings);

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

async function paySalaryToAll(context: any) {
  const admin = await Person_Get(context);
  if (!admin) return;

  const alliance = await prisma.alliance.findFirst({
    where: { id: admin.id_alliance as number }
  });

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

  let message = `начислить зарплату всем персонажам?\n\n`;
  message += `📊 Всего: ${filteredUsers.length}\n\n`;
  
  const settings = await prisma.salarySettings.findFirst({
    where: { allianceId: admin.id_alliance }
  });

  for (const user of filteredUsers) {
    const coin = await prisma.allianceCoin.findFirst({ 
      where: { id: user.salary_coin_id ?? 0 } 
    });
    const isActive = await checkUserActivityThisWeek(user.id, settings);
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
    const coin = await prisma.allianceCoin.findFirst({ 
      where: { id: user.salary_coin_id ?? 0 } 
    });
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

async function paySalaryToActiveOnly(context: any) {
  const admin = await Person_Get(context);
  if (!admin) return;

  const alliance = await prisma.alliance.findFirst({
    where: { id: admin.id_alliance as number }
  });

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

  const settings = await prisma.salarySettings.findFirst({
    where: { allianceId: admin.id_alliance }
  });

  const activeUsers = [];
  const inactiveUsers = [];

  for (const user of filteredUsers) {
    const isActive = await checkUserActivityThisWeek(user.id, settings);
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

  let message = `начислить зарплату только активным?\n\n`;
  message += `📊 Всего с зарплатой: ${filteredUsers.length}\n`;
  message += `✅ Активных: ${activeUsers.length}\n`;
  message += `⏸️ Неактивных: ${inactiveUsers.length}\n\n`;
  
  message += `✅ Активные (получат):\n`;
  for (const user of activeUsers) {
    const coin = await prisma.allianceCoin.findFirst({ 
      where: { id: user.salary_coin_id ?? 0 } 
    });
    message += `  • ${user.name} (UID: ${user.id}): ${user.salary_amount}${coin?.smile || '💰'}\n`;
  }
  
  if (inactiveUsers.length > 0) {
    message += `\n⏸️ Неактивные (НЕ получат):\n`;
    for (const user of inactiveUsers) {
      const coin = await prisma.allianceCoin.findFirst({ 
        where: { id: user.salary_coin_id ?? 0 } 
      });
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
    const coin = await prisma.allianceCoin.findFirst({ 
      where: { id: user.salary_coin_id ?? 0 } 
    });
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
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function processSalaryPayment(user: User): Promise<boolean> {
  try {
    if (!user.salary_coin_id || !user.salary_amount || user.salary_amount <= 0) {
      return false;
    }

    const coin = await prisma.allianceCoin.findFirst({ 
      where: { id: user.salary_coin_id } 
    });
    if (!coin) return false;

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

    let message = `🔔 Уведомление для ${user.name} (UID: ${user.id})\n`;

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
        message += `💬 "+ ${user.salary_amount}${coin.smile}" --> ${oldAmount}${coin.smile} + ${user.salary_amount}${coin.smile} = ${newAmount}${coin.smile}\n`;
        message += `🧷 Сообщение: Начисление зарплаты`;
      }
    } else {
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
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  return sevenDaysAgo;
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