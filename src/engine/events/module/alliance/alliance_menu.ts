// engine/events/module/alliance/alliance_menu.ts

import { Alliance, User } from "@prisma/client"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"
import { Person_Coin_Printer } from "../person/person_coin"
import { Facult_Rank_Printer } from "./facult_rank"
import { Keyboard, KeyboardBuilder } from "vk-io"
import { Accessed, Logger, Send_Message } from "../../../core/helper"
import { hasPermission, hasAnyPermission, isAdmin } from "../../../core/permissions"
import { ico_list } from "../data_center/icons_lib"

export async function Alliance_Enter(context:any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (!get_user) { return }
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const text = `${ico_list['alliance'].ico} Добро пожаловать в [${alli_get?.name} - 📜 AUID: ${alli_get?.id}] \n${facult_rank}`
    const keyboard = new KeyboardBuilder()
    
    if (await prisma.allianceShop.findFirst({ where: { id_alliance: get_user.id_alliance ?? 0 } })) {
        keyboard.textButton({ label: `🛍 Магазины`, payload: { command: 'operation_enter' }, color: 'secondary' }).row()
    }
    if (await prisma.allianceCoin.findFirst({ where: { id_alliance: get_user.id_alliance ?? 0 } })) {
        keyboard.textButton({ label: `${ico_list[`converter`].ico} Конвертер`, payload: { command: 'operation_enter' }, color: 'secondary' }).row()
    }
    keyboard.callbackButton({ label: `${ico_list['statistics'].ico} Рейтинги`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' }).row()
    keyboard.textButton({ label: `${ico_list['statistics'].ico} Отчатор`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' }).row()
    
    const user = get_user;
    const isAdminUser = await isAdmin(user);
    
    // ===== ВСЕ ПРАВА, КОТОРЫЕ ДАЮТ ДОСТУП К АДМИН-МЕНЮ =====
    const adminPermissions = [
        'canManageShops', 'canManageAbilities', 'canManageSkills',
        'canManageChests', 'canManageLegacy', 'canManageBackgrounds',
        'canManageFacults', 'canManageClassSettings', 'canManageYearEnd',
        'canManageSalary', 'canManageFinance', 'canManageConverter',
        'canManageScoopins', 'canManageMonitors', 'canManageTopics',
        'canManageRoles', 'canManageRolesAssign',
        'canViewAllUsers', 'canViewInventoryAll',
        'canEditAllUsers', 'canEditInventoryAll', 'canGiveItemsAll', 'canEditCoins',
        'canUpgradeOthers', 'canAssignAbility', 'canAssignSkill',
        'canAssignShopOwner',
        'canMassOperations', 'canMassKick'
    ] as const;  // <-- ДОБАВЛЯЕМ as const
    
    const hasAdminRights = await hasAnyPermission(user, adminPermissions as any);
    
    if (isAdminUser || hasAdminRights) {
        keyboard.callbackButton({ 
            label: `${ico_list['config'].ico} Админам`, 
            payload: { command: 'alliance_enter_admin' }, 
            color: 'secondary' 
        }).row();
    }
    
    keyboard.callbackButton({ 
        label: `${ico_list['stop'].ico}`, 
        payload: { command: 'system_call' }, 
        color: 'secondary' 
    }).inline().oneTime()
    
    await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
    await Send_Message(context.peerId, text, keyboard)
}

export async function Alliance_Enter_Admin(context:any, page: number = 1) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (!get_user) { return }
    
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const text = `${ico_list['alliance'].ico} Добро пожаловать в меню администрирования ролевого проекта [${alli_get?.name}] --> \n`
    
    const keyboard = Keyboard.builder().inline();
    
    const user = get_user;
    const isAdminUser = await isAdmin(user);
    
    // ===== СТРАНИЦА 1 =====
    if (page === 1) {
        // Факультеты + Положения
        if (isAdminUser || await hasPermission(user, 'canManageFacults') || await hasPermission(user, 'canManageClassSettings')) {
            if (await hasPermission(user, 'canManageFacults')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !факультеты настроить`, 
                    payload: { command: "alliance_config_facult" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !факультеты настроить`, 
                    payload: { command: "alliance_config_facult" }, 
                    color: 'secondary' 
                });
            }
            if (await hasPermission(user, 'canManageClassSettings')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !положения настроить`, 
                    payload: { command: "alliance_config_rules" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !положения настроить`, 
                    payload: { command: "alliance_config_rules" }, 
                    color: 'secondary' 
                });
            }
            keyboard.row();
        }

        // Валюты + Магазины
        if (isAdminUser || await hasPermission(user, 'canManageFinance') || await hasPermission(user, 'canManageShops')) {
            if (await hasPermission(user, 'canManageFinance')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !валюты настроить`, 
                    payload: { command: "alliance_config_coin" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !валюты настроить`, 
                    payload: { command: "alliance_config_coin" }, 
                    color: 'secondary' 
                });
            }
            if (await hasPermission(user, 'canManageShops')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !магазины настроить`, 
                    payload: { command: "alliance_config_shop" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !магазины настроить`, 
                    payload: { command: "alliance_config_shop" }, 
                    color: 'secondary' 
                });
            }
            keyboard.row();
        }
        
        // Конвертация + S-coins
        if (isAdminUser || await hasPermission(user, 'canManageConverter') || await hasPermission(user, 'canManageScoopins')) {
            if (await hasPermission(user, 'canManageConverter')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !конвертацию настроить`, 
                    payload: { command: "alliance_config_convert" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !конвертацию настроить`, 
                    payload: { command: "alliance_config_convert" }, 
                    color: 'secondary' 
                });
            }
            if (await hasPermission(user, 'canManageScoopins')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !S-coins настроить`, 
                    payload: { command: "alliance_config_scoins" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !S-coins настроить`, 
                    payload: { command: "alliance_config_scoins" }, 
                    color: 'secondary' 
                });
            }
            keyboard.row();
        }
        
        // Внутренняя конвертация
        if (isAdminUser || await hasPermission(user, 'canManageConverter')) {
            keyboard.textButton({ 
                label: `${ico_list['config'].ico} !внутрконвертацию настроить`, 
                payload: { command: "alliance_config_internal_convert" }, 
                color: 'secondary' 
            });
        } else {
            keyboard.textButton({ 
                label: `🔒 !внутрконвертацию настроить`, 
                payload: { command: "alliance_config_internal_convert" }, 
                color: 'secondary' 
            });
        }
        keyboard.row();
        
        // Навигация →
        const hasNextPage = await hasAnyPermission(user, [
            'canManageChests', 'canManageLegacy', 'canManageMonitors',
            'canManageTopics', 'canManageYearEnd', 'canManageBackgrounds',
            'canManageAbilities', 'canManageSkills', 'canManageSalary',
            'canManageRoles', 'canManageRolesAssign'
        ]);
        
        if (isAdminUser || hasNextPage) {
            keyboard.callbackButton({ 
                label: `→`, 
                payload: { command: "admin_page", page: 2 }, 
                color: 'secondary' 
            }).row();
        }
        
    // ===== СТРАНИЦА 2 =====
    } else if (page === 2) {
        // Сундуки + Легаси
        if (isAdminUser || await hasPermission(user, 'canManageChests') || await hasPermission(user, 'canManageLegacy')) {
            if (await hasPermission(user, 'canManageChests')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !сундуки настроить`, 
                    payload: { command: "alliance_config_chest" },
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !сундуки настроить`, 
                    payload: { command: "alliance_config_chest" },
                    color: 'secondary' 
                });
            }
            if (await hasPermission(user, 'canManageLegacy')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !легаси настроить`, 
                    payload: { command: "alliance_config_legacy" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !легаси настроить`, 
                    payload: { command: "alliance_config_legacy" }, 
                    color: 'secondary' 
                });
            }
            keyboard.row();
        }
        
        // Мониторы + Обсуждения
        if (isAdminUser || await hasPermission(user, 'canManageMonitors') || await hasPermission(user, 'canManageTopics')) {
            if (await hasPermission(user, 'canManageMonitors')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !мониторы настроить`, 
                    payload: { command: "alliance_config_monitor" },
                    color: 'positive' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !мониторы настроить`, 
                    payload: { command: "alliance_config_monitor" },
                    color: 'secondary' 
                });
            }
            if (await hasPermission(user, 'canManageTopics')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !отслеживание обсуждений`, 
                    payload: { command: 'alliance_topic_monitor_enter' }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !отслеживание обсуждений`, 
                    payload: { command: 'alliance_topic_monitor_enter' }, 
                    color: 'secondary' 
                });
            }
            keyboard.row();
        }
        
        // Завершить сезон
        if (isAdminUser || await hasPermission(user, 'canManageYearEnd')) {
            keyboard.textButton({ 
                label: `${ico_list['config'].ico} !закончить сезон`, 
                payload: { command: "alliance_config_end_year" },
                color: 'primary' 
            });
        } else {
            keyboard.textButton({ 
                label: `🔒 !закончить сезон`, 
                payload: { command: "alliance_config_end_year" },
                color: 'secondary' 
            });
        }
        keyboard.row();
        
        // Навигация ← →
        keyboard.callbackButton({ 
            label: `←`, 
            payload: { command: "admin_page", page: 1 }, 
            color: 'secondary' 
        });
        
        const hasNextPage = await hasAnyPermission(user, [
            'canManageBackgrounds', 'canManageAbilities', 'canManageSkills',
            'canManageSalary', 'canManageRoles', 'canManageRolesAssign'
        ]);
        
        if (isAdminUser || hasNextPage) {
            keyboard.callbackButton({ 
                label: `→`, 
                payload: { command: "admin_page", page: 3 }, 
                color: 'secondary' 
            });
        }
        keyboard.row();
        
    // ===== СТРАНИЦА 3 — ТОЛЬКО ФОНЫ =====
    } else if (page === 3) {
        // Фоны (настроить + удалить)
        if (isAdminUser || await hasPermission(user, 'canManageBackgrounds')) {
            keyboard.textButton({ 
                label: `${ico_list['config'].ico} !основу настроить`, 
                payload: { command: "alliance_config_menu_bg" },
                color: 'secondary' 
            });
            keyboard.textButton({ 
                label: `${ico_list['config'].ico} !основу удалить`, 
                payload: { command: "alliance_config_menu_bg_remove" }, 
                color: 'negative' 
            });
            keyboard.row();
            
            keyboard.textButton({ 
                label: `${ico_list['config'].ico} !карту настроить`, 
                payload: { command: "alliance_config_card_bg" },
                color: 'secondary' 
            });
            keyboard.textButton({ 
                label: `${ico_list['config'].ico} !карту удалить`, 
                payload: { command: "alliance_config_card_bg_remove" }, 
                color: 'negative' 
            });
            keyboard.row();
            
            keyboard.textButton({
                label: `${ico_list['config'].ico} !услуги настроить`,
                payload: { command: "alliance_config_service_bg" },
                color: 'secondary'
            });
            keyboard.textButton({
                label: `${ico_list['config'].ico} !услуги удалить`,
                payload: { command: "alliance_config_service_bg_remove" },
                color: 'negative'
            });
            keyboard.row();
        } else {
            keyboard.textButton({ 
                label: `🔒 !основу настроить`, 
                payload: { command: "alliance_config_menu_bg" },
                color: 'secondary' 
            });
            keyboard.textButton({ 
                label: `🔒 !основу удалить`, 
                payload: { command: "alliance_config_menu_bg_remove" }, 
                color: 'secondary' 
            });
            keyboard.row();
            keyboard.textButton({ 
                label: `🔒 !карту настроить`, 
                payload: { command: "alliance_config_card_bg" },
                color: 'secondary' 
            });
            keyboard.textButton({ 
                label: `🔒 !карту удалить`, 
                payload: { command: "alliance_config_card_bg_remove" }, 
                color: 'secondary' 
            });
            keyboard.row();
            keyboard.textButton({
                label: `🔒 !услуги настроить`,
                payload: { command: "alliance_config_service_bg" },
                color: 'secondary'
            });
            keyboard.textButton({
                label: `🔒 !услуги удалить`,
                payload: { command: "alliance_config_service_bg_remove" },
                color: 'secondary'
            });
            keyboard.row();
        }
        
        // Навигация → на страницу 4
        const hasNextPage = await hasAnyPermission(user, [
            'canManageAbilities', 'canManageSkills', 'canManageSalary',
            'canManageRoles', 'canManageRolesAssign', 'canManageFinance'
        ]);
        
        if (isAdminUser || hasNextPage) {
            keyboard.callbackButton({ 
                label: `←`, 
                payload: { command: "admin_page", page: 2 }, 
                color: 'secondary' 
            });
        }
        
        keyboard.callbackButton({ 
            label: `→`, 
            payload: { command: "admin_page", page: 4 }, 
            color: 'secondary' 
        }).row();
        
    // ===== СТРАНИЦА 4 — СПОСОБНОСТИ, НАВЫКИ, ЗАРПЛАТА, ПОРЯДОК ВАЛЮТ, ПРАВА =====
    } else if (page === 4) {
        // Способности + Навыки
        if (isAdminUser || await hasPermission(user, 'canManageAbilities') || await hasPermission(user, 'canManageSkills')) {
            if (await hasPermission(user, 'canManageAbilities')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !способности настроить`, 
                    payload: { command: "alliance_config_abilities" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !способности настроить`, 
                    payload: { command: "alliance_config_abilities" }, 
                    color: 'secondary' 
                });
            }
            if (await hasPermission(user, 'canManageSkills')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !навыки настроить`, 
                    payload: { command: "alliance_config_skills" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !навыки настроить`, 
                    payload: { command: "alliance_config_skills" }, 
                    color: 'secondary' 
                });
            }
            keyboard.row();
        }
        
        // Зарплата + Порядок валют
        if (isAdminUser || await hasPermission(user, 'canManageSalary') || await hasPermission(user, 'canManageFinance')) {
            if (await hasPermission(user, 'canManageSalary')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !зарплату настроить`, 
                    payload: { command: "alliance_config_salary" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !зарплату настроить`, 
                    payload: { command: "alliance_config_salary" }, 
                    color: 'secondary' 
                });
            }
            if (await hasPermission(user, 'canManageFinance')) {
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !порядок валют настроить`, 
                    payload: { command: "alliance_config_coin_order" }, 
                    color: 'secondary' 
                });
            } else {
                keyboard.textButton({ 
                    label: `🔒 !порядок валют настроить`, 
                    payload: { command: "alliance_config_coin_order" }, 
                    color: 'secondary' 
                });
            }
            keyboard.row();
        }
        
        // Права
        if (isAdminUser || await hasPermission(user, 'canManageRoles') || await hasPermission(user, 'canManageRolesAssign')) {
            keyboard.textButton({ 
                label: `${ico_list['config'].ico} !права настроить`, 
                payload: { command: "alliance_config_rights" }, 
                color: 'secondary' 
            });
        } else {
            keyboard.textButton({ 
                label: `🔒 !права настроить`, 
                payload: { command: "alliance_config_rights" }, 
                color: 'secondary' 
            });
        }
        keyboard.row();

        // Шаблоны уведомлений
        if (isAdminUser) {
            keyboard.textButton({
                label: `${ico_list['config'].ico} !шаблоны настроить`,
                payload: { command: 'alliance_config_notification_templates' },
                color: 'secondary'
            }).row();
        }
        
        // Навигация ← на страницу 3
        keyboard.callbackButton({ 
            label: `←`, 
            payload: { command: "admin_page", page: 3 }, 
            color: 'secondary' 
        }).row();
    }
    
    // Кнопка закрытия (всегда)
    keyboard.callbackButton({ 
        label: `${ico_list['stop'].ico}`, 
        payload: { command: "system_call_admin" }, 
        color: 'secondary' 
    }).row();
    
    await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
    await Send_Message(context.peerId, text, keyboard)
}
