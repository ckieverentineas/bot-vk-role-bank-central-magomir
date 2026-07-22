import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { vk } from "../../../..";
import { Logger, Send_Message } from "../../../core/helper";
import { ico_list } from "../data_center/icons_lib";
import { Keyboard } from "vk-io";

export async function Monitor_Select_Person_Handler(context: any) {
    const personId = context.eventPayload?.personId;
    if (!personId) {
        await Send_Message(context.peerId, `${ico_list['warn'].ico} Ошибка: не указан ID персонажа`);
        return;
    }
    
    const account = await prisma.account.findFirst({ 
        where: { idvk: context.userId || context.senderId } 
    });
    
    if (!account) {
        await Send_Message(context.peerId, `${ico_list['warn'].ico} Аккаунт не найден!`);
        return;
    }
    
    // Проверяем, принадлежит ли персонаж пользователю
    const person = await prisma.user.findFirst({ 
        where: { 
            id: personId, 
            id_account: account.id 
        }
    });
    
    if (!person) {
        await Send_Message(context.peerId, `${ico_list['warn'].ico} Этот персонаж не найден среди ваших персонажей!`);
        return;
    }
    
    // Проверяем, находится ли персонаж в альянсе
    if (!person.id_alliance || person.id_alliance <= 0) {
        await Send_Message(context.peerId, `${ico_list['warn'].ico} Этот персонаж не состоит в альянсе! Только персонажи в альянсах могут получать начисления от мониторов.`);
        return;
    }
    
    // Получаем информацию об альянсе
    const alliance = await prisma.alliance.findFirst({
        where: { id: person.id_alliance }
    });
    
    if (!alliance) {
        await Send_Message(context.peerId, `${ico_list['warn'].ico} Альянс не найден!`);
        return;
    }
    
    // Проверяем существующий выбор для этого альянса
    const existingSelection = await prisma.monitorSelection.findFirst({
        where: {
            accountId: account.id,
            allianceId: alliance.id
        },
        include: {
            user: true
        }
    });
    
    // Если пытаемся выбрать того же персонажа - отменяем выбор
    if (existingSelection && existingSelection.userId === personId) {
        await prisma.monitorSelection.delete({
            where: { id: existingSelection.id }
        });
        
        // Также очищаем старое поле для обратной совместимости
        await prisma.account.update({
            where: { id: account.id },
            data: { monitor_select_user: null }
        });
        
        await Send_Message(
            context.peerId,
            `${ico_list['stop'].ico} Выбор персонажа для мониторов отменен!\n\n` +
            `👤 Персонаж: ${person.name}\n` +
            `🏠 Альянс: ${alliance.name}\n\n` +
            `ℹ️ Теперь система будет использовать стандартную логику выбора персонажа для начислений в этом альянсе.`
        );
        
        await Logger(`User ${context.userId || context.senderId} deselected person ${person.id} for monitor rewards in alliance ${alliance.id}`);
    } else {
        // Создаем или обновляем выбор
        await prisma.monitorSelection.upsert({
            where: {
                accountId_allianceId: {
                    accountId: account.id,
                    allianceId: alliance.id
                }
            },
            update: {
                userId: personId
            },
            create: {
                accountId: account.id,
                userId: personId,
                allianceId: alliance.id
            }
        });
        
        // Также обновляем старое поле для обратной совместимости
        await prisma.account.update({
            where: { id: account.id },
            data: { monitor_select_user: personId }
        });
        
        // Если был предыдущий выбор, сообщаем об этом
        if (existingSelection) {
            await Send_Message(
                context.peerId,
                `${ico_list['change'].ico} Выбор персонажа для мониторов обновлен!\n\n` +
                `🔄 Было: ${existingSelection.user.name}\n` +
                `✅ Стало: ${person.name}\n` +
                `🏠 Альянс: ${alliance.name}\n\n` +
                `📊 Все активности в группах альянса "${alliance.name}" будут начисляться ${person.name}.`
            );
            
            await Logger(`User ${context.userId || context.senderId} changed monitor selection from ${existingSelection.user.id} to ${person.id} in alliance ${alliance.id}`);
        } else {
            await Send_Message(
                context.peerId,
                `${ico_list['success'].ico} Персонаж выбран для мониторов!\n\n` +
                `👤 Персонаж: ${person.name}\n` +
                `🏠 Альянс: ${alliance.name}\n\n` +
                `📊 Все активности в группах альянса "${alliance.name}" будут начисляться этому персонажу.\n` +
                `ℹ️ Этот выбор имеет приоритет над текущим открытым персонажем.`
            );
            
            await Logger(`User ${context.userId || context.senderId} selected person ${person.id} for monitor rewards in alliance ${alliance.id}`);
        }
    }
    
    // Показываем снекбар
    try {
        await vk?.api.messages.sendMessageEventAnswer({
            event_id: context.eventId,
            user_id: context.userId,
            peer_id: context.peerId,
            event_data: JSON.stringify({
                type: "show_snackbar",
                text: existingSelection && existingSelection.userId === personId ? 
                    "❌ Выбор персонажа отменен" : 
                    "✅ Персонаж выбран для мониторов"
            })
        });
    } catch (e) {
        console.error('Error showing snackbar:', e);
    }
}

