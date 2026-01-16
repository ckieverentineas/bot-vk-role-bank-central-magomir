import prisma from "../prisma_client";
import { calculatePostStats, getPcLinesForCheck, getPcLinesForDisplay, calculateReward } from "../topic_statistic";
import { GetSelectedPersonForAlliance } from "../person/monitor_select";
import { Alliance, Monitor, User } from "@prisma/client";
import { KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id } from "../../../..";
import { Confirm_User_Success, Fixed_Number_To_Five, Input_Number, Input_Text, Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";
import { button_alliance_return } from "../data_center/standart";
import { serializeLinesRewards, parseLinesRewards } from "../topic_statistic";

// Основная функция управления отслеживанием обсуждений
export async function Alliance_Topic_Monitor_Printer(context: any) {
    const user = await Person_Get(context);
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } });
    if (!alliance || !user) { return; }

    // Сначала выбираем монитор
    const monitor = await selectMonitor(context, alliance, user);
    if (!monitor) { return; }

    let allicoin_tr = false;
    let cursor = 0;

    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = `${ico_list['monitor'].ico} Управление отслеживанием обсуждений для монитора "${monitor.name}":\n\n`;

        const currentMonitor = await prisma.monitor.findFirst({ where: { id: monitor.id } });
        const defaultCoin = await prisma.allianceCoin.findFirst({ 
            where: { id: currentMonitor?.id_coin ?? 0 } 
        });
        const topicCoin = currentMonitor?.id_topic_coin ? 
            await prisma.allianceCoin.findFirst({ where: { id: currentMonitor.id_topic_coin } }) : null;

        if (topicCoin) {
            event_logger += `💰 Валюта наград: ${topicCoin.smile} ${topicCoin.name}\n`;
        } else if (defaultCoin) {
            event_logger += `💰 Валюта наград: используется валюта монитора ${defaultCoin.smile} ${defaultCoin.name}\n`;
        } else {
            event_logger += `💰 Валюта наград: не настроена\n`;
        }
        event_logger += `\n`;

        const topicMonitors = await prisma.topicMonitor.findMany({
            where: { monitorId: monitor.id },
            orderBy: { id: 'asc' },
            skip: cursor,
            take: 5
        });
        
        if (topicMonitors.length === 0) {
            event_logger += `📭 Нет отслеживаемых обсуждений\n`;
        } else {
            for (const topicMonitor of topicMonitors) {
                keyboard.textButton({
                    label: `${ico_list['edit'].ico} ${topicMonitor.name.slice(0, 25)}`,
                    payload: { command: 'topic_monitor_edit', cursor: cursor, id: topicMonitor.id },
                    color: 'secondary'
                })
                .textButton({
                    label: `${ico_list['delete'].ico}`,
                    payload: { command: 'topic_monitor_delete', cursor: cursor, id: topicMonitor.id },
                    color: 'secondary'
                }).row();

                const coinId = monitor.id_topic_coin ?? monitor.id_coin;
                const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
                event_logger += `${topicMonitor.name}\n`;
                event_logger += `🔗 ${topicMonitor.topicUrl}\n`;
                event_logger += `📏 Мин. ПК строк: ${topicMonitor.minPcLines || 1}\n`;
                if (topicMonitor.minPcMessage) {
                    event_logger += `💬 Сообщение: "${topicMonitor.minPcMessage}"\n`;
                }
                event_logger += `💰 Награды: ${topicMonitor.rewardEnabled ? '✅' : '❌'}\n`;
                if (topicMonitor.rewardEnabled) {
                    if (topicMonitor.uniformReward) {
                        event_logger += `🎯 Единая: ${topicMonitor.uniformReward}${coin?.smile || ''}\n`;
                    } else if (topicMonitor.linesRewards) {
                        event_logger += `📊 За ПК строки: настроено\n`;
                    }
                    event_logger += `⚡ Мин. для награды: ${topicMonitor.rewardMinLines || 1} ПК строк\n`;
                }
                event_logger += `\n`;
            }
        }

        // Пагинация
        const totalCount = await prisma.topicMonitor.count({ where: { monitorId: monitor.id } });
        
        if (cursor >= 5) {
            keyboard.textButton({
                label: `${ico_list['back'].ico}`,
                payload: { command: 'topic_monitor_back', cursor: cursor },
                color: 'secondary'
            });
        }

        if (cursor + 5 < totalCount) {
            keyboard.textButton({
                label: `${ico_list['next'].ico}`,
                payload: { command: 'topic_monitor_next', cursor: cursor },
                color: 'secondary'
            });
        }

        keyboard.textButton({
            label: `${ico_list['money'].ico} Валюта`,
            payload: { command: 'topic_monitor_set_currency', cursor: cursor, monitorId: monitor.id },
            color: 'primary'
        });

        keyboard.textButton({
            label: `${ico_list['add'].ico} Добавить обсуждение`,
            payload: { command: 'topic_monitor_create', cursor: cursor },
            color: 'secondary'
        }).row()
        .textButton({
            label: `${ico_list['stop'].ico}`,
            payload: { command: 'topic_monitor_return', cursor: cursor },
            color: 'secondary'
        }).oneTime();

        event_logger += `\nСтраница ${Math.floor(cursor / 5) + 1} из ${Math.ceil(totalCount / 5)}`;

        const answer: any = await context.question(event_logger, {
            keyboard: keyboard,
            answerTimeLimit
        });

        if (answer.isTimeout) {
            return await context.send(`${ico_list['time'].ico} Время ожидания истекло!`);
        }

        const config: any = {
            'topic_monitor_edit': Topic_Monitor_Edit,
            'topic_monitor_create': Topic_Monitor_Create,
            'topic_monitor_next': Topic_Monitor_Next,
            'topic_monitor_back': Topic_Monitor_Back,
            'topic_monitor_return': Topic_Monitor_Return,
            'topic_monitor_delete': Topic_Monitor_Delete,
            'topic_monitor_set_currency': Topic_Monitor_Set_Currency,
            'topic_monitor_return_from_currency': Topic_Monitor_Return
        };

        if (answer?.payload?.command in config) {
            const commandHandler = config[answer.payload.command];
            const ans = await commandHandler(context, answer.payload, monitor, user, alliance);
            cursor = ans?.cursor || ans?.cursor === 0 ? ans.cursor : cursor;
            allicoin_tr = ans.stop ? ans.stop : false;
        } else {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`);
        }
    }

    await Keyboard_Index(context, `${ico_list['help'].ico} Управление отслеживанием завершено!`);
}

export async function Topic_Monitor_Set_Currency(context: any, data: any, monitor: any, user: any, alliance: Alliance) {
    let cursor = data.cursor;
    let returnToMain = false;
    
    // Получаем все валюты альянса
    const coins = await prisma.allianceCoin.findMany({
        where: { id_alliance: alliance.id },
        orderBy: { name: 'asc' }
    });

    if (coins.length === 0) {
        await context.send(`${ico_list['warn'].ico} В альянсе нет валют. Сначала создайте валюту в меню "⚙ !валюты настроить".`);
        return { cursor: cursor, stop: true };
    }

    while (!returnToMain) {
        // ОБНОВЛЯЕМ объект monitor на каждой итерации
        const currentMonitor = await prisma.monitor.findFirst({ 
            where: { id: monitor.id } 
        });
        
        // Проверяем, что монитор существует
        if (!currentMonitor) {
            await context.send(`${ico_list['warn'].ico} Монитор не найден!`);
            return { cursor: cursor, stop: true };
        }
        
        // Создаем клавиатуру
        const keyboard = new KeyboardBuilder();
        let text = `${ico_list['money'].ico} Выберите валюту для наград в обсуждениях:\n`;
        text += `Монитор: "${currentMonitor.name}"\n\n`;
        
        // Текущая валюта (ИСПОЛЬЗУЕМ ОБНОВЛЕННЫЙ МОНИТОР)
        const defaultCoin = await prisma.allianceCoin.findFirst({ 
            where: { id: currentMonitor.id_coin ?? 0 } 
        });
        const currentTopicCoin = currentMonitor.id_topic_coin ? 
            await prisma.allianceCoin.findFirst({ where: { id: currentMonitor.id_topic_coin } }) : null;
        
        text += `Текущая настройка:\n`;
        if (currentTopicCoin) {
            text += `• Валюта обсуждений: ${currentTopicCoin.smile} ${currentTopicCoin.name}\n`;
        } else {
            text += `• Используется валюта монитора: ${defaultCoin?.smile || '❌'} ${defaultCoin?.name || 'Не выбрана'}\n`;
        }
        text += `\nДоступные валюты:\n`;

        // Добавляем кнопки валют
        let rowIndex = 0;
        for (let i = 0; i < coins.length; i += 2) {
            const coin1 = coins[i];
            let coin2 = null;
            
            if (i + 1 < coins.length) {
                coin2 = coins[i + 1];
            }
            
            // Проверяем, выбрана ли эта валюта (ИСПОЛЬЗУЕМ ОБНОВЛЕННЫЙ МОНИТОР)
            const isSelected1 = currentMonitor.id_topic_coin === coin1.id || 
                               (!currentMonitor.id_topic_coin && currentMonitor.id_coin === coin1.id);
            
            const label1 = isSelected1 ? 
                `${coin1.smile} ${coin1.name.slice(0, 12)} ✅` : 
                `${coin1.smile} ${coin1.name.slice(0, 12)}`;
            
            keyboard.textButton({
                label: label1,
                payload: {
                    command: 'topic_currency_select',
                    monitorId: currentMonitor.id,
                    coinId: coin1.id,
                    cursor: cursor
                },
                color: isSelected1 ? 'positive' : 'secondary'
            });

            if (coin2) {
                const isSelected2 = currentMonitor.id_topic_coin === coin2.id || 
                                   (!currentMonitor.id_topic_coin && currentMonitor.id_coin === coin2.id);
                
                const label2 = isSelected2 ? 
                    `${coin2.smile} ${coin2.name.slice(0, 12)} ✅` : 
                    `${coin2.smile} ${coin2.name.slice(0, 12)}`;
                
                keyboard.textButton({
                    label: label2,
                    payload: {
                        command: 'topic_currency_select',
                        monitorId: currentMonitor.id,
                        coinId: coin2.id,
                        cursor: cursor
                    },
                    color: isSelected2 ? 'positive' : 'secondary'
                });
            }
            keyboard.row();
            
            rowIndex++;
            text += `${i + 1}. ${coin1.smile} ${coin1.name}\n`;
            if (coin2) {
                text += `${i + 2}. ${coin2.smile} ${coin2.name}\n`;
            }
        }

        // Кнопка для сброса к валюте монитора (только если задана отдельная валюта)
        if (currentMonitor.id_topic_coin) {
            keyboard.textButton({
                label: '🔄 Использовать валюту монитора',
                payload: {
                    command: 'topic_currency_reset',
                    monitorId: currentMonitor.id,
                    cursor: cursor
                },
                color: 'negative'
            }).row();
        }

        // Кнопка возврата
        keyboard.textButton({
            label: '↩️ Назад к обсуждениям',
            payload: {
                command: 'topic_monitor_return_from_currency',
                cursor: cursor,
                monitorId: currentMonitor.id
            },
            color: 'secondary'
        }).row().oneTime();

        // Отправляем сообщение с клавиатурой
        const answer: any = await context.question(text, {
            keyboard: keyboard,
            answerTimeLimit
        });

        if (answer.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время ожидания истекло!`);
            return { cursor: cursor, stop: true };
        }

        // Обработка выбора валюты
        if (answer.payload?.command === 'topic_currency_select') {
            const coinId = answer.payload.coinId;
            const monitorId = answer.payload.monitorId;
            const cursor = answer.payload.cursor;

            // Обновляем валюту обсуждений для монитора
            await prisma.monitor.update({
                where: { id: monitorId },
                data: { id_topic_coin: coinId }
            });

            // ЗАГРУЖАЕМ ОБНОВЛЕННЫЙ МОНИТОР ДЛЯ СЛЕДУЮЩЕЙ ИТЕРАЦИИ
            const updatedMonitor = await prisma.monitor.findFirst({ 
                where: { id: monitorId } 
            });
            
            // Проверяем, что монитор обновлен
            if (!updatedMonitor) {
                await context.send(`${ico_list['warn'].ico} Ошибка обновления монитора!`);
                return { cursor: cursor, stop: true };
            }
            
            const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });
            
            // Обновляем локальную переменную monitor
            monitor = updatedMonitor;
            
            // Отправляем сообщение об успехе
            await context.send(`${ico_list['save'].ico} Валюта установлена: ${coin?.smile} ${coin?.name}`);
            
            // Не выходим из цикла - показываем обновленное меню снова
            continue;
        }

        // Обработка сброса валюты
        if (answer.payload?.command === 'topic_currency_reset') {
            const monitorId = answer.payload.monitorId;
            const cursor = answer.payload.cursor;

            // Сбрасываем валюту обсуждений
            await prisma.monitor.update({
                where: { id: monitorId },
                data: { id_topic_coin: null }
            });

            // ЗАГРУЖАЕМ ОБНОВЛЕННЫЙ МОНИТОР
            const updatedMonitor = await prisma.monitor.findFirst({ 
                where: { id: monitorId } 
            });
            
            // Проверяем, что монитор обновлен
            if (!updatedMonitor) {
                await context.send(`${ico_list['warn'].ico} Ошибка обновления монитора!`);
                return { cursor: cursor, stop: true };
            }
            
            // Обновляем локальную переменную monitor
            monitor = updatedMonitor;
            
            const defaultCoin = updatedMonitor.id_coin 
                ? await prisma.allianceCoin.findFirst({ where: { id: updatedMonitor.id_coin } })
                : null;

            await context.send(`${ico_list['save'].ico} Валюта сброшена. Используется валюта монитора: ${defaultCoin?.smile} ${defaultCoin?.name}`);
            
            // Не выходим из цикла - показываем обновленное меню снова
            continue;
        }

        // Возврат к управлению обсуждениями
        if (answer.payload?.command === 'topic_monitor_return_from_currency') {
            returnToMain = true;
            // Возвращаем ОБНОВЛЕННЫЙ монитор
            const finalMonitor = await prisma.monitor.findFirst({ 
                where: { id: answer.payload.monitorId } 
            });
            
            if (!finalMonitor) {
                await context.send(`${ico_list['warn'].ico} Монитор не найден!`);
                return { cursor: answer.payload.cursor, stop: true };
            }
            
            return { 
                cursor: answer.payload.cursor, 
                stop: false,
                monitor: finalMonitor
            };
        }
    }

    return { cursor: cursor, stop: true };
}

