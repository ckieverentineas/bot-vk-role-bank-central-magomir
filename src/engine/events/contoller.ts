// engine/events/contoller.ts
import { Context, KeyboardBuilder } from "vk-io"
import prisma from "./module/prisma_client"
import { root, vk } from "../.."
import { User } from "@prisma/client";
import { Person_Detector, Person_Get } from "./module/person/person";
import { Accessed, Send_Message } from "../core/helper";
import { image_bank } from "./module/data_center/system_image";
import { ico_list } from "./module/data_center/icons_lib";
import { Person_Coin_Printer } from "./module/person/person_coin";
import { Facult_Rank_Printer } from "./module/alliance/facult_rank";
import { CardSystem } from "../core/card_system";
import { Abilities_Upgrade_Menu } from "./module/abilities/abilities_upgrade";
import { Alliance_Control_Multi, Alliance_Control, Alliance_Controller } from "./module/alliance/alliance";
import { Alliance_Enter, Alliance_Enter_Admin } from "./module/alliance/alliance_menu";
import { Alliance_Rank_Enter, Alliance_Rank_Coin_Enter } from "./module/alliance/alliance_rank";
import { Alliance_Topic_Monitor_Printer } from "./module/alliance/alliance_topic_monitor";
import { Card_Enter, Admin_Enter, Statistics_Enter, Rank_Enter, Comment_Person_Enter } from "./module/info";
import { Monitor_Select_Person_Handler } from "./module/person/monitor_select";
import { Service_Enter, Service_Cancel, Service_Kvass_Open } from "./module/service";
import { Shop_Category_Enter, Shop_Enter_Multi, Shop_Enter, Shop_Cancel, Shop_Bought, Shop_Buy } from "./module/shop/engine";
import { Operation_Enter, Right_Enter } from "./module/tool";
import { Topic_Rank_V2_Enter, Topic_Rank_V2_Search_Topic, Topic_Rank_V2_Weeks, Topic_Rank_V2_Select_Monitor, Topic_Rank_V2_Select_Facult } from "./module/topic_rank_v2";

export async function Main_Menu_Init(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    
    // Получаем фон меню (автоматически определяет альянс или дефолт)
    const attached = await CardSystem.getMenuBackground(user);
    
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const alli_get = await prisma.alliance.findFirst({ where: { id: user?.id_alliance ?? 0 } })
    
    // Проверяем, есть ли у альянса рейтинговые валюты (point == true)
    const hasRatingCurrencies = alli_get ? await prisma.allianceCoin.findFirst({ 
        where: { 
            id_alliance: alli_get.id,
            point: true 
        } 
    }) : false;
    
    let text = ''
    if (alli_get) {
        text = `${ico_list['alliance'].ico} Доступ разрешен, зашифрованное соединение через VPN: https:/${alli_get.name}:${alli_get.idvk}/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}! 💳 UID-${user?.id}\n${coin}\n\n🔑 Добро пожаловать в [${alli_get?.name} | 📜 AUID: ${alli_get?.id}]`
        
        // Добавляем факультетские рейтинги только если есть рейтинговые валюты
        if (hasRatingCurrencies && facult_rank) {
            text += ` \n${facult_rank}`
        }
    } else {
        text = `🏦 Доступ разрешен, зашифрованное соединение по proxy: https:/Ministry_of_Magic/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}!\n💳 UID-${user?.id} Баланс: ${user.medal}🔘`
    }
    await Send_Message(context.peerId, text, await Keyboard_User_Main(context), attached)
}

export async function Exit(context: any) {
    const text = `💡 Сессия успешно завершена. Чтобы начать новую, напишите [!банк] без квадратных скобочек`
    await Send_Message(context.peerId, text)
    await vk?.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: "🔔 Выход из системы успешно завершен!"
        })
    })
}

