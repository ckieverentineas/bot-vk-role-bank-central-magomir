import { KeyboardBuilder } from 'vk-io';
import prisma from './prisma_client';
import { Person_Get } from './person/person';
import { Logger, OperationCancelledError, Send_Message } from '../../core/helper';
import { splitVkMessage } from '../../core/vk_limits';

type WorkTier = { maxPc: number | null; amount: number };
type StoredPost = { date: Date; pc: number };
type RpWorkSettings = {
    id: number;
    userId: number;
    allianceId: number;
    ratePerPc: number;
    highSeniority: boolean;
    seniorityBonus: number;
    minimumPcPerYear: number;
    workScope: string;
    workHashtag: string | null;
    workYearStart: Date | null;
    workYearEnd: Date | null;
    lifeHashtag: string;
    lifeTierRates: string;
};

const db = prisma as any;
const DEFAULT_LIFE_TIERS: WorkTier[] = [
    { maxPc: 500, amount: 3 },
    { maxPc: 800, amount: 5 },
    { maxPc: 1200, amount: 7 },
    { maxPc: 1500, amount: 10 },
    { maxPc: 2000, amount: 15 },
    { maxPc: null, amount: 20 }
];

type PendingInputFlow =
    | {
        kind: 'settingNumber'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        field: 'ratePerPc' | 'seniorityBonus' | 'minimumPcPerYear'; prompt: string;
    }
    | {
        kind: 'workYear'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        step: 'start' | 'end'; startDate?: Date;
    }
    | {
        kind: 'goal'; userId: number; allianceId: number; menuPage: number; hashtag: string | null;
        step: 'target' | 'start' | 'end'; targetPc?: number; startDate?: Date;
    }
    | {
        kind: 'lifeTiers'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        step: 'max' | 'amount'; index: number; previousMax: number; maxPc?: number;
        tiers: WorkTier[]; oldTiers: WorkTier[];
    };

// Callback events (message_event) do not have QuestionManager's context.question().
// Track the multi-message input flow and consume the user's following message_new instead.
const pendingInputFlows = new Map<string, PendingInputFlow>();

/** Entry point for all card buttons related to work estimates and writing goals. */
export async function RP_Work_Settings_Enter(context: any): Promise<void> {
    const user = await Person_Get(context);
    if (!user) {
        await sendContextMessage(context, '❌ Сначала выберите персонажа в банке.');
        return;
    }

    const allianceId = Number(user.id_alliance ?? 0);
    if (allianceId <= 0) {
        await sendContextMessage(context, '❌ Настройки работы и целей доступны только персонажам из ролевой.');
        return;
    }

    const topicCount = await prisma.topicMonitor.count({
        where: { monitor: { id_alliance: allianceId } }
    });
    if (topicCount === 0) {
        await sendContextMessage(context, '📭 В этой ролевой не настроены обсуждения. Настройки работы и целей недоступны.');
        return;
    }

    try {
        const settings = await getOrCreateSettings(user.id, allianceId);
        const menuPage = clampMenuPage(context.eventPayload?.menuPage);
        const action = String(context.eventPayload?.action ?? 'menu');

        switch (action) {
            case 'menu_page':
                // Render the selected settings tab below.
                break;
            case 'edit_rate':
                await startSettingNumberFlow(context, user.id, allianceId, settings.id, menuPage, 'ratePerPc', 'Введите оплату за одну ПК-строку. Допускается дробное число:');
                return;
            case 'toggle_seniority':
                await db.rpWorkSettings.update({ where: { id: settings.id }, data: { highSeniority: !settings.highSeniority } });
                break;
            case 'edit_seniority_bonus':
                await startSettingNumberFlow(context, user.id, allianceId, settings.id, menuPage, 'seniorityBonus', 'Введите фиксированную доплату за высокий стаж:');
                return;
            case 'edit_minimum':
                await startSettingNumberFlow(context, user.id, allianceId, settings.id, menuPage, 'minimumPcPerYear', 'Введите минимальное целое число ПК-строк за ролевой год для допуска к оплате:');
                return;
            case 'set_work_year':
                await startWorkYearFlow(context, user.id, allianceId, settings.id, menuPage);
                return;
            case 'cancel_input':
                pendingInputFlows.delete(getInputFlowKey(context));
                await sendContextMessage(context, 'Ввод отменён.');
                await renderSettingsMenu(context, user.id, allianceId, settings, menuPage);
                return;
            case 'scope_all':
                await db.rpWorkSettings.update({ where: { id: settings.id }, data: { workScope: 'all', workHashtag: null } });
                break;
            case 'scope_tag_menu':
                await renderHashtagPicker(context, allianceId, 'scope_tag', 'Выберите хештег, посты с которым считаются работой:', Number(context.eventPayload?.hashtagPage ?? 0), 1);
                return;
            case 'scope_tag':
                if (typeof context.eventPayload?.hashtag === 'string') {
                    await db.rpWorkSettings.update({ where: { id: settings.id }, data: { workScope: 'hashtag', workHashtag: normalizeHashtag(context.eventPayload.hashtag) } });
                }
                break;
            case 'life_tag_menu':
                await renderHashtagPicker(context, allianceId, 'life_set_tag', 'Выберите хештег для отдельного тарифа за пост:', Number(context.eventPayload?.hashtagPage ?? 0), 1);
                return;
            case 'life_set_tag':
                if (typeof context.eventPayload?.hashtag === 'string') {
                    await db.rpWorkSettings.update({ where: { id: settings.id }, data: { lifeHashtag: normalizeHashtag(context.eventPayload.hashtag) } });
                }
                break;
            case 'configure_life_tiers':
                await startLifeTiersFlow(context, user.id, allianceId, settings, menuPage);
                return;
            case 'forecast':
                await sendForecast(context, user.id, allianceId, settings);
                return;
            case 'goal_create_overall':
                await startGoalFlow(context, user.id, allianceId, null, menuPage);
                return;
            case 'goal_tag_menu':
                await renderHashtagPicker(context, allianceId, 'goal_create_tag', 'Для какого хештега создать план?', Number(context.eventPayload?.hashtagPage ?? 0), 2);
                return;
            case 'goal_create_tag':
                if (typeof context.eventPayload?.hashtag === 'string') {
                    await startGoalFlow(context, user.id, allianceId, normalizeHashtag(context.eventPayload.hashtag), menuPage);
                    return;
                }
                break;
            case 'goal_list':
                await renderGoalList(context, user.id, allianceId, Number(context.eventPayload?.goalPage ?? 0));
                return;
            case 'goal_view':
                await renderGoalDetails(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), Number(context.eventPayload?.weekPage ?? 0));
                return;
            case 'goal_delete': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                if (goalId > 0) {
                    await db.rpWritingGoal.deleteMany({ where: { id: goalId, userId: user.id, allianceId } });
                    await sendContextMessage(context, '✅ План удалён.');
                }
                await renderGoalList(context, user.id, allianceId, 0);
                return;
            }
            default:
                break;
        }

        const updatedSettings = await getOrCreateSettings(user.id, allianceId);
        await renderSettingsMenu(context, user.id, allianceId, updatedSettings, menuPage);
    } catch (error: any) {
        if (error instanceof OperationCancelledError) {
            const settings = await getOrCreateSettings(user.id, allianceId);
            await renderSettingsMenu(context, user.id, allianceId, settings, clampMenuPage(context.eventPayload?.menuPage));
            return;
        }
        await Logger(`RP work settings error for user ${user.id}: ${error?.message ?? error}`);
        await Send_Message(context.peerId, '❌ Не удалось обновить настройки работы или цели. Проверьте логи.');
    } finally {
        try {
            if (typeof context.answer === 'function') await context.answer();
        } catch {
            // The action may have been invoked from a regular message context rather than a callback.
        }
    }
}