// Выбор монитора
async function selectMonitor(context: any, alliance: Alliance, user: any) {
    let monitor_check = false;
    let id_builder_sent = 0;
    let selectedMonitor = null;

    while (!monitor_check) {
        const keyboard = new KeyboardBuilder();
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent);
        let event_logger = `${ico_list['monitor'].ico} Выберите монитор для настройки отслеживания обсуждений:\n\n`;

        const monitors = await prisma.monitor.findMany({
            where: { id_alliance: alliance.id },
            orderBy: { id: 'asc' },
            skip: id_builder_sent,
            take: 5
        });

        if (monitors.length === 0) {
            await context.send(`${ico_list['warn'].ico} Нет доступных мониторов!`);
            return null;
        }

        // Группируем по 2 монитора в ряд
        for (let i = 0; i < monitors.length; i += 2) {
            const row = keyboard.textButton({
                label: `${monitors[i].name.slice(0, 15)}`,
                payload: { command: 'select_monitor', id_builder_sent: id_builder_sent, monitorId: monitors[i].id },
                color: 'secondary'
            });
            
            if (i + 1 < monitors.length) {
                row.textButton({
                    label: `${monitors[i + 1].name.slice(0, 15)}`,
                    payload: { command: 'select_monitor', id_builder_sent: id_builder_sent, monitorId: monitors[i + 1].id },
                    color: 'secondary'
                });
            }
            row.row();
        }

        // Навигация
        const totalMonitors = await prisma.monitor.count({ where: { id_alliance: alliance.id } });
        
        if (id_builder_sent >= 5) {
            keyboard.textButton({
                label: `${ico_list['back'].ico}`,
                payload: { command: 'monitor_nav', id_builder_sent: Math.max(0, id_builder_sent - 5) },
                color: 'secondary'
            });
        }

        if (id_builder_sent + 5 < totalMonitors) {
            keyboard.textButton({
                label: `${ico_list['next'].ico}`,
                payload: { command: 'monitor_nav', id_builder_sent: id_builder_sent + 5 },
                color: 'secondary'
            });
        }

        if (id_builder_sent >= 5 || id_builder_sent + 5 < totalMonitors) {
            keyboard.row();
        }

        keyboard.textButton({
            label: `${ico_list['stop'].ico} Отмена`,
            payload: { command: 'monitor_cancel' },
            color: 'secondary'
        }).oneTime();

        const answer: any = await context.question(event_logger, {
            keyboard: keyboard,
            answerTimeLimit
        });

        if (answer.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время ожидания истекло!`);
            return null;
        }

        if (answer.payload?.command === 'select_monitor') {
            selectedMonitor = await prisma.monitor.findFirst({ where: { id: answer.payload.monitorId } });
            monitor_check = true;
        } else if (answer.payload?.command === 'monitor_nav') {
            id_builder_sent = answer.payload.id_builder_sent;
        } else if (answer.payload?.command === 'monitor_cancel') {
            return null;
        }
    }

    return selectedMonitor;
}

// Создание отслеживания обсуждения
async function Topic_Monitor_Create(context: any, data: any, monitor: any, user: any, alliance: Alliance) {
    const res = { cursor: data.cursor };

    // 1. Ввод названия
    const name = await Input_Text(context, `Введите название для отслеживания обсуждения (например, "Основной сюжет"):`);
    if (!name) return res;

    // 2. Ввод ссылки на обсуждение
    const topicUrl = await Input_Text(context, `Введите полную ссылку на обсуждение VK (например, https://vk.com/topic-12345678_90123456):`);
    if (!topicUrl) return res;

    // Парсим URL для получения topicId
    const parsed = parseTopicUrl(topicUrl);
    if (!parsed) {
        await context.send(`${ico_list['warn'].ico} Неверный формат ссылки на обсуждение! Пример: https://vk.com/topic-12345678_90123456`);
        return res;
    }

    // Проверяем, не отслеживается ли уже это обсуждение
    const existing = await prisma.topicMonitor.findFirst({
        where: {
            monitorId: monitor.id,
            topicId: parsed.topicId
        }
    });

    if (existing) {
        await context.send(`${ico_list['warn'].ico} Это обсуждение уже отслеживается: ${existing.name}`);
        return res;
    }

    // 3. Минимальное количество ПК строк
    const minPcLinesInput = await Input_Number(
        context, 
        `Введите минимальное количество ПК строк для засчитывания поста (0 = любые посты, любой длины, 1 ПК = 102 символа):`, 
        true
    );
    const minPcLinesValue = minPcLinesInput !== false ? Math.max(0, minPcLinesInput) : 1;

    // 4. Кастомное сообщение при недостаточном объеме (опционально)
    const addCustomMessage = await Confirm_User_Success(context, `добавить кастомное сообщение при недостаточном объеме?`);
    let minPcMessage = null;

    if (addCustomMessage.status) {
        const customMessage = await Input_Text(
            context,
            `Введите кастомное сообщение при недостаточном объеме:\n` +
            `Пример: "⚠ ПОСТ МЕНЬШЕ ТРЕХ СТРОК? ВЫСЕЧЬ!"\n` +
            `Если оставить пустым - будут стандартные сообщения:`,
            200
        );
        
        if (customMessage && customMessage.trim() !== "") {
            minPcMessage = customMessage.trim();
            await context.send(`✅ Кастомное сообщение добавлено: "${minPcMessage}"`);
        }
    }

    // 5. Включение наград
    const rewardEnabled = await Confirm_User_Success(context, `включить автоматические награды за посты в этом обсуждении?`);
    await context.send(`${rewardEnabled.text}`);

    let uniformReward = null;
    let linesRewards = null;
    let rewardMinLines = 1;

    if (rewardEnabled.status) {
        // 6. Выбор типа наград
        const rewardType = await selectRewardType(context);
        
        if (rewardType === 'uniform') {
            // Единая награда
            const coinId = monitor.id_topic_coin ?? monitor.id_coin;
            const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
            const rewardInput = await Input_Number(context, `Введите единую награду за пост (в ${coin?.smile || 'валюте'}):`, false);
            if (rewardInput !== false) {
                uniformReward = rewardInput;
            }
        } else if (rewardType === 'lines') {
            // Награды за ПК строки
            const linesConfig = await configureLinesRewards(context, monitor);
            if (linesConfig) {
                linesRewards = linesConfig;
            }
        }

        // 7. Минимальное количество ПК строк для награды
        const minRewardLinesInput = await Input_Number(
            context, 
            `Введите минимальное количество ПК строк для получения награды (0 = награждать любые посты):`, 
            true
        );
        rewardMinLines = minRewardLinesInput !== false ? Math.max(0, minRewardLinesInput) : 1;
    }

    // Создание записи
    const topicMonitor = await prisma.topicMonitor.create({
        data: {
            name: name,
            monitorId: monitor.id,
            topicUrl: topicUrl,
            topicId: parsed.topicId,
            minPcLines: minPcLinesValue,
            minPcMessage: minPcMessage,
            rewardEnabled: rewardEnabled.status,
            uniformReward: uniformReward,
            linesRewards: linesRewards,
            rewardMinLines: rewardMinLines
        }
    });

    if (topicMonitor) {
        const statusText = rewardEnabled.status ? 
            `💰 Награды: ✅ (${uniformReward ? `единая ${uniformReward}` : 'за ПК строки'})` : 
            `💰 Награды: ❌ (только статистика)`;
        
        const messageText = minPcMessage ? `💬 Сообщение: "${minPcMessage}"` : `💬 Сообщение: стандартное`;
        
        await Logger(`Создано отслеживание обсуждения: ${topicMonitor.id}-${topicMonitor.name} для монитора ${monitor.id} админом ${user.idvk}`);
        await context.send(`${ico_list['save'].ico} Создано отслеживание обсуждения "${topicMonitor.name}"!\n` +
                          `📏 Минимальные ПК строки: ${minPcLinesValue} ${minPcLinesValue === 0 ? '(любые посты)' : ''}\n` +
                          `${messageText}\n` +
                          statusText);
        await Send_Message(chat_id,
            `${ico_list['save'].ico} Создано отслеживание обсуждения\n` +
            `📝 ${topicMonitor.name}\n` +
            `🔗 ${topicMonitor.topicUrl}\n` +
            `🎯 Монитор: ${monitor.name}\n` +
            `👤 @id${user.idvk}(${user.name})\n` +
            `${ico_list['alliance'].ico} ${alliance.name}`
        );
    }

    return res;
}

async function selectRewardType(context: any): Promise<'uniform' | 'lines' | null> {
    const keyboard = new KeyboardBuilder()
        .textButton({ label: 'Единая награда', payload: { command: 'uniform' }, color: 'secondary' }).row()
        .textButton({ label: 'За ПК строки', payload: { command: 'lines' }, color: 'secondary' }).row()
        .textButton({ label: 'Без наград', payload: { command: 'none' }, color: 'secondary' }).oneTime();

    const answer = await context.question(
        `Выберите тип наград:\n` +
        `• Единая награда - фиксированная сумма за любой пост\n` +
        `• За ПК строки - разная награда в зависимости от объема (1 ПК = 102 символа)\n` +
        `• Без наград - только статистика`,
        { keyboard: keyboard, answerTimeLimit }
    );

    if (answer.isTimeout || answer.payload?.command === 'none') {
        return null;
    }

    return answer.payload?.command as 'uniform' | 'lines';
}

async function configureLinesRewards(context: any, monitor: any): Promise<string | null> {
    const coinId = monitor.id_topic_coin ?? monitor.id_coin;
    const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
    const rewards = [];
    let moreLines = true;

    await context.send(`Настройка наград за ПК строки (1 ПК = 102 символа).\nВведите пары "ПК_строки:награда".\nПример: 5:10 (5 ПК строк = 10${coin?.smile || ''})`);

    while (moreLines) {
        const lineReward = await Input_Text(context, `Введите пару "ПК_строки:награда" (или "готово" для завершения):`);
        
        if (!lineReward || lineReward.toLowerCase() === 'готово') {
            moreLines = false;
            continue;
        }

        const match = lineReward.match(/^(\d+):(\d+(\.\d+)?)$/);
        if (match) {
            const lines = parseInt(match[1]);
            const reward = parseFloat(match[2]);
            rewards.push({ lines, reward });
            await context.send(`Добавлено: ${lines} ПК строк = ${reward}${coin?.smile || ''}`);
        } else {
            await context.send(`Неверный формат! Используйте "число:число", например "5:10"`);
        }
    }

    // Сортируем по возрастанию количества ПК строк
    rewards.sort((a, b) => a.lines - b.lines);
    
    // Сериализуем в строку JSON
    return rewards.length > 0 ? serializeLinesRewards(rewards) : null;
}

// Редактирование отслеживания обсуждения
async function Topic_Monitor_Edit(context: any, data: any, monitor: any, user: any, alliance: Alliance) {
    const res = { cursor: data.cursor };
    
    const topicMonitor = await prisma.topicMonitor.findFirst({
        where: { id: data.id }
    });
    
    if (!topicMonitor) return res;
    
    // Редактирование настроек
    await context.send(`${ico_list['edit'].ico} Редактирование "${topicMonitor.name}"`);
    
    // 1. Изменить название
    const newName = await Input_Text(context, `Текущее название: ${topicMonitor.name}\nВведите новое название (или "пропустить" для сохранения текущего):`);
    if (newName && newName.toLowerCase() !== 'пропустить') {
        await prisma.topicMonitor.update({
            where: { id: topicMonitor.id },
            data: { name: newName }
        });
        await context.send(`✅ Название обновлено: "${newName}"`);
    }
    
    // 2. Изменить минимальное количество ПК строк
    const newMinPcLines = await Input_Number(
        context, 
        `Текущее мин. ПК строк: ${topicMonitor.minPcLines || 1}\nВведите новое значение (0 = любые посты, любой длины):`, 
        true
    );
    if (newMinPcLines !== false && newMinPcLines >= 0) {
        await prisma.topicMonitor.update({
            where: { id: topicMonitor.id },
            data: { minPcLines: newMinPcLines }
        });
        await context.send(`✅ Мин. ПК строк обновлено: ${newMinPcLines}`);
    }
    
    // 3. Изменить кастомное сообщение при недостаточном объеме
    const currentMessage = topicMonitor.minPcMessage || "ℹ️ (сообщение не настроено)";
    await context.send(`Текущее сообщение при малом объеме: "${currentMessage}"`);
    const newMessage = await Input_Text(
        context, 
        `Введите новое сообщение при недостаточном объеме:\n` +
        `• Оставьте пустым для стандартных сообщений\n` +
        `• "удалить" - удалить кастомное сообщение\n` +
        `• "пропустить" - оставить как есть\n` +
        `Примеры:\n` +
        `- "⚠ ПОСТ МЕНЬШЕ ТРЕХ СТРОК? ВЫСЕЧЬ!"\n` +
        `- "Пиши больше, ленивая задница!"\n` +
        `- "Надо было стараться лучше!"\n\n` +
        `При редактировании: "⚠ Объем ниже минимального, награда снята!"\n` +
        `При новом посте: "ℹ️ Пост зафиксирован, но не принес награды"`, 
        200
    );

    if (newMessage && newMessage.toLowerCase() === 'удалить') {
        await prisma.topicMonitor.update({
            where: { id: topicMonitor.id },
            data: { minPcMessage: null }
        });
        await context.send(`✅ Кастомное сообщение удалено, будут стандартные сообщения`);
    } else if (newMessage && newMessage.toLowerCase() !== 'пропустить' && newMessage.trim() !== "") {
        await prisma.topicMonitor.update({
            where: { id: topicMonitor.id },
            data: { minPcMessage: newMessage.trim() }
        });
        await context.send(`✅ Сообщение обновлено: "${newMessage.trim()}"`);
    } else if (newMessage && newMessage.toLowerCase() === 'пропустить') {
        await context.send(`✅ Сообщение оставлено как есть`);
    }
    
    // 4. Настройка наград
    const editRewards = await Confirm_User_Success(context, `изменить настройки наград?`);
    if (editRewards.status) {
        // Включение/выключение наград
        const newRewardEnabled = await Confirm_User_Success(context, `включить награды для этого обсуждения?`);
        await prisma.topicMonitor.update({
            where: { id: topicMonitor.id },
            data: { rewardEnabled: newRewardEnabled.status }
        });
        await context.send(`✅ Награды ${newRewardEnabled.status ? 'включены' : 'отключены'}`);
        
        if (newRewardEnabled.status) {
            // Выбор типа наград
            const rewardType = await selectRewardType(context);
            
            if (rewardType === 'uniform') {
                const coinId = monitor.id_topic_coin ?? monitor.id_coin;
                const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
                const rewardInput = await Input_Number(context, `Введите единую награду за пост (в ${coin?.smile || 'валюте'}):`, false);
                if (rewardInput !== false) {
                    await prisma.topicMonitor.update({
                        where: { id: topicMonitor.id },
                        data: { 
                            uniformReward: rewardInput,
                            linesRewards: null // Сбрасываем награды за строки если выбрана единая
                        }
                    });
                    await context.send(`✅ Единая награда установлена: ${rewardInput}${coin?.smile || ''}`);
                }
            } else if (rewardType === 'lines') {
                const linesConfig = await configureLinesRewards(context, monitor);
                if (linesConfig) {
                    await prisma.topicMonitor.update({
                        where: { id: topicMonitor.id },
                        data: { 
                            linesRewards: linesConfig,
                            uniformReward: null // Сбрасываем единую награду если выбраны награды за строки
                        }
                    });
                    await context.send(`✅ Награды за ПК строки настроены`);
                }
            } else {
                // Отключить награды
                await prisma.topicMonitor.update({
                    where: { id: topicMonitor.id },
                    data: { 
                        rewardEnabled: false,
                        uniformReward: null,
                        linesRewards: null
                    }
                });
                await context.send(`✅ Награды отключены`);
            }
            
            // Минимальное количество ПК строк для награды
            const newRewardMinLines = await Input_Number(
                context, 
                `Текущее мин. ПК строк для награды: ${topicMonitor.rewardMinLines || 1}\nВведите новое значение (0 = награждать любые посты):`, 
                true
            );
            if (newRewardMinLines !== false && newRewardMinLines >= 0) {
                await prisma.topicMonitor.update({
                    where: { id: topicMonitor.id },
                    data: { rewardMinLines: newRewardMinLines }
                });
                await context.send(`✅ Мин. ПК строк для награды обновлено: ${newRewardMinLines}`);
            }
        }
    }
    
    await context.send(`${ico_list['save'].ico} Настройки обсуждения "${topicMonitor.name}" обновлены!`);
    
    return res;
}

// Удаление отслеживания обсуждения
async function Topic_Monitor_Delete(context: any, data: any, monitor: any, user: any, alliance: Alliance) {
    const res = { cursor: data.cursor };
    
    const topicMonitor = await prisma.topicMonitor.findFirst({
        where: { id: data.id }
    });
    
    if (!topicMonitor) return res;
    
    const confirm = await Confirm_User_Success(context, `удалить отслеживание "${topicMonitor.name}"?`);
    
    if (confirm.status) {
        // Сначала удаляем всю статистику
        await prisma.postStatistic.deleteMany({
            where: { topicMonitorId: topicMonitor.id }
        });
        
        // Затем удаляем само отслеживание
        await prisma.topicMonitor.delete({
            where: { id: topicMonitor.id }
        });
        
        await context.send(`${ico_list['delete'].ico} Удалено отслеживание "${topicMonitor.name}"`);
        await Logger(`Удалено отслеживание обсуждения: ${topicMonitor.id} админом ${user.idvk}`);
    }
    
    return res;
}

// Навигация вперед
async function Topic_Monitor_Next(context: any, data: any) {
    return { cursor: data.cursor + 5 };
}

// Навигация назад
async function Topic_Monitor_Back(context: any, data: any) {
    return { cursor: Math.max(0, data.cursor - 5) };
}

// Возврат в главное меню
async function Topic_Monitor_Return(context: any, data: any) {
    return { cursor: data.cursor, stop: true };
}


// Интерфейс для контекста обсуждения
interface BoardPostContext {
    fromId?: number;
    id: number;
    topicId: number;
    text?: string;
    groupId?: number;
}

async function determineTargetUser(
    text: string,
    senderUserId: number,
    allianceId: number
): Promise<{ user: any, uidSpecified: boolean, specifiedUid: number | null }> {
    //console.log(`🔍 Определение пользователя: senderUserId=${senderUserId}, allianceId=${allianceId}`);
    
    // 1. Получаем аккаунт отправителя по VK ID
    const account = await prisma.account.findFirst({
        where: { idvk: senderUserId }
    });
    
    if (!account) {
        //console.log(`❌ Аккаунт VK ID ${senderUserId} не найден`);
        throw new Error(`Аккаунт VK ID ${senderUserId} не найден`);
    }
    
    //console.log(`✅ Аккаунт найден: ID=${account.id}, VK ID=${account.idvk}`);
    
    // 2. Пытаемся извлечь UID из текста поста
    const extractedUid = extractTargetUidFromText(text);
    
    if (extractedUid) {
        //console.log(`📝 Найден UID в тексте: #${extractedUid}`);
        
        // Проверяем, существует ли пользователь с таким UID в альянсе
        const specifiedUser = await prisma.user.findFirst({
            where: { 
                id: extractedUid,
                id_alliance: allianceId
            }
        });
        
        if (specifiedUser) {
            // Проверяем, принадлежит ли указанный пользователь тому же аккаунту
            if (specifiedUser.id_account === account.id) {
                //console.log(`✅ Указанный UID ${extractedUid} принадлежит аккаунту ${account.id}. Используем его.`);
                return {
                    user: specifiedUser,
                    uidSpecified: true,
                    specifiedUid: extractedUid
                };
            } else {
                //console.log(`⚠️ Указанный UID ${extractedUid} принадлежит другому аккаунту. Начисление по умолчанию.`);
                await Logger(`⚠️ Пользователь ${account.idvk} попытался указать чужой UID ${extractedUid}. Начисление по умолчанию.`);
            }
        } else {
            //console.log(`⚠️ Указанный UID ${extractedUid} не найден в альянсе ${allianceId}. Начисление по умолчанию.`);
            await Logger(`⚠️ Указанный UID ${extractedUid} не найден в альянсе ${allianceId}. Начисление по умолчанию.`);
        }
    }
    
    // 3. По умолчанию: получаем выбранного персонажа для мониторов в этом альянсе
    //console.log(`🔍 Получаем выбранного персонажа для accountId=${account.id}, allianceId=${allianceId}`);
    const selectedUser = await GetSelectedPersonForAlliance(account.id, allianceId);
    
    if (selectedUser) {
        //console.log(`✅ Найден выбранный персонаж для мониторов: UID=${selectedUser.id}, Name=${selectedUser.name}`);
        return {
            user: selectedUser,
            uidSpecified: false,
            specifiedUid: null
        };
    } else {
        //console.log(`⚠️ Нет выбранного персонажа для мониторов для accountId=${account.id}, allianceId=${allianceId}`);
    }
    
    // 4. Если нет явного выбора, ищем пользователя по VK ID (обратная совместимость)
    //console.log(`🔍 Ищем пользователя по VK ID ${senderUserId} в альянсе ${allianceId}`);
    const senderUser = await prisma.user.findFirst({
        where: { 
            idvk: senderUserId,
            id_alliance: allianceId 
        }
    });
    
    if (senderUser) {
        //console.log(`✅ Найден пользователь по VK ID: UID=${senderUser.id}, Name=${senderUser.name}`);
        return {
            user: senderUser,
            uidSpecified: false,
            specifiedUid: null
        };
    }
    
    // 5. Последняя попытка: берем любого персонажа аккаунта в альянсе
    //console.log(`🔍 Ищем любого персонажа аккаунта ${account.id} в альянсе ${allianceId}`);
    const anyUserInAlliance = await prisma.user.findFirst({
        where: { 
            id_account: account.id,
            id_alliance: allianceId
        }
    });
    
    if (anyUserInAlliance) {
        //console.log(`✅ Найден персонаж аккаунта в альянсе: UID=${anyUserInAlliance.id}, Name=${anyUserInAlliance.name}`);
        return {
            user: anyUserInAlliance,
            uidSpecified: false,
            specifiedUid: null
        };
    }
    
    //console.log(`❌ Не удалось определить пользователя для начисления`);
    throw new Error(`Не удалось определить пользователя для начисления`);
}

// Функция для извлечения UID из текста
function extractTargetUidFromText(text: string): number | null {
    // Ищем паттерн #UID (например, #1377)
    const pattern = /#(\d+)/;
    const match = text.match(pattern);
    
    if (match) {
        const extractedUid = parseInt(match[1]);
        if (extractedUid && extractedUid > 0) {
            return extractedUid;
        }
    }
    
    return null;
}

// Обработчик новых постов в обсуждениях
export async function handleTopicPost(context: BoardPostContext, monitor: any, action: 'new' | 'edit' | 'delete' | 'restore') {
    try {
        //console.log(`\n🎯 Обработка поста: action=${action}, postId=${context.id}, topicId=${context.topicId}, fromId=${context.fromId}`);

        // ДОБАВЛЕНО: Защита от повторной обработки
        const processingKey = `${monitor.id}_${context.topicId}_${context.id}`;
        if (processingPosts.has(processingKey)) {
            //console.log(`⏸️  Пропуск: пост ${context.id} уже обрабатывается`);
            return;
        }
        
        processingPosts.set(processingKey, Date.now());
        
        // Автоматическая очистка через 30 секунд на случай сбоев
        setTimeout(() => {
            processingPosts.delete(processingKey);
        }, 30000);

        // Проверяем, есть ли текст (для delete может не быть)
        if ((action === 'new' || action === 'edit' || action === 'restore') && !context.text) {
            //console.log(`⚠ Пропуск: нет текста для действия ${action}`);
            processingPosts.delete(processingKey);
            return;
        }

        // Проверяем, что это не бот (для delete ищем пользователя в БД)
        if (action !== 'delete' && (!context.fromId || context.fromId <= 0)) {
            //console.log(`⚠ Пропуск: невалидный fromId ${context.fromId}`);
            processingPosts.delete(processingKey);
            return;
        }

        // ID обсуждения
        const topicId = context.topicId;
        
        // Проверяем, отслеживается ли это обсуждение
        const topicMonitor = await prisma.topicMonitor.findFirst({
            where: {
                monitorId: monitor.id,
                topicId: topicId
            }
        });

        if (!topicMonitor) {
            //console.log(`⚠ Пропуск: обсуждение ${topicId} не отслеживается монитором ${monitor.id}`);
            processingPosts.delete(processingKey);
            return;
        }

        //console.log(`✅ Найдено отслеживание: "${topicMonitor.name}" для поста ${context.id}, действие: ${action}`);

        // Для удаления - удаляем статистику и отменяем награды
        if (action === 'delete') {
            //console.log(`🗑️ Удаление поста ${context.id} из статистики`);
            await handlePostDeletion(topicMonitor, context.id, monitor, context.fromId, context.topicId);
            processingPosts.delete(processingKey);
            return;
        }

        // Проверяем, что есть fromId для new/edit/restore
        if (!context.fromId || context.fromId <= 0) {
            //console.log(`⚠ Пропуск: нет fromId для действия ${action}`);
            processingPosts.delete(processingKey);
            return;
        }

        // Определяем, какому пользователю начислять (с поддержкой UID в тексте)
        const { user: targetUser, uidSpecified, specifiedUid } = await determineTargetUser(
            context.text || '',
            context.fromId,
            monitor.id_alliance
        );
        
        if (!targetUser) {
            //console.log(`⚠ Пользователь не найден для начисления`);
            processingPosts.delete(processingKey);
            return;
        }

        if (uidSpecified && specifiedUid) {
            //console.log(`🎯 Начисление по указанному UID: ${specifiedUid} (отправитель: ${context.fromId})`);
        } else {
            //console.log(`🎯 Начисление по умолчанию: UID:${targetUser.id} (${targetUser.name})`);
        }

        // Рассчитываем статистику поста
        const text = context.text || '';
        const stats = calculatePostStats(text);
        const displayPc = getPcLinesForDisplay(stats.pc); // Для отображения
        const checkPcLines = getPcLinesForCheck(stats.pc); // Для проверки

        //console.log(`📊 Статистика поста: ${stats.words} слов, ${stats.characters} символов, PC=${displayPc}, checkPcLines=${checkPcLines}`);

        // Проверяем существующую запись для редактирования/восстановления
        const existingStat = await prisma.postStatistic.findFirst({
            where: {
                topicMonitorId: topicMonitor.id,
                postId: context.id
            }
        });

        let oldReward = 0;
        let oldDisplayPc = 0;
        let oldTargetUserId = null;
        let userChanged = false;
        let oldUser = null;
        
        if (existingStat) {
            oldReward = existingStat.rewardAmount || 0;
            oldDisplayPc = getPcLinesForDisplay(existingStat.pc);
            oldTargetUserId = existingStat.userId;
            
            // Получаем информацию о старом пользователе
            oldUser = await prisma.user.findFirst({
                where: { id: existingStat.userId }
            });
            
            // Проверяем, изменился ли целевой пользователь
            userChanged = false;

            if (existingStat && oldUser) {
                // Сравниваем не только ID, но и имя, и другие параметры
                userChanged = !(
                    oldUser.id === targetUser.id && 
                    oldUser.name === targetUser.name &&
                    oldUser.idvk === targetUser.idvk &&
                    oldUser.id_alliance === targetUser.id_alliance
                );
                
                // ДОБАВЛЕНО: Дополнительная проверка на случай некорректных данных
                if (userChanged && oldUser.id === targetUser.id) {
                    //console.log(`⚠️  userChanged=true, но ID пользователей одинаковые. Исправляем.`);
                    userChanged = false;
                }
            }
            //console.log(`🔄 Сравнение пользователей: было UID:${existingStat.userId} (${oldUser?.name}), стало UID:${targetUser.id} (${targetUser.name}), изменился: ${userChanged}`);
        }

        // Проверяем минимальный объем (ПК строки)
        const minPcLines = topicMonitor.minPcLines ?? 0;
        const hasMinPcLines = minPcLines > 0;
        const belowMinPcLines = hasMinPcLines && checkPcLines < minPcLines;

        //console.log(`📏 Минималка: ${minPcLines} ПК строк, текущий объем: ${checkPcLines}, ниже минималки: ${belowMinPcLines}`);

        // === ВАЖНО: НОВАЯ ЛОГИКА ===
        // Сначала обрабатываем СТАРОГО пользователя (если изменился)
        if (userChanged && existingStat && oldUser && oldUser.id !== targetUser.id) {
            //console.log(`🔄 Обработка смены пользователя: с ${oldUser.name} (${oldTargetUserId}) на ${targetUser.name} (${targetUser.id})`);
            
            // 1. Снимаем награду со старого пользователя (если была)
            if (existingStat.rewardGiven && existingStat.rewardAmount && existingStat.rewardAmount > 0) {
                //console.log(`💰 Снимаем награду ${existingStat.rewardAmount} со старого пользователя ${oldUser.name}`);
                
                // Снимаем награду у старого пользователя
                await deductRewardFromUser(oldUser, existingStat.rewardAmount, monitor, topicMonitor, context);
                
                // Уведомляем старого пользователя о переводе
                await notifyUserOfRewardTransfer(oldUser, targetUser, topicMonitor, monitor, context, existingStat.rewardAmount);
            } else {
                //console.log(`ℹ️ У старого пользователя ${oldUser.name} не было награды для снятия`);
            }
            
            // 2. Обрабатываем нового пользователя (с учетом объема)
            //console.log(`🎯 Обработка нового пользователя ${targetUser.name}`);
            
            // Проверяем объем для нового пользователя
            if (belowMinPcLines) {
                //console.log(`⚠ Новый пост ниже минималки (${checkPcLines} < ${minPcLines}), награда НЕ начисляется`);
                // Просто сохраняем статистику без награды
                await savePostStats(topicMonitor, targetUser, context, stats, action, false, 0);
                
                // Уведомляем нового пользователя (если ниже минималки)
                await sendBelowMinNotification(targetUser, topicMonitor, monitor, context, stats, displayPc, action, uidSpecified, specifiedUid);
                
                // Логируем в чат (смена пользователя, но без награды)
                const coinId = monitor.id_topic_coin ?? monitor.id_coin;
                const coin = coinId ? await prisma.allianceCoin.findFirst({ where: { id: coinId } }) : undefined;
                await logToTopicChat(topicMonitor, targetUser, monitor, action, stats, displayPc, 0, coin, context.id, true, uidSpecified, specifiedUid);
                
                processingPosts.delete(processingKey);
                return;
            } else {
                // Объем достаточный, рассчитываем и начисляем награду
                const newRewardAmount = calculateReward(topicMonitor, stats.characters);
                
                if (newRewardAmount > 0) {
                    //console.log(`💰 Начисляем награду ${newRewardAmount} новому пользователю ${targetUser.name}`);
                    
                    // Начисляем награду новому пользователю
                    await addRewardToUser(targetUser, newRewardAmount, monitor, topicMonitor, context);
                    
                    // Сохраняем статистику с наградой
                    await savePostStats(topicMonitor, targetUser, context, stats, action, true, newRewardAmount);
                    
                    // Уведомляем нового пользователя
                    await notifyUserOfEditWithTransfer(targetUser, topicMonitor, monitor, context, stats, displayPc, newRewardAmount, uidSpecified, specifiedUid);
                    
                    // Логируем в чат (смена пользователя с наградой)
                    await logToTopicChat(topicMonitor, targetUser, monitor, action, stats, displayPc, newRewardAmount, undefined, context.id, false, uidSpecified, specifiedUid);
                    
                    processingPosts.delete(processingKey);
                    return;
                } else {
                    // Награда 0 (ниже rewardMinLines)
                    //console.log(`ℹ️ Объем достаточный, но награда 0 (ниже rewardMinLines)`);
                    await savePostStats(topicMonitor, targetUser, context, stats, action, false, 0);
                    
                    // Уведомление о посте без награды
                    await notifyUserOfNewPostNoReward(targetUser, topicMonitor, monitor, context, stats, displayPc, uidSpecified, specifiedUid);
                    
                    await logToTopicChat(topicMonitor, targetUser, monitor, action, stats, displayPc, 0, undefined, context.id, false, uidSpecified, specifiedUid);
                    
                    processingPosts.delete(processingKey);
                    return;
                }
            }
        }
        
        // Если пользователь НЕ менялся
        if (!userChanged) {
            //console.log(`👤 Пользователь не изменился: ${targetUser.name}`);
            
            // Проверяем объем
            if (belowMinPcLines) {
                //console.log(`⚠ Пост ниже минималки (${checkPcLines} < ${minPcLines})`);
                
                if (existingStat && existingStat.rewardGiven && existingStat.rewardAmount && existingStat.rewardAmount > 0) {
                    // Была награда - снимаем
                    //console.log(`📉 Была награда ${existingStat.rewardAmount}, снимаем`);
                    
                    // Проверяем, что action подходит для handleRewardReduction
                    if (action === 'edit' || action === 'restore') {
                        await handleRewardReduction(
                            topicMonitor, 
                            existingStat, 
                            monitor, 
                            targetUser,
                            context, 
                            stats, 
                            displayPc,
                            action,
                            uidSpecified,
                            specifiedUid
                        );
                    } else {
                        // Для 'new' используем другую логику
                        //console.log(`ℹ️ Новый пост ниже минималки, награда не начислена`);
                        await sendBelowMinNotification(targetUser, topicMonitor, monitor, context, stats, displayPc, action, uidSpecified, specifiedUid);
                    }
                } else {
                    // Не было награды или её не было
                    await sendBelowMinNotification(targetUser, topicMonitor, monitor, context, stats, displayPc, action, uidSpecified, specifiedUid);
                }
                
                // Сохраняем статистику без награды
                await savePostStats(topicMonitor, targetUser, context, stats, action, false, 0);
                await logToTopicChat(topicMonitor, targetUser, monitor, action, stats, displayPc, existingStat?.rewardAmount ? -existingStat.rewardAmount : 0, null, context.id, true, uidSpecified, specifiedUid);
                
                processingPosts.delete(processingKey);
                return;
            }
            
            // Объем достаточный
            const newRewardAmount = calculateReward(topicMonitor, stats.characters);
            const rewardGiven = newRewardAmount > 0;
            
            // Сохраняем статистику
            await savePostStats(topicMonitor, targetUser, context, stats, action, rewardGiven, newRewardAmount);
            
            // Рассчитываем изменение награды
            const rewardChange = newRewardAmount - (existingStat?.rewardAmount || 0);
            
            // Получаем текущий баланс ДО изменений
            const coinId = monitor.id_topic_coin ?? monitor.id_coin;
            const currentBalance = await prisma.balanceCoin.findFirst({ 
                where: { id_coin: coinId ?? 0, id_user: targetUser.id } 
            });
            const currentBalanceAmount = currentBalance?.amount || 0;
            
            //console.log(`💰 Расчет награды: старая=${oldReward}, новая=${newRewardAmount}, изменение=${rewardChange}, текущий баланс=${currentBalanceAmount}`);
            
            if (action === 'edit' || action === 'restore') {
                // Обрабатываем изменение награды при редактировании
                await handlePostRewardsAndNotifications(
                    topicMonitor, targetUser, context, stats, displayPc, monitor, action, 
                    existingStat?.rewardAmount || 0, oldDisplayPc, newRewardAmount,
                    uidSpecified, specifiedUid, false, oldTargetUserId,
                    currentBalanceAmount // Передаем текущий баланс
                );
            } else if (action === 'new') {
                // Новый пост
                if (rewardGiven) {
                    await addRewardToUser(targetUser, newRewardAmount, monitor, topicMonitor, context);
                    await notifyUserOfNewPost(targetUser, topicMonitor, monitor, context, stats, displayPc, newRewardAmount, uidSpecified, specifiedUid);
                } else {
                    await notifyUserOfNewPostNoReward(targetUser, topicMonitor, monitor, context, stats, displayPc, uidSpecified, specifiedUid);
                }
                await logToTopicChat(topicMonitor, targetUser, monitor, action, stats, displayPc, newRewardAmount, null, context.id, false, uidSpecified, specifiedUid);
            }
        }

        //console.log(`✅ Пост ${context.id} успешно обработан (${action})\n`);
        processingPosts.delete(processingKey);

    } catch (error) {
        console.error(`❌ Ошибка обработки поста в обсуждении: ${error}`);
        // Очищаем маркер обработки даже при ошибке
        const processingKey = `${monitor.id}_${context.topicId}_${context.id}`;
        try {
            processingPosts.delete(processingKey);
        } catch (error) {
            console.error(error);
        }
    }
}

// Глобальная мапа для отслеживания обрабатываемых постов
const processingPosts = new Map<string, number>();

// Снять награду у пользователя
async function deductRewardFromUser(user: any, amount: number, monitor: any, topicMonitor: any, context: BoardPostContext) {
    // ИСПРАВЛЕНО: Используем валюту обсуждений, если она задана
    const coinId = monitor.id_topic_coin ?? monitor.id_coin;
    const balance = await prisma.balanceCoin.findFirst({ 
        where: { id_coin: coinId ?? 0, id_user: user.id } 
    });
    
    if (balance) {
        await prisma.balanceCoin.update({
            where: { id: balance.id },
            data: { amount: balance.amount - amount }
        });
        
        // Снимаем с факультета если есть
        if (user.id_facult) {
            const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
            if (coin?.point) {
                const facultBalance = await prisma.balanceFacult.findFirst({
                    where: { 
                        id_coin: coinId ?? 0,
                        id_facult: user.id_facult
                    }
                });
                
                if (facultBalance) {
                    await prisma.balanceFacult.update({
                        where: { id: facultBalance.id },
                        data: { amount: facultBalance.amount - amount }
                    });
                }
            }
        }
    }
}

// Добавить награду пользователю
async function addRewardToUser(user: any, amount: number, monitor: any, topicMonitor: any, context: BoardPostContext) {
    // ИСПРАВЛЕНО: Используем валюту обсуждений, если она задана
    const coinId = monitor.id_topic_coin ?? monitor.id_coin;
    const balance = await prisma.balanceCoin.findFirst({ 
        where: { id_coin: coinId ?? 0, id_user: user.id } 
    });
    
    if (balance) {
        await prisma.balanceCoin.update({
            where: { id: balance.id },
            data: { amount: balance.amount + amount }
        });
        
        // Добавляем факультету если есть
        if (user.id_facult) {
            const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
            if (coin?.point) {
                const facultBalance = await prisma.balanceFacult.findFirst({
                    where: { 
                        id_coin: coinId ?? 0,
                        id_facult: user.id_facult
                    }
                });
                
                if (facultBalance) {
                    await prisma.balanceFacult.update({
                        where: { id: facultBalance.id },
                        data: { amount: facultBalance.amount + amount }
                    });
                }
            }
        }
    }
}

// Уведомить пользователя о переводе награды
async function notifyUserOfRewardTransfer(oldUser: any, newUser: any, topicMonitor: any, monitor: any, context: BoardPostContext, amount: number) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: oldUser.idvk } 
    });
    
    if (account && oldUser.notification_topic) {
        const coinId = monitor.id_topic_coin ?? monitor.id_coin;
        const coin = await prisma.allianceCoin.findFirst({ 
            where: { id: coinId ?? 0 } 
        });
        let balanceText = '';
        if (coin) {
            const balance = await prisma.balanceCoin.findFirst({ 
                where: { id_coin: coin.id, id_user: oldUser.id } 
            });
            
            if (balance) {
                if (oldUser.id_facult && coin.point) {
                    const facult = await prisma.allianceFacult.findFirst({ 
                        where: { id: oldUser.id_facult } 
                    });
                    
                    if (facult) {
                        balanceText = `\n💳 Ваш баланс: ${balance.amount + amount} - ${amount} = ${balance.amount}${coin.smile} для факультета [${facult.smile} ${facult.name}]`;
                    }
                } else {
                    balanceText = `\n💳 Ваш баланс: ${balance.amount + amount} - ${amount} = ${balance.amount}${coin.smile}`;
                }
            }
        }
        
        const message = `⚠ ${oldUser.name} (UID: ${oldUser.id}), награда переведена другому персонажу!\n` +
                       `📝 Ваш пост в обсуждении "${topicMonitor.name}" был изменен.\n` +
                       `👤 Новый владелец: ${newUser.name} (UID: ${newUser.id})${balanceText}\n` +
                       `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        
        await Send_Message(account.idvk, message);
    }
}

// Уведомить пользователя о редактировании с переводом
async function notifyUserOfEditWithTransfer(user: any, topicMonitor: any, monitor: any, context: BoardPostContext, stats: any, displayPc: number, amount: number, uidSpecified: boolean, specifiedUid: number | null) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        const coinId = monitor.id_topic_coin ?? monitor.id_coin;
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        const balance = await prisma.balanceCoin.findFirst({ 
            where: { id_coin: coinId ?? 0, id_user: user.id } 
        });        
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
        
        let balanceText = '';
        if (balance && coin) {
            const oldBalance = balance.amount - amount;
            if (user.id_facult && coin.point) {
                const facult = await prisma.allianceFacult.findFirst({ 
                    where: { id: user.id_facult } 
                });
                
                if (facult) {
                    balanceText = `💳 Ваш баланс: ${oldBalance} + ${amount} = ${balance.amount}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                }
            } else {
                balanceText = `💳 Ваш баланс: ${oldBalance} + ${amount} = ${balance.amount}${coin.smile}\n`;
            }
        }
        
        const message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" отредактирован!${uidInfo}\n` +
                       `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                       `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n` +
                       `🔄 Награда ${amount} переведена с другого персонажа\n` +
                       balanceText +
                       `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        
        await Send_Message(account.idvk, message);
    }
}