export async function Get_Person_Monitor_Status(accountId: number, userId: number, allianceId?: number | null) {
    // Если accountId = 0, значит аккаунт не найден
    if (accountId === 0) {
        return { status: 'unknown', description: 'Аккаунт не найден', emoji: '❓' };
    }
    
    const account = await prisma.account.findFirst({ 
        where: { id: accountId } 
    });
    
    if (!account) {
        return { status: 'unknown', description: 'Аккаунт не найден', emoji: '❓' };
    }
    
    // Получаем информацию о персонаже
    const person = await prisma.user.findFirst({ 
        where: { id: userId } 
    });
    
    if (!person) {
        return { status: 'unknown', description: 'Персонаж не найден', emoji: '❓' };
    }
    
    // Проверяем, что персонаж принадлежит этому аккаунту
    if (person.id_account !== account.id) {
        return { status: 'wrong_account', description: 'Персонаж принадлежит другому аккаунту', emoji: '❓' };
    }
    
    // Если allianceId не передан, используем allianceId из персонажа
    const actualAllianceId = allianceId !== undefined ? allianceId : person.id_alliance;
    
    // Если персонаж не в альянсе
    if (!actualAllianceId || actualAllianceId <= 0) {
        return { 
            status: 'no_alliance', 
            description: '⚠ Персонаж не в альянсе — не получает начисления с мониторов',
            emoji: '⚠'
        };
    }
    
    // [!] ИСПРАВЛЕНИЕ: Проверяем есть ли мониторы в альянсе
    const monitorsInAlliance = await prisma.monitor.count({
        where: { id_alliance: actualAllianceId }
    });
    
    if (monitorsInAlliance === 0) {
        return { 
            status: 'no_monitors', 
            description: '', // [!] Пустая строка, чтобы ничего не показывать
            emoji: '⏸'
        };
    }
    
    // Получаем явный выбор для этого альянса
    const monitorSelection = await prisma.monitorSelection.findFirst({
        where: {
            accountId: account.id,
            allianceId: actualAllianceId
        },
        include: {
            user: true
        }
    });
    
    // Если есть явный выбор для этого альянса
    if (monitorSelection) {
        if (monitorSelection.userId === userId) {
            return { 
                status: 'selected', 
                description: '✅ Выбран для начислений от мониторов',
                emoji: '✅'
            };
        } else {
            return { 
                status: 'other_selected', 
                description: `⏸ ${monitorSelection.user.name} получает начисления с мониторов в этом альянсе`,
                emoji: '⏸'
            };
        }
    }
    
    // Проверяем старое поле для обратной совместимости
    if (account.monitor_select_user === userId) {
        if (!person.id_alliance || person.id_alliance <= 0) {
            return { 
                status: 'selected_but_no_alliance', 
                description: '✅ Выбран, но персонаж не в альянсе',
                emoji: '✅⏸'
            };
        }
        
        return { 
            status: 'selected', 
            description: '✅ Выбран для начислений от мониторов',
            emoji: '✅'
        };
    }
    
    // Проверяем текущего открытого персонажа
    const allPersonsInAlliance = await prisma.user.findMany({
        where: { 
            id_account: account.id,
            id_alliance: actualAllianceId
        }
    });
    
    if (allPersonsInAlliance.length === 0) {
        return { 
            status: 'no_alliance_persons', 
            description: '⚠ Нет персонажей в этом альянсе',
            emoji: '⚠'
        };
    }
    
    const currentPersonInAlliance = allPersonsInAlliance.find(p => p.id === account.select_user);
    
    if (currentPersonInAlliance) {
        if (currentPersonInAlliance.id === userId) {
            return { 
                status: 'current_default', 
                description: '🔶 Получает начисления с мониторов как текущий открытый персонаж',
                emoji: '🔶'
            };
        } else {
            return { 
                status: 'other_current', 
                description: `⭕ ${currentPersonInAlliance.name} получает начисления с мониторов как текущий`,
                emoji: '⭕'
            };
        }
    }
    
    // Берем первого персонажа в альянсе
    const firstPersonInAlliance = allPersonsInAlliance[0];
    
    if (firstPersonInAlliance.id === userId) {
        return { 
            status: 'auto_selected', 
            description: '🔸 Получает начисления с мониторов автоматически (первый в альянсе)',
            emoji: '🔸'
        };
    } else {
        return { 
            status: 'other_auto_selected', 
            description: `⭕ ${firstPersonInAlliance.name} получает начисления с мониторов автоматически`,
            emoji: '⭕'
        };
    }
}

// Функция для получения всех выборов пользователя
export async function GetUserMonitorSelections(accountId: number) {
    return await prisma.monitorSelection.findMany({
        where: { accountId },
        include: {
            user: true,
            alliance: true
        }
    });
}

// Функция для очистки выборов при переводе персонажа в другой альянс
export async function CleanupMonitorSelectionsForUser(userId: number) {
    const user = await prisma.user.findFirst({
        where: { id: userId }
    });
    
    if (!user) return;
    
    // Удаляем все выборы, где этот персонаж выбран
    const deleted = await prisma.monitorSelection.deleteMany({
        where: { userId }
    });
    
    // Если этот персонаж был выбран в старом поле, очищаем его
    const account = await prisma.account.findFirst({
        where: { id: user.id_account }
    });
    
    if (account && account.monitor_select_user === userId) {
        await prisma.account.update({
            where: { id: account.id },
            data: { monitor_select_user: null }
        });
    }
    
    return deleted.count;
}

// Функция для проверки, выбран ли персонаж для мониторов в конкретном альянсе
export async function IsPersonSelectedForAlliance(accountId: number, userId: number, allianceId: number): Promise<boolean> {
    const selection = await prisma.monitorSelection.findFirst({
        where: {
            accountId,
            allianceId,
            userId
        }
    });
    
    return !!selection;
}

// Функция для получения выбранного персонажа для конкретного альянса
export async function GetSelectedPersonForAlliance(accountId: number, allianceId: number) {
    const selection = await prisma.monitorSelection.findFirst({
        where: {
            accountId,
            allianceId
        },
        include: {
            user: true
        }
    });
    
    return selection?.user || null;
}