/** Handles the next ordinary message when a callback-based settings action expects text input. */
export async function RP_Work_Settings_ProcessInput(context: any): Promise<boolean> {
    const key = getInputFlowKey(context);
    const flow = pendingInputFlows.get(key);
    if (!flow) return false;

    const raw = String(context?.text ?? '').trim();
    if (/^(отмена|назад|cancel)$/i.test(raw)) {
        pendingInputFlows.delete(key);
        await sendContextMessage(context, 'Ввод отменён.');
        await showSettingsAfterInput(context, flow);
        return true;
    }
    if (!raw) {
        await sendInputPrompt(context, getFlowPrompt(flow), flow.menuPage);
        return true;
    }

    try {
        switch (flow.kind) {
            case 'settingNumber': {
                const value = parseInputNumber(raw);
                if (value === null || (flow.field === 'minimumPcPerYear' && !Number.isInteger(value))) {
                    const hint = flow.field === 'minimumPcPerYear'
                        ? 'Введите неотрицательное целое число.'
                        : 'Введите неотрицательное число; для дробного значения используйте точку или запятую.';
                    await sendInputPrompt(context, `${hint}\n\n${flow.prompt}`, flow.menuPage);
                    return true;
                }
                await db.rpWorkSettings.update({ where: { id: flow.settingsId }, data: { [flow.field]: value } });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, '✅ Настройка сохранена.');
                await showSettingsAfterInput(context, flow);
                return true;
            }
            case 'workYear': {
                const date = parseRuDate(raw);
                if (!date) {
                    await sendInputPrompt(context, '❌ Некорректная дата. Используйте ДД.ММ.ГГГГ.\n\n' + getFlowPrompt(flow), flow.menuPage);
                    return true;
                }
                if (flow.step === 'start') {
                    const next: PendingInputFlow = { ...flow, step: 'end', startDate: date };
                    pendingInputFlows.set(key, next);
                    await sendInputPrompt(context, 'Введите дату окончания ролевого года в формате ДД.ММ.ГГГГ:', flow.menuPage);
                    return true;
                }
                if (!flow.startDate || date.getTime() < flow.startDate.getTime()) {
                    await sendInputPrompt(context, '❌ Окончание не может быть раньше начала. Введите дату окончания ролевого года в формате ДД.ММ.ГГГГ:', flow.menuPage);
                    return true;
                }
                await db.rpWorkSettings.update({
                    where: { id: flow.settingsId },
                    data: { workYearStart: flow.startDate, workYearEnd: date }
                });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, `✅ Период ролевого года сохранён: ${formatDate(flow.startDate)}–${formatDate(date)}.`);
                await showSettingsAfterInput(context, flow);
                return true;
            }
            case 'goal': {
                if (flow.step === 'target') {
                    const target = parseInputNumber(raw);
                    if (target === null || target <= 0) {
                        await sendInputPrompt(context, '❌ Цель должна быть числом больше нуля.\n\n' + getFlowPrompt(flow), flow.menuPage);
                        return true;
                    }
                    const next: PendingInputFlow = { ...flow, step: 'start', targetPc: target };
                    pendingInputFlows.set(key, next);
                    await sendInputPrompt(context, 'Введите дату начала плана в формате ДД.ММ.ГГГГ:', flow.menuPage);
                    return true;
                }

                const date = parseRuDate(raw);
                if (!date) {
                    await sendInputPrompt(context, '❌ Некорректная дата. Используйте ДД.ММ.ГГГГ.\n\n' + getFlowPrompt(flow), flow.menuPage);
                    return true;
                }
                if (flow.step === 'start') {
                    const next: PendingInputFlow = { ...flow, step: 'end', startDate: date };
                    pendingInputFlows.set(key, next);
                    await sendInputPrompt(context, 'Введите дату окончания плана в формате ДД.ММ.ГГГГ:', flow.menuPage);
                    return true;
                }
                if (!flow.startDate || date.getTime() < flow.startDate.getTime()) {
                    await sendInputPrompt(context, '❌ Окончание плана не может быть раньше начала. Введите дату окончания плана в формате ДД.ММ.ГГГГ:', flow.menuPage);
                    return true;
                }
                const name = flow.hashtag ? `План #${flow.hashtag}` : 'Общий план';
                await db.rpWritingGoal.create({
                    data: {
                        userId: flow.userId,
                        allianceId: flow.allianceId,
                        name,
                        hashtag: flow.hashtag,
                        targetPc: flow.targetPc,
                        startDate: flow.startDate,
                        endDate: date
                    }
                });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, `✅ План создан: ${name}, ${fmt(flow.targetPc ?? 0)} ПК, ${formatDate(flow.startDate)}–${formatDate(date)}.`);
                await showSettingsAfterInput(context, flow);
                return true;
            }
            case 'lifeTiers': {
                const value = parseInputNumber(raw);
                if (value === null) {
                    await sendInputPrompt(context, '❌ Введите неотрицательное число.\n\n' + getFlowPrompt(flow), flow.menuPage);
                    return true;
                }
                if (flow.step === 'max') {
                    if (value <= flow.previousMax) {
                        await sendInputPrompt(context, `❌ Верхняя граница должна быть больше ${fmt(flow.previousMax)} ПК.\n\n${getFlowPrompt(flow)}`, flow.menuPage);
                        return true;
                    }
                    const next: PendingInputFlow = { ...flow, step: 'amount', maxPc: value };
                    pendingInputFlows.set(key, next);
                    await sendInputPrompt(context, getFlowPrompt(next), flow.menuPage);
                    return true;
                }

                const newTier: WorkTier = { maxPc: flow.index === 5 ? null : (flow.maxPc ?? null), amount: value };
                const tiers = [...flow.tiers, newTier];
                if (flow.index === 5) {
                    await db.rpWorkSettings.update({ where: { id: flow.settingsId }, data: { lifeTierRates: JSON.stringify(tiers) } });
                    pendingInputFlows.delete(key);
                    await sendContextMessage(context, '✅ Ступени оплаты за пост сохранены.');
                    await showSettingsAfterInput(context, flow);
                    return true;
                }

                const nextIndex = flow.index + 1;
                const next: PendingInputFlow = {
                    ...flow,
                    index: nextIndex,
                    previousMax: flow.maxPc ?? flow.previousMax,
                    step: nextIndex === 5 ? 'amount' : 'max',
                    maxPc: undefined,
                    tiers
                };
                pendingInputFlows.set(key, next);
                await sendInputPrompt(context, getFlowPrompt(next), flow.menuPage);
                return true;
            }
        }
    } catch (error: any) {
        pendingInputFlows.delete(key);
        await Logger(`RP work input error for user ${flow.userId}: ${error?.message ?? error}`);
        await sendContextMessage(context, '❌ Не удалось сохранить значение. Проверьте логи.');
        try { await showSettingsAfterInput(context, flow); } catch { /* avoid a secondary error */ }
        return true;
    }
}