// Уведомить о новом посте с наградой
async function notifyUserOfNewPost(user: any, topicMonitor: any, monitor: any, context: BoardPostContext, stats: any, displayPc: number, amount: number, uidSpecified: boolean, specifiedUid: number | null) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        const coinId = monitor.id_topic_coin ?? monitor.id_coin;
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        const balance = await prisma.balanceCoin.findFirst({ 
            where: { id_coin: coinId ?? 0, id_user: user.id } 
        });        
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
        
        let balanceText = '';
        if (balance && coin) {
            const oldBalance = balance.amount - amount;
            if (user.id_facult && coin.point) {
                const facult = await prisma.allianceFacult.findFirst({ 
                    where: { id: user.id_facult } 
                });
                
                if (facult) {
                    balanceText = `💳 Ваш баланс: ${oldBalance} + ${amount} = ${balance.amount}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                }
            } else {
                balanceText = `💳 Ваш баланс: ${oldBalance} + ${amount} = ${balance.amount}${coin.smile}\n`;
            }
        }
        
        const message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" засчитан!${uidInfo}\n` +
                       `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                       `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n` +
                       balanceText +
                       `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        
        await Send_Message(account.idvk, message);
    }
}

// Уведомить о новом посте без награды
async function notifyUserOfNewPostNoReward(user: any, topicMonitor: any, monitor: any, context: BoardPostContext, stats: any, displayPc: number, uidSpecified: boolean, specifiedUid: number | null) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        const coinId = monitor.id_topic_coin ?? monitor.id_coin;
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        const balance = await prisma.balanceCoin.findFirst({ 
            where: { id_coin: coinId ?? 0, id_user: user.id } 
        });
        
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
        
        let balanceText = '';
        if (balance && coin) {
            if (user.id_facult && coin.point) {
                const facult = await prisma.allianceFacult.findFirst({ 
                    where: { id: user.id_facult } 
                });
                
                if (facult) {
                    balanceText = `💳 Ваш баланс не изменился: ${balance.amount}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                }
            } else {
                balanceText = `💳 Ваш баланс не изменился: ${balance.amount}${coin.smile}\n`;
            }
        }
        
        const message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" засчитан!${uidInfo}\n` +
                       `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                       `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n` +
                       `ℹ️ Пост зафиксирован, но не принес награды\n` +
                       balanceText +
                       `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        
        await Send_Message(account.idvk, message);
    }
}

// Сохранение статистики поста
async function savePostStats(
    topicMonitor: any, 
    targetUser: any,
    context: BoardPostContext, 
    stats: any, 
    action: string,
    rewardGiven: boolean,
    rewardAmount: number
) {
    return await prisma.postStatistic.upsert({
        where: {
            topicMonitorId_postId: {
                topicMonitorId: topicMonitor.id,
                postId: context.id
            }
        },
        update: {
            characters: stats.characters,
            words: stats.words,
            pc: stats.pc,
            mb: stats.mb,
            date: new Date(),
            action: action,
            userId: targetUser.id,
            rewardGiven: rewardGiven,
            rewardAmount: rewardAmount
        },
        create: {
            topicMonitorId: topicMonitor.id,
            userId: targetUser.id,
            postId: context.id,
            characters: stats.characters,
            words: stats.words,
            pc: stats.pc,
            mb: stats.mb,
            date: new Date(),
            action: action,
            rewardGiven: rewardGiven,
            rewardAmount: rewardAmount
        }
    });
}

// Обработка удаления поста
async function handlePostDeletion(topicMonitor: any, postId: number, monitor: any, fromId?: number, topicId?: number) {
    // Находим статистику поста
    const postStat = await prisma.postStatistic.findFirst({
        where: {
            topicMonitorId: topicMonitor.id,
            postId: postId
        }
    });

    let user = null;
    
    // Если статистика найдена, ищем пользователя по userId
    if (postStat) {
        user = await prisma.user.findFirst({
            where: {
                id: postStat.userId,
                id_alliance: monitor.id_alliance
            }
        });
    } 
    // Если статистики нет, но есть fromId, ищем пользователя
    else if (fromId) {
        user = await prisma.user.findFirst({
            where: {
                idvk: fromId,
                id_alliance: monitor.id_alliance
            }
        });
    }

    if (!user) {
        //console.log(`⚠ Пользователь не найден для поста ${postId}`);
        // Если была статистика, удаляем ее
        if (postStat) {
            await prisma.postStatistic.delete({
                where: {
                    topicMonitorId_postId: {
                        topicMonitorId: topicMonitor.id,
                        postId: postId
                    }
                }
            });
        }
        return;
    }
    
    // Получаем баланс пользователя
    const coinId = monitor.id_topic_coin ?? monitor.id_coin;
    const balance = await prisma.balanceCoin.findFirst({ 
        where: { id_coin: coinId ?? 0, id_user: user.id } 
    });
    const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
    
    if (!balance || !coin) {
        //console.log(`⚠ Баланс не найден для пользователя ${user.name}`);
        // Все равно удаляем статистику если она была
        if (postStat) {
            await prisma.postStatistic.delete({
                where: {
                    topicMonitorId_postId: {
                        topicMonitorId: topicMonitor.id,
                        postId: postId
                    }
                }
            });
        }
        return;
    }
    
    let message = '';
    let newBalance = balance.amount;
    let rewardAmount = 0;
    
    if (postStat && postStat.rewardGiven && postStat.rewardAmount && postStat.rewardAmount > 0) {
        // Если была награда - снимаем ее
        rewardAmount = postStat.rewardAmount;
        //console.log(`💰 Снятие награды за удаленный пост: ${rewardAmount}`);
        
        newBalance = balance.amount - rewardAmount;
        
        // Обновляем баланс
        await prisma.balanceCoin.update({
            where: { id: balance.id },
            data: { amount: newBalance }
        });
        
        // Формируем сообщение с учетом факультета
        if (user.id_facult && coin.point) {
            const facult = await prisma.allianceFacult.findFirst({ 
                where: { id: user.id_facult } 
            });
            
            if (facult) {
                message = `🗑️ ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" удален!\n` +
                         `📊 Статистика: ${postStat.words} слов, ${postStat.characters} символов\n` +
                         `💻 ПК: ${getPcLinesForDisplay(postStat.pc)}, 📱 МБ: ${postStat.mb.toFixed(2)}\n` +
                         `💳 Ваш баланс: ${balance.amount} - ${rewardAmount} = ${newBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]`;
            } else {
                message = `🗑️ ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" удален!\n` +
                         `📊 Статистика: ${postStat.words} слов, ${postStat.characters} символов\n` +
                         `💻 ПК: ${getPcLinesForDisplay(postStat.pc)}, 📱 МБ: ${postStat.mb.toFixed(2)}\n` +
                         `💳 Ваш баланс: ${balance.amount} - ${rewardAmount} = ${newBalance}${coin.smile}`;
            }
        } else {
            message = `🗑️ ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" удален!\n` +
                     `📊 Статистика: ${postStat.words} слов, ${postStat.characters} символов\n` +
                     `💻 ПК: ${getPcLinesForDisplay(postStat.pc)}, 📱 МБ: ${postStat.mb.toFixed(2)}\n` +
                     `💳 Ваш баланс: ${balance.amount} - ${rewardAmount} = ${newBalance}${coin.smile}`;
        }
    } else if (postStat) {
        // Была статистика, но без награды
        message = `🗑️ ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" удален!\n` +
                 `📊 Статистика: ${postStat.words} слов, ${postStat.characters} символов\n` +
                 `💻 ПК: ${getPcLinesForDisplay(postStat.pc)}, 📱 МБ: ${postStat.mb.toFixed(2)}\n` +
                 `ℹ️ Пост был зафиксирован, но не принес награды\n` +
                 `💳 Ваш баланс не изменился: ${balance.amount}${coin.smile}`;
    } else {
        // Не было статистики (например, пост был ниже минималки)
        const minPcLines = topicMonitor.minPcLines ?? 0;
        const hasMinPcLines = minPcLines > 0;
        const minPcText = hasMinPcLines ? ` (минимальный объем: ${minPcLines} ПК строк)` : '';
        
        message = `🗑️ ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" удален!\n` +
                 `ℹ️ Пост был удален${minPcText}\n` +
                 `💳 Ваш баланс не изменился: ${balance.amount}${coin.smile}`;
    }
    
    // Добавляем ссылку если есть topicId
    if (topicId) {
        message += `\n🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${topicId}?post=${postId}`;
    }
    
    // Удаляем статистику если она была
    if (postStat) {
        await prisma.postStatistic.delete({
            where: {
                topicMonitorId_postId: {
                    topicMonitorId: topicMonitor.id,
                    postId: postId
                }
            }
        });
        //console.log(`🗑️ Статистика поста ${postId} удалена`);
    }
    
    // Отправляем уведомление если пользователь найден и включены уведомления ОБСУЖДЕНИЙ
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        try {
            await Send_Message(account.idvk, message);
            //console.log(`📨 Уведомление об удалении отправлено пользователю ${user.name}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки уведомления об удаления: ${error}`);
        }
    }
    
    // ЛОГИРУЕМ В ЧАТ ОБСУЖДЕНИЙ (ВСЕГДА, независимо от notification_topic)
    if (postStat) {
        const rewardChange = rewardAmount > 0 ? -rewardAmount : 0;
        await logToTopicChat(topicMonitor, user, monitor, 'delete', {
            words: postStat.words,
            characters: postStat.characters,
            pc: postStat.pc,
            mb: postStat.mb
        }, getPcLinesForDisplay(postStat.pc), rewardChange, coin, postId);
    }
}

// Обработка снятия награды при редактировании ниже минималки
async function handleRewardReduction(
    topicMonitor: any,
    existingStat: any,
    monitor: any,
    user: any,
    context: BoardPostContext,
    stats: any,
    displayPc: number,
    action: 'edit' | 'restore',
    uidSpecified: boolean = false,
    specifiedUid: number | null = null
) {
    // Получаем баланс
    const coinId = monitor.id_topic_coin ?? monitor.id_coin;
    const balance = await prisma.balanceCoin.findFirst({ 
        where: { id_coin: coinId ?? 0, id_user: user.id } 
    });
    const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
    
    if (!balance || !coin) return;
    
    // Снимаем награду
    const newBalance = balance.amount - existingStat.rewardAmount;
    
    await prisma.balanceCoin.update({
        where: { id: balance.id },
        data: { amount: newBalance }
    });
    
    // Добавляем информацию об указанном UID
    const uidInfo = uidSpecified && specifiedUid ? 
        `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
    
    // Отправляем уведомление
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        const actionText = action === 'edit' ? 'отредактирован' : 'восстановлен';
        const minPcLines = topicMonitor.minPcLines ?? 0;
        const minPcText = minPcLines > 0 ? ` (минимальный объем: ${minPcLines} ПК строк)` : '';
        
        // ДИНАМИЧЕСКОЕ СООБЩЕНИЕ
        let customMessage = "";
        if (topicMonitor.minPcMessage && topicMonitor.minPcMessage.trim() !== "") {
            customMessage = topicMonitor.minPcMessage;
        } else {
            customMessage = `⚠ Объем ниже минимального, награда снята!`;
        }
        
        // Формируем сообщение с учетом факультета
        let balanceText = '';
        if (user.id_facult && coin.point) {
            const facult = await prisma.allianceFacult.findFirst({ 
                where: { id: user.id_facult } 
            });
            
            if (facult) {
                balanceText = `💳 Ваш баланс: ${balance.amount} - ${existingStat.rewardAmount} = ${newBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
            } else {
                balanceText = `💳 Ваш баланс: ${balance.amount} - ${existingStat.rewardAmount} = ${newBalance}${coin.smile}\n`;
            }
        } else {
            balanceText = `💳 Ваш баланс: ${balance.amount} - ${existingStat.rewardAmount} = ${newBalance}${coin.smile}\n`;
        }
        
        const message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" ${actionText}!${uidInfo}\n` +
                       `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                       `💻 ПК: ${displayPc}${minPcText}\n` +
                       `${customMessage}\n` +
                       `${balanceText}` +
                       `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        
        try {
            await Send_Message(account.idvk, message);
            //console.log(`📨 Уведомление о снятии награды отправлено пользователю ${user.name}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки уведомления: ${error}`);
        }
    }
}

