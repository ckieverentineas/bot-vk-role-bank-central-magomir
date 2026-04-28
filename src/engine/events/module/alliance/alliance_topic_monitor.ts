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
import { getMonitorHashtags, addMonitorHashtag, removeMonitorHashtag, extractHashtags } from "./hashtag_manager";
import {
    applyMonitorTopicSettings,
    buildRewardBalanceChanges,
    getExtraRewardCoinIdForPostStatistic,
    getPostStatisticExtraRewardCoinId,
    getPostStatisticRewardCoinId,
    getRewardCoinIdForPostStatistic,
    getTopicExtraRewardCoinId,
    getTopicRewardCoinId,
    resolveTopicRewardSettings,
    resolveTopicExtraRewardSettings,
    RewardBalanceChange,
    TopicRewardSettings
} from "../topic_monitor_settings";

const processingPosts = new Map<string, number>();

// Основная функция управления отслеживанием обсуждений
export async function Alliance_Topic_Monitor_Printer(context: any) {
    const user = await Person_Get(context);
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } });
    if (!alliance || !user) { return; }

    let monitor: any = await selectMonitor(context, alliance, user);
    if (!monitor) { return; }

    let allicoin_tr = false;
    let cursor = 0;

    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = `${ico_list['monitor'].ico} Управление отслеживанием обсуждений для монитора "${monitor.name}":\n\n`;

        const currentMonitor = await prisma.monitor.findFirst({ where: { id: monitor.id } });
        const activeMonitor = currentMonitor ?? monitor;
        const topicSettings = resolveTopicRewardSettings(activeMonitor);
        const extraTopicSettings = resolveTopicExtraRewardSettings(activeMonitor);
        const defaultCoin = await prisma.allianceCoin.findFirst({
            where: { id: activeMonitor.id_coin ?? 0 }
        });
        const topicCoinId = getTopicRewardCoinId(activeMonitor);
        const topicCoin = topicCoinId
            ? await prisma.allianceCoin.findFirst({ where: { id: topicCoinId } })
            : null;
        const extraTopicCoinId = getTopicExtraRewardCoinId(activeMonitor);
        const extraTopicCoin = extraTopicCoinId
            ? await prisma.allianceCoin.findFirst({ where: { id: extraTopicCoinId } })
            : null;

        if (topicCoin) {
            event_logger += `💰 Валюта наград: ${topicCoin.smile} ${topicCoin.name}\n`;
        } else if (defaultCoin) {
            event_logger += `💰 Валюта наград: используется валюта монитора ${defaultCoin.smile} ${defaultCoin.name}\n`;
        } else {
            event_logger += `💰 Валюта наград: не настроена\n`;
        }
        event_logger += buildMonitorTopicSettingsText(topicSettings, topicCoin ?? defaultCoin, extraTopicSettings, extraTopicCoin);
        event_logger += `\n`;
        
        // ДОБАВЛЕНО: Отображение хештегов монитора
        const monitorHashtags = await getMonitorHashtags(monitor.id);
        if (monitorHashtags.length > 0) {
            event_logger += `🏷️ Хештеги: #${monitorHashtags.join(', #')}\n`;
        } else {
            event_logger += `🏷️ Хештеги: не настроены\n`;
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

                event_logger += `${topicMonitor.name}\n`;
                event_logger += `🔗 ${topicMonitor.topicUrl}\n`;
                event_logger += `⚙️ Использует общие параметры монитора\n`;
                event_logger += `\n`; 
            }
        }

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

        // ДОБАВЛЕНО: Кнопка "Хештеги"
        keyboard.textButton({
            label: `${ico_list['edit'].ico} Хештеги`,
            payload: { command: 'topic_monitor_hashtags', cursor: cursor, monitorId: monitor.id },
            color: 'secondary'
        });

        keyboard.textButton({
            label: `${ico_list['config'].ico} Параметры`,
            payload: { command: 'topic_monitor_settings', cursor: cursor, monitorId: monitor.id },
            color: 'primary'
        }).row();

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
            'topic_monitor_settings': Topic_Monitor_Settings,
            'topic_monitor_return_from_currency': Topic_Monitor_Return,
            'topic_monitor_hashtags': async (ctx: any, data: any) => {
                const monitor = await prisma.monitor.findFirst({ where: { id: data.monitorId } });
                if (monitor) {
                    await MonitorHashtag_Manager(ctx, monitor);
                }
                return { cursor: data.cursor };
            }
        };

        if (answer?.payload?.command in config) {
            const commandHandler = config[answer.payload.command];
            const ans: any = await commandHandler(context, answer.payload, monitor, user, alliance);
            cursor = ans?.cursor || ans?.cursor === 0 ? ans.cursor : cursor;
            monitor = ans?.monitor ?? monitor;
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
        orderBy: { order: 'asc' }
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
        let text = `${ico_list['money'].ico} Выберите валюты для РП-постов в обсуждениях:\n`;
        text += `Монитор: "${currentMonitor.name}"\n\n`;
        
        // Текущая валюта (ИСПОЛЬЗУЕМ ОБНОВЛЕННЫЙ МОНИТОР)
        const defaultCoin = await prisma.allianceCoin.findFirst({ 
            where: { id: currentMonitor.id_coin ?? 0 } 
        });
        const currentTopicCoin = currentMonitor.id_topic_coin ? 
            await prisma.allianceCoin.findFirst({ where: { id: currentMonitor.id_topic_coin } }) : null;
        const currentExtraTopicCoin = currentMonitor.id_topic_extra_coin
            ? await prisma.allianceCoin.findFirst({ where: { id: currentMonitor.id_topic_extra_coin } })
            : null;
        
        text += `Текущая настройка:\n`;
        if (currentTopicCoin) {
            text += `• Основная валюта РП-постов: ${currentTopicCoin.smile} ${currentTopicCoin.name}\n`;
        } else {
            text += `• Основная валюта РП-постов: валюта монитора ${defaultCoin?.smile || '❌'} ${defaultCoin?.name || 'Не выбрана'}\n`;
        }
        if (currentExtraTopicCoin) {
            text += `• Доп. валюта РП-постов: ${currentExtraTopicCoin.smile} ${currentExtraTopicCoin.name}\n`;
        } else {
            text += `• Доп. валюта РП-постов: не настроена\n`;
        }
        text += `\nДоступные валюты:\n`;

        for (const coin of coins) {
            const isPrimarySelected = currentMonitor.id_topic_coin === coin.id ||
                (!currentMonitor.id_topic_coin && currentMonitor.id_coin === coin.id);
            const isExtraSelected = currentMonitor.id_topic_extra_coin === coin.id;

            keyboard.textButton({
                label: `${coin.smile} Осн.${isPrimarySelected ? " ✅" : ""}`,
                payload: {
                    command: 'topic_currency_select',
                    monitorId: currentMonitor.id,
                    coinId: coin.id,
                    cursor: cursor
                },
                color: isPrimarySelected ? 'positive' : 'secondary'
            })
            .textButton({
                label: `${coin.smile} Доп.${isExtraSelected ? " ✅" : ""}`,
                payload: {
                    command: 'topic_extra_currency_select',
                    monitorId: currentMonitor.id,
                    coinId: coin.id,
                    cursor: cursor
                },
                color: isExtraSelected ? 'positive' : 'secondary'
            });
            keyboard.row();
            text += `${coin.smile} ${coin.name}\n`;
        }

        // Кнопка для сброса к валюте монитора (только если задана отдельная валюта)
        if (currentMonitor.id_topic_coin) {
            keyboard.textButton({
                label: '🔄 Основная = валюта монитора',
                payload: {
                    command: 'topic_currency_reset',
                    monitorId: currentMonitor.id,
                    cursor: cursor
                },
                color: 'negative'
            }).row();
        }

        if (currentMonitor.id_topic_extra_coin) {
            keyboard.textButton({
                label: '🚫 Отключить доп. валюту',
                payload: {
                    command: 'topic_extra_currency_reset',
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

        if (answer.payload?.command === 'topic_extra_currency_select') {
            const coinId = answer.payload.coinId;
            const monitorId = answer.payload.monitorId;
            const cursor = answer.payload.cursor;

            await prisma.monitor.update({
                where: { id: monitorId },
                data: { id_topic_extra_coin: coinId }
            });

            const updatedMonitor = await prisma.monitor.findFirst({
                where: { id: monitorId }
            });

            if (!updatedMonitor) {
                await context.send(`${ico_list['warn'].ico} Ошибка обновления монитора!`);
                return { cursor: cursor, stop: true };
            }

            const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });
            monitor = updatedMonitor;
            await context.send(`${ico_list['save'].ico} Доп. валюта РП-постов установлена: ${coin?.smile} ${coin?.name}`);
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

        if (answer.payload?.command === 'topic_extra_currency_reset') {
            const monitorId = answer.payload.monitorId;
            const cursor = answer.payload.cursor;

            await prisma.monitor.update({
                where: { id: monitorId },
                data: { id_topic_extra_coin: null }
            });

            const updatedMonitor = await prisma.monitor.findFirst({
                where: { id: monitorId }
            });

            if (!updatedMonitor) {
                await context.send(`${ico_list['warn'].ico} Ошибка обновления монитора!`);
                return { cursor: cursor, stop: true };
            }

            monitor = updatedMonitor;
            await context.send(`${ico_list['save'].ico} Доп. валюта РП-постов отключена`);
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

function buildMonitorTopicSettingsText(
    settings: TopicRewardSettings,
    coin: any,
    extraSettings = resolveTopicExtraRewardSettings({}),
    extraCoin: any = null
): string {
    let text = `📏 Общий минимум поста: ${settings.minPcLines} ПК строк\n`;

    if (settings.minPcMessage) {
        text += `💬 Сообщение при малом объеме: "${settings.minPcMessage}"\n`;
    } else {
        text += `💬 Сообщение при малом объеме: стандартное\n`;
    }

    if (!settings.rewardEnabled) {
        text += `💰 Основные награды: ❌\n`;
    } else if (settings.uniformReward) {
        text += `💰 Основные награды: ✅ единая ${settings.uniformReward}${coin?.smile || ""}\n`;
    } else if (settings.linesRewards) {
        const rewards = parseLinesRewards(settings.linesRewards);
        const rewardsText = rewards.length > 0
            ? rewards.map((reward) => `${reward.lines} ПК = ${reward.reward}${coin?.smile || ""}`).join(", ")
            : "ступенчатая настройка пустая";

        text += `💰 Основные награды: ✅ ${rewardsText}\n`;
    } else {
        text += `💰 Основные награды: ✅ без суммы\n`;
    }

    text += `⚡ Общий минимум для основной награды: ${settings.rewardMinLines} ПК строк\n`;

    if (!extraCoin) {
        return `${text}➕ Доп. валюта РП-постов: не настроена\n`;
    }

    text += `➕ Доп. валюта РП-постов: ${extraCoin.smile} ${extraCoin.name}\n`;

    if (!extraSettings.rewardEnabled) {
        return `${text}➕ Доп. награды: ❌\n`;
    }

    if (extraSettings.uniformReward) {
        text += `➕ Доп. награды: ✅ единая ${extraSettings.uniformReward}${extraCoin.smile || ""}\n`;
    } else if (extraSettings.linesRewards) {
        const rewards = parseLinesRewards(extraSettings.linesRewards);
        const rewardsText = rewards.length > 0
            ? rewards.map((reward) => `${reward.lines} ПК = ${reward.reward}${extraCoin.smile || ""}`).join(", ")
            : "ступенчатая настройка пустая";

        text += `➕ Доп. награды: ✅ ${rewardsText}\n`;
    } else {
        text += `➕ Доп. награды: ✅ без суммы\n`;
    }

    return `${text}⚡ Общий минимум для доп. награды: ${extraSettings.rewardMinLines} ПК строк\n`;
}

async function getTopicExtraRewardCoin(monitor: any): Promise<any | null> {
    const extraCoinId = getTopicExtraRewardCoinId(monitor);

    return extraCoinId
        ? prisma.allianceCoin.findFirst({ where: { id: extraCoinId } })
        : null;
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

async function Topic_Monitor_Settings(context: any, data: any, monitor: any, user: any, alliance: Alliance) {
    let cursor = data.cursor;
    let exit = false;

    while (!exit) {
        const currentMonitor = await prisma.monitor.findFirst({ where: { id: monitor.id } });

        if (!currentMonitor) {
            await context.send(`${ico_list['warn'].ico} Монитор не найден!`);
            return { cursor, stop: true };
        }

        monitor = currentMonitor;
        const coinId = getTopicRewardCoinId(currentMonitor);
        const coin = coinId
            ? await prisma.allianceCoin.findFirst({ where: { id: coinId } })
            : null;
        const settings = resolveTopicRewardSettings(currentMonitor);
        const extraSettings = resolveTopicExtraRewardSettings(currentMonitor);
        const keyboard = new KeyboardBuilder()
            .textButton({
                label: "📏 Минимум",
                payload: { command: "topic_settings_min_pc", cursor },
                color: "secondary"
            })
            .textButton({
                label: "💬 Сообщение",
                payload: { command: "topic_settings_message", cursor },
                color: "secondary"
            }).row()
            .textButton({
                label: "💰 Осн. награды",
                payload: { command: "topic_settings_rewards", cursor },
                color: "primary"
            })
            .textButton({
                label: "⚡ Мин. осн.",
                payload: { command: "topic_settings_reward_min", cursor },
                color: "secondary"
            }).row()
            .textButton({
                label: "➕ Доп. награды",
                payload: { command: "topic_settings_extra_rewards", cursor },
                color: "primary"
            })
            .textButton({
                label: "➕ Мин. доп.",
                payload: { command: "topic_settings_extra_reward_min", cursor },
                color: "secondary"
            }).row()
            .textButton({
                label: "↩️ Назад",
                payload: { command: "topic_settings_back", cursor },
                color: "secondary"
            }).oneTime();

        const answer: any = await context.question(
            `${ico_list['config'].ico} Общие параметры обсуждений для монитора "${currentMonitor.name}"\n\n` +
            buildMonitorTopicSettingsText(settings, coin, extraSettings, await getTopicExtraRewardCoin(currentMonitor)),
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout) {
            return { cursor, stop: true, monitor: currentMonitor };
        }

        switch (answer.payload?.command) {
            case "topic_settings_min_pc":
                await editMonitorTopicMinPcLines(context, currentMonitor);
                break;
            case "topic_settings_message":
                await editMonitorTopicMinPcMessage(context, currentMonitor);
                break;
            case "topic_settings_rewards":
                await editMonitorTopicRewards(context, currentMonitor);
                break;
            case "topic_settings_reward_min":
                await editMonitorTopicRewardMinLines(context, currentMonitor);
                break;
            case "topic_settings_extra_rewards":
                await editMonitorTopicExtraRewards(context, currentMonitor);
                break;
            case "topic_settings_extra_reward_min":
                await editMonitorTopicExtraRewardMinLines(context, currentMonitor);
                break;
            case "topic_settings_back":
                exit = true;
                break;
            default:
                await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`);
                break;
        }
    }

    const updatedMonitor = await prisma.monitor.findFirst({ where: { id: monitor.id } });

    return { cursor, monitor: updatedMonitor ?? monitor };
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

    const currentMonitor = await prisma.monitor.findFirst({ where: { id: monitor.id } });
    const topicSettings = resolveTopicRewardSettings(currentMonitor ?? monitor);

    // Создание записи
    const topicMonitor = await prisma.topicMonitor.create({
        data: {
            name: name,
            monitorId: monitor.id,
            topicUrl: topicUrl,
            topicId: parsed.topicId,
            minPcLines: topicSettings.minPcLines,
            minPcMessage: topicSettings.minPcMessage,
            rewardEnabled: topicSettings.rewardEnabled,
            uniformReward: topicSettings.uniformReward,
            linesRewards: topicSettings.linesRewards,
            rewardMinLines: topicSettings.rewardMinLines
        }
    });

    if (topicMonitor) {
        await Logger(`Создано отслеживание обсуждения: ${topicMonitor.id}-${topicMonitor.name} для монитора ${monitor.id} админом ${user.idvk}`);
        await context.send(`${ico_list['save'].ico} Создано отслеживание обсуждения "${topicMonitor.name}"!\n` +
                          `⚙️ Правила зачета и наград берутся из общих параметров монитора.`);
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

async function configureLinesRewards(context: any, monitor: any, rewardCoinId?: number | null): Promise<string | null> {
    const coinId = rewardCoinId ?? getTopicRewardCoinId(monitor);
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

async function editMonitorTopicMinPcLines(context: any, monitor: any): Promise<void> {
    const currentValue = monitor.topicMinPcLines ?? 1;
    const newValue = await Input_Number(
        context,
        `Текущий общий минимум: ${currentValue} ПК строк.\nВведите новое значение (0 = любые посты, любой длины):`,
        true
    );

    if (newValue === false || newValue < 0) {
        return;
    }

    await prisma.monitor.update({
        where: { id: monitor.id },
        data: { topicMinPcLines: Math.max(0, newValue) }
    });
    await context.send(`✅ Общий минимум поста обновлен: ${Math.max(0, newValue)} ПК строк`);
}

async function editMonitorTopicMinPcMessage(context: any, monitor: any): Promise<void> {
    const currentMessage = monitor.topicMinPcMessage || "стандартное";
    const newMessage = await Input_Text(
        context,
        `Текущее сообщение при малом объеме: "${currentMessage}"\n\n` +
        `Введите новое сообщение, "удалить" для стандартного сообщения или "пропустить" для отмены:`,
        200
    );

    if (!newMessage || newMessage.toLowerCase() === "пропустить") {
        return;
    }

    const message = newMessage.toLowerCase() === "удалить" ? null : newMessage.trim();

    await prisma.monitor.update({
        where: { id: monitor.id },
        data: { topicMinPcMessage: message || null }
    });
    await context.send(message ? `✅ Сообщение обновлено: "${message}"` : `✅ Будет использоваться стандартное сообщение`);
}

async function editMonitorTopicRewards(context: any, monitor: any): Promise<void> {
    const rewardType = await selectRewardType(context);

    if (!rewardType) {
        await prisma.monitor.update({
            where: { id: monitor.id },
            data: {
                topicRewardEnabled: false,
                topicUniformReward: null,
                topicLinesRewards: null
            }
        });
        await context.send(`✅ Награды обсуждений отключены`);
        return;
    }

    if (rewardType === "uniform") {
        const coinId = getTopicRewardCoinId(monitor);
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        const rewardInput = await Input_Number(
            context,
            `Введите общую награду за пост (в ${coin?.smile || "валюте"}):`,
            false
        );

        if (rewardInput === false) {
            return;
        }

        await prisma.monitor.update({
            where: { id: monitor.id },
            data: {
                topicRewardEnabled: true,
                topicUniformReward: rewardInput,
                topicLinesRewards: null
            }
        });
        await context.send(`✅ Единая награда обсуждений установлена: ${rewardInput}${coin?.smile || ""}`);
        return;
    }

    const linesConfig = await configureLinesRewards(context, monitor);

    if (!linesConfig) {
        return;
    }

    await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
            topicRewardEnabled: true,
            topicLinesRewards: linesConfig,
            topicUniformReward: null
        }
    });
    await context.send(`✅ Награды обсуждений за ПК строки настроены`);
}

async function editMonitorTopicRewardMinLines(context: any, monitor: any): Promise<void> {
    const currentValue = monitor.topicRewardMinLines ?? 1;
    const newValue = await Input_Number(
        context,
        `Текущий общий минимум для награды: ${currentValue} ПК строк.\nВведите новое значение (0 = награждать любые посты):`,
        true
    );

    if (newValue === false || newValue < 0) {
        return;
    }

    await prisma.monitor.update({
        where: { id: monitor.id },
        data: { topicRewardMinLines: Math.max(0, newValue) }
    });
    await context.send(`✅ Общий минимум для награды обновлен: ${Math.max(0, newValue)} ПК строк`);
}

async function editMonitorTopicExtraRewards(context: any, monitor: any): Promise<void> {
    const extraCoinId = getTopicExtraRewardCoinId(monitor);
    const extraCoin = extraCoinId
        ? await prisma.allianceCoin.findFirst({ where: { id: extraCoinId } })
        : null;

    if (!extraCoin) {
        await context.send(`➕ Сначала выберите доп. валюту РП-постов в меню "Валюта".`);
        return;
    }

    const rewardType = await selectRewardType(context);

    if (!rewardType) {
        await prisma.monitor.update({
            where: { id: monitor.id },
            data: {
                topicExtraRewardEnabled: false,
                topicExtraUniformReward: null,
                topicExtraLinesRewards: null
            }
        });
        await context.send(`✅ Доп. награды за РП-посты отключены`);
        return;
    }

    if (rewardType === "uniform") {
        const rewardInput = await Input_Number(
            context,
            `Введите доп. награду за РП-пост (в ${extraCoin.smile} ${extraCoin.name}):`,
            false
        );

        if (rewardInput === false) {
            return;
        }

        await prisma.monitor.update({
            where: { id: monitor.id },
            data: {
                topicExtraRewardEnabled: true,
                topicExtraUniformReward: rewardInput,
                topicExtraLinesRewards: null
            }
        });
        await context.send(`✅ Доп. награда РП-постов установлена: ${rewardInput}${extraCoin.smile || ""}`);
        return;
    }

    const linesConfig = await configureLinesRewards(context, monitor, extraCoin.id);

    if (!linesConfig) {
        return;
    }

    await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
            topicExtraRewardEnabled: true,
            topicExtraLinesRewards: linesConfig,
            topicExtraUniformReward: null
        }
    });
    await context.send(`✅ Доп. награды РП-постов за ПК строки настроены`);
}

async function editMonitorTopicExtraRewardMinLines(context: any, monitor: any): Promise<void> {
    const currentValue = monitor.topicExtraRewardMinLines ?? 1;
    const newValue = await Input_Number(
        context,
        `Текущий минимум для доп. награды: ${currentValue} ПК строк.\nВведите новое значение (0 = награждать любые посты):`,
        true
    );

    if (newValue === false || newValue < 0) {
        return;
    }

    await prisma.monitor.update({
        where: { id: monitor.id },
        data: { topicExtraRewardMinLines: Math.max(0, newValue) }
    });
    await context.send(`✅ Минимум для доп. награды обновлен: ${Math.max(0, newValue)} ПК строк`);
}

// Редактирование отслеживания обсуждения
async function Topic_Monitor_Edit(context: any, data: any, monitor: any, user: any, alliance: Alliance) {
    const res = { cursor: data.cursor };
    let exit = false;

    while (!exit) {
        const topicMonitor = await prisma.topicMonitor.findFirst({
            where: { id: data.id }
        });

        if (!topicMonitor) {
            return res;
        }

        const keyboard = new KeyboardBuilder()
            .textButton({
                label: "📝 Название",
                payload: { command: "topic_edit_name" },
                color: "secondary"
            })
            .textButton({
                label: "🔗 Ссылка",
                payload: { command: "topic_edit_url" },
                color: "secondary"
            }).row()
            .textButton({
                label: "↩️ Назад",
                payload: { command: "topic_edit_back" },
                color: "secondary"
            }).oneTime();

        const answer: any = await context.question(
            `${ico_list['edit'].ico} Редактирование обсуждения "${topicMonitor.name}"\n\n` +
            `🔗 ${topicMonitor.topicUrl}\n\n` +
            `Выберите конкретный параметр для изменения.\n` +
            `Правила зачета, лимиты, валюта и награды редактируются в общих параметрах монитора.`,
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout) {
            return res;
        }

        switch (answer.payload?.command) {
            case "topic_edit_name":
                await editTopicMonitorName(context, topicMonitor);
                break;
            case "topic_edit_url":
                await editTopicMonitorUrl(context, topicMonitor, monitor);
                break;
            case "topic_edit_back":
                exit = true;
                break;
            default:
                await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`);
                break;
        }
    }

    return res;
}

async function editTopicMonitorName(context: any, topicMonitor: any): Promise<void> {
    const newName = await Input_Text(
        context,
        `Текущее название: ${topicMonitor.name}\nВведите новое название или "отмена":`
    );

    if (!newName || newName.toLowerCase() === "отмена") {
        return;
    }

    await prisma.topicMonitor.update({
        where: { id: topicMonitor.id },
        data: { name: newName.trim() }
    });
    await context.send(`✅ Название обсуждения обновлено: "${newName.trim()}"`);
}

async function editTopicMonitorUrl(context: any, topicMonitor: any, monitor: any): Promise<void> {
    const newUrl = await Input_Text(
        context,
        `Текущая ссылка: ${topicMonitor.topicUrl}\nВведите новую ссылку VK-обсуждения или "отмена":`
    );

    if (!newUrl || newUrl.toLowerCase() === "отмена") {
        return;
    }

    const parsed = parseTopicUrl(newUrl);

    if (!parsed) {
        await context.send(`${ico_list['warn'].ico} Неверный формат ссылки на обсуждение! Пример: https://vk.com/topic-12345678_90123456`);
        return;
    }

    const existing = await prisma.topicMonitor.findFirst({
        where: {
            monitorId: monitor.id,
            topicId: parsed.topicId
        }
    });

    if (existing && existing.id !== topicMonitor.id) {
        await context.send(`${ico_list['warn'].ico} Это обсуждение уже отслеживается: ${existing.name}`);
        return;
    }

    await prisma.topicMonitor.update({
        where: { id: topicMonitor.id },
        data: {
            topicUrl: newUrl.trim(),
            topicId: parsed.topicId
        }
    });
    await context.send(`✅ Ссылка обсуждения обновлена`);
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

type TopicPostAction = 'new' | 'edit' | 'delete' | 'restore';

interface RewardSnapshot {
    amount: number;
    coinId: number | null;
}

interface TopicPostRewardSnapshots {
    main: RewardSnapshot;
    extra: RewardSnapshot;
}

interface AppliedRewardBalanceChange {
    coin: any | null;
    facult: any | null;
    oldAmount: number;
    newAmount: number;
    amountChange: number;
}

function getEmptyRewardSnapshots(): TopicPostRewardSnapshots {
    return {
        main: { amount: 0, coinId: null },
        extra: { amount: 0, coinId: null }
    };
}

function getStoredRewardSnapshots(postStat: any | null | undefined, monitor: any): TopicPostRewardSnapshots {
    if (!postStat) {
        return getEmptyRewardSnapshots();
    }

    const mainAmount = postStat.rewardGiven ? postStat.rewardAmount || 0 : 0;
    const extraAmount = postStat.extraRewardGiven ? postStat.extraRewardAmount || 0 : 0;

    return {
        main: {
            amount: mainAmount,
            coinId: getPostStatisticRewardCoinId(postStat, monitor)
        },
        extra: {
            amount: extraAmount,
            coinId: getPostStatisticExtraRewardCoinId(postStat, monitor)
        }
    };
}

function calculateTopicPostRewards(topicMonitor: any, monitor: any, characters: number): TopicPostRewardSnapshots {
    const mainAmount = calculateReward(topicMonitor, characters);
    const extraAmount = calculateTopicExtraRewardAmount(monitor, characters);

    return {
        main: {
            amount: mainAmount,
            coinId: getRewardCoinIdForPostStatistic(mainAmount > 0, mainAmount, monitor)
        },
        extra: {
            amount: extraAmount,
            coinId: getExtraRewardCoinIdForPostStatistic(extraAmount > 0, extraAmount, monitor)
        }
    };
}

function calculateTopicExtraRewardAmount(monitor: any, characters: number): number {
    const extraCoinId = getTopicExtraRewardCoinId(monitor);

    if (!extraCoinId) {
        return 0;
    }

    const settings = resolveTopicExtraRewardSettings(monitor);

    return calculateReward({
        rewardEnabled: settings.rewardEnabled,
        linesRewards: settings.linesRewards,
        uniformReward: settings.uniformReward,
        rewardMinLines: settings.rewardMinLines
    }, characters);
}

function buildTopicRewardBalanceChanges(
    oldRewards: TopicPostRewardSnapshots,
    newRewards: TopicPostRewardSnapshots
): RewardBalanceChange[] {
    return mergeRewardBalanceChanges([
        ...buildRewardBalanceChanges(oldRewards.main.amount, oldRewards.main.coinId, newRewards.main.amount, newRewards.main.coinId),
        ...buildRewardBalanceChanges(oldRewards.extra.amount, oldRewards.extra.coinId, newRewards.extra.amount, newRewards.extra.coinId)
    ]);
}

function mergeRewardBalanceChanges(changes: RewardBalanceChange[]): RewardBalanceChange[] {
    const merged: RewardBalanceChange[] = [];

    for (const change of changes) {
        const existing = merged.find((item) => item.coinId === change.coinId);

        if (existing) {
            existing.amountChange += change.amountChange;
            continue;
        }

        merged.push({ ...change });
    }

    return merged.filter((change) => change.amountChange !== 0);
}

async function applyRewardBalanceChanges(
    user: any,
    changes: RewardBalanceChange[]
): Promise<AppliedRewardBalanceChange[]> {
    const appliedChanges: AppliedRewardBalanceChange[] = [];

    for (const change of mergeRewardBalanceChanges(changes)) {
        const appliedChange = await applyRewardBalanceChange(user, change);

        if (appliedChange) {
            appliedChanges.push(appliedChange);
        }
    }

    return appliedChanges;
}

async function applyRewardBalanceChange(
    user: any,
    change: RewardBalanceChange
): Promise<AppliedRewardBalanceChange | null> {
    if (!change.coinId || change.amountChange === 0) {
        return null;
    }

    const coin = await prisma.allianceCoin.findFirst({ where: { id: change.coinId } });
    const balance = await prisma.balanceCoin.findFirst({
        where: { id_coin: change.coinId, id_user: user.id }
    });
    const oldAmount = balance?.amount || 0;
    const newAmount = oldAmount + change.amountChange;

    await updateUserBalance(user.id, change.coinId, newAmount);

    let facult = null;
    if (user.id_facult && coin?.point) {
        facult = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult } });
        await updateFacultBalance(user.id_facult, change.coinId, change.amountChange);
    }

    return {
        coin,
        facult,
        oldAmount,
        newAmount,
        amountChange: change.amountChange
    };
}

async function getPostHashtags(postStatisticId: number): Promise<string[]> {
    const hashtagRecords = await prisma.postHashtag.findMany({
        where: { postStatisticId },
        select: { hashtag: true }
    });

    return hashtagRecords.map((record: { hashtag: string }) => record.hashtag);
}

function uniqueCoinIds(coinIds: Array<number | null | undefined>): number[] {
    const result: number[] = [];

    for (const coinId of coinIds) {
        if (coinId && !result.includes(coinId)) {
            result.push(coinId);
        }
    }

    return result;
}

function formatAppliedRewardBalanceLine(change: AppliedRewardBalanceChange): string {
    const operation = change.amountChange > 0 ? '+' : '-';
    const amount = Math.abs(change.amountChange);
    const coinLabel = change.coin ? `${change.coin.smile || ''} ${change.coin.name}`.trim() : 'валюта';
    const coinSmile = change.coin?.smile || '';
    const facultText = change.facult ? ` для факультета [${change.facult.smile} ${change.facult.name}]` : '';

    return `💳 Баланс ${coinLabel}: ${change.oldAmount} ${operation} ${amount} = ${change.newAmount}${coinSmile}${facultText}`;
}

function formatAppliedRewardBalanceText(changes: AppliedRewardBalanceChange[]): string {
    if (changes.length === 0) {
        return '';
    }

    return `${changes.map(formatAppliedRewardBalanceLine).join('\n')}\n`;
}

async function buildUnchangedRewardBalanceText(user: any, coinIds: Array<number | null | undefined>): Promise<string> {
    const lines: string[] = [];

    for (const coinId of uniqueCoinIds(coinIds)) {
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });

        if (!coin) {
            continue;
        }

        const balance = await prisma.balanceCoin.findFirst({
            where: { id_coin: coinId, id_user: user.id }
        });
        const facult = user.id_facult && coin.point
            ? await prisma.allianceFacult.findFirst({ where: { id: user.id_facult } })
            : null;
        const facultText = facult ? ` для факультета [${facult.smile} ${facult.name}]` : '';

        lines.push(`💳 Баланс ${coin.smile || ''} ${coin.name}: не изменился, ${balance?.amount || 0}${coin.smile || ''}${facultText}`);
    }

    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

async function buildRewardBalanceText(
    user: any,
    monitor: any,
    appliedChanges: AppliedRewardBalanceChange[]
): Promise<string> {
    const configuredCoinIds = uniqueCoinIds([
        getTopicRewardCoinId(monitor),
        getTopicExtraRewardCoinId(monitor)
    ]);

    if (appliedChanges.length > 0) {
        const changedCoinIds = appliedChanges.map((change) => change.coin?.id).filter((coinId) => Boolean(coinId));
        const unchangedCoinIds = configuredCoinIds.filter((coinId) => !changedCoinIds.includes(coinId));

        return formatAppliedRewardBalanceText(appliedChanges) +
            await buildUnchangedRewardBalanceText(user, unchangedCoinIds);
    }

    return buildUnchangedRewardBalanceText(user, configuredCoinIds);
}

async function notifyUserOfTopicPostChange(params: {
    user: any;
    topicMonitor: any;
    monitor: any;
    context: BoardPostContext;
    stats: any;
    displayPc: number;
    action: 'new' | 'edit' | 'restore';
    belowMin: boolean;
    uidSpecified: boolean;
    specifiedUid: number | null;
    hashtags: string[];
    oldDisplayPc?: number;
    oldHadReward?: boolean;
    userChanged?: boolean;
    appliedChanges: AppliedRewardBalanceChange[];
}): Promise<void> {
    const account = await prisma.account.findFirst({
        where: { idvk: params.user.idvk }
    });

    if (!account || !params.user.notification_topic) {
        return;
    }

    const uidInfo = params.uidSpecified && params.specifiedUid
        ? `\n🎯 Начисление по указанному UID: ${params.specifiedUid}`
        : '';
    const hashtagText = params.hashtags.length > 0
        ? `\n🏷️ Хештеги: #${params.hashtags.join(', #')}`
        : '';
    const minPcLines = params.topicMonitor.minPcLines ?? 0;
    const minPcText = params.belowMin && minPcLines > 0
        ? ` (минимальный объем: ${minPcLines} ПК строк)`
        : '';
    const actionText = getTopicPostActionText(params.action);
    const volumeChange = params.action === 'edit' && params.oldDisplayPc !== undefined && params.oldDisplayPc !== params.displayPc
        ? ` (было ${params.oldDisplayPc} ПК строк, стало ${params.displayPc} ПК строк)`
        : '';
    const balanceText = await buildRewardBalanceText(params.user, params.monitor, params.appliedChanges);
    const customMessage = getTopicPostNotificationMessage(params.belowMin, params.oldHadReward || false, params.appliedChanges.length > 0, params.userChanged || false);

    const message = `📝 ${params.user.name} (UID: ${params.user.id}), ваш ролевой пост в обсуждении "${params.topicMonitor.name}" ${actionText}${volumeChange}!${uidInfo}${hashtagText}\n` +
        `📊 Статистика: ${params.stats.words} слов, ${params.stats.characters} символов\n` +
        `💻 ПК: ${params.displayPc}, 📱 МБ: ${params.stats.mb.toFixed(2)}${minPcText}\n` +
        `${customMessage}` +
        `${balanceText}` +
        `🧷 Ссылка: https://vk.com/topic${params.monitor.idvk}_${params.context.topicId}?post=${params.context.id}`;

    try {
        await Send_Message(account.idvk, message);
    } catch (error) {
        console.error(`❌ Ошибка отправки уведомления о посте: ${error}`);
    }
}

function getTopicPostActionText(action: 'new' | 'edit' | 'restore'): string {
    switch (action) {
        case 'new':
            return 'засчитан';
        case 'edit':
            return 'отредактирован';
        case 'restore':
            return 'восстановлен';
    }
}

function getTopicPostNotificationMessage(
    belowMin: boolean,
    oldHadReward: boolean,
    hasBalanceChanges: boolean,
    userChanged: boolean
): string {
    if (belowMin) {
        return oldHadReward
            ? '⚠ Объем ниже минимального, награда снята!\n'
            : 'ℹ️ Пост зафиксирован, но не принес награды\n';
    }

    if (userChanged && hasBalanceChanges) {
        return '🔄 Награда переведена с другого персонажа\n';
    }

    if (!hasBalanceChanges) {
        return 'ℹ️ Баланс наград не изменился\n';
    }

    return '';
}

async function notifyUserOfRewardTransfer(
    oldUser: any,
    newUser: any,
    topicMonitor: any,
    monitor: any,
    context: BoardPostContext,
    appliedChanges: AppliedRewardBalanceChange[]
): Promise<void> {
    if (appliedChanges.length === 0) {
        return;
    }

    const account = await prisma.account.findFirst({
        where: { idvk: oldUser.idvk }
    });

    if (!account || !oldUser.notification_topic) {
        return;
    }

    const message = `⚠ ${oldUser.name} (UID: ${oldUser.id}), награда переведена другому персонажу!\n` +
        `📝 Ваш пост в обсуждении "${topicMonitor.name}" был изменен.\n` +
        `👤 Новый владелец: ${newUser.name} (UID: ${newUser.id})\n` +
        formatAppliedRewardBalanceText(appliedChanges) +
        `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;

    try {
        await Send_Message(account.idvk, message);
    } catch (error) {
        console.error(`❌ Ошибка отправки уведомления о переводе награды: ${error}`);
    }
}

// Обработчик новых постов в обсуждениях
export async function handleTopicPost(context: BoardPostContext, monitor: any, action: TopicPostAction) {
    let processingKey = `${monitor.id}_${context.topicId}_${context.id}`;
    let processingStarted = false;

    try {
        const currentMonitor = await prisma.monitor.findFirst({ where: { id: monitor.id } });
        monitor = currentMonitor ?? monitor;
        processingKey = `${monitor.id}_${context.topicId}_${context.id}`;

        if (processingPosts.has(processingKey)) {
            return;
        }

        processingPosts.set(processingKey, Date.now());
        processingStarted = true;

        setTimeout(() => {
            processingPosts.delete(processingKey);
        }, 30000);

        const topicMonitorRecord = await prisma.topicMonitor.findFirst({
            where: {
                monitorId: monitor.id,
                topicId: context.topicId
            }
        });

        if (!topicMonitorRecord) {
            return;
        }

        const topicMonitor = applyMonitorTopicSettings(topicMonitorRecord, monitor);

        if (action === 'delete') {
            await handlePostDeletion(topicMonitor, context.id, monitor, context.fromId, context.topicId);
            return;
        }

        const text = context.text;
        const senderUserId = context.fromId;

        if (!text || !senderUserId || senderUserId <= 0) {
            return;
        }

        const { user: targetUser, uidSpecified, specifiedUid } = await determineTargetUser(
            text,
            senderUserId,
            monitor.id_alliance
        );

        if (!targetUser) {
            return;
        }

        const stats = calculatePostStats(text);
        const displayPc = getPcLinesForDisplay(stats.pc);
        const checkPcLines = getPcLinesForCheck(stats.pc);
        const monitorHashtags = await getMonitorHashtags(monitor.id);
        const relevantHashtags = extractHashtags(text).filter((tag: string) => monitorHashtags.includes(tag));
        const existingStat = await prisma.postStatistic.findFirst({
            where: {
                topicMonitorId: topicMonitor.id,
                postId: context.id
            }
        });
        const oldRewards = getStoredRewardSnapshots(existingStat, monitor);
        const oldHadReward = oldRewards.main.amount > 0 || oldRewards.extra.amount > 0;
        const oldDisplayPc = existingStat ? getPcLinesForDisplay(existingStat.pc) : 0;
        const oldUser = existingStat
            ? await prisma.user.findFirst({ where: { id: existingStat.userId } })
            : null;
        const userChanged = Boolean(oldUser && oldUser.id !== targetUser.id);
        const minPcLines = topicMonitor.minPcLines ?? 0;
        const belowMinPcLines = minPcLines > 0 && checkPcLines < minPcLines;
        if (userChanged && oldUser) {
            const oldUserChanges = buildTopicRewardBalanceChanges(oldRewards, getEmptyRewardSnapshots());
            const oldUserAppliedChanges = await applyRewardBalanceChanges(oldUser, oldUserChanges);
            await notifyUserOfRewardTransfer(oldUser, targetUser, topicMonitor, monitor, context, oldUserAppliedChanges);
        }

        const newRewards = belowMinPcLines
            ? getEmptyRewardSnapshots()
            : calculateTopicPostRewards(topicMonitor, monitor, stats.characters);
        const baseOldRewards = userChanged ? getEmptyRewardSnapshots() : oldRewards;
        const rewardChanges = buildTopicRewardBalanceChanges(baseOldRewards, newRewards);
        const appliedChanges = await applyRewardBalanceChanges(targetUser, rewardChanges);

        await savePostStatsWithHashtags(
            topicMonitor,
            targetUser,
            context,
            stats,
            action,
            newRewards.main.amount > 0,
            newRewards.main.amount,
            relevantHashtags,
            monitor,
            monitor.id_alliance,
            newRewards.extra.amount > 0,
            newRewards.extra.amount
        );

        await notifyUserOfTopicPostChange({
            user: targetUser,
            topicMonitor,
            monitor,
            context,
            stats,
            displayPc,
            action,
            belowMin: belowMinPcLines,
            uidSpecified,
            specifiedUid,
            hashtags: relevantHashtags,
            oldDisplayPc,
            oldHadReward: userChanged ? false : oldHadReward,
            userChanged,
            appliedChanges
        });

        const totalRewardChange = appliedChanges.reduce((sum, change) => sum + change.amountChange, 0);
        await logToTopicChat(
            topicMonitor,
            targetUser,
            monitor,
            action,
            stats,
            displayPc,
            totalRewardChange,
            undefined,
            context.id,
            belowMinPcLines,
            uidSpecified,
            specifiedUid,
            relevantHashtags,
            appliedChanges
        );
    } catch (error) {
        console.error(`❌ Ошибка обработки поста в обсуждении: ${error}`);
    } finally {
        if (processingStarted) {
            processingPosts.delete(processingKey);
        }
    }
}

// Снять награду у пользователя
async function deductRewardFromUser(user: any, amount: number, monitor: any, topicMonitor: any, context: BoardPostContext) {
    const coinId = getTopicRewardCoinId(monitor);
    if (!coinId) {
        return;
    }

    const balance = await prisma.balanceCoin.findFirst({
        where: { id_coin: coinId, id_user: user.id }
    });
    await updateUserBalance(user.id, coinId, (balance?.amount || 0) - amount);

    if (user.id_facult) {
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });
        if (coin?.point) {
            await updateFacultBalance(user.id_facult, coinId, -amount);
        }
    }
}

// Добавить награду пользователю
async function addRewardToUser(user: any, amount: number, monitor: any, topicMonitor: any, context: BoardPostContext) {
    const coinId = getTopicRewardCoinId(monitor);
    if (!coinId) {
        return;
    }

    const balance = await prisma.balanceCoin.findFirst({
        where: { id_coin: coinId, id_user: user.id }
    });
    await updateUserBalance(user.id, coinId, (balance?.amount || 0) + amount);

    if (user.id_facult) {
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId } });
        if (coin?.point) {
            await updateFacultBalance(user.id_facult, coinId, amount);
        }
    }
}

// Уведомить пользователя о редактировании с переводом
async function notifyUserOfEditWithTransfer(user: any, topicMonitor: any, monitor: any, context: BoardPostContext, stats: any, displayPc: number, amount: number, uidSpecified: boolean, specifiedUid: number | null) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        const coinId = getTopicRewardCoinId(monitor);
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
async function notifyUserOfNewPost(user: any, topicMonitor: any, monitor: any, context: BoardPostContext, stats: any, displayPc: number, amount: number, uidSpecified: boolean, specifiedUid: number | null, hashtags: string[] = []) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        const coinId = getTopicRewardCoinId(monitor);
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        const balance = await prisma.balanceCoin.findFirst({ 
            where: { id_coin: coinId ?? 0, id_user: user.id } 
        });        
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
        
        // Добавляем информацию о хештегах
        let hashtagText = '';
        if (hashtags && hashtags.length > 0) {
            hashtagText = `\n🏷️ Хештеги: #${hashtags.join(', #')}`;
        }
        
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
        
        const message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" засчитан!${uidInfo}${hashtagText}\n` +
                       `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                       `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n` +
                       balanceText +
                       `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        
        await Send_Message(account.idvk, message);
    }
}

