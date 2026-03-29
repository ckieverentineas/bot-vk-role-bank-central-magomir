// engine/events/module/alliance/alliance_menu.ts
import { Alliance, User } from "@prisma/client"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"
import { Person_Coin_Printer } from "../person/person_coin"
import { Facult_Rank_Printer } from "./facult_rank"
import { Keyboard, KeyboardBuilder } from "vk-io"
import { Accessed, Logger, Send_Message } from "../../../core/helper"
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
    if (await Accessed(context) != 1) {
        keyboard.callbackButton({ label: `${ico_list['config'].ico} Админам`, payload: { command: 'alliance_enter_admin' }, color: 'secondary' }).row()
    }
    keyboard.callbackButton({ label: `${ico_list['stop'].ico}`, payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
    await Send_Message(context.peerId, text, keyboard)
}

export async function Alliance_Enter_Admin(context:any, page: number = 1) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (get_user) {
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const text = `${ico_list['alliance'].ico} Добро пожаловать в меню администрирования ролевого проекта [${alli_get?.name}] --> \n`
        
        const keyboard = Keyboard.builder().inline();
        
        if (await Accessed(context) != 1) {
            if (page === 1) {
                // ========== СТРАНИЦА 1 ==========
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !факультеты настроить`, 
                    payload: { command: "alliance_config_facult" }, 
                    color: 'secondary' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !положения настроить`, 
                    payload: { command: "alliance_config_rules" }, 
                    color: 'secondary' 
                }).row()
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !валюты настроить`, 
                    payload: { command: "alliance_config_coin" }, 
                    color: 'secondary' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !магазины настроить`, 
                    payload: { command: "alliance_config_shop" }, 
                    color: 'secondary' 
                }).row()
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !конвертацию настроить`, 
                    payload: { command: "alliance_config_convert" }, 
                    color: 'secondary' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !S-coins настроить`, 
                    payload: { command: "alliance_config_scoins" }, 
                    color: 'secondary' 
                }).row()
                
                // Стрелочка навигации
                keyboard.callbackButton({ 
                    label: `→`, 
                    payload: { command: "admin_page", page: 2 }, 
                    color: 'secondary' 
                }).row()
                
            } else if (page === 2) {
                // ========== СТРАНИЦА 2 ==========
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !сундуки настроить`, 
                    payload: { command: "alliance_config_chest" },
                    color: 'secondary' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !легаси настроить`, 
                    payload: { command: "alliance_config_legacy" }, 
                    color: 'secondary' 
                }).row()
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !мониторы настроить`, 
                    payload: { command: "alliance_config_monitor" },
                    color: 'positive' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !отслеживание обсуждений`, 
                    payload: { command: 'alliance_topic_monitor_enter' }, 
                    color: 'secondary' 
                }).row()
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !закончить учебный год`, 
                    payload: { command: "alliance_config_end_year" },
                    color: 'primary' 
                }).row()
                
                // Стрелочки навигации
                keyboard.callbackButton({ 
                    label: `←`, 
                    payload: { command: "admin_page", page: 1 }, 
                    color: 'secondary' 
                })
                keyboard.callbackButton({ 
                    label: `→`, 
                    payload: { command: "admin_page", page: 3 }, 
                    color: 'secondary' 
                }).row()
                
            } else if (page === 3) {
                // ========== СТРАНИЦА 3 ==========
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !основу настроить`, 
                    payload: { command: "alliance_config_menu_bg" },
                    color: 'secondary' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !основу удалить`, 
                    payload: { command: "alliance_config_menu_bg_remove" }, 
                    color: 'negative' 
                }).row()
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !карту настроить`, 
                    payload: { command: "alliance_config_card_bg" },
                    color: 'secondary' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !карту удалить`, 
                    payload: { command: "alliance_config_card_bg_remove" }, 
                    color: 'negative' 
                }).row()
                
                // Стрелочки навигации
                keyboard.callbackButton({ 
                    label: `←`, 
                    payload: { command: "admin_page", page: 2 }, 
                    color: 'secondary' 
                })
                keyboard.callbackButton({ 
                    label: `→`, 
                    payload: { command: "admin_page", page: 4 }, 
                    color: 'secondary' 
                }).row()
                
            } else if (page === 4) {
                // ========== СТРАНИЦА 4 - НАВЫКИ ==========
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !уровни настроить`, 
                    payload: { command: "alliance_config_skill_levels" },
                    color: 'secondary' 
                })
                keyboard.textButton({ 
                    label: `${ico_list['config'].ico} !навыки настроить`, 
                    payload: { command: "alliance_config_skills" }, 
                    color: 'secondary' 
                }).row()
                
                // Стрелочка назад
                keyboard.callbackButton({ 
                    label: `←`, 
                    payload: { command: "admin_page", page: 3 }, 
                    color: 'secondary' 
                }).row()
            }
        }
        
        // Кнопка закрытия
        keyboard.callbackButton({ 
            label: `${ico_list['stop'].ico}`, 
            payload: { command: "system_call_admin" }, 
            color: 'secondary' 
        }).row()
        
        await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
        await Send_Message(context.peerId, text, keyboard)
    }
}