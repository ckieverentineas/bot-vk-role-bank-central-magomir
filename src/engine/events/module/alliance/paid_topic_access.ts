import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, chat_id } from "../../../..";
import { Format_Number_Correction, Send_Message } from "../../../core/helper";
import { Add_Exact_Days, Get_App_Time_Zone, Format_App_Date_Time } from "../../../core/date_time";

type AccessResult = {
    allowed: boolean;
    paid: boolean;
    reason?: "insufficient_funds" | "currency_missing" | "configuration_error";
    coinName?: string;
    coinSmile?: string;
    price?: number;
    balanceBefore?: number;
    balanceAfter?: number;
    paidUntil?: Date;
};

/**
 * Общие настройки платного доступа монитора.
 */
export async function Paid_Access_Monitor_Settings(
    context: any,
    monitorId: number,
    allianceId: number
): Promise<void> {
    let exit = false;

    while (!exit) {
        const monitor = await prisma.monitor.findFirst({
            where: { id: monitorId, id_alliance: allianceId }
        });

        if (!monitor) {
            await context.send("❌ Монитор не найден.");
            return;
        }

        const selected = await prisma.monitorPaidAccessTopic.findMany({
            where: { monitorId },
            include: { topicMonitor: true },
            orderBy: { topicMonitor: { name: "asc" } }
        });

        const coinId = monitor.paidAccessCoinId ?? monitor.id_coin;

        const coin = coinId
            ? await prisma.allianceCoin.findFirst({
                where: { id: coinId, id_alliance: allianceId }
            })
            : null;

        const keyboard = new KeyboardBuilder()
            .textButton({
                label: monitor.paidAccessEnabled
                    ? "🟢 Выключить платный доступ"
                    : "🔴 Включить платный доступ",
                payload: { command: "paid_monitor_toggle" },
                color: monitor.paidAccessEnabled ? "negative" : "positive"
            }).row()
            .textButton({
                label: "💰 Стоимость",
                payload: { command: "paid_monitor_price" },
                color: "secondary"
            })
            .textButton({
                label: "📅 Дней",
                payload: { command: "paid_monitor_days" },
                color: "secondary"
            }).row()
            .textButton({
                label: "💱 Валюта",
                payload: { command: "paid_monitor_coin" },
                color: "secondary"
            }).row()
            .textButton({
                label: "📍 Выбрать обсуждения",
                payload: { command: "paid_monitor_topics" },
                color: "primary"
            })
            .textButton({
                label: "🗂 Группы обсуждений",
                payload: { command: "paid_monitor_groups" },
                color: "primary"
            }).row()
            .textButton({
                label: "🚫 Исключения по UID",
                payload: { command: "paid_monitor_exemptions" },
                color: "secondary"
            }).row()
            .textButton({
                label: "↩️ Назад",
                payload: { command: "paid_monitor_back" },
                color: "secondary"
            })
            .oneTime();

        const selectedNames = selected.length > 0
            ? selected.map(entry => `• ${entry.topicMonitor.name}`).join("\n")
            : "Не выбраны";

        const answer: any = await context.question(
            `💳 Платный доступ — общие настройки\n` +
            `Монитор: ${monitor.name}\n\n` +
            `Статус: ${monitor.paidAccessEnabled ? "включён" : "выключен"}\n` +
            `Стоимость: ${monitor.paidAccessPrice} ${coin?.smile ?? ""}\n` +
            `Срок: ${monitor.paidAccessDays} суток (по 24 часа)\n` +
            `Валюта: ${coin ? `${coin.smile} ${coin.name}` : "не выбрана"}\n\n` +
            `Обсуждения (${selected.length}):\n${selectedNames}\n\n` +
            `В индивидуальных настройках обсуждения можно переопределить параметры.`,
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout || answer.payload?.command === "paid_monitor_back") {
            exit = true;
            continue;
        }

        switch (answer.payload?.command) {
            case "paid_monitor_toggle":
                await prisma.monitor.update({
                    where: { id: monitorId },
                    data: {
                        paidAccessEnabled: !monitor.paidAccessEnabled
                    }
                });
                break;

            case "paid_monitor_price": {
                const value = await askPositiveNumber(
                    context,
                    "Введите стоимость доступа:",
                    false,
                    1_000_000_000
                );

                if (value !== null) {
                    await prisma.monitor.update({
                        where: { id: monitorId },
                        data: { paidAccessPrice: value }
                    });
                }
                break;
            }

            case "paid_monitor_days": {
                const value = await askPositiveNumber(
                    context,
                    "Введите срок доступа в календарных днях:",
                    true,
                    3650
                );

                if (value !== null) {
                    await prisma.monitor.update({
                        where: { id: monitorId },
                        data: { paidAccessDays: value }
                    });
                }
                break;
            }

            case "paid_monitor_coin": {
                const selectedCoinId = await selectCurrency(
                    context,
                    allianceId,
                    monitor.paidAccessCoinId,
                    "Выберите валюту для платного доступа",
                    "Валюта монитора"
                );

                if (selectedCoinId !== undefined) {
                    await prisma.monitor.update({
                        where: { id: monitorId },
                        data: { paidAccessCoinId: selectedCoinId }
                    });
                }
                break;
            }

            case "paid_monitor_topics":
                await manageMonitorTopics(context, monitorId);
                break;

            case "paid_monitor_groups":
                await manageTopicGroups(context, monitorId);
                break;

            case "paid_monitor_exemptions":
                await manageExemptions(
                    context,
                    selected.map(entry => entry.topicMonitorId)
                );
                break;

            default:
                await context.send("Нажмите одну из кнопок меню.");
                break;
        }
    }
}

