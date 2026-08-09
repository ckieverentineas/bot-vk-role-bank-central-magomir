// engine/events/module/statistics/player_statistics.ts
import { KeyboardBuilder } from 'vk-io';
import { Person_Get } from '../person/person';
import { hasAnyPermission, isAdmin, isRoot } from '../../../core/permissions';
import { User, Account, AllianceFacult } from '@prisma/client';
import prisma from '../prisma_client';
import { Send_Message, Logger } from '../../../core/helper';
import { ico_list } from '../data_center/icons_lib';
import { getTerminology } from '../alliance/terminology_helper';
import { vk } from '../../../..';

const ITEMS_PER_PAGE = 5; // Количество игроков на одной странице

interface UserWithFaculty extends User {
    facultyName?: string;
    facultySmile?: string;
}

/**
 * Получить реальное имя пользователя ВКонтакте через API
 */
async function getVkUserName(vkId: number): Promise<string> {
    try {
        if (!vk) return `id${vkId}`;
        
        const [userData] = await vk.api.users.get({ user_id: vkId });
        return `${userData.first_name} ${userData.last_name}`;
    } catch (error) {
        console.error(`Failed to get VK user name for ${vkId}:`, error);
        return `id${vkId}`;
    }
}

/**
 * Получить название ролевой
 */
async function getAllianceName(allianceId: number): Promise<string> {
    const alliance = await prisma.alliance.findFirst({
        where: { id: allianceId }
    });
    return alliance?.name || 'Ролевой проект';
}

/**
 * Получить термин для "без факультета" с учетом терминологии проекта
 */
async function getNoFacultyText(allianceId: number): Promise<string> {
    const genitive = await getTerminology(allianceId, 'genitive');
    return `Без ${genitive}`;
}

/**
 * Получить всех аккаунтов с персонажами в конкретной ролевой
 */
async function getPlayerAccounts(allianceId: number): Promise<Account[]> {
    const accounts = await prisma.account.findMany({
        where: {
            User: {
                some: {
                    id_alliance: allianceId
                }
            }
        },
        orderBy: { id: 'asc' }
    });
    return accounts;
}

/**
 * Получить персонажей аккаунта с информацией о факультетах (только для конкретной ролевой)
 */
async function getUsersForAccount(accountId: number, allianceId: number): Promise<UserWithFaculty[]> {
    const users = await prisma.user.findMany({
        where: { 
            id_account: accountId,
            id_alliance: allianceId
        },
        orderBy: { id: 'asc' }
    });

    const usersWithFaculty: UserWithFaculty[] = [];
    const noFacultyText = await getNoFacultyText(allianceId);
    
    for (const user of users) {
        let facultyName = noFacultyText;
        let facultySmile = '🔮';
        
        if (user.id_facult) {
            const facult = await prisma.allianceFacult.findFirst({
                where: { id: user.id_facult }
            });
            if (facult) {
                facultyName = facult.name;
                facultySmile = facult.smile;
            }
        }
        
        usersWithFaculty.push({
            ...user,
            facultyName,
            facultySmile
        });
    }
    
    return usersWithFaculty;
}

/**
 * Форматирует вывод статистики для одной страницы
 */
async function formatPlayerStatisticsPage(
    accounts: Account[],
    startIndex: number,
    currentPage: number,
    totalPages: number,
    allianceId: number
): Promise<string> {
    const allianceName = await getAllianceName(allianceId);
    let text = `🌟 Персонажи игроков в ролевом проекте ${allianceName}\n\n`;
    
    let globalCounter = startIndex + 1;
    
    for (const account of accounts) {
        const users = await getUsersForAccount(account.id, allianceId);
        const realName = await getVkUserName(Number(account.idvk));
        
        // Формат: "👤 1 - @id123(Иван Петров) — GUID: 1"
        text += `👤 ${globalCounter} - @id${account.idvk}(${realName}) — GUID: ${account.id}\n`;
        
        if (users.length === 0) {
            text += `   └─ Нет персонажей\n`;
        } else {
            // Древовидная структура для персонажей
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const isLast = i === users.length - 1;
                const prefix = isLast ? '   └─ ' : '   ├─ ';
                
                text += `${prefix}${user.name} (UID: ${user.id}) — ${user.facultySmile} ${user.facultyName}\n`;
            }
        }
        
        text += `\n`;
        globalCounter++;
    }
    
    // Информация о количестве
    const totalPlayers = await prisma.account.count({
        where: {
            User: {
                some: {
                    id_alliance: allianceId
                }
            }
        }
    });

    text += `${ico_list['help'].ico} Всего игроков: ${totalPlayers}`;
    
    return text;
}