async function getOrCreateSettings(userId: number, allianceId: number): Promise<RpWorkSettings> {
    return db.rpWorkSettings.upsert({
        where: { userId_allianceId: { userId, allianceId } },
        create: {
            userId,
            allianceId,
            ratePerPc: 0,
            highSeniority: false,
            seniorityBonus: 200,
            minimumPcPerYear: 10,
            workScope: 'all',
            workHashtag: null,
            workYearStart: null,
            workYearEnd: null,
            lifeHashtag: 'жизнь',
            lifeTierRates: JSON.stringify(DEFAULT_LIFE_TIERS)
        },
        update: {}
    });
}

async function renderSettingsMenu(
    context: any,
    userId: number,
    allianceId: number,
    settings: RpWorkSettings,
    requestedPage: number = 0
): Promise<void> {
    const goalsCount = await db.rpWritingGoal.count({ where: { userId, allianceId } });
    const periodText = settings.workYearStart && settings.workYearEnd
        ? `${formatDate(settings.workYearStart)}–${formatDate(settings.workYearEnd)}`
        : 'не задан';
    const scopeText = settings.workScope === 'hashtag' && settings.workHashtag
        ? `#${settings.workHashtag}`
        : 'все посты';
    const tiers = parseLifeTiers(settings.lifeTierRates);
    const tierText = tiers.map((tier, index) => `${index + 1}: ${tier.maxPc === null ? 'свыше' : `до ${fmt(tier.maxPc)} ПК`} — ${fmt(tier.amount)}`).join('; ');
    const menuPage = clampMenuPage(requestedPage);

    const text = `💼 Работа и цели персонажа\n\n` +
        `💰 Оплата: ${fmt(settings.ratePerPc)} за ПК-строку\n` +
        `🎖 Высокий стаж: ${settings.highSeniority ? 'включён' : 'выключен'}\n` +
        `➕ Фиксированная доплата за стаж: ${fmt(settings.seniorityBonus)}\n` +
        `📏 Минимум для оплаты: ${fmt(settings.minimumPcPerYear)} ПК за ролевой год\n` +
        `📆 Период ролевого года: ${periodText}\n` +
        `📝 Учитывать как работу: ${scopeText}\n\n` +
        `🏷 Тариф за посты #${settings.lifeHashtag || 'жизнь'}\n${tierText}\n\n` +
        `🎯 Сохранённых планов: ${goalsCount}\n\n` +
        `ℹ Расчёты справочные. Бот ничего не начисляет и не переводит автоматически. Старые записи статистики, удалённые до установки этого обновления, восстановить нельзя.\n\n` +
        `Раздел ${menuPage + 1}/3: ${['Оплата', 'Условия работы', 'Планы'][menuPage]}`;

    // VK limits inline keyboards to six rows. Keep each tab under that limit.
    const keyboard = new KeyboardBuilder();
    const actionPayload = (action: string, extra: Record<string, any> = {}) => ({
        command: 'rp_work_settings', action, menuPage, ...extra
    });

    if (menuPage === 0) {
        keyboard.callbackButton({ label: '💰 Изменить ставку за строку', payload: actionPayload('edit_rate'), color: 'secondary' }).row();
        keyboard.callbackButton({ label: `🎖 Высокий стаж: ${settings.highSeniority ? '✅' : '❌'}`, payload: actionPayload('toggle_seniority'), color: settings.highSeniority ? 'positive' : 'secondary' });
        keyboard.callbackButton({ label: '➕ Изменить доплату', payload: actionPayload('edit_seniority_bonus'), color: 'secondary' }).row();
        keyboard.callbackButton({ label: '📏 Изменить минимум ПК за год', payload: actionPayload('edit_minimum'), color: 'secondary' }).row();
        keyboard.callbackButton({ label: '📆 Указать даты ролевого года', payload: actionPayload('set_work_year'), color: 'secondary' }).row();
    } else if (menuPage === 1) {
        keyboard.callbackButton({ label: settings.workScope === 'all' ? '📝 Все посты ✅' : '📝 Учитывать все посты', payload: actionPayload('scope_all'), color: settings.workScope === 'all' ? 'positive' : 'secondary' });
        keyboard.callbackButton({ label: '🏷 Выбрать рабочий хештег', payload: actionPayload('scope_tag_menu'), color: settings.workScope === 'hashtag' ? 'positive' : 'secondary' }).row();
        keyboard.callbackButton({ label: `🏷 Тариф: #${String(settings.lifeHashtag || 'жизнь').slice(0, 20)}`, payload: actionPayload('life_tag_menu'), color: 'secondary' });
        keyboard.callbackButton({ label: '⚖ Настроить тарифные ступени', payload: actionPayload('configure_life_tiers'), color: 'secondary' }).row();
        keyboard.callbackButton({ label: '📊 Прогноз заработка', payload: actionPayload('forecast'), color: 'positive' }).row();
    } else {
        keyboard.callbackButton({ label: '🎯 Создать общий план', payload: actionPayload('goal_create_overall'), color: 'secondary' });
        keyboard.callbackButton({ label: '🏷 План по хештегу', payload: actionPayload('goal_tag_menu'), color: 'secondary' }).row();
        keyboard.callbackButton({ label: `📋 Мои планы (${goalsCount})`, payload: actionPayload('goal_list', { goalPage: 0 }), color: 'secondary' }).row();
    }

    keyboard.callbackButton({ label: menuPage === 0 ? '💰 Оплата ✓' : '💰 Оплата', payload: actionPayload('menu_page', { menuPage: 0 }), color: menuPage === 0 ? 'positive' : 'secondary' });
    keyboard.callbackButton({ label: menuPage === 1 ? '📝 Работа ✓' : '📝 Работа', payload: actionPayload('menu_page', { menuPage: 1 }), color: menuPage === 1 ? 'positive' : 'secondary' });
    keyboard.callbackButton({ label: menuPage === 2 ? '🎯 Планы ✓' : '🎯 Планы', payload: actionPayload('menu_page', { menuPage: 2 }), color: menuPage === 2 ? 'positive' : 'secondary' }).row();
    keyboard.callbackButton({ label: '↩ Карточка', payload: { command: 'card_enter' }, color: 'secondary' });
    keyboard.callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).row().inline().oneTime();

    await Send_Message(context.peerId, text, keyboard);
}