/**
 * Индивидуальные настройки платного доступа обсуждения.
 */
export async function Paid_Access_Topic_Settings(
    context: any,
    topicMonitorId: number,
    monitorId: number,
    allianceId: number
): Promise<void> {
    let exit = false;

    while (!exit) {
        const topic = await prisma.topicMonitor.findFirst({
            where: {
                id: topicMonitorId,
                monitorId
            },
            include: { monitor: true }
        });

        if (!topic) {
            await context.send("❌ Обсуждение не найдено.");
            return;
        }

        const mode = topic.paidAccessMode ?? "inherit";

        const selectedCoinId =
            topic.paidAccessCoinId ??
            topic.monitor.paidAccessCoinId ??
            topic.monitor.id_coin;

        const coin = selectedCoinId
            ? await prisma.allianceCoin.findFirst({
                where: {
                    id: selectedCoinId,
                    id_alliance: allianceId
                }
            })
            : null;

        const exemptions = await prisma.topicPaidAccessExemption.findMany({
            where: { topicMonitorId },
            orderBy: { uid: "asc" },
            take: 30
        });

        const actualExemptions = exemptions.filter(
            entry => entry.uid !== null
        );

        const keyboard = new KeyboardBuilder()
            .textButton({
                label: mode === "inherit"
                    ? "✅ Общие настройки"
                    : "↪️ Использовать общие",
                payload: { command: "paid_topic_inherit" },
                color: mode === "inherit" ? "positive" : "secondary"
            }).row()
            .textButton({
                label: mode === "custom"
                    ? "✅ Индивидуальные условия"
                    : "⚙️ Индивидуальные условия",
                payload: { command: "paid_topic_custom" },
                color: mode === "custom" ? "positive" : "secondary"
            }).row()
            .textButton({
                label: mode === "disabled"
                    ? "✅ Не взимать плату"
                    : "🚫 Отключить для этого обсуждения",
                payload: { command: "paid_topic_disable" },
                color: mode === "disabled" ? "positive" : "secondary"
            }).row();

        if (mode === "custom") {
            keyboard
                .textButton({
                    label: "💰 Стоимость",
                    payload: { command: "paid_topic_price" },
                    color: "secondary"
                })
                .textButton({
                    label: "📅 Дней",
                    payload: { command: "paid_topic_days" },
                    color: "secondary"
                }).row()
                .textButton({
                    label: "💱 Валюта",
                    payload: { command: "paid_topic_coin" },
                    color: "secondary"
                }).row();
        }

        keyboard
            .textButton({
                label: "🚫 Исключения по UID",
                payload: { command: "paid_topic_exemptions" },
                color: "secondary"
            }).row()
            .textButton({
                label: "↩️ Назад",
                payload: { command: "paid_topic_back" },
                color: "secondary"
            })
            .oneTime();

        let statusText = "использует общие настройки монитора";

        if (mode === "custom") {
            statusText =
                `индивидуальные условия: ` +
                `${topic.paidAccessPrice ?? topic.monitor.paidAccessPrice} ` +
                `${coin?.smile ?? ""} на ` +
                `${topic.paidAccessDays ?? topic.monitor.paidAccessDays} дн.`;
        } else if (mode === "disabled") {
            statusText = "платный доступ отключён";
        }

        const answer: any = await context.question(
            `💳 Платный доступ — ${topic.name}\n\n` +
            `Режим: ${statusText}\n` +
            `Валюта: ${coin ? `${coin.smile} ${coin.name}` : "валюта монитора"}\n` +
            `Исключений UID: ${actualExemptions.length}\n` +
            `UID: ${actualExemptions.map(entry => entry.uid).join(", ") || "нет"}\n\n` +
            `Общие настройки действуют только для выбранных в мониторе обсуждений.`,
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout || answer.payload?.command === "paid_topic_back") {
            exit = true;
            continue;
        }

        switch (answer.payload?.command) {
            case "paid_topic_inherit":
                await prisma.topicMonitor.update({
                    where: { id: topicMonitorId },
                    data: { paidAccessMode: "inherit" }
                });
                break;

            case "paid_topic_custom":
                await prisma.topicMonitor.update({
                    where: { id: topicMonitorId },
                    data: { paidAccessMode: "custom" }
                });
                break;

            case "paid_topic_disable":
                await prisma.topicMonitor.update({
                    where: { id: topicMonitorId },
                    data: { paidAccessMode: "disabled" }
                });
                break;

            case "paid_topic_price": {
                const value = await askPositiveNumber(
                    context,
                    "Введите индивидуальную стоимость доступа:",
                    false,
                    1_000_000_000
                );

                if (value !== null) {
                    await prisma.topicMonitor.update({
                        where: { id: topicMonitorId },
                        data: { paidAccessPrice: value }
                    });
                }
                break;
            }

            case "paid_topic_days": {
                const value = await askPositiveNumber(
                    context,
                    "Введите индивидуальный срок доступа:",
                    true,
                    3650
                );

                if (value !== null) {
                    await prisma.topicMonitor.update({
                        where: { id: topicMonitorId },
                        data: { paidAccessDays: value }
                    });
                }
                break;
            }

            case "paid_topic_coin": {
                const selectedCoinId = await selectCurrency(
                    context,
                    allianceId,
                    topic.paidAccessCoinId,
                    "Выберите валюту для этого обсуждения",
                    "Валюта общих настроек"
                );

                if (selectedCoinId !== undefined) {
                    await prisma.topicMonitor.update({
                        where: { id: topicMonitorId },
                        data: { paidAccessCoinId: selectedCoinId }
                    });
                }
                break;
            }

            case "paid_topic_exemptions":
                await manageExemptions(context, [topicMonitorId]);
                break;

            default:
                await context.send("Нажмите одну из кнопок меню.");
                break;
        }
    }
}