// Отправка уведомления о посте ниже минималки
async function sendBelowMinNotification(
    targetUser: any,
    topicMonitor: any,
    monitor: any,
    context: BoardPostContext,
    stats: any,
    displayPc: number,
    action: 'new' | 'edit' | 'restore',
    uidSpecified: boolean = false,
    specifiedUid: number | null = null
) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: targetUser.idvk } 
    });
    
    if (!account || !targetUser.notification_topic) {
        //console.log(`⚠ Уведомления об обсуждениях отключены для пользователя ${targetUser.name}`);
        return;
    }
    
    // Получаем баланс для информации
    const coinId = monitor.id_topic_coin ?? monitor.id_coin;
    const balance = await prisma.balanceCoin.findFirst({ 
        where: { id_coin: coinId ?? 0, id_user: targetUser.id } 
    });
    const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
    
    let balanceText = '';
    if (balance && coin) {
        if (targetUser.id_facult && coin.point) {
            const facult = await prisma.allianceFacult.findFirst({ 
                where: { id: targetUser.id_facult } 
            });
            
            if (facult) {
                balanceText = `💳 Ваш баланс: ${balance.amount}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
            } else {
                balanceText = `💳 Ваш баланс: ${balance.amount}${coin.smile}\n`;
            }
        } else {
            balanceText = `💳 Ваш баланс: ${balance.amount}${coin.smile}\n`;
        }
    }
    
    const minPcLines = topicMonitor.minPcLines ?? 0;
    const minPcText = minPcLines > 0 ? ` (минимальный объем: ${minPcLines} ПК строк)` : '';
    
    // Добавляем информацию об указанном UID
    const uidInfo = uidSpecified && specifiedUid ? 
        `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
    
    // Проверяем, была ли награда у исходного поста (для edit/restore)
    let hadReward = false;
    let customMessage = "";
    
    if (action === 'edit' || action === 'restore') {
        const existingStat = await prisma.postStatistic.findFirst({
            where: {
                topicMonitorId: topicMonitor.id,
                postId: context.id
            }
        });
        // Явная проверка существования и наличия награды
        hadReward = existingStat ? 
                   (existingStat.rewardGiven === true && (existingStat.rewardAmount || 0) > 0) : 
                   false;
    }
    
    // ДИНАМИЧЕСКОЕ СООБЩЕНИЕ
    if (topicMonitor.minPcMessage && topicMonitor.minPcMessage.trim() !== "") {
        customMessage = topicMonitor.minPcMessage;
    } else {
        // Автоматическое сообщение в зависимости от ситуации
        if (action === 'new') {
            customMessage = "ℹ️ Пост зафиксирован, но не принес награды";
        } else if (action === 'edit' || action === 'restore') {
            if (hadReward) {
                customMessage = "⚠ Объем ниже минимального, награда снята!";
            } else {
                customMessage = "ℹ️ Пост зафиксирован, но не принес награды";
            }
        }
    }
    
    let actionText = '';
    switch (action) {
        case 'new': actionText = 'создан'; break;
        case 'edit': actionText = 'отредактирован'; break;
        case 'restore': actionText = 'восстановлен'; break;
    }
    
    const message = `📝 ${targetUser.name} (UID: ${targetUser.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" ${actionText}!${uidInfo}\n` +
                   `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                   `💻 ПК: ${displayPc}${minPcText}\n` +
                   `${customMessage}\n` +
                   `${balanceText}` +
                   `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
    
    try {
        await Send_Message(account.idvk, message);
        //console.log(`📨 Уведомление о посте ниже минималки отправлено пользователю ${targetUser.name}`);
    } catch (error) {
        console.error(`❌ Ошибка отправки уведомления: ${error}`);
    }
}

// Обработка наград и уведомлений (для new, edit и restore при достаточном объеме)
async function handlePostRewardsAndNotifications(
    topicMonitor: any, user: any, context: BoardPostContext, stats: any, 
    displayPc: number, monitor: any, action: 'new' | 'edit' | 'restore',
    oldReward: number, oldDisplayPc: number, newRewardAmount: number,
    uidSpecified: boolean = false,
    specifiedUid: number | null = null,
    rewardTransferNeeded: boolean = false,
    oldTargetUserId: number | null = null,
    currentBalanceAmount: number = 0 // ДОБАВЛЕНО: текущий баланс перед изменениями
) {
    try {
        const account = await prisma.account.findFirst({ 
            where: { idvk: context.fromId } 
        });
        
        // Получаем валюту
        const coinId = monitor.id_topic_coin ?? monitor.id_coin;
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        
        if (!coin) {
            //console.log(`⚠ Валюта не найдена для монитора ${monitor.id}`);
            return;
        }
        
        // Получаем ТЕКУЩИЙ баланс пользователя (если не передан)
        let userBalance = currentBalanceAmount;
        if (userBalance === 0) {
            const balanceRecord = await prisma.balanceCoin.findFirst({ 
                where: { id_coin: coinId ?? 0, id_user: user.id } 
            });
            userBalance = balanceRecord?.amount || 0;
        }
        
        //console.log(`🎯 Обработка наград: действие=${action}, старая награда=${oldReward}, новая награда=${newRewardAmount}, текущий баланс=${userBalance}`);
        
        let message = '';
        let rewardChange = 0;
        let newBalance = userBalance;
        
        // Добавляем информацию об указанном UID
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
        
        if (action === 'new') {
            // Новый пост с достаточным объемом
            message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" засчитан!${uidInfo}\n` +
                     `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                     `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n`;
            
            if (newRewardAmount > 0) {
                const oldBalance = userBalance;
                newBalance = oldBalance + newRewardAmount;
                rewardChange = newRewardAmount;
                
                // Обновляем баланс
                await updateUserBalance(user.id, coinId, newBalance);
                
                if (user.id_facult && coin?.point) {
                    const facult = await prisma.allianceFacult.findFirst({ 
                        where: { id: user.id_facult } 
                    });
                    
                    if (facult) {
                        message += `💳 Ваш баланс: ${oldBalance} + ${newRewardAmount} = ${newBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                    } else {
                        message += `💳 Ваш баланс: ${oldBalance} + ${newRewardAmount} = ${newBalance}${coin.smile}\n`;
                    }
                } else {
                    message += `💳 Ваш баланс: ${oldBalance} + ${newRewardAmount} = ${newBalance}${coin.smile}\n`;
                }
                
                rewardChange = newRewardAmount;
            } else {
                if (user.id_facult && coin?.point) {
                    const facult = await prisma.allianceFacult.findFirst({ 
                        where: { id: user.id_facult } 
                    });
                    
                    if (facult) {
                        message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                    } else {
                        message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                    }
                } else {
                    message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                }
            }
            
            message += `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
            
        } else if (action === 'edit') {
            // Редактирование поста с достаточным объемом
            const volumeChange = oldDisplayPc !== displayPc ? ` (было ${oldDisplayPc} ПК строк, стало ${displayPc} ПК строк)` : '';
            
            message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" отредактирован${volumeChange}!${uidInfo}\n` +
                     `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                     `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n`;
            
            if (rewardTransferNeeded) {
                // Особый случай: награда переведена от другого персонажа
                //console.log(`🔄 Обработка перевода награды от другого персонажа`);
                
                if (oldReward > 0 && newRewardAmount > 0) {
                    // Переводим награду от старого к новому пользователю
                    const oldBalance = userBalance;
                    newBalance = oldBalance + newRewardAmount; // Уже сняли у старого, начисляем новому
                    rewardChange = newRewardAmount;
                    
                    // Обновляем баланс
                    await updateUserBalance(user.id, coinId, newBalance);
                    
                    if (user.id_facult && coin?.point) {
                        const facult = await prisma.allianceFacult.findFirst({ 
                            where: { id: user.id_facult } 
                        });
                        
                        if (facult) {
                            message += `🔄 Награда ${oldReward} переведена с другого персонажа\n`;
                            message += `💳 Ваш баланс: ${oldBalance} + ${newRewardAmount} = ${newBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                        } else {
                            message += `🔄 Награда ${oldReward} переведена с другого персонажа\n`;
                            message += `💳 Ваш баланс: ${oldBalance} + ${newRewardAmount} = ${newBalance}${coin.smile}\n`;
                        }
                    } else {
                        message += `🔄 Награда ${oldReward} переведена с другого персонажа\n`;
                        message += `💳 Ваш баланс: ${oldBalance} + ${newRewardAmount} = ${newBalance}${coin.smile}\n`;
                    }
                } else if (oldReward > 0 && newRewardAmount === 0) {
                    // У старого была награда, у нового нет (уже сняли у старого)
                    message += `🔄 Награда ${oldReward} снята с другого персонажа\n`;
                    message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                } else {
                    message += `🔄 Изменен целевой персонаж, награда не изменилась\n`;
                    message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                }
            } else if (newRewardAmount !== oldReward) {
                // Обычное изменение награды (без смены пользователя)
                rewardChange = newRewardAmount - oldReward;
                const oldBalance = userBalance;
                newBalance = oldBalance + rewardChange;
                
                //console.log(`📈 Изменение награды: ${oldReward} → ${newRewardAmount}, изменение=${rewardChange}, баланс ${oldBalance} → ${newBalance}`);
                
                // Обновляем баланс
                await updateUserBalance(user.id, coinId, newBalance);
                
                if (user.id_facult && coin?.point) {
                    const facult = await prisma.allianceFacult.findFirst({ 
                        where: { id: user.id_facult } 
                    });
                    
                    if (facult) {
                        const operation = rewardChange > 0 ? '+' : '-';
                        const amount = Math.abs(rewardChange);
                        
                        message += `💳 Ваш баланс: ${oldBalance} ${operation} ${amount} = ${newBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                    } else {
                        const operation = rewardChange > 0 ? '+' : '-';
                        const amount = Math.abs(rewardChange);
                        
                        message += `💳 Ваш баланс: ${oldBalance} ${operation} ${amount} = ${newBalance}${coin.smile}\n`;
                    }
                } else {
                    const operation = rewardChange > 0 ? '+' : '-';
                    const amount = Math.abs(rewardChange);
                    
                    message += `💳 Ваш баланс: ${oldBalance} ${operation} ${amount} = ${newBalance}${coin.smile}\n`;
                }
            } else {
                // Награда не изменилась
                if (newRewardAmount > 0) {
                    // Награда осталась той же
                    if (user.id_facult && coin?.point) {
                        const facult = await prisma.allianceFacult.findFirst({ 
                            where: { id: user.id_facult } 
                        });
                        
                        if (facult) {
                            message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                        } else {
                            message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                        }
                    } else {
                        message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                    }
                } else {
                    // Награды нет
                    message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                }
            }
            
            message += `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
            
        } else if (action === 'restore') {
            // Восстановление поста с достаточным объемом
            message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" восстановлен!${uidInfo}\n` +
                     `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                     `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n`;
            
            if (newRewardAmount > 0) {
                if (oldReward > 0 && newRewardAmount === oldReward) {
                    // Была награда и снова такая же
                    if (user.id_facult && coin?.point) {
                        const facult = await prisma.allianceFacult.findFirst({ 
                            where: { id: user.id_facult } 
                        });
                        
                        if (facult) {
                            message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                        } else {
                            message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                        }
                    } else {
                        message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                    }
                } else {
                    // Вычисляем разницу между новой и старой наградой
                    rewardChange = newRewardAmount - oldReward;
                    const oldBalance = userBalance;
                    newBalance = oldBalance + rewardChange;
                    
                    //console.log(`↩️ Восстановление: изменение награды ${rewardChange}, баланс ${oldBalance} → ${newBalance}`);
                    
                    // Обновляем баланс
                    await updateUserBalance(user.id, coinId, newBalance);
                    
                    if (user.id_facult && coin?.point) {
                        const facult = await prisma.allianceFacult.findFirst({ 
                            where: { id: user.id_facult } 
                        });
                        
                        if (facult) {
                            const operation = rewardChange > 0 ? '+' : '-';
                            const amount = Math.abs(rewardChange);
                            
                            message += `💳 Ваш баланс: ${oldBalance} ${operation} ${amount} = ${newBalance}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
                        } else {
                            const operation = rewardChange > 0 ? '+' : '-';
                            const amount = Math.abs(rewardChange);
                            
                            message += `💳 Ваш баланс: ${oldBalance} ${operation} ${amount} = ${newBalance}${coin.smile}\n`;
                        }
                    } else {
                        const operation = rewardChange > 0 ? '+' : '-';
                        const amount = Math.abs(rewardChange);
                        
                        message += `💳 Ваш баланс: ${oldBalance} ${operation} ${amount} = ${newBalance}${coin.smile}\n`;
                    }
                }
            } else if (oldReward > 0) {
                // Была награда, теперь нет (уже обработано в handleRewardReduction)
                message += `ℹ️ Ранее была награда ${oldReward}${coin.smile}, но сейчас не начислена\n`;
                message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
            } else {
                // Никогда не было награды
                message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
            }
            
            message += `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        }
        
        // Обновляем баланс факультета если нужно
        if (rewardChange !== 0 && user.id_facult && coin?.point) {
            await updateFacultBalance(user.id_facult, coinId, rewardChange);
        }
        
        // Отправляем уведомление пользователю если включены уведомления
        if (account && user.notification_topic) {
            try {
                await Send_Message(account.idvk, message);
                //console.log(`📨 Уведомление отправлено пользователю ${user.name} (${action})`);
            } catch (error) {
                console.error(`❌ Ошибка отправки уведомления: ${error}`);
            }
        }
        
        // ЛОГИРУЕМ В ЧАТ ОБСУЖДЕНИЙ (ВСЕГДА, независимо от notification_topic)
        await logToTopicChat(topicMonitor, user, monitor, action, stats, displayPc, rewardChange, coin, context.id, false, uidSpecified, specifiedUid);
        
    } catch (error) {
        console.error(`❌ Ошибка в handlePostRewardsAndNotifications: ${error}`);
    }
}

// Вспомогательная функция для обновления баланса пользователя
async function updateUserBalance(userId: number, coinId: number | null, newAmount: number) {
    if (!coinId) return;
    
    // Ищем существующую запись баланса
    const existingBalance = await prisma.balanceCoin.findFirst({
        where: {
            id_coin: coinId,
            id_user: userId
        }
    });
    
    if (existingBalance) {
        // Обновляем существующую запись по id
        await prisma.balanceCoin.update({
            where: { id: existingBalance.id },
            data: { amount: newAmount }
        });
    } else {
        // Создаем новую запись
        await prisma.balanceCoin.create({
            data: {
                id_coin: coinId,
                id_user: userId,
                amount: newAmount
            }
        });
    }
}

// Вспомогательная функция для обновления баланса факультета
async function updateFacultBalance(facultId: number, coinId: number | null, amountChange: number) {
    if (!coinId || !facultId) return;
    
    const currentBalance = await prisma.balanceFacult.findFirst({
        where: {
            id_coin: coinId,
            id_facult: facultId
        }
    });
    
    if (currentBalance) {
        await prisma.balanceFacult.update({
            where: { id: currentBalance.id },
            data: { amount: currentBalance.amount + amountChange }
        });
    }
}

// Логирование в чат обсуждений (ВСЕГДА, независимо от настроек пользователя)
async function logToTopicChat(
    topicMonitor: any, 
    user: any, 
    monitor: any, 
    action: 'new' | 'edit' | 'restore' | 'delete',
    stats: any,
    displayPc: number,
    rewardChange: number,
    coin?: any,
    postId?: number,
    belowMin?: boolean,
    uidSpecified: boolean = false,
    specifiedUid: number | null = null
) {
    try {
        const coinId = monitor.id_topic_coin ?? monitor.id_coin;
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        // Получаем альянс
        const alliance = await prisma.alliance.findFirst({ 
            where: { id: user.id_alliance ?? 0 } 
        });
        
        if (!alliance?.id_chat_topic || alliance.id_chat_topic === 0) {
            return; // Чат обсуждений не привязан
        }
        
        // Эмодзи для действий
        const actionEmoji = {
            'new': '✅',
            'edit': '✏️',
            'delete': '🗑️',
            'restore': '↩️'
        }[action] || '📝';
        
        // Эмодзи для награды (только если есть изменение)
        const rewardEmoji = rewardChange > 0 ? '💰' : rewardChange < 0 ? '💸' : '';

        // Информация об указанном UID
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Указанный UID: ${specifiedUid}` : '';
        
        // Формируем красивый лог как в мониторах
        let logMessage = `🌐 [${alliance.name}] --> (обсуждение №${monitor.id}):\n`;
        logMessage += `📖 ${topicMonitor.name}\n`;
        logMessage += `👤 @id${user.idvk}(${user.name}) (UID: ${user.id}) --> ${actionEmoji}${rewardEmoji}${uidInfo}\n`;
        
        // Добавляем статистику с округлением до 2 знаков
        logMessage += `📊 ${stats.words} слов | ${stats.characters} симв | ${displayPc.toFixed(2)} ПК | ${stats.mb.toFixed(2)} МБ\n`;
        
        // Получаем текущий баланс пользователя для отображения
        let userBalance = 0;
        if (coin) {
            const balanceCoin = await prisma.balanceCoin.findFirst({
                where: {
                    id_coin: coin.id,
                    id_user: user.id
                }
            });
            userBalance = balanceCoin?.amount || 0;
        }
        
        // Проверяем, нужно ли показывать информацию о факультете
        if (user.id_facult && coin?.point && rewardChange !== 0) {
            const facult = await prisma.allianceFacult.findFirst({ 
                where: { id: user.id_facult } 
            });
            
            if (facult) {
                // Получаем баланс факультета
                const balanceFacult = await prisma.balanceFacult.findFirst({
                    where: { 
                        id_coin: coin.id,
                        id_facult: user.id_facult
                    }
                });
                
                if (balanceFacult) {
                    const oldFacultBalance = balanceFacult.amount;
                    const newFacultBalance = rewardChange > 0 ? 
                        oldFacultBalance + rewardChange : 
                        oldFacultBalance - Math.abs(rewardChange);
                    
                    const operation = rewardChange > 0 ? '+' : '-';
                    const operationSymbol = rewardChange > 0 ? `"${coin.smile}"` : `"${coin.smile}"`;
                    
                    logMessage += `🔮 ${operationSymbol} > ${oldFacultBalance} ${operation} ${Math.abs(rewardChange)} = ${newFacultBalance} для факультета [${facult.smile} ${facult.name}]\n`;
                }
            }
        }
        // Если нет факультета, но есть изменение баланса - показываем в формате "205 + 10 = 215"
        else if (rewardChange !== 0 && coin) {
            const operation = rewardChange > 0 ? '+' : '-';
            const operationSymbol = rewardChange > 0 ? `"${coin.smile}"` : `"${coin.smile}"`;
            const oldBalance = userBalance - rewardChange; // Так проще вычислить старое значение
            
            logMessage += `🔮 ${operationSymbol} > ${oldBalance} ${operation} ${Math.abs(rewardChange)} = ${userBalance}\n`;
        }
        
        // Добавляем ссылку на пост
        if (postId && monitor?.idvk && topicMonitor?.topicId) {
            logMessage += `🔗 https://vk.com/topic${monitor.idvk}_${topicMonitor.topicId}?post=${postId}`;
        }
        
        // Отправляем в чат обсуждений
        await Send_Message(alliance.id_chat_topic, logMessage);
        //console.log(`📨 Лог отправлен в чат обсуждений ${alliance.id_chat_topic}`);
        
    } catch (error) {
        console.error(`❌ Ошибка отправки лога в чат обсуждений: ${error}`);
    }
}