async function renderHashtagPicker(
    context: any,
    allianceId: number,
    action: string,
    prompt: string,
    requestedPage: number = 0,
    returnMenuPage: number = 0
): Promise<void> {
    const hashtags = await getAllianceHashtags(allianceId);
    if (hashtags.length === 0) {
        await sendContextMessage(context, '🏷 В этой ролевой не настроены хештеги мониторов. Сначала добавьте хештеги в настройках обсуждений.');
        return;
    }

    // Keep the inline keyboard within VK's row limits; long hashtag lists are paginated.
    const pageSize = 4;
    const totalPages = Math.max(1, Math.ceil(hashtags.length / pageSize));
    const page = Math.min(Math.max(0, Number.isFinite(requestedPage) ? requestedPage : 0), totalPages - 1);
    const pageHashtags = hashtags.slice(page * pageSize, (page + 1) * pageSize);
    const keyboard = new KeyboardBuilder();
    for (const hashtag of pageHashtags) {
        keyboard.callbackButton({
            label: `#${hashtag}`.slice(0, 40),
            payload: { command: 'rp_work_settings', action, hashtag, menuPage: returnMenuPage },
            color: 'secondary'
        }).row();
    }
    if (page > 0) {
        keyboard.callbackButton({
            label: '◀ Назад',
            payload: { command: 'rp_work_settings', action: pickerMenuAction(action), hashtagPage: page - 1, menuPage: returnMenuPage },
            color: 'secondary'
        });
    }
    if (page + 1 < totalPages) {
        keyboard.callbackButton({
            label: 'Далее ▶',
            payload: { command: 'rp_work_settings', action: pickerMenuAction(action), hashtagPage: page + 1, menuPage: returnMenuPage },
            color: 'secondary'
        });
    }
    keyboard.callbackButton({ label: '↩ Настройки', payload: { command: 'rp_work_settings', menuPage: returnMenuPage }, color: 'secondary' }).row().inline().oneTime();
    await Send_Message(context.peerId, `${prompt}\n\nДоступные хештеги · страница ${page + 1}/${totalPages}:`, keyboard);
}