/**
 * Проверка доступа и списание выбранной валюты.
 */
export async function Ensure_Topic_Paid_Access(
    user: any,
    monitor: any,
    topicMonitor: any,
    postContext: any
): Promise<AccessResult> {

    const mode = topicMonitor.paidAccessMode ?? "inherit";

    if (mode === "disabled") {
        return { allowed: true, paid: false };
    }

    // В группе все обсуждения используют одну оплату. Если обсуждение не состоит
    // в группе, область оплаты ограничивается им самим.
    const groupTopics = topicMonitor.paidAccessGroupId
        ? await prisma.topicMonitor.findMany({
            where: {
                monitorId: monitor.id,
                paidAccessGroupId: topicMonitor.paidAccessGroupId
            },
            select: { id: true }
        })
        : [{ id: topicMonitor.id }];
    const accessTopicIds = Array.from(new Set([
        topicMonitor.id,
        ...groupTopics.map((entry: any) => entry.id)
    ]));

    const selectedForMonitor = await prisma.monitorPaidAccessTopic.findFirst({
        where: {
            monitorId: monitor.id,
            topicMonitorId: { in: accessTopicIds }
        }
    });

    const enabled =
        mode === "custom" ||
        (mode === "inherit" &&
            monitor.paidAccessEnabled &&
            Boolean(selectedForMonitor));

    if (!enabled) {
        return { allowed: true, paid: false };
    }

    // UID-исключение, заданное для любой локации группы, действует на всю группу.
    const exemption = await prisma.topicPaidAccessExemption.findFirst({
        where: {
            topicMonitorId: { in: accessTopicIds },
            uid: user.id
        }
    });

    if (exemption) {
        return { allowed: true, paid: false };
    }

    const now = new Date();

    // Ищем действующую оплату в любом обсуждении группы, а не только в текущем.
    const existingAccess = await prisma.topicPaidAccess.findFirst({
        where: {
            topicMonitorId: { in: accessTopicIds },
            userId: user.id,
            paidUntil: { gt: now }
        },
        orderBy: { paidUntil: "desc" }
    });

    if (existingAccess?.paidUntil && existingAccess.paidUntil > now) {
        // Синхронизируем срок на текущую локацию, если запись отсутствовала.
        await prisma.topicPaidAccess.upsert({
            where: {
                topicMonitorId_userId: {
                    topicMonitorId: topicMonitor.id,
                    userId: user.id
                }
            },
            create: {
                topicMonitorId: topicMonitor.id,
                userId: user.id,
                paidUntil: existingAccess.paidUntil,
                chargedCoinId: existingAccess.chargedCoinId,
                chargedAmount: existingAccess.chargedAmount
            },
            update: { paidUntil: existingAccess.paidUntil }
        });
        return {
            allowed: true,
            paid: false,
            paidUntil: existingAccess.paidUntil
        };
    }

    const price = mode === "custom"
        ? (topicMonitor.paidAccessPrice ?? monitor.paidAccessPrice ?? 30)
        : (monitor.paidAccessPrice ?? 30);

    const days = mode === "custom"
        ? (topicMonitor.paidAccessDays ?? monitor.paidAccessDays ?? 3)
        : (monitor.paidAccessDays ?? 3);

    const coinId =
        (mode === "custom" ? topicMonitor.paidAccessCoinId : null) ??
        monitor.paidAccessCoinId ??
        monitor.id_coin ??
        null;

    if (
        !coinId ||
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 1_000_000_000 ||
        !Number.isInteger(days) ||
        days <= 0 ||
        days > 3650
    ) {
        return {
            allowed: false,
            paid: false,
            reason: "configuration_error",
            price
        };
    }

    const coin = await prisma.allianceCoin.findFirst({
        where: {
            id: coinId,
            id_alliance: monitor.id_alliance
        }
    });

    if (!coin) {
        return {
            allowed: false,
            paid: false,
            reason: "currency_missing",
            price
        };
    }

    const purchasedAt = new Date();
    const paidUntil = Add_Exact_Days(purchasedAt, days);

    const charge = await prisma.$transaction(async (tx) => {

        const balance = await tx.balanceCoin.findFirst({
            where: {
                id_coin: coinId,
                id_user: user.id
            }
        });

        const balanceBefore = balance?.amount ?? 0;

        if (!balance || balanceBefore < price) {
            return {
                success: false as const,
                balanceBefore
            };
        }

        await tx.balanceCoin.update({
            where: { id: balance.id },
            data: {
                amount: { decrement: price }
            }
        });

        if (coin.point && user.id_facult) {

            const facultyBalance = await tx.balanceFacult.findFirst({
                where: {
                    id_coin: coinId,
                    id_facult: user.id_facult
                }
            });

            if (facultyBalance) {
                await tx.balanceFacult.update({
                    where: { id: facultyBalance.id },
                    data: {
                        amount: { decrement: price }
                    }
                });
            } else {
                await tx.balanceFacult.create({
                    data: {
                        id_coin: coinId,
                        id_facult: user.id_facult,
                        amount: -price
                    }
                });
            }
        }

        // Одна оплата открывает текущую локацию и все обсуждения её группы.
        for (const accessTopicId of accessTopicIds) {
            await tx.topicPaidAccess.upsert({
                where: {
                    topicMonitorId_userId: {
                        topicMonitorId: accessTopicId,
                        userId: user.id
                    }
                },
                create: {
                    topicMonitorId: accessTopicId,
                    userId: user.id,
                    paidUntil,
                    chargedCoinId: coinId,
                    chargedAmount: price
                },
                update: {
                    paidUntil,
                    chargedCoinId: coinId,
                    chargedAmount: price
                }
            });
        }

        return {
            success: true as const,
            balanceBefore,
            balanceAfter: balanceBefore - price
        };
    });

    if (!charge.success) {
        return {
            allowed: false,
            paid: false,
            reason: "insufficient_funds",
            coinName: coin.name,
            coinSmile: coin.smile,
            price,
            balanceBefore: charge.balanceBefore
        };
    }

    await logPaidAccessPurchase(
        user,
        monitor,
        topicMonitor,
        coin,
        price,
        charge.balanceBefore,
        charge.balanceAfter,
        postContext,
        paidUntil
    );

    return {
        allowed: true,
        paid: true,
        coinName: coin.name,
        coinSmile: coin.smile,
        price,
        balanceBefore: charge.balanceBefore,
        balanceAfter: charge.balanceAfter,
        paidUntil
    };
}