// Парсим ссылку на обсуждение
export function parseTopicUrl(url: string): { topicId: number } | null {
    const patterns = [
        /topic-(\d+)_(\d+)/,
        /[\?&]topic=(\d+)/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            const topicId = parseInt(match[match.length - 1]);
            if (!isNaN(topicId)) {
                return { topicId };
            }
        }
    }

    return null;
}

// Обработчик выбора валюты
export async function Topic_Currency_Select(context: any) {
    try {
        const user = await Person_Get(context);
        if (!user) {
            console.log('❌ Пользователь не найден');
            return null;
        }

        const monitorId = context.eventPayload?.monitorId;
        const coinId = context.eventPayload?.coinId;
        const cursor = context.eventPayload?.cursor || 0;

        if (!monitorId || !coinId) {
            console.log('❌ Не указаны monitorId или coinId');
            return null;
        }

        // Обновляем валюту обсуждений для монитора
        await prisma.monitor.update({
            where: { id: monitorId },
            data: { id_topic_coin: coinId }
        });

        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });
        const monitor = await prisma.monitor.findFirst({ where: { id: monitorId } });

        // Отправляем сообщение через API VK
        const peerId = context.peerId || context.senderId;
        
        // Отвечаем на callback
        await context.answer({
            type: "show_snackbar",
            text: `✅ Валюта установлена: ${coin?.smile} ${coin?.name}`
        });

        // Возвращаем данные для редиректа
        return {
            cursor: cursor,
            stop: false,
            command: 'alliance_topic_monitor_enter',
            monitorId: monitorId
        };

    } catch (error) {
        console.error('❌ Ошибка в Topic_Currency_Select:', error);
        return null;
    }
}