async function sendContextMessage(context: any, message: string): Promise<void> {
    if (typeof context?.send === 'function') {
        await context.send(message);
        return;
    }
    if (context?.peerId != null) {
        await Send_Message(context.peerId, message);
    }
}

function pickerMenuAction(selectionAction: string): string {
    switch (selectionAction) {
        case 'scope_tag': return 'scope_tag_menu';
        case 'life_set_tag': return 'life_tag_menu';
        case 'goal_create_tag': return 'goal_tag_menu';
        default: return 'menu';
    }
}

async function getAllianceHashtags(allianceId: number): Promise<string[]> {
    const rows = await prisma.monitorHashtag.findMany({
        where: { monitor: { id_alliance: allianceId } },
        select: { hashtag: true }
    });
    return Array.from(new Set(rows.map(row => normalizeHashtag(row.hashtag)))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
}

async function startSettingNumberFlow(
    context: any,
    userId: number,
    allianceId: number,
    settingsId: number,
    menuPage: number,
    field: 'ratePerPc' | 'seniorityBonus' | 'minimumPcPerYear',
    prompt: string
): Promise<void> {
    const flow: PendingInputFlow = { kind: 'settingNumber', userId, allianceId, settingsId, menuPage, field, prompt };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, prompt, menuPage);
}

async function startWorkYearFlow(context: any, userId: number, allianceId: number, settingsId: number, menuPage: number): Promise<void> {
    const flow: PendingInputFlow = { kind: 'workYear', userId, allianceId, settingsId, menuPage, step: 'start' };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, 'Введите дату начала ролевого года в формате ДД.ММ.ГГГГ:', menuPage);
}

async function startGoalFlow(context: any, userId: number, allianceId: number, hashtag: string | null, menuPage: number): Promise<void> {
    const flow: PendingInputFlow = { kind: 'goal', userId, allianceId, menuPage, hashtag, step: 'target' };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, `Введите цель в ПК-строках${hashtag ? ` для #${hashtag}` : ''}:`, menuPage);
}

async function startLifeTiersFlow(context: any, userId: number, allianceId: number, settings: RpWorkSettings, menuPage: number): Promise<void> {
    const flow: PendingInputFlow = {
        kind: 'lifeTiers', userId, allianceId, settingsId: settings.id, menuPage,
        step: 'max', index: 0, previousMax: 0, tiers: [], oldTiers: parseLifeTiers(settings.lifeTierRates)
    };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, getFlowPrompt(flow), menuPage);
}

function getInputFlowKey(context: any): string {
    const peerId = context?.peerId ?? context?.peer_id ?? 'no-peer';
    const actorId = context?.senderId ?? context?.userId ?? context?.eventPayload?.user_id ?? 'no-user';
    return `${peerId}:${actorId}`;
}

async function sendInputPrompt(context: any, prompt: string, menuPage: number): Promise<void> {
    const keyboard = new KeyboardBuilder()
        .callbackButton({
            label: '🚫 Отмена',
            payload: { command: 'rp_work_settings', action: 'cancel_input', menuPage },
            color: 'negative'
        })
        .inline()
        .oneTime();
    await Send_Message(context.peerId, `${prompt}\n\nДля отмены нажмите кнопку или напишите «отмена».`, keyboard);
}