/**
 * Управление списком обсуждений, использующих общие настройки монитора.
 */
async function manageMonitorTopics(
    context: any,
    monitorId: number
): Promise<void> {

    let cursor = 0;
    let exit = false;
    const pageSize = 5;

    while (!exit) {

        const topics = await prisma.topicMonitor.findMany({
            where: { monitorId },
            orderBy: { name: "asc" },
            skip: cursor,
            take: pageSize
        });

        const selected = await prisma.monitorPaidAccessTopic.findMany({
            where: { monitorId }
        });

        const selectedIds = new Set(
            selected.map(entry => entry.topicMonitorId)
        );

        const total = await prisma.topicMonitor.count({
            where: { monitorId }
        });

        const keyboard = new KeyboardBuilder();

        for (const topic of topics) {
            const isSelected = selectedIds.has(topic.id);
            const groupLabel = topic.paidAccessGroupId ? " 🗂" : "";

            keyboard.textButton({
                label: `${isSelected ? "✅" : "▫️"}${groupLabel} ${topic.name.slice(0, 21)}`,
                payload: {
                    command: "paid_topic_toggle_selection",
                    topicMonitorId: topic.id
                },
                color: isSelected ? "positive" : "secondary"
            }).row();
        }

        if (cursor > 0) {
            keyboard.textButton({
                label: "⬅️",
                payload: { command: "paid_topics_prev" },
                color: "secondary"
            });
        }

        if (cursor + pageSize < total) {
            keyboard.textButton({
                label: "➡️",
                payload: { command: "paid_topics_next" },
                color: "secondary"
            });
        }

        keyboard.row()
            .textButton({
                label: "✅ Выбрать все",
                payload: { command: "paid_topics_all" },
                color: "positive"
            })
            .textButton({
                label: "Очистить",
                payload: { command: "paid_topics_clear" },
                color: "negative"
            }).row()
            .textButton({
                label: "↩️ Назад",
                payload: { command: "paid_topics_back" },
                color: "secondary"
            })
            .oneTime();

        const answer: any = await context.question(
            `📍 Выберите обсуждения для общих правил платного доступа.\n` +
            `Выбрано: ${selectedIds.size} из ${total}.\n` +
            `Страница ${Math.floor(cursor / pageSize) + 1} из ${Math.max(1, Math.ceil(total / pageSize))}.`,
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout || answer.payload?.command === "paid_topics_back") {
            exit = true;
            continue;
        }

        switch (answer.payload?.command) {

            case "paid_topic_toggle_selection": {
                const topicMonitorId = Number(answer.payload.topicMonitorId);

                if (!Number.isInteger(topicMonitorId) || topicMonitorId <= 0) {
                    break;
                }

                const link = await prisma.monitorPaidAccessTopic.findFirst({
                    where: { monitorId, topicMonitorId }
                });

                if (link) {
                    const topic = await prisma.topicMonitor.findFirst({
                        where: { id: topicMonitorId, monitorId },
                        select: { paidAccessGroupId: true }
                    });
                    if (topic?.paidAccessGroupId) {
                        await context.send("Сначала удалите обсуждение из группы. Иначе группа перестанет работать как единый доступ.");
                        break;
                    }
                    await prisma.monitorPaidAccessTopic.delete({
                        where: { id: link.id }
                    });
                } else {
                    await prisma.monitorPaidAccessTopic.create({
                        data: { monitorId, topicMonitorId }
                    });
                }
                break;
            }

            case "paid_topics_prev":
                cursor = Math.max(0, cursor - pageSize);
                break;

            case "paid_topics_next":
                cursor = cursor + pageSize < total
                    ? cursor + pageSize
                    : cursor;
                break;

            case "paid_topics_all": {
                const allTopics = await prisma.topicMonitor.findMany({
                    where: { monitorId },
                    select: { id: true }
                });

                for (const topic of allTopics) {
                    await prisma.monitorPaidAccessTopic.upsert({
                        where: { topicMonitorId: topic.id },
                        create: {
                            monitorId,
                            topicMonitorId: topic.id
                        },
                        update: { monitorId }
                    });
                }
                break;
            }

            case "paid_topics_clear": {
                const groupedTopics = await prisma.topicMonitor.findMany({
                    where: { monitorId, paidAccessGroupId: { not: null } },
                    select: { id: true }
                });
                const groupedIds = groupedTopics.map((topic: any) => topic.id);
                if (groupedIds.length > 0) {
                    await prisma.monitorPaidAccessTopic.deleteMany({
                        where: {
                            monitorId,
                            topicMonitorId: { notIn: groupedIds }
                        }
                    });
                } else {
                    await prisma.monitorPaidAccessTopic.deleteMany({ where: { monitorId } });
                }
                cursor = 0;
                break;
            }

            default:
                await context.send("Нажмите одну из кнопок списка.");
                break;
        }
    }
}

