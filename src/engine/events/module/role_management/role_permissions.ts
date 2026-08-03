// engine/events/module/role_management/role_permissions.ts

export interface PermissionInfo {
    key: string;
    label: string;
    description: string;
    category: string;
    forWhat: string;
}

export const PERMISSIONS_LIST: PermissionInfo[] = [
    // ===== 1. МАССОВЫЕ ОПЕРАЦИИ =====
    { 
        key: 'canMassOperations', 
        label: '📊 Массовые начисления', 
        description: 'Доступ к !опмасс для всех персонажей',
        category: 'Массовые операции',
        forWhat: 'Начисление/снятие валют у всех игроков'
    },
    { 
        key: 'canMassKick', 
        label: '👠 Массовый кик', 
        description: 'Доступ к !кикмасс для всех персонажей',
        category: 'Массовые операции',
        forWhat: 'Исключение всех игроков из ролевой'
    },
    
    // ===== 2. УПРАВЛЕНИЕ РОЛЯМИ =====
    { 
        key: 'canManageRoles', 
        label: '⚙️ Управление ролями', 
        description: 'Создание/редактирование кастомных ролей',
        category: 'Управление ролями',
        forWhat: 'Настройка прав для разных должностей'
    },
    { 
        key: 'canManageRolesAssign', 
        label: '👥 Выдача ролей', 
        description: 'Выдача/снятие ролей с пользователей',
        category: 'Управление ролями',
        forWhat: 'Назначение ролей игрокам через !права'
    },
    
    // ===== 3. УПРАВЛЕНИЕ КОНТЕНТОМ (настройка альянса) =====
    { 
        key: 'canManageShops', 
        label: '🛍️ Управление магазинами', 
        description: 'Создание магазинов и категорий',
        category: 'Управление контентом',
        forWhat: '!магазины настроить'
    },
    { 
        key: 'canManageAbilities', 
        label: '⚡ Управление способностями', 
        description: 'Создание/редактирование способностей',
        category: 'Управление контентом',
        forWhat: '!способности настроить'
    },
    { 
        key: 'canManageSkills', 
        label: '⚔️ Управление навыками', 
        description: 'Создание/редактирование навыков',
        category: 'Управление контентом',
        forWhat: '!навыки настроить'
    },
    { 
        key: 'canManageChests', 
        label: '🎒 Управление сундуками', 
        description: 'Создание и настройка сундуков',
        category: 'Управление контентом',
        forWhat: '!сундуки настроить'
    },
    { 
        key: 'canManageLegacy', 
        label: '📦 Управление легаси', 
        description: 'Управление легаси-категориями',
        category: 'Управление контентом',
        forWhat: '!легаси настроить'
    },
    { 
        key: 'canManageBackgrounds', 
        label: '🎨 Управление фонами', 
        description: 'Настройка фонов меню и карточек',
        category: 'Управление контентом',
        forWhat: '!основу настроить, !карту настроить'
    },
    { 
        key: 'canManageFacults', 
        label: '🔮 Управление факультетами', 
        description: 'Создание/редактирование факультетов/фракций и пр.',
        category: 'Управление контентом',
        forWhat: '!факультеты настроить'
    },
    { 
        key: 'canManageClassSettings', 
        label: '👑 Управление положениями', 
        description: 'Настройка доступных положений',
        category: 'Управление контентом',
        forWhat: '!положения настроить'
    },
    { 
        key: 'canManageYearEnd', 
        label: '📅 Завершение сезона', 
        description: 'Завершение учебного/иного сезона',
        category: 'Управление контентом',
        forWhat: '!закончить сезон'
    },
    { 
        key: 'canManageSalary', 
        label: '💳 Управление зарплатами', 
        description: 'Настройка и начисление зарплат',
        category: 'Управление контентом',
        forWhat: '!зарплату настроить'
    },
    { 
        key: 'canManageFinance', 
        label: '💰 Управление валютами', 
        description: 'Создание/редактирование валют',
        category: 'Управление контентом',
        forWhat: '!валюты настроить'
    },
    { 
        key: 'canManageConverter', 
        label: '⚖️ Управление конвертацией', 
        description: 'Настройка курсов конвертации',
        category: 'Управление контентом',
        forWhat: '!конвертацию настроить'
    },
    { 
        key: 'canManageScoopins', 
        label: '🌕 Управление S-coins', 
        description: 'Настройка S-coins',
        category: 'Управление контентом',
        forWhat: '!S-coins настроить'
    },
    { 
        key: 'canManageMonitors', 
        label: '🎥 Управление мониторами', 
        description: 'Подключение/настройка мониторов',
        category: 'Управление контентом',
        forWhat: '!мониторы настроить'
    },
    { 
        key: 'canManageTopics', 
        label: '📝 Управление обсуждениями', 
        description: 'Настройка отслеживания обсуждений',
        category: 'Управление контентом',
        forWhat: '!отслеживание обсуждений'
    },
    
    // ===== 4. ПРОСМОТР ЧЕРЕЗ !опсоло =====
    { 
        key: 'canViewAllUsers', 
        label: '👁️ Просмотр всех', 
        description: 'Просмотр карточек ЛЮБЫХ персонажей через !опсоло',
        category: 'Просмотр через !опсоло',
        forWhat: 'Открытие карточки любого игрока'
    },
    { 
        key: 'canViewInventoryAll', 
        label: '👁️ Просмотр инвентаря всех', 
        description: 'Просмотр инвентаря ЛЮБЫХ игроков',
        category: 'Просмотр через !опсоло',
        forWhat: 'Просмотр инвентаря любого игрока'
    },
    
    // ===== 5. РЕДАКТИРОВАНИЕ ЧЕРЕЗ !опсоло =====
    { 
        key: 'canEditAllUsers', 
        label: '✏️ Редактирование всех', 
        description: 'Редактирование ЛЮБЫХ персонажей (имя, специализация и т.д.)',
        category: 'Редактирование через !опсоло',
        forWhat: 'Изменение данных персонажа'
    },
    { 
        key: 'canEditInventoryAll', 
        label: '✏️ Редактирование инвентаря всех', 
        description: 'Удаление/перемещение предметов у ЛЮБЫХ игроков',
        category: 'Редактирование через !опсоло',
        forWhat: 'Удаление предметов у других, перемещение между сундуками'
    },
    { 
        key: 'canGiveItemsAll', 
        label: '🎁 Выдача предметов всем', 
        description: 'Выдача предметов из хранилища ЛЮБЫМ игрокам',
        category: 'Редактирование через !опсоло',
        forWhat: 'Выдача из хранилища любому игроку'
    },
    { 
        key: 'canEditCoins', 
        label: '💰 Редактирование валют всех', 
        description: 'Начисление/снятие местных валют у ЛЮБЫХ игроков',
        category: 'Редактирование через !опсоло',
        forWhat: 'Начисление/снятие валют'
    },
    
    // ===== 6. ПРОКАЧКА И СПОСОБНОСТИ =====
    { 
        key: 'canUpgradeOthers', 
        label: '⚡ Прокачка других', 
        description: 'Прокачка способностей у ЛЮБЫХ игроков',
        category: 'Прокачка и способности',
        forWhat: 'Прокачка способностей другим игрокам'
    },
    { 
        key: 'canAssignAbility', 
        label: '⚡ Назначение способностей', 
        description: 'Назначение/удаление способностей у ЛЮБЫХ игроков',
        category: 'Прокачка и способности',
        forWhat: 'Добавление/удаление способностей у других'
    },
    { 
        key: 'canAssignSkill', 
        label: '⚔️ Назначение навыков', 
        description: 'Назначение/удаление навыков у ЛЮБЫХ игроков',
        category: 'Прокачка и способности',
        forWhat: 'Добавление/удаление навыков у других'
    },
    
    // ===== 7. НАЗНАЧЕНИЕ ВЛАДЕЛЬЦЕМ =====
    { 
        key: 'canAssignShopOwner', 
        label: '🏪 Назначение владельцем магазина', 
        description: 'Назначение игрока владельцем магазина',
        category: 'Назначение владельцем',
        forWhat: '🛍 Назначить магазин через !опсоло'
    },
];

// Получение прав по категории
export function getPermissionsByCategory(): Record<string, PermissionInfo[]> {
    const result: Record<string, PermissionInfo[]> = {};
    for (const perm of PERMISSIONS_LIST) {
        if (!result[perm.category]) result[perm.category] = [];
        result[perm.category].push(perm);
    }
    return result;
}

// Получение права по ключу
export function getPermissionInfo(key: string): PermissionInfo | undefined {
    return PERMISSIONS_LIST.find(p => p.key === key);
}