function getFlowPrompt(flow: PendingInputFlow): string {
    switch (flow.kind) {
        case 'settingNumber':
            return flow.prompt;
        case 'workYear':
            return flow.step === 'start'
                ? 'Введите дату начала ролевого года в формате ДД.ММ.ГГГГ:'
                : 'Введите дату окончания ролевого года в формате ДД.ММ.ГГГГ:';
        case 'goal':
            if (flow.step === 'target') return `Введите цель в ПК-строках${flow.hashtag ? ` для #${flow.hashtag}` : ''}:`;
            return flow.step === 'start'
                ? 'Введите дату начала плана в формате ДД.ММ.ГГГГ:'
                : 'Введите дату окончания плана в формате ДД.ММ.ГГГГ:';
        case 'lifeTiers': {
            if (flow.step === 'max') {
                const oldMax = flow.oldTiers[flow.index]?.maxPc ?? DEFAULT_LIFE_TIERS[flow.index]?.maxPc ?? 0;
                return `Ступень ${flow.index + 1}/6. Верхняя граница ПК для этой ступени (текущая: ${fmt(oldMax ?? 0)}):`;
            }
            const oldAmount = flow.oldTiers[flow.index]?.amount ?? DEFAULT_LIFE_TIERS[flow.index]?.amount ?? 0;
            return flow.index === 5
                ? `Ступень 6/6. Выплата за пост выше ${fmt(flow.previousMax)} ПК (текущая: ${fmt(oldAmount)}):`
                : `Ступень ${flow.index + 1}/6. Выплата за пост (текущая: ${fmt(oldAmount)}):`;
    }
    }
}