/**
 * Группировка обсуждений внутри конкретного монитора.
 * Назначение обсуждения в группу автоматически включает его в список платных локаций.
 */
async function manageTopicGroups(context: any, monitorId: number): Promise<void> {
    let exit = false;

    while (!exit) {
        const groups = await prisma.monitorTopicGroup.findMany({
            where: { monitorId },
            orderBy: { name: "asc" }
        });
        const counts = await prisma.topicMonitor.groupBy({
            by: ["paidAccessGroupId"],
            where: { monitorId, paidAccessGroupId: { not: null } },
            _count: { _all: true }
        });
        const countByGroup = new Map<number, number>();
        for (const entry of counts) {
            if (entry.paidAccessGroupId !== null) {
                countByGroup.set(entry.paidAccessGroupId, entry._count._all);
            }
        }

        const keyboard = new KeyboardBuilder();
        for (const group of groups) {
            keyboard.textButton({
                label: `🗂 ${group.name.slice(0, 28)} (${countByGroup.get(group.id) ?? 0})`,
                payload: { command: "paid_group_open", groupId: group.id },
                color: "secondary"
            }).row();
        }

        keyboard.textButton({
            label: "➕ Создать группу",
            payload: { command: "paid_group_create" },
            color: "positive"
        }).row()
        .textButton({
            label: "↩️ Назад",
            payload: { command: "paid_group_back" },
            color: "secondary"
        }).oneTime();

        const answer: any = await context.question(
            `🗂 Группы обсуждений монитора\n\n` +
            `Оплата любого обсуждения внутри группы откроет все обсуждения этой группы.\n` +
            `Обсуждение может входить только в одну группу.\n\n` +
            (groups.length ? "Выберите группу для настройки:" : "Групп пока нет."),
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout || answer.payload?.command === "paid_group_back") {
            exit = true;
            continue;
        }

        if (answer.payload?.command === "paid_group_create") {
            const nameAnswer: any = await context.question(
                "Введите название новой группы обсуждений (до 40 символов):",
                { answerTimeLimit }
            );
            if (nameAnswer.isTimeout) continue;
            const name = String(nameAnswer.text ?? "").trim().slice(0, 40);
            if (!name) {
                await context.send("❌ Название группы не может быть пустым.");
                continue;
            }
            try {
                const group = await prisma.monitorTopicGroup.create({
                    data: { monitorId, name }
                });
                await manageTopicGroup(context, monitorId, group.id);
            } catch (error) {
                await context.send("❌ Не удалось создать группу. Проверьте, нет ли группы с таким названием.");
            }
            continue;
        }

        if (answer.payload?.command === "paid_group_open") {
            const groupId = Number(answer.payload.groupId);
            if (Number.isInteger(groupId) && groupId > 0) {
                await manageTopicGroup(context, monitorId, groupId);
            }
        }
    }
}