export async function Keyboard_User_Main(context: Context) {
    await Person_Detector(context)
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: user?.id_alliance ?? 0 } })
    const keyboard_user = new KeyboardBuilder()
    .callbackButton({ label: '💳 Карта', payload: { command: 'card_enter' }, color: 'secondary' })
    .textButton({ label: '👜 Инвентарь', payload: { command: 'inventory_enter' }, color: 'secondary' }).row()
    
    if (alliance) {
        keyboard_user.callbackButton({ label: `${ico_list['statistics'].ico} Рейтинги`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' })
        .textButton({ label: `${ico_list['statistics'].ico} Отчатор`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' }).row()
        .textButton({ label: `🛍 Магазины`, payload: { command: 'operation_enter' }, color: 'secondary' })
        .textButton({ label: `${ico_list[`converter`].ico} Конвертер`, payload: { command: 'operation_enter' }, color: 'secondary' }).row()
    }
    
    keyboard_user
        .callbackButton({ label: '🧚‍♀ Услуги', payload: { command: 'service_enter' }, color: 'secondary' })
        .callbackButton({ label: '⚡ Прокачка', payload: { command: 'abilities_upgrade_enter' }, color: 'secondary' }).row()
    
    keyboard_user
        .callbackButton({ label: '✨ Маголавка "Чудо в перьях"', payload: { command: 'shop_category_enter' }, color: 'positive' }).row()
    
    if (await Accessed(context) != 1) { 
        keyboard_user.callbackButton({ label: '🔧 Еще', payload: { command: 'system_call_admin' }, color: 'positive' })
    }
    
    keyboard_user.oneTime().inline()
    return keyboard_user
}

export async function Keyboard_Admin_Main(context: Context) {
    await Person_Detector(context)
    const admin = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: admin?.id_alliance ?? 0 } })
    const keyboard_admin = new KeyboardBuilder()
    if (await Accessed(context) != 1) {
        keyboard_admin.callbackButton({ label: '⚙ Админы', payload: { command: 'admin_enter' }, color: 'secondary' })
        .callbackButton({ label: `${ico_list['config'].ico} Админам`, payload: { command: 'alliance_enter_admin' }, color: 'secondary' }).row()
    }
    if (await Accessed(context) == 3) {
        keyboard_admin.callbackButton({ label: '⚙ Союзники', payload: { command: 'alliance_control_multi' }, color: 'negative' }).row()
    }
    keyboard_admin.callbackButton({ label: `${ico_list['stop'].ico}`, payload: { command: 'system_call' }, color: 'secondary' }).oneTime().inline()
    return keyboard_admin
}

export async function Main_Menu_Admin_Init(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const attached = await CardSystem.getMenuBackground(user);
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const alli_get = await prisma.alliance.findFirst({ where: { id: user?.id_alliance ?? 0 } })
    
    // Проверяем, есть ли у альянса рейтинговые валюты (point == true)
    const hasRatingCurrencies = alli_get ? await prisma.allianceCoin.findFirst({ 
        where: { 
            id_alliance: alli_get.id,
            point: true 
        } 
    }) : false;
    
    let text = ''
    if (alli_get) {
        text = `${ico_list['alliance'].ico} Доступ разрешен, зашифрованное соединение через VPN: https:/${alli_get.name}:${alli_get.idvk}/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}! 💳 UID-${user?.id}\n${coin}\n\n🔑 Добро пожаловать в [${alli_get?.name} | 📜 AUID: ${alli_get?.id}]`
        
        // Добавляем факультетские рейтинги только если есть рейтинговые валюты
        if (hasRatingCurrencies && facult_rank) {
            text += ` \n${facult_rank}`
        }
    } else {
        text = `🏦 Доступ разрешен, зашифрованное соединение по proxy: https:/Ministry_of_Magic/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}!\n💳 UID-${user?.id} Баланс: ${user.medal}🔘`
    }
    await Send_Message(context.peerId, text, await Keyboard_Admin_Main(context), attached)
}

// ===================== ГЛОБАЛЬНЫЙ КОНФИГ ОБРАБОТЧИКОВ =====================