function parseInputNumber(raw: string): number | null {
    const value = Number(raw.trim().replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(value) && value >= 0 ? value : null;
}

async function showSettingsAfterInput(context: any, flow: PendingInputFlow): Promise<void> {
    const settings = await getOrCreateSettings(flow.userId, flow.allianceId);
    await renderSettingsMenu(context, flow.userId, flow.allianceId, settings, flow.menuPage);
}

async function renderGoalList(context: any, userId: number, allianceId: number, requestedPage: number): Promise<void> {
    const goals = await db.rpWritingGoal.findMany({
        where: { userId, allianceId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    if (goals.length === 0) {
        const keyboard = new KeyboardBuilder()
            .callbackButton({ label: '↩ Настройки', payload: { command: 'rp_work_settings' }, color: 'secondary' })
            .inline().oneTime();
        await Send_Message(context.peerId, '🎯 Сохранённых планов пока нет.', keyboard);
        return;
    }

    const perPage = 4;
    const totalPages = Math.max(1, Math.ceil(goals.length / perPage));
    const page = Math.min(Math.max(0, requestedPage), totalPages - 1);
    const visibleGoals = goals.slice(page * perPage, (page + 1) * perPage);
    const text = `📋 Ваши планы (${goals.length})\nВыберите план, чтобы посмотреть прогресс и разбивку по дням.\nСтраница ${page + 1}/${totalPages}`;
    const keyboard = new KeyboardBuilder();
    for (const goal of visibleGoals) {
        keyboard.callbackButton({
            label: `${goal.name} · ${fmt(goal.targetPc)} ПК`.slice(0, 40),
            payload: { command: 'rp_work_settings', action: 'goal_view', goalId: goal.id, menuPage: 2 },
            color: 'secondary'
        }).row();
    }
    if (page > 0) {
        keyboard.callbackButton({ label: '←', payload: { command: 'rp_work_settings', action: 'goal_list', goalPage: page - 1, menuPage: 2 }, color: 'secondary' });
    }
    if (page + 1 < totalPages) {
        keyboard.callbackButton({ label: '→', payload: { command: 'rp_work_settings', action: 'goal_list', goalPage: page + 1, menuPage: 2 }, color: 'secondary' });
    }
    keyboard.callbackButton({ label: '↩ Настройки', payload: { command: 'rp_work_settings', menuPage: 2 }, color: 'secondary' }).row().inline().oneTime();
    await Send_Message(context.peerId, text, keyboard);
}

async function renderGoalDetails(
    context: any,
    userId: number,
    allianceId: number,
    goalId: number,
    requestedWeekPage: number = 0
): Promise<void> {
    const goal = await db.rpWritingGoal.findFirst({ where: { id: goalId, userId, allianceId } });
    if (!goal) {
        await sendContextMessage(context, '❌ План не найден.');
        await renderGoalList(context, userId, allianceId, 0);
        return;
    }

    const startDate = startOfUtcDay(new Date(goal.startDate));
    const endDate = startOfUtcDay(new Date(goal.endDate));
    if (startDate.getTime() > endDate.getTime()) {
        await sendContextMessage(context, '❌ У плана некорректный период.');
        await renderGoalList(context, userId, allianceId, 0);
        return;
    }

    const endExclusive = addUtcDays(endDate, 1);
    const posts = await getPosts(userId, allianceId, startDate, endExclusive, goal.hashtag ?? null);
    const daily = new Map<string, number>();
    let actualTotal = 0;
    for (const post of posts) {
        const key = dayKey(post.date);
        daily.set(key, (daily.get(key) ?? 0) + post.pc);
        actualTotal += post.pc;
    }

    const dayCount = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    const dailyBaseline = goal.targetPc / dayCount;
    const dailyRows: Array<{ date: Date; line: string }> = [];
    let cumulative = 0;

    // Compute all dates before slicing the requested week so surplus/deficit carries
    // correctly across week boundaries.
    for (let offset = 0; offset < dayCount; offset++) {
        const date = addUtcDays(startDate, offset);
        const actualToday = daily.get(dayKey(date)) ?? 0;
        const targetThroughToday = Math.min(goal.targetPc, dailyBaseline * (offset + 1));
        const requiredToday = Math.max(0, targetThroughToday - cumulative);
        cumulative += actualToday;
        const remainingThroughToday = Math.max(0, targetThroughToday - cumulative);
        const carriedForward = Math.max(0, cumulative - targetThroughToday);
        dailyRows.push({
            date,
            line: `${formatDate(date)} — нужно с переносом ${fmt(requiredToday)} ПК; наролено ${fmt(actualToday)} ПК; остаток к норме ${fmt(remainingThroughToday)} ПК; запас ${fmt(carriedForward)} ПК`
        });
    }

    const weekSize = 7;
    const totalWeeks = Math.max(1, Math.ceil(dayCount / weekSize));
    const parsedWeekPage = Number.isFinite(requestedWeekPage) ? Math.trunc(requestedWeekPage) : 0;
    const weekPage = Math.min(Math.max(parsedWeekPage, 0), totalWeeks - 1);
    const weekRows = dailyRows.slice(weekPage * weekSize, (weekPage + 1) * weekSize);
    const weekStart = weekRows[0]?.date ?? startDate;
    const weekEnd = weekRows[weekRows.length - 1]?.date ?? endDate;

    const remainingTotal = Math.max(0, goal.targetPc - actualTotal);
    const excess = Math.max(0, actualTotal - goal.targetPc);
    const report = `🎯 ${goal.name}\n` +
        `Период: ${formatDate(startDate)}–${formatDate(endDate)} (${dayCount} дн.)\n` +
        `Цель: ${fmt(goal.targetPc)} ПК\n` +
        `Наролено: ${fmt(actualTotal)} ПК\n` +
        `Осталось до цели: ${fmt(remainingTotal)} ПК\n` +
        `Средняя норма: ${fmt(dailyBaseline)} ПК/день\n` +
        (excess > 0 ? `Перевыполнение: ${fmt(excess)} ПК\n` : '') +
        `Учёт: ${goal.hashtag ? `только #${goal.hashtag}` : 'все отслеживаемые посты'}\n\n` +
        `Разбивка по дням (перевыполнение переносится на следующие даты)\n` +
        `Неделя ${weekPage + 1}/${totalWeeks}: ${formatDate(weekStart)}–${formatDate(weekEnd)}\n` +
        weekRows.map(row => row.line).join('\n') +
        `\n\nДанные основаны на сохранённой статистике обсуждений.`;

    const keyboard = new KeyboardBuilder();
    if (weekPage > 0) {
        keyboard.callbackButton({
            label: '← Пред. неделя',
            payload: { command: 'rp_work_settings', action: 'goal_view', goalId: goal.id, weekPage: weekPage - 1, menuPage: 2 },
            color: 'secondary'
        });
    }
    if (weekPage + 1 < totalWeeks) {
        keyboard.callbackButton({
            label: 'След. неделя →',
            payload: { command: 'rp_work_settings', action: 'goal_view', goalId: goal.id, weekPage: weekPage + 1, menuPage: 2 },
            color: 'secondary'
        });
    }
    if (totalWeeks > 1) keyboard.row();

    keyboard.callbackButton({
        label: '🗑 Удалить план',
        payload: { command: 'rp_work_settings', action: 'goal_delete', goalId: goal.id, menuPage: 2 },
        color: 'negative'
    }).row();
    keyboard.callbackButton({
        label: '↩ К планам',
        payload: { command: 'rp_work_settings', action: 'goal_list', goalPage: 0, menuPage: 2 },
        color: 'secondary'
    });
    keyboard.callbackButton({
        label: '↩ Настройки',
        payload: { command: 'rp_work_settings', menuPage: 2 },
        color: 'secondary'
    }).row().inline().oneTime();

    // One week (at most seven date lines) fits in a single VK message.
    await Send_Message(context.peerId, report, keyboard);
}

async function sendForecast(context: any, userId: number, allianceId: number, settings: RpWorkSettings): Promise<void> {
    if (!settings.workYearStart || !settings.workYearEnd) {
        await sendContextMessage(context, '📆 Сначала задайте даты ролевого года в настройках.');
        return;
    }
    const start = startOfUtcDay(new Date(settings.workYearStart));
    const end = startOfUtcDay(new Date(settings.workYearEnd));
    if (start.getTime() > end.getTime()) {
        await sendContextMessage(context, '❌ Даты ролевого года настроены некорректно.');
        return;
    }

    const workHashtag = settings.workScope === 'hashtag' ? settings.workHashtag : null;
    if (settings.workScope === 'hashtag' && !workHashtag) {
        await sendContextMessage(context, '🏷 Сначала выберите рабочий хештег.');
        return;
    }
    const workPosts = await getPosts(userId, allianceId, start, addUtcDays(end, 1), workHashtag);
    const totalPc = sumPc(workPosts);
    const minimumMet = totalPc >= settings.minimumPcPerYear;
    const basePay = minimumMet ? totalPc * settings.ratePerPc : 0;
    const seniorityPay = minimumMet && settings.highSeniority ? settings.seniorityBonus : 0;
    const totalPay = basePay + seniorityPay;

    const lifeTag = normalizeHashtag(settings.lifeHashtag || 'жизнь');
    const lifePosts = await getPosts(userId, allianceId, start, addUtcDays(end, 1), lifeTag);
    const tiers = parseLifeTiers(settings.lifeTierRates);
    let lifeTotal = 0;
    const byTier = tiers.map(() => ({ count: 0, total: 0 }));
    for (const post of lifePosts) {
        const tierIndex = findTierIndex(post.pc, tiers);
        if (tierIndex < 0) continue;
        byTier[tierIndex].count++;
        byTier[tierIndex].total += tiers[tierIndex].amount;
        lifeTotal += tiers[tierIndex].amount;
    }

    const tierLines = tiers.map((tier, index) => {
        const range = tier.maxPc === null
            ? `свыше ${index > 0 ? fmt(tiers[index - 1].maxPc ?? 0) : '0'} ПК`
            : `до ${fmt(tier.maxPc)} ПК`;
        return `  • ${range}: ${byTier[index].count} постов × ${fmt(tier.amount)} = ${fmt(byTier[index].total)}`;
    }).join('\n');

    const report = `📊 Прогноз заработка за ${formatDate(start)}–${formatDate(end)}\n\n` +
        `💼 Работа (${settings.workScope === 'hashtag' ? `#${workHashtag}` : 'все посты'}):\n` +
        `ПК-строк: ${fmt(totalPc)} из минимума ${fmt(settings.minimumPcPerYear)}\n` +
        `Допуск к оплате: ${minimumMet ? 'да' : 'нет — минимум не выполнен'}\n` +
        `Базовая оплата: ${fmt(basePay)} (${minimumMet ? `${fmt(totalPc)} × ${fmt(settings.ratePerPc)}` : '0 из-за невыполненного минимума'})\n` +
        `Доплата за высокий стаж: ${fmt(seniorityPay)}${settings.highSeniority ? '' : ' (отключена)'}\n` +
        `Итого по работе: ${fmt(totalPay)}\n\n` +
        `🏷 Отдельный тариф #${lifeTag}:\n` +
        `Постов: ${lifePosts.length}; ПК-строк суммарно: ${fmt(sumPc(lifePosts))}\n` +
        `${tierLines}\n` +
        `Ожидаемая сумма по тарифу #${lifeTag}: ${fmt(lifeTotal)}\n\n` +
        `⚠ Это прогноз, не начисление. Статистика старше 7 недель сохраняется только для периодов активных планов и настроенного ролевого года; ранее удалённые записи восстановить нельзя.`;

    const keyboard = new KeyboardBuilder()
        .callbackButton({ label: '↩ Настройки', payload: { command: 'rp_work_settings', menuPage: 1 }, color: 'secondary' })
        .inline().oneTime();
    const parts = splitVkMessage(report);
    for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) await Send_Message(context.peerId, parts[i], keyboard);
        else await sendContextMessage(context, parts[i]);
    }
}

async function getPosts(userId: number, allianceId: number, startDate: Date, endExclusive: Date, hashtag: string | null): Promise<StoredPost[]> {
    const where: any = {
        userId,
        date: { gte: startDate, lt: endExclusive },
        topicMonitor: { monitor: { id_alliance: allianceId } }
    };
    if (hashtag) {
        where.hashtags = { some: { hashtag: normalizeHashtag(hashtag), allianceId } };
    }
    return prisma.postStatistic.findMany({ where, select: { date: true, pc: true } });
}

function parseRuDate(raw: string): Date | null {
    const match = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
}

function parseLifeTiers(raw: string | null | undefined): WorkTier[] {
    if (!raw) return [...DEFAULT_LIFE_TIERS];
    try {
        const value = JSON.parse(raw);
        if (!Array.isArray(value) || value.length !== 6) return [...DEFAULT_LIFE_TIERS];
        const tiers = value.map((item: any) => ({
            maxPc: item.maxPc === null ? null : Number(item.maxPc),
            amount: Number(item.amount)
        }));
        if (tiers.some(tier => (tier.maxPc !== null && (!Number.isFinite(tier.maxPc) || tier.maxPc <= 0)) || !Number.isFinite(tier.amount) || tier.amount < 0)) {
            return [...DEFAULT_LIFE_TIERS];
        }
        if (tiers[5].maxPc !== null) tiers[5].maxPc = null;
        return tiers;
    } catch {
        return [...DEFAULT_LIFE_TIERS];
    }
}

function findTierIndex(pc: number, tiers: WorkTier[]): number {
    for (let i = 0; i < tiers.length; i++) {
        if (tiers[i].maxPc === null || pc <= tiers[i].maxPc!) return i;
    }
    return tiers.length - 1;
}

function clampMenuPage(value: unknown): number {
    const page = Number(value ?? 0);
    if (!Number.isFinite(page)) return 0;
    return Math.min(2, Math.max(0, Math.trunc(page)));
}

function normalizeHashtag(value: string): string {
    return value.replace(/^#/, '').trim().toLowerCase();
}

function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function dayKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', { timeZone: 'UTC' });
}

function fmt(value: number | null | undefined): string {
    return Number(value ?? 0).toFixed(2).replace('.', ',');
}

function sumPc(posts: StoredPost[]): number {
    return posts.reduce((sum, post) => sum + post.pc, 0);
}