async function manageTopicGroup(context: any, monitorId: number, groupId: number): Promise<void> {
    let exit = false;

    while (!exit) {
        const group = await prisma.monitorTopicGroup.findFirst({
            where: { id: groupId, monitorId }
        });
        if (!group) return;

        const members = await prisma.topicMonitor.findMany({
            where: { monitorId, paidAccessGroupId: groupId },
            orderBy: { name: "asc" }
        });
        const keyboard = new KeyboardBuilder()
            .textButton({
                label: "📍 Состав группы",
                payload: { command: "paid_group_members" },
                color: "primary"
            }).row()
            .textButton({
                label: "✏️ Переименовать",
                payload: { command: "paid_group_rename" },
                color: "secondary"
            })
            .textButton({
                label: "🗑 Удалить группу",
                payload: { command: "paid_group_delete" },
                color: "negative"
            }).row()
            .textButton({
                label: "↩️ Назад",
                payload: { command: "paid_group_detail_back" },
                color: "secondary"
            }).oneTime();

        const names = members.length
            ? members.map(member => `• ${member.name}`).join("\n")
            : "Пока нет обсуждений";
        const answer: any = await context.question(
            `🗂 Группа: ${group.name}\n` +
            `Обсуждений: ${members.length}\n\n${names}\n\n` +
            `Оплата одного обсуждения откроет доступ ко всем участникам группы.`,
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout || answer.payload?.command === "paid_group_detail_back") {
            exit = true;
            continue;
        }

        switch (answer.payload?.command) {
            case "paid_group_members":
                await manageTopicGroupMembers(context, monitorId, groupId);
                break;
            case "paid_group_rename": {
                const nameAnswer: any = await context.question(
                    `Введите новое название для группы «${group.name}»:`,
                    { answerTimeLimit }
                );
                if (nameAnswer.isTimeout) break;
                const name = String(nameAnswer.text ?? "").trim().slice(0, 40);
                if (!name) {
                    await context.send("❌ Название не может быть пустым.");
                    break;
                }
                try {
                    await prisma.monitorTopicGroup.update({
                        where: { id: groupId },
                        data: { name }
                    });
                } catch (error) {
                    await context.send("❌ Такое название группы уже используется в этом мониторе.");
                }
                break;
            }
            case "paid_group_delete": {
                const confirm = await context.question(
                    `Удалить группу «${group.name}»? Обсуждения останутся отдельными платными локациями.`,
                    { answerTimeLimit }
                );
                const agreed = /^(да|yes|удалить)$/i.test(String(confirm.text ?? "").trim());
                if (agreed) {
                    await prisma.topicMonitor.updateMany({
                        where: { monitorId, paidAccessGroupId: groupId },
                        data: { paidAccessGroupId: null }
                    });
                    await prisma.monitorTopicGroup.delete({ where: { id: groupId } });
                    await context.send("✅ Группа удалена. Обсуждения остались в настройках платного доступа по отдельности.");
                    exit = true;
                } else if (!confirm.isTimeout) {
                    await context.send("Удаление отменено.");
                }
                break;
            }
        }
    }
}

async function manageTopicGroupMembers(context: any, monitorId: number, groupId: number): Promise<void> {
    let cursor = 0;
    let exit = false;
    const pageSize = 5;

    while (!exit) {
        const group = await prisma.monitorTopicGroup.findFirst({ where: { id: groupId, monitorId } });
        if (!group) return;

        const topics = await prisma.topicMonitor.findMany({
            where: { monitorId },
            orderBy: { name: "asc" },
            skip: cursor,
            take: pageSize
        });
        const total = await prisma.topicMonitor.count({ where: { monitorId } });
        const membersCount = await prisma.topicMonitor.count({
            where: { monitorId, paidAccessGroupId: groupId }
        });

        const keyboard = new KeyboardBuilder();
        for (const topic of topics) {
            const isMember = topic.paidAccessGroupId === groupId;
            const otherGroup = topic.paidAccessGroupId !== null && topic.paidAccessGroupId !== groupId;
            keyboard.textButton({
                label: `${isMember ? "✅" : otherGroup ? "↪️" : "▫️"} ${topic.name.slice(0, 23)}`,
                payload: { command: "paid_group_toggle_member", topicMonitorId: topic.id },
                color: isMember ? "positive" : "secondary"
            }).row();
        }

        if (cursor > 0) {
            keyboard.textButton({ label: "⬅️", payload: { command: "paid_group_members_prev" }, color: "secondary" });
        }
        if (cursor + pageSize < total) {
            keyboard.textButton({ label: "➡️", payload: { command: "paid_group_members_next" }, color: "secondary" });
        }
        keyboard.row()
            .textButton({ label: "↩️ Назад", payload: { command: "paid_group_members_back" }, color: "secondary" })
            .oneTime();

        const answer: any = await context.question(
            `📍 Состав группы «${group.name}»\n` +
            `Обсуждений в группе: ${membersCount}. Страница ${Math.floor(cursor / pageSize) + 1} из ${Math.max(1, Math.ceil(total / pageSize))}.\n\n` +
            `✅ — уже в этой группе; ↪️ — перенос из другой группы; ▫️ — добавить.\n` +
            `Нажмите обсуждение, чтобы добавить или убрать его.`,
            { keyboard, answerTimeLimit }
        );

        if (answer.isTimeout || answer.payload?.command === "paid_group_members_back") {
            exit = true;
            continue;
        }

        switch (answer.payload?.command) {
            case "paid_group_members_prev":
                cursor = Math.max(0, cursor - pageSize);
                break;
            case "paid_group_members_next":
                cursor = cursor + pageSize < total ? cursor + pageSize : cursor;
                break;
            case "paid_group_toggle_member": {
                const topicMonitorId = Number(answer.payload.topicMonitorId);
                if (!Number.isInteger(topicMonitorId) || topicMonitorId <= 0) break;
                const topic = await prisma.topicMonitor.findFirst({
                    where: { id: topicMonitorId, monitorId }
                });
                if (!topic) break;

                if (topic.paidAccessGroupId === groupId) {
                    await prisma.topicMonitor.update({
                        where: { id: topicMonitorId },
                        data: { paidAccessGroupId: null }
                    });
                } else {
                    await prisma.topicMonitor.update({
                        where: { id: topicMonitorId },
                        data: { paidAccessGroupId: groupId }
                    });
                    // Включаем обсуждение в список платных локаций монитора.
                    await prisma.monitorPaidAccessTopic.upsert({
                        where: { topicMonitorId },
                        create: { monitorId, topicMonitorId },
                        update: { monitorId }
                    });
                }
                break;
            }
        }
    }
}