export const config: Record<string, (ctx: any) => Promise<void>> = {
    // Основные команды
    "system_call": Main_Menu_Init,
    "card_enter": Card_Enter,
    "exit": Exit,
    "admin_enter": Admin_Enter,
    "service_enter": Service_Enter,
    "service_cancel": Service_Cancel,
    "shop_category_enter": Shop_Category_Enter,
    "shop_enter_multi": Shop_Enter_Multi,
    "shop_enter": Shop_Enter,
    "shop_cancel": Shop_Cancel,
    "shop_bought": Shop_Bought,
    "shop_buy": Shop_Buy,
    "operation_enter": Operation_Enter,
    "right_enter": Right_Enter,
    "service_kvass_open": Service_Kvass_Open,
    "statistics_enter": Statistics_Enter,
    "rank_enter": Rank_Enter,
    "alliance_control_multi": Alliance_Control_Multi,
    "alliance_control": Alliance_Control,
    "alliance_controller": Alliance_Controller,
    "alliance_enter": Alliance_Enter,
    "alliance_rank_enter": Alliance_Rank_Enter,
    "alliance_rank_coin_enter": Alliance_Rank_Coin_Enter,
    "comment_person_enter": Comment_Person_Enter,
    "monitor_select_person": Monitor_Select_Person_Handler,
    "alliance_topic_monitor_enter": Alliance_Topic_Monitor_Printer,
    "topic_rank_v2": Topic_Rank_V2_Enter,
    "topic_rank_v2_search_topic": Topic_Rank_V2_Search_Topic,
    "topic_rank_v2_weeks": Topic_Rank_V2_Weeks,
    "topic_rank_v2_select_monitor": Topic_Rank_V2_Select_Monitor,
    "topic_rank_v2_select_facult": Topic_Rank_V2_Select_Facult,
    
    // Способности
    //"abilities_upgrade_enter": Abilities_Upgrade_Menu,
    "abilities_upgrade_enter": async (ctx: any) => {
    await Abilities_Upgrade_Menu(ctx);
    },
    
    // Админ-панель
    "admin_page": async (ctx: any) => {
        const page = ctx.eventPayload?.page || 1;
        await Alliance_Enter_Admin(ctx, page);
        await ctx.answer();
    },
    
    // Настройка фонов
    "alliance_config_menu_bg": async (ctx: any) => {
        await ctx.send('!основу настроить');
        await ctx.answer();
    },
    "alliance_config_menu_bg_remove": async (ctx: any) => {
        await ctx.send('!основу удалить');
        await ctx.answer();
    },
    "alliance_config_card_bg": async (ctx: any) => {
        await ctx.send('!карту настроить');
        await ctx.answer();
    },
    "alliance_config_card_bg_remove": async (ctx: any) => {
        await ctx.send('!карту удалить');
        await ctx.answer();
    },
    
    // Админ-меню альянса
    "alliance_enter_admin": async (ctx: any) => {
        await Alliance_Enter_Admin(ctx, 1);
        await ctx.answer();
    },
    "system_call_admin": async (ctx: any) => {
        await Main_Menu_Admin_Init(ctx);
        await ctx.answer();
    },
    
    // Выход с подтверждением
    "systemok_call": async (ctx: any) => {
        try {
            const messageId = ctx.eventPayload?.messageId;
            
            // Отвечаем на callback
            await vk?.api.messages.sendMessageEventAnswer({
                event_id: ctx.eventId,
                user_id: ctx.userId,
                peer_id: ctx.peerId,
                event_data: JSON.stringify({
                    type: "show_snackbar",
                    text: "🔔 Возврат в главное меню"
                })
            });
            
            // Получаем пользователя
            const user = await Person_Get(ctx);
            if (!user) return;
            
            // Создаем ТЕКСТОВУЮ клавиатуру (не inline)
            const keyboard = new KeyboardBuilder();
            
            // Добавляем кнопки как в Keyboard_Index
            if (user.idvk == root) {
                keyboard.textButton({ label: '!Лютный переулок', payload: { command: 'sliz' }, color: 'positive' }).row();
            }
            
            if (await Accessed(ctx) != 1) {
                keyboard.textButton({ label: '!права', payload: { command: 'sliz' }, color: 'negative' }).row();
                keyboard.textButton({ label: '!опсоло', payload: { command: 'sliz' }, color: 'positive' });
                keyboard.textButton({ label: '!опмасс', payload: { command: 'sliz' }, color: 'negative' }).row();
            } 
            
            keyboard.textButton({ label: '!банк', payload: { command: 'sliz' }, color: 'positive' }).row().oneTime();
            keyboard.textButton({ label: '!помощь', payload: { command: 'sliz' }, color: 'secondary' }).row();
            keyboard.textButton({ label: '!СБП', payload: { command: 'sliz' }, color: 'secondary' });
            
            // Отправляем новое сообщение с ТЕКСТОВОЙ клавиатурой
            await vk?.api.messages.send({ 
                peer_id: ctx.peerId, 
                random_id: 0, 
                message: `🏦 Возврат в главное меню\n\n✅ Вы авторизованы, ${user.name}!\n💳 UID-${user.id}\n\nДля открытия банка нажмите: !банк`,
                keyboard: keyboard 
            });
            
            // Если нужно, удаляем старое сообщение с рейтингом
            if (messageId) {
                try {
                    await vk?.api.messages.delete({
                        peer_id: ctx.peerId,
                        message_ids: [messageId],
                        delete_for_all: 1
                    });
                } catch (deleteError) {
                    console.log("Не удалось удалить сообщение:", deleteError);
                }
            }
            
        } catch (error) {
            console.error("Ошибка в systemok_call:", error);
        }
    }
}