/**
 * Основная функция вывода статистики по игрокам
 */
export async function PlayerStatistics(context: any) {
    const user = await Person_Get(context);
    if (!user) {
        await context.send('❌ Сначала выберите персонажа.');
        return;
    }

    // Проверка, что пользователь состоит в ролевой
    if (!user.id_alliance || user.id_alliance <= 0) {
        await context.send('❌ Вы не состоите в ролевой. Статистика доступна только для участников ролевых проектов.');
        return;
    }

    // Проверка прав: суперадмин, админ или любое кастомное право
    const hasManageRights = await hasAnyPermission(user, [
        'canViewAllUsers',
        'canManageShops', 'canManageAbilities', 'canManageSkills',
        'canManageChests', 'canManageLegacy', 'canManageBackgrounds',
        'canManageFacults', 'canManageClassSettings', 'canManageYearEnd',
        'canManageSalary', 'canManageFinance', 'canManageConverter',
        'canManageScoopins', 'canManageMonitors', 'canManageTopics',
        'canManageRoles', 'canManageRolesAssign',
        'canMassOperations', 'canMassKick'
    ]);

    if (!(await isAdmin(user)) && !(await isRoot(user)) && !hasManageRights) {
        await context.send('🔒 У вас нет прав для просмотра этой статистики.');
        return;
    }

    const allianceId = user.id_alliance;
    
    // Получаем страницу из payload (по умолчанию 0)
    const currentPage = context.eventPayload?.page || 0;

    // Получаем всех игроков (аккаунты) в ролевой
    const accounts = await getPlayerAccounts(allianceId);
    const totalItems = accounts.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalItems === 0) {
        await context.send('📭 В вашей ролевой пока нет зарегистрированных игроков.');
        return;
    }

    // Проверка на валидность страницы
    if (currentPage >= totalPages) {
        await context.send(`⚠️ Страница ${currentPage + 1} не существует. Всего страниц: ${totalPages}.`);
        return;
    }

    // Вычисляем начальный и конечный индекс для текущей страницы
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    const currentAccounts = accounts.slice(startIndex, endIndex);

    // Формируем текст сообщения
    const text = await formatPlayerStatisticsPage(
        currentAccounts,
        startIndex,
        currentPage,
        totalPages,
        allianceId
    );

    // Создаем клавиатуру как в рейтингах
    const keyboard = new KeyboardBuilder();

    // Навигация по страницам
    if (totalPages > 1) {
        if (currentPage > 0) {
            keyboard.callbackButton({
                label: `${ico_list['back'].ico}`,
                payload: {
                    command: 'player_statistics',
                    page: currentPage - 1
                },
                color: 'secondary'
            });
        }

        keyboard.callbackButton({
            label: `${currentPage + 1}/${totalPages}`,
            payload: {
                command: 'player_statistics',
                page: currentPage
            },
            color: 'primary'
        });

        if (currentPage < totalPages - 1) {
            keyboard.callbackButton({
                label: `${ico_list['next'].ico}`,
                payload: {
                    command: 'player_statistics',
                    page: currentPage + 1
                },
                color: 'secondary'
            });
        }
        
        keyboard.row();
    }

    keyboard.callbackButton({
        label: `${ico_list['stop'].ico} Закрыть`,
        payload: { 
            command: 'systemok_call',
            messageId: context.conversationMessageId
        },
        color: 'secondary'
    });

    keyboard.inline().oneTime();

    await Logger(`Пользователь ${user.idvk} просматривает статистику игроков в ролевой ${allianceId} (страница ${currentPage + 1}/${totalPages})`);
    await Send_Message(context.peerId, text, keyboard);
}