/**
 * Исключения по UID.
 * Поддерживает как общие, так и индивидуальные настройки обсуждений.
 */
async function manageExemptions(
    context: any,
    topicMonitorIds: number[]
): Promise<void> {

    const ids = Array.from(
        new Set(topicMonitorIds.filter(
            id => Number.isInteger(id) && id > 0
        ))
    );

    if (ids.length === 0) {
        await context.send(
            "Сначала выберите обсуждения для платного доступа в общих настройках монитора."
        );
        return;
    }

    let exit = false;

    while (!exit) {

        const rows = await prisma.topicPaidAccessExemption.findMany({
            where: {
                topicMonitorId: { in: ids }
            },
            orderBy: { uid: "asc" }
        });

        const byUid = new Map<number, number>();

        for (const row of rows) {
            // Старые NULL-строки оставляем, но не считаем исключениями.
            if (row.uid === null) continue;

            byUid.set(
                row.uid,
                (byUid.get(row.uid) ?? 0) + 1
            );
        }

        const keyboard = new KeyboardBuilder()
            .textButton({
                label: "➕ Добавить / убрать UID",
                payload: { command: "paid_exemption_toggle" },
                color: "primary"
            }).row()
            .textButton({
                label: "↩️ Назад",
                payload: { command: "paid_exemption_back" },
                color: "secondary"
            })
            .oneTime();

        const exceptionText = Array.from(byUid.entries())
            .map(([uid, count]) =>
                `• UID ${uid} — исключён в ${count} из ${ids.length} обсуждений`
            )
            .join("\n") || "Нет исключений";

        const answer: any = await context.question(
            `🚫 Исключения из платы\n\n` +
            `Список применяется ко всем выбранным обсуждениям.\n` +
            `${exceptionText}\n\n` +
            `Введите UID: если он уже исключён хотя бы в одном выбранном обсуждении, ` +
            `исключение будет снято со всех; иначе добавится во все.`,
            { keyboard, answerTimeLimit }
        );

        if (
            answer.isTimeout ||
            answer.payload?.command === "paid_exemption_back"
        ) {
            exit = true;
            continue;
        }

        if (answer.payload?.command === "paid_exemption_toggle") {

            const uid = await askPositiveNumber(
                context,
                "Введите UID персонажа:",
                true
            );

            if (uid === null) continue;

            const exists = await prisma.topicPaidAccessExemption.count({
                where: {
                    topicMonitorId: { in: ids },
                    uid
                }
            });

            if (exists > 0) {
                await prisma.topicPaidAccessExemption.deleteMany({
                    where: {
                        topicMonitorId: { in: ids },
                        uid
                    }
                });

                await context.send(
                    `✅ Исключение для UID ${uid} снято со всех выбранных обсуждений.`
                );
            } else {

                for (const topicMonitorId of ids) {

                    const existing = await prisma.topicPaidAccessExemption.findFirst({
                        where: { topicMonitorId, uid }
                    });

                    if (!existing) {
                        await prisma.topicPaidAccessExemption.create({
                            data: { topicMonitorId, uid }
                        });
                    }
                }

                await context.send(
                    `✅ UID ${uid} добавлен в исключения для всех выбранных обсуждений.`
                );
            }
        }
    }
}

/**
 * Выбор валюты.
 */
async function selectCurrency(
    context: any,
    allianceId: number,
    currentCoinId: number | null,
    title: string,
    defaultLabel: string
): Promise<number | null | undefined> {

    const coins = await prisma.allianceCoin.findMany({
        where: { id_alliance: allianceId },
        orderBy: { order: "asc" }
    });

    if (coins.length === 0) {
        await context.send("❌ В этом ролевом проекте пока нет валют.");
        return undefined;
    }

    const keyboard = new KeyboardBuilder();

    keyboard.textButton({
        label: `${defaultLabel}${currentCoinId === null ? " ✅" : ""}`,
        payload: {
            command: "paid_coin_selected",
            coinId: -1
        },
        color: currentCoinId === null ? "positive" : "secondary"
    }).row();

    for (const coin of coins) {
        keyboard.textButton({
            label:
                `${coin.smile} ${coin.name.slice(0, 18)}` +
                `${coin.id === currentCoinId ? " ✅" : ""}`,
            payload: {
                command: "paid_coin_selected",
                coinId: coin.id
            },
            color: coin.id === currentCoinId ? "positive" : "secondary"
        }).row();
    }

    keyboard.textButton({
        label: "↩️ Отмена",
        payload: { command: "paid_coin_cancel" },
        color: "secondary"
    }).oneTime();

    const answer: any = await context.question(
        title,
        { keyboard, answerTimeLimit }
    );

    if (
        answer.isTimeout ||
        answer.payload?.command === "paid_coin_cancel"
    ) {
        return undefined;
    }

    if (answer.payload?.command !== "paid_coin_selected") {
        return undefined;
    }

    return Number(answer.payload.coinId) === -1
        ? null
        : Number(answer.payload.coinId);
}