// Обработчик сброса валюты
export async function Topic_Currency_Reset(context: any) {
    try {
        const user = await Person_Get(context);
        if (!user) {
            console.log('❌ Пользователь не найден');
            return;
        }

        const monitorId = context.eventPayload?.monitorId;
        const cursor = context.eventPayload?.cursor || 0;

        if (!monitorId) {
            console.log('❌ Не указан monitorId');
            return;
        }

        // Сбрасываем валюту обсуждений
        await prisma.monitor.update({
            where: { id: monitorId },
            data: { id_topic_coin: null }
        });

        const monitor = await prisma.monitor.findFirst({ where: { id: monitorId } });
        const defaultCoin = monitor?.id_coin 
            ? await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin } })
            : null;

        // Отвечаем на callback
        await context.answer({
            type: "show_snackbar",
            text: `✅ Валюта сброшена. Используется валюта монитора: ${defaultCoin?.smile} ${defaultCoin?.name}`
        });

        // Создаем новый payload для редиректа
        const newPayload = {
            command: 'alliance_topic_monitor_enter',
            cursor: cursor,
            monitorId: monitorId
        };

        // Возвращаемся к управлению обсуждениями
        const eventContext = {
            ...context,
            eventPayload: newPayload
        };
        
        await Alliance_Topic_Monitor_Printer(eventContext);

    } catch (error) {
        console.error('❌ Ошибка в Topic_Currency_Reset:', error);
    }
}