// Уведомить о новом посте без награды
async function notifyUserOfNewPostNoReward(user: any, topicMonitor: any, monitor: any, context: BoardPostContext, stats: any, displayPc: number, uidSpecified: boolean, specifiedUid: number | null, hashtags: string[] = []) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        const coinId = getTopicRewardCoinId(monitor);
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        const balance = await prisma.balanceCoin.findFirst({ 
            where: { id_coin: coinId ?? 0, id_user: user.id } 
        });
        
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
        
        // Добавляем информацию о хештегах
        let hashtagText = '';
        if (hashtags && hashtags.length > 0) {
            hashtagText = `\n🏷️ Хештеги: #${hashtags.join(', #')}`;
        }
        
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
        
        const message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" засчитан!${uidInfo}${hashtagText}\n` +
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

async function savePostStatsWithHashtags(
    topicMonitor: any, 
    targetUser: any,
    context: BoardPostContext, 
    stats: any, 
    action: string,
    rewardGiven: boolean,
    rewardAmount: number,
    relevantHashtags: string[],
    monitor: any,
    allianceId: number,
    extraRewardGiven: boolean = false,
    extraRewardAmount: number = 0
): Promise<any> {
    const rewardCoinId = getRewardCoinIdForPostStatistic(rewardGiven, rewardAmount, monitor);
    const extraRewardCoinId = getExtraRewardCoinIdForPostStatistic(extraRewardGiven, extraRewardAmount, monitor);

    const saved = await prisma.postStatistic.upsert({
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
            rewardAmount: rewardAmount,
            rewardCoinId,
            extraRewardGiven,
            extraRewardAmount,
            extraRewardCoinId
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
            rewardAmount: rewardAmount,
            rewardCoinId,
            extraRewardGiven,
            extraRewardAmount,
            extraRewardCoinId
        }
    });
    
    // ДОБАВИТЬ ОТЛАДОЧНЫЙ ЛОГ:
    //console.log(`💾 [DEBUG] Сохраняем статистику поста ${saved.id}, хештегов: ${relevantHashtags.length}`);
    
    // Сохраняем хештеги для поста
    if (relevantHashtags.length > 0) {
        // Удаляем старые
        await prisma.postHashtag.deleteMany({
            where: { postStatisticId: saved.id }
        });
        
        for (const hashtag of relevantHashtags) {
            await prisma.postHashtag.create({
                data: {
                    postStatisticId: saved.id,
                    hashtag,
                    monitorId: monitor.id,
                    allianceId
                }
            });
            console.log(`   ✅ Сохранен хештег: #${hashtag} для поста ${saved.id}`);
        }
    } else {
        await prisma.postHashtag.deleteMany({
            where: { postStatisticId: saved.id }
        });
        console.log(`   ⚠ Нет релевантных хештегов для поста ${saved.id}`);
    }
    
    return saved;
}