/**
 * Ввод положительного числа.
 */
async function askPositiveNumber(
    context: any,
    prompt: string,
    integerOnly: boolean,
    maxValue: number = 2_147_483_647
): Promise<number | null> {

    const answer: any = await context.question(
        `${prompt}\nВведите «отмена» для возврата.`,
        { answerTimeLimit }
    );

    if (answer.isTimeout) return null;

    const raw = String(answer.text ?? "")
        .trim()
        .toLowerCase();

    if (!raw || raw === "отмена") return null;

    const value = Number(raw.replace(",", "."));

    if (
        !Number.isFinite(value) ||
        value <= 0 ||
        value > maxValue ||
        (integerOnly && !Number.isInteger(value))
    ) {
        await context.send(
            integerOnly
                ? "❌ Нужно ввести положительное целое число."
                : "❌ Нужно ввести положительное число."
        );
        return null;
    }

    return value;
}

/**
 * Уведомление пользователю при недостатке средств или ошибке настроек.
 */
export async function Notify_Topic_Paid_Access_Denied(
    user: any,
    result: AccessResult
): Promise<void> {

    let message =
        "❌ Пост не засчитан: для этой локации требуется оплатить доступ.\n";

    if (result.reason === "insufficient_funds") {

        message +=
            `Стоимость доступа: ${result.price} ` +
            `${result.coinSmile ?? ""} ${result.coinName ?? ""}.\n`;

        message +=
            `Ваш баланс: ${result.balanceBefore ?? 0}. ` +
            `Пополните счёт и отправьте пост заново.`;

    } else if (result.reason === "currency_missing") {

        message +=
            "Валюта платного доступа не найдена. Обратитесь к администрации проекта.";

    } else {

        message +=
            "Настройки платного доступа заполнены некорректно. Обратитесь к администрации проекта.";
    }

    await Send_Message(Number(user.idvk), message);
}

/**
 * Уведомление пользователя после оплаты.
 */
export async function Notify_Topic_Paid_Access_Charged(
    user: any,
    topicName: string,
    result: AccessResult
): Promise<void> {

    if (!result.paid || !result.paidUntil) return;

    await Send_Message(
        Number(user.idvk),
        `💳 Оплачен доступ к локации «${topicName}».\n` +
        `Списано: ${result.price} ${result.coinSmile ?? ""} ${result.coinName ?? ""}.\n` +
        `Доступ действует до ${Format_App_Date_Time(result.paidUntil)} (${Get_App_Time_Zone()}).`
    );
}

/**
 * Лог покупки доступа в формате финансовых логов проекта.
 */
async function logPaidAccessPurchase(
    user: any,
    monitor: any,
    topicMonitor: any,
    coin: any,
    price: number,
    balanceBefore: number,
    balanceAfter: number,
    postContext: any,
    paidUntil: Date
): Promise<void> {

    try {
        const alliance = await prisma.alliance.findFirst({
            where: { id: monitor.id_alliance }
        });

        if (!alliance) return;

        const paidUntilText = Format_App_Date_Time(paidUntil);

        const userVkId = String(user.idvk);

        const userName = String(
            user.name ?? "Пользователь"
        ).replace(/[\[\]|]/g, "");

        const userLink = `https://vk.ru/id${userVkId}`;

        const postId = Number(postContext?.id ?? 0);

        const topicId = Number(
            topicMonitor.topicId ?? postContext?.topicId ?? 0
        );

        const topicUrl =
            `https://vk.com/topic${monitor.idvk}_${topicId}` +
            (postId > 0 ? `?post=${postId}` : "");

        const logMessage =
            `🌐 [${String(alliance.name ?? "Неизвестный проект").trim()}]:\n` +
            `📖 ${topicMonitor.name}\n` +
            `💰 [${userLink}|${userName || userVkId}] (UID: ${user.id}) оплатил доступ к локации\n` +
            `💳 ${Format_Number_Correction(balanceBefore)} - ` +
            `${Format_Number_Correction(price)} = ` +
            `${Format_Number_Correction(balanceAfter)}` +
            `${coin.smile ?? ""} ${coin.name ?? ""}\n` +
            `📅 Действует до ${paidUntilText} (${Get_App_Time_Zone()})\n` +
            `🔗 [${topicUrl}|${topicUrl}]`;

        const localChatId = Number(
            alliance.id_chat_monitor ?? 0
        );

        const targetChatId =
            localChatId > 0
                ? localChatId
                : Number(chat_id);

        const delivered = await Send_Message(
            targetChatId,
            logMessage
        );

        if (
            !delivered &&
            Number(chat_id) > 0 &&
            targetChatId !== Number(chat_id)
        ) {
            await Send_Message(
                Number(chat_id),
                logMessage
            );
        }

    } catch (error) {
        console.error(
            "Ошибка отправки лога покупки платного доступа:",
            error
        );
    }
}