// Обработка удаления поста
async function handlePostDeletion(topicMonitor: any, postId: number, monitor: any, fromId?: number, topicId?: number) {
    const postStat = await prisma.postStatistic.findFirst({
        where: {
            topicMonitorId: topicMonitor.id,
            postId: postId
        }
    });

    const postHashtags = postStat ? await getPostHashtags(postStat.id) : [];

    let user = null;

    if (postStat) {
        user = await prisma.user.findFirst({
            where: {
                id: postStat.userId,
                id_alliance: monitor.id_alliance
            }
        });
    } else if (fromId) {
        user = await prisma.user.findFirst({
            where: {
                idvk: fromId,
                id_alliance: monitor.id_alliance
            }
        });
    }

    if (!user) {
        if (postStat) {
            await prisma.postHashtag.deleteMany({
                where: { postStatisticId: postStat.id }
            });
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

    const oldRewards = getStoredRewardSnapshots(postStat, monitor);
    const rewardChanges = buildTopicRewardBalanceChanges(oldRewards, getEmptyRewardSnapshots());
    const appliedChanges = await applyRewardBalanceChanges(user, rewardChanges);
    const hashtagText = postHashtags.length > 0
        ? `\n🏷️ Хештеги: #${postHashtags.join(', #')}`
        : `\n🏷️ Хештеги: отсутствовали`;
    const balanceText = await buildRewardBalanceText(user, monitor, appliedChanges);
    const statsText = postStat
        ? `📊 Статистика: ${postStat.words} слов, ${postStat.characters} символов\n` +
          `💻 ПК: ${getPcLinesForDisplay(postStat.pc)}, 📱 МБ: ${postStat.mb.toFixed(2)}\n`
        : `ℹ️ Пост был удален\n`;
    const rewardText = postStat && appliedChanges.length === 0
        ? `ℹ️ Пост был зафиксирован, но не принес награды\n`
        : '';
    let message = `🗑️ ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" удален!${hashtagText}\n` +
        statsText +
        rewardText +
        balanceText.trimEnd();

    if (topicId) {
        message += `\n🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${topicId}?post=${postId}`;
    }

    if (postStat) {
        await prisma.postHashtag.deleteMany({
            where: { postStatisticId: postStat.id }
        });
        await prisma.postStatistic.delete({
            where: {
                topicMonitorId_postId: {
                    topicMonitorId: topicMonitor.id,
                    postId: postId
                }
            }
        });
    }

    const account = await prisma.account.findFirst({ 
        where: { idvk: user.idvk } 
    });
    
    if (account && user.notification_topic) {
        try {
            await Send_Message(account.idvk, message);
        } catch (error) {
            console.error(`❌ Ошибка отправки уведомления об удаления: ${error}`);
        }
    }

    if (postStat) {
        const totalRewardChange = appliedChanges.reduce((sum, change) => sum + change.amountChange, 0);
        await logToTopicChat(topicMonitor, user, monitor, 'delete', {
            words: postStat.words,
            characters: postStat.characters,
            pc: postStat.pc,
            mb: postStat.mb
        }, getPcLinesForDisplay(postStat.pc), totalRewardChange, undefined, postId, false, false, null, postHashtags, appliedChanges);
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
    const coinId = getTopicRewardCoinId(monitor);
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
    specifiedUid: number | null = null,
    relevantHashtags: string[] = []
) {
    const account = await prisma.account.findFirst({ 
        where: { idvk: targetUser.idvk } 
    });
    
    if (!account || !targetUser.notification_topic) {
        return;
    }
    
    // Получаем баланс для информации
    const coinId = getTopicRewardCoinId(monitor);
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
                balanceText = `💳 Ваш баланс не изменился: ${balance.amount}${coin.smile} для факультета [${facult.smile} ${facult.name}]\n`;
            } else {
                balanceText = `💳 Ваш баланс не изменился: ${balance.amount}${coin.smile}\n`;
            }
        } else {
            balanceText = `💳 Ваш баланс не изменился: ${balance.amount}${coin.smile}\n`;
        }
    }
    
    const minPcLines = topicMonitor.minPcLines ?? 0;
    const minPcText = minPcLines > 0 ? ` (минимальный объем: ${minPcLines} ПК строк)` : '';
    
    // Добавляем информацию об указанном UID
    const uidInfo = uidSpecified && specifiedUid ? 
        `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
    
    // Добавляем информацию о хештегах
    let hashtagText = '';
    if (relevantHashtags && relevantHashtags.length > 0) {
        hashtagText = `\n🏷️ Хештеги: #${relevantHashtags.join(', #')}`;
    }
    
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
    
    const message = `📝 ${targetUser.name} (UID: ${targetUser.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" ${actionText}!${uidInfo}${hashtagText}\n` +
                   `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                   `💻 ПК: ${displayPc}${minPcText}\n` +
                   `${customMessage}\n` +
                   `${balanceText}` +
                   `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
    
    try {
        await Send_Message(account.idvk, message);
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
    currentBalanceAmount: number = 0,
    oldHashtags: string[] = [],
    newHashtags: string[] = [],
    hashtagsChanged: boolean = false
) {
    try {
        const account = await prisma.account.findFirst({ 
            where: { idvk: context.fromId } 
        });
        
        const coinId = getTopicRewardCoinId(monitor);
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        
        if (!coin) {
            return;
        }
        
        let userBalance = currentBalanceAmount;
        if (userBalance === 0) {
            const balanceRecord = await prisma.balanceCoin.findFirst({ 
                where: { id_coin: coinId ?? 0, id_user: user.id } 
            });
            userBalance = balanceRecord?.amount || 0;
        }
        
        let message = '';
        let rewardChange = 0;
        let newBalance = userBalance;
        
        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Начисление по указанному UID: ${specifiedUid}` : '';
        
        // ДОБАВЛЕНО: Информация об изменении хештегов
        let hashtagInfo = '';
        if (hashtagsChanged && (action === 'edit' || action === 'restore')) {
            const added = newHashtags.filter(t => !oldHashtags.includes(t));
            const removed = oldHashtags.filter(t => !newHashtags.includes(t));
            if (added.length > 0) {
                hashtagInfo += `\n➕ Добавлены хештеги: #${added.join(', #')}`;
            }
            if (removed.length > 0) {
                hashtagInfo += `\n➖ Удалены хештеги: #${removed.join(', #')}`;
            }
        }
        
        if (action === 'new') {
            // Добавляем информацию о хештегах
            let hashtagText = '';
            if (newHashtags && newHashtags.length > 0) {
                hashtagText = `\n🏷️ Хештеги: #${newHashtags.join(', #')}`;
            }
            message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" засчитан!${uidInfo}${hashtagInfo}\n` +
                     `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                     `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n`;
            
            if (newRewardAmount > 0) {
                const oldBalance = userBalance;
                newBalance = oldBalance + newRewardAmount;
                rewardChange = newRewardAmount;
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
            const volumeChange = oldDisplayPc !== displayPc ? ` (было ${oldDisplayPc} ПК строк, стало ${displayPc} ПК строк)` : '';

            // Информация об изменении хештегов
            let hashtagChangeText = '';
            if (oldHashtags && newHashtags) {
                const added = newHashtags.filter(t => !oldHashtags.includes(t));
                const removed = oldHashtags.filter(t => !newHashtags.includes(t));
                
                if (added.length > 0) {
                    hashtagChangeText += `\n➕ Добавлены хештеги: #${added.join(', #')}`;
                }
                if (removed.length > 0) {
                    hashtagChangeText += `\n➖ Удалены хештеги: #${removed.join(', #')}`;
                }
                if (added.length === 0 && removed.length === 0 && newHashtags.length > 0) {
                    hashtagChangeText += `\n🏷️ Хештеги: #${newHashtags.join(', #')}`;
                }
            }

            message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" отредактирован${volumeChange}!${uidInfo}${hashtagChangeText}\n` +
                    `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                    `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n`;
            
            if (rewardTransferNeeded) {
                if (oldReward > 0 && newRewardAmount > 0) {
                    const oldBalance = userBalance;
                    newBalance = oldBalance + newRewardAmount;
                    rewardChange = newRewardAmount;
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
                    message += `🔄 Награда ${oldReward} снята с другого персонажа\n`;
                    message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                } else {
                    message += `🔄 Изменен целевой персонаж, награда не изменилась\n`;
                    message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                }
            } else if (newRewardAmount !== oldReward) {
                rewardChange = newRewardAmount - oldReward;
                const oldBalance = userBalance;
                newBalance = oldBalance + rewardChange;
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
                if (newRewardAmount > 0) {
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
                    message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
                }
            }
            
            message += `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
            
        } else if (action === 'restore') {
            let hashtagText = '';
            if (newHashtags && newHashtags.length > 0) {
                hashtagText = `\n🏷️ Хештеги: #${newHashtags.join(', #')}`;
            }        

            message = `📝 ${user.name} (UID: ${user.id}), ваш ролевой пост в обсуждении "${topicMonitor.name}" восстановлен!${uidInfo}${hashtagInfo}${hashtagText}\n` +
                     `📊 Статистика: ${stats.words} слов, ${stats.characters} символов\n` +
                     `💻 ПК: ${displayPc}, 📱 МБ: ${stats.mb.toFixed(2)}\n`;
            
            if (newRewardAmount > 0) {
                if (oldReward > 0 && newRewardAmount === oldReward) {
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
                    rewardChange = newRewardAmount - oldReward;
                    const oldBalance = userBalance;
                    newBalance = oldBalance + rewardChange;
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
                message += `ℹ️ Ранее была награда ${oldReward}${coin.smile}, но сейчас не начислена\n`;
                message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
            } else {
                message += `💳 Ваш баланс не изменился: ${userBalance}${coin.smile}\n`;
            }
            
            message += `🧷 Ссылка: https://vk.com/topic${monitor.idvk}_${context.topicId}?post=${context.id}`;
        }
        
        if (rewardChange !== 0 && user.id_facult && coin?.point) {
            await updateFacultBalance(user.id_facult, coinId, rewardChange);
        }
        
        if (account && user.notification_topic) {
            try {
                await Send_Message(account.idvk, message);
            } catch (error) {
                console.error(`❌ Ошибка отправки уведомления: ${error}`);
            }
        }
        
        await logToTopicChat(topicMonitor, user, monitor, action, stats, displayPc, rewardChange, coin, context.id, false, uidSpecified, specifiedUid, newHashtags);
        
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
        return;
    }

    await prisma.balanceFacult.create({
        data: {
            id_coin: coinId,
            id_facult: facultId,
            amount: amountChange
        }
    });
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
    specifiedUid: number | null = null,
    hashtags: string[] = [],
    appliedChanges: AppliedRewardBalanceChange[] = []
) {
    try {
        const coinId = getTopicRewardCoinId(monitor);
        const coin = await prisma.allianceCoin.findFirst({ where: { id: coinId ?? 0 } });
        const alliance = await prisma.alliance.findFirst({ 
            where: { id: user.id_alliance ?? 0 } 
        });
        
        if (!alliance?.id_chat_topic || alliance.id_chat_topic === 0) {
            return;
        }
        
        const actionEmoji = {
            'new': '✅',
            'edit': '✏️',
            'delete': '🗑️',
            'restore': '↩️'
        }[action] || '📝';
        
        const rewardEmoji = rewardChange > 0 ? '💰' : rewardChange < 0 ? '💸' : '';

        const uidInfo = uidSpecified && specifiedUid ? 
            `\n🎯 Указанный UID: ${specifiedUid}` : '';
        
        // ДОБАВИТЬ ИНФОРМАЦИЮ О ХЕШТЕГАХ
        let hashtagText = '';
        if (hashtags && hashtags.length > 0) {
            hashtagText = `\n🏷️ Хештеги: #${hashtags.join(', #')}`;
        }
        
        let logMessage = `🌐 [${alliance.name}] --> (обсуждение №${monitor.id}):\n`;
        logMessage += `📖 ${topicMonitor.name}\n`;
        logMessage += `👤 @id${user.idvk}(${user.name}) (UID: ${user.id}) --> ${actionEmoji}${rewardEmoji}${uidInfo}${hashtagText}\n`;
        logMessage += `📊 ${stats.words} слов | ${stats.characters} симв | ${displayPc.toFixed(2)} ПК | ${stats.mb.toFixed(2)} МБ\n`;
        if (appliedChanges.length > 0) {
            for (const change of appliedChanges) {
                const operation = change.amountChange > 0 ? '+' : '-';
                const operationSymbol = `"${change.coin?.smile || ''}"`;
                const facultText = change.facult ? ` для факультета [${change.facult.smile} ${change.facult.name}]` : '';

                logMessage += `🔮 ${operationSymbol} > ${change.oldAmount} ${operation} ${Math.abs(change.amountChange)} = ${change.newAmount}${facultText}\n`;
            }
        } else if (rewardChange !== 0 && coin) {
            const balanceCoin = await prisma.balanceCoin.findFirst({
                where: {
                    id_coin: coin.id,
                    id_user: user.id
                }
            });
            const userBalance = balanceCoin?.amount || 0;
            const operation = rewardChange > 0 ? '+' : '-';
            const operationSymbol = `"${coin.smile}"`;
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

async function updatePostHashtagsOnEdit(
    postStatisticId: number,
    oldHashtags: string[],
    newHashtags: string[],
    monitor: any,
    allianceId: number,
    stats: any
): Promise<void> {
    // Находим хештеги, которые добавились
    const addedHashtags = newHashtags.filter(tag => !oldHashtags.includes(tag));
    // Находим хештеги, которые удалились
    const removedHashtags = oldHashtags.filter(tag => !newHashtags.includes(tag));
    
    // Для добавленных хештегов - создаем записи
    for (const hashtag of addedHashtags) {
        await prisma.postHashtag.create({
            data: {
                postStatisticId,
                hashtag,
                monitorId: monitor.id,
                allianceId
            }
        });
    }
    
    // Для удаленных хештегов - удаляем записи
    if (removedHashtags.length > 0) {
        await prisma.postHashtag.deleteMany({
            where: {
                postStatisticId,
                hashtag: { in: removedHashtags }
            }
        });
    }
}

// Меню управления хештегами для монитора
export async function MonitorHashtag_Manager(context: any, monitor: any) {
    let exit = false;
    
    while (!exit) {
        const currentHashtags = await getMonitorHashtags(monitor.id);
        
        let text = `${ico_list['monitor'].ico} Управление хештегами для монитора "${monitor.name}":\n\n`;
        
        if (currentHashtags.length === 0) {
            text += `📭 Нет отслеживаемых хештегов\n\n`;
        } else {
            text += `📋 Отслеживаемые хештеги:\n`;
            for (const tag of currentHashtags) {
                text += `   #${tag}\n`;
            }
            text += `\n`;
        }
        
        text += `💡 При обнаружении этих хештегов в постах, они будут учитываться в отдельных топа.\n`;
        text += `💡 Примеры: работа, жизнь, квест, событие\n\n`;
        
        const keyboard = new KeyboardBuilder()
            .textButton({
                label: `➕ Добавить хештег`,
                payload: { command: 'hashtag_add' },
                color: 'positive'
            })
            .row();
        
        if (currentHashtags.length > 0) {
            keyboard.textButton({
                label: `❌ Удалить хештег`,
                payload: { command: 'hashtag_remove' },
                color: 'negative'
            });
            keyboard.row();
        }
        
        keyboard.textButton({
            label: `↩️ Назад`,
            payload: { command: 'hashtag_back' },
            color: 'secondary'
        });
        
        const response = await context.question(text, { keyboard: keyboard.oneTime().inline() });
        
        if (response.isTimeout) {
            exit = true;
            continue;
        }
        
        if (!response.payload) {
            continue;
        }
        
        switch (response.payload.command) {
            case 'hashtag_add':
                const newTag = await context.question(
                    `➕ Введите название хештега (без #):\n\n` +
                    `Примеры: работа, жизнь, квест\n\n` +
                    `Или "отмена" для возврата`
                );
                
                if (newTag.isTimeout) break;
                if (newTag.text?.toLowerCase() === 'отмена') break;
                
                const tagName = newTag.text?.toLowerCase().replace(/[^a-zа-яё0-9]/g, '');
                if (tagName && tagName.length > 0 && tagName.length <= 30) {
                    const success = await addMonitorHashtag(monitor.id, tagName);
                    if (success) {
                        await context.send(`✅ Добавлен хештег #${tagName}`);
                    } else {
                        await context.send(`⚠ Хештег #${tagName} уже существует`);
                    }
                } else {
                    await context.send(`❌ Некорректное название хештега (допустимо до 30 символов)`);
                }
                break;
                
            case 'hashtag_remove':
                if (currentHashtags.length === 0) break;
                
                const removeKeyboard = new KeyboardBuilder();
                for (let i = 0; i < currentHashtags.length; i++) {
                    const tag = currentHashtags[i];
                    removeKeyboard.textButton({
                        label: `#${tag}`,
                        payload: { command: 'remove_tag', tag: tag },
                        color: 'secondary'
                    });
                    if (i < currentHashtags.length - 1) removeKeyboard.row();
                }
                removeKeyboard
                    .row()
                    .textButton({
                        label: '↩️ Назад',
                        payload: { command: 'back' },
                        color: 'secondary'
                    });
                
                const removeResponse = await context.question(
                    `❌ Выберите хештег для удаления:`,
                    { keyboard: removeKeyboard.oneTime().inline() }
                );
                
                if (removeResponse.isTimeout) break;
                if (!removeResponse.payload) break;
                
                if (removeResponse.payload.command === 'remove_tag') {
                    await removeMonitorHashtag(monitor.id, removeResponse.payload.tag);
                    await context.send(`✅ Удален хештег #${removeResponse.payload.tag}`);
                }
                break;
                
            case 'hashtag_back':
                exit = true;
                break;
        }
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
