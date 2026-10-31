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
    bonusLabel: string;
    minimumPcPerYear: number;
    workScope: string;
    workHashtag: string | null;
    workYearStart: Date | null;
    workYearEnd: Date | null;
    lifeHashtag: string;
    lifeTierRates: string;
};

const db = prisma as any;

type PendingInputFlow =
    | {
        kind: 'settingNumber'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        field: 'ratePerPc' | 'seniorityBonus' | 'minimumPcPerYear'; prompt: string;
    }
    | {
        kind: 'settingText'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        field: 'bonusLabel'; prompt: string;
    }
    | {
        kind: 'workYear'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        step: 'start' | 'end'; startDate?: Date;
    }
    | {
        kind: 'goal'; userId: number; allianceId: number; menuPage: number; hashtag: string | null;
        step: 'target' | 'start' | 'end'; targetPc?: number; startDate?: Date; goalId?: number;
    }
    | {
        kind: 'lifeTierAdd'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        step: 'boundary' | 'amount'; tiers: WorkTier[]; maxPc?: number;
    }
    | {
        kind: 'lifeTierEdit'; userId: number; allianceId: number; settingsId: number; menuPage: number;
        step: 'max' | 'amount'; index: number; tiers: WorkTier[];
    }
    | {
        kind: 'goalTierAdd'; userId: number; allianceId: number; goalId: number; menuPage: number;
        step: 'boundary' | 'amount'; tiers: WorkTier[]; maxPc?: number;
    }
    | {
        kind: 'goalTierEdit'; userId: number; allianceId: number; goalId: number; menuPage: number;
        step: 'max' | 'amount'; index: number; tiers: WorkTier[];
    }
    | {
        kind: 'goalSettingNumber'; userId: number; allianceId: number; goalId: number; menuPage: number;
        field: 'ratePerPc' | 'minimumPc' | 'extraPaymentAmount'; prompt: string;
    }
    | {
        kind: 'goalSettingText'; userId: number; allianceId: number; goalId: number; menuPage: number;
        field: 'extraPaymentLabel'; prompt: string;
    }
    | { kind: 'goalTemplateName'; userId: number; allianceId: number; goalId: number; menuPage: number; }
    | { kind: 'goalTemplateCode'; userId: number; allianceId: number; goalId: number; menuPage: number; };

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
        await sendContextMessage(context, '❌ Настройки целей доступны только персонажам из ролевой.');
        return;
    }

    const topicCount = await prisma.topicMonitor.count({
        where: { monitor: { id_alliance: allianceId } }
    });
    if (topicCount === 0) {
        await sendContextMessage(context, '📭 В этой ролевой не настроены обсуждения. Настройки целей недоступны.');
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
            case 'cancel_input': {
                const key = getInputFlowKey(context);
                const pendingFlow = pendingInputFlows.get(key);
                pendingInputFlows.delete(key);
                await sendContextMessage(context, 'Ввод отменён.');
                if (pendingFlow?.kind === 'lifeTierAdd' || pendingFlow?.kind === 'lifeTierEdit') {
                    await renderLifeTierMenu(context, user.id, allianceId, settings, 0);
                } else if (pendingFlow?.kind === 'goalTierAdd' || pendingFlow?.kind === 'goalTierEdit') {
                    await renderGoalTierMenu(context, user.id, allianceId, pendingFlow.goalId, 0);
                } else if (pendingFlow?.kind === 'goalTemplateName' || pendingFlow?.kind === 'goalTemplateCode') {
                    await renderGoalConfig(context, user.id, allianceId, pendingFlow.goalId);
                } else if (pendingFlow?.kind === 'goalSettingNumber' || pendingFlow?.kind === 'goalSettingText') {
                    await renderGoalAdvancedSettings(context, user.id, allianceId, pendingFlow.goalId);
                } else {
                    await renderSettingsMenu(context, user.id, allianceId, settings, menuPage);
                }
                return;
            }
            case 'edit_rate':
            case 'edit_bonus_label':
            case 'toggle_seniority':
            case 'edit_seniority_bonus':
            case 'edit_minimum':
            case 'set_work_year':
            case 'scope_all':
            case 'scope_tag_menu':
            case 'scope_tag':
            case 'life_tag_menu':
            case 'life_configure_tag_menu':
            case 'life_configure_tag':
            case 'life_set_tag':
            case 'configure_life_tiers':
            case 'life_tier_menu':
            case 'life_tier_add':
            case 'life_tier_edit':
            case 'life_tier_edit_amount':
            case 'life_tier_edit_max':
            case 'life_tier_delete':
            case 'life_tier_disable':
            case 'life_tier_back':
            case 'forecast':
                await sendContextMessage(context, 'Эти параметры теперь настраиваются отдельно внутри каждой цели: откройте цель → настройки → углублённые настройки.');
                await renderSettingsMenu(context, user.id, allianceId, settings, 2);
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
            case 'goal_config':
                await renderGoalConfig(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0));
                return;
            case 'goal_advanced':
                await renderGoalAdvancedSettings(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0));
                return;
            case 'goal_edit_rate':
                await startGoalSettingNumberFlow(
                    context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), 'ratePerPc',
                    'Введите ставку за одну ПК-строку для этой цели. Используйте точку или запятую для дробной части:'
                );
                return;
            case 'goal_edit_minimum':
                await startGoalSettingNumberFlow(
                    context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), 'minimumPc',
                    'Введите минимальное целое количество ПК-строк за период этой цели для допуска к выплате:'
                );
                return;
            case 'goal_toggle_extra_payment': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                const goal = await getOwnedGoal(user.id, allianceId, goalId);
                if (!goal) { await sendContextMessage(context, '❌ Цель не найдена.'); return; }
                await db.rpWritingGoal.updateMany({
                    where: { id: goalId, userId: user.id, allianceId },
                    data: { extraPaymentEnabled: !Boolean(goal.extraPaymentEnabled) }
                });
                await renderGoalAdvancedSettings(context, user.id, allianceId, goalId);
                return;
            }
            case 'goal_edit_extra_label':
                await startGoalSettingTextFlow(
                    context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), 'extraPaymentLabel',
                    'Введите название дополнительной выплаты для этой цели (до 40 символов):'
                );
                return;
            case 'goal_edit_extra_amount':
                await startGoalSettingNumberFlow(
                    context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), 'extraPaymentAmount',
                    'Введите размер дополнительной выплаты для этой цели:'
                );
                return;
            case 'goal_forecast':
                await sendGoalForecast(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0));
                return;
            case 'goal_tracking_all': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                await updateGoalTracking(user.id, allianceId, goalId, 'all', []);
                await renderGoalConfig(context, user.id, allianceId, goalId);
                return;
            }
            case 'goal_tracking_tags_menu':
                await renderGoalHashtagPicker(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), Number(context.eventPayload?.hashtagPage ?? 0));
                return;
            case 'goal_tracking_toggle_tag': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                const hashtag = normalizeHashtag(String(context.eventPayload?.hashtag ?? ''));
                await toggleGoalHashtag(user.id, allianceId, goalId, hashtag);
                await renderGoalHashtagPicker(context, user.id, allianceId, goalId, Number(context.eventPayload?.hashtagPage ?? 0));
                return;
            }
            case 'goal_tracking_tags_done':
                await renderGoalConfig(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0));
                return;
            case 'goal_tier_menu':
                await renderGoalTierMenu(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), Number(context.eventPayload?.tierPage ?? 0));
                return;
            case 'goal_tier_add':
                await startGoalTierAddFlow(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0));
                return;
            case 'goal_tier_edit':
                await renderGoalTierEditMenu(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), Number(context.eventPayload?.tierIndex ?? -1));
                return;
            case 'goal_tier_edit_amount':
                await startGoalTierEditFlow(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), Number(context.eventPayload?.tierIndex ?? -1), 'amount');
                return;
            case 'goal_tier_edit_max':
                await startGoalTierEditFlow(context, user.id, allianceId, Number(context.eventPayload?.goalId ?? 0), Number(context.eventPayload?.tierIndex ?? -1), 'max');
                return;
            case 'goal_tier_delete': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                const goal = await getOwnedGoal(user.id, allianceId, goalId);
                if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
                const tiers = parseLifeTiers(goal.tierRates);
                const index = Number(context.eventPayload?.tierIndex ?? -1);
                if (!Number.isInteger(index) || index < 0 || index >= tiers.length) {
                    await sendContextMessage(context, '❌ Тарифная ступень не найдена.');
                } else {
                    tiers.splice(index, 1);
                    if (tiers.length > 0) tiers[tiers.length - 1].maxPc = null;
                    await db.rpWritingGoal.update({ where: { id: goalId }, data: { tierRates: serializeLifeTiers(tiers) } });
                    await sendContextMessage(context, '✅ Тарифная ступень удалена.');
                }
                await renderGoalTierMenu(context, user.id, allianceId, goalId, 0);
                return;
            }
            case 'goal_tier_disable': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                await db.rpWritingGoal.updateMany({ where: { id: goalId, userId: user.id, allianceId }, data: { tierRates: serializeLifeTiers([]) } });
                await sendContextMessage(context, '✅ Тариф для этой цели отключён.');
                await renderGoalTierMenu(context, user.id, allianceId, goalId, 0);
                return;
            }
            case 'goal_template_save': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                const goal = await getOwnedGoal(user.id, allianceId, goalId);
                if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
                pendingInputFlows.set(getInputFlowKey(context), { kind: 'goalTemplateName', userId: user.id, allianceId, goalId, menuPage: 2 });
                await sendInputPrompt(context, 'Введите название шаблона настроек этой цели (до 40 символов):', 2);
                return;
            }
            case 'goal_template_apply': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                const goal = await getOwnedGoal(user.id, allianceId, goalId);
                if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
                pendingInputFlows.set(getInputFlowKey(context), { kind: 'goalTemplateCode', userId: user.id, allianceId, goalId, menuPage: 2 });
                await sendInputPrompt(context, 'Введите код шаблона. Сработают только шаблоны, созданные в этой ролевой:', 2);
                return;
            }
            case 'goal_edit': {
                const goalId = Number(context.eventPayload?.goalId ?? 0);
                const goal = await db.rpWritingGoal.findFirst({ where: { id: goalId, userId: user.id, allianceId } });
                if (!goal) {
                    await sendContextMessage(context, '❌ План не найден.');
                    await renderGoalList(context, user.id, allianceId, 0);
                    return;
                }
                await startGoalEditFlow(context, user.id, allianceId, goal, menuPage);
                return;
            }
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
        await Send_Message(context.peerId, '❌ Не удалось обновить настройки целей. Проверьте логи.');
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
        if (flow.kind === 'lifeTierAdd' || flow.kind === 'lifeTierEdit') {
            await showLifeTierMenuAfterInput(context, flow);
        } else if (flow.kind === 'goalTierAdd' || flow.kind === 'goalTierEdit') {
            await renderGoalTierMenu(context, flow.userId, flow.allianceId, flow.goalId, 0);
        } else if (flow.kind === 'goalTemplateName' || flow.kind === 'goalTemplateCode') {
            await renderGoalConfig(context, flow.userId, flow.allianceId, flow.goalId);
        } else if (flow.kind === 'goalSettingNumber' || flow.kind === 'goalSettingText') {
            await renderGoalAdvancedSettings(context, flow.userId, flow.allianceId, flow.goalId);
        } else {
            await showSettingsAfterInput(context, flow);
        }
        return true;
    }
    if (!raw) {
        await sendInputPrompt(context, getFlowPrompt(flow), flow.menuPage);
        return true;
    }

    try {
        switch (flow.kind) {
            case 'settingText': {
                const value = raw.replace(/\s+/g, ' ').trim();
                if (!value || value.length > 40) {
                    await sendInputPrompt(context, '❌ Название должно содержать от 1 до 40 символов.\n\n' + flow.prompt, flow.menuPage);
                    return true;
                }
                await db.rpWorkSettings.update({ where: { id: flow.settingsId }, data: { [flow.field]: value } });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, '✅ Название выплаты сохранено.');
                await showSettingsAfterInput(context, flow);
                return true;
            }
            case 'settingNumber': {
                const value = parseInputNumber(raw);
                if (value === null || (flow.field === 'minimumPcPerYear' && !Number.isInteger(value))) {
                    const hint = flow.field === 'minimumPcPerYear'
                        ? 'Введите неотрицательное целое число.'
                        : 'Введите неотрицательное число; дробную часть указывайте через точку, например 1.5. Запятая тоже принимается.';
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
                    await sendInputPrompt(context, 'Введите дату окончания периода в формате ДД.ММ.ГГГГ:', flow.menuPage);
                    return true;
                }
                if (!flow.startDate || date.getTime() < flow.startDate.getTime()) {
                    await sendInputPrompt(context, '❌ Окончание не может быть раньше начала. Введите дату окончания периода в формате ДД.ММ.ГГГГ:', flow.menuPage);
                    return true;
                }
                await db.rpWorkSettings.update({
                    where: { id: flow.settingsId },
                    data: { workYearStart: flow.startDate, workYearEnd: date }
                });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, `✅ Период сохранён: ${formatDate(flow.startDate)}–${formatDate(date)}.`);
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
                if (flow.goalId) {
                    const existingGoal = await db.rpWritingGoal.findFirst({
                        where: { id: flow.goalId, userId: flow.userId, allianceId: flow.allianceId }
                    });
                    if (!existingGoal) {
                        pendingInputFlows.delete(key);
                        await sendContextMessage(context, '❌ План больше не существует.');
                        await showSettingsAfterInput(context, flow);
                        return true;
                    }
                    await db.rpWritingGoal.update({
                        where: { id: flow.goalId },
                        data: {
                            // Editing a goal's target or period must not reset its own
                            // payment configuration (rate, minimum, bonus or tier rates).
                            targetPc: flow.targetPc,
                            startDate: flow.startDate,
                            endDate: date,
                            completionNotified: false,
                            completionNotifiedSuccess: null
                        }
                    });
                    pendingInputFlows.delete(key);
                    await sendContextMessage(context, `✅ План «${existingGoal.name}» обновлён: ${fmt(flow.targetPc ?? 0)} ПК, ${formatDate(flow.startDate)}–${formatDate(date)}.`);
                } else {
                    const name = flow.hashtag ? `План #${flow.hashtag}` : 'Общий план';
                    const createdGoal = await db.rpWritingGoal.create({
                        data: {
                            userId: flow.userId,
                            allianceId: flow.allianceId,
                            name,
                            hashtag: flow.hashtag,
                            trackingMode: flow.hashtag ? 'hashtags' : 'all',
                            trackingHashtags: JSON.stringify(flow.hashtag ? [normalizeHashtag(flow.hashtag)] : []),
                            tierRates: serializeLifeTiers([]),
                            targetPc: flow.targetPc,
                            startDate: flow.startDate,
                            endDate: date,
                            completionNotified: false,
                            completionNotifiedSuccess: null
                        }
                    });
                    pendingInputFlows.delete(key);
                    await sendContextMessage(context, `✅ План создан: ${name}, ${fmt(flow.targetPc ?? 0)} ПК, ${formatDate(flow.startDate)}–${formatDate(date)}.`);
                    await renderGoalConfig(context, flow.userId, flow.allianceId, createdGoal.id);
                    return true;
                }
                await showSettingsAfterInput(context, flow);
                return true;
            }
            case 'lifeTierAdd': {
                const value = parseInputNumber(raw);
                if (value === null) {
                    await sendInputPrompt(context, '❌ Введите неотрицательное число.\n\n' + getFlowPrompt(flow), flow.menuPage);
                    return true;
                }

                if (flow.step === 'boundary') {
                    const previousMax = flow.tiers.length > 1 ? Number(flow.tiers[flow.tiers.length - 2].maxPc ?? 0) : 0;
                    if (value <= previousMax) {
                        await sendInputPrompt(context, `❌ Новая граница должна быть больше ${fmt(previousMax)} ПК.\n\n${getFlowPrompt(flow)}`, flow.menuPage);
                        return true;
                    }
                    const next: PendingInputFlow = { ...flow, step: 'amount', maxPc: value };
                    pendingInputFlows.set(key, next);
                    await sendInputPrompt(context, getFlowPrompt(next), flow.menuPage);
                    return true;
                }

                const tiers = [...flow.tiers];
                if (tiers.length === 0) {
                    tiers.push({ maxPc: null, amount: value });
                } else {
                    const last = tiers[tiers.length - 1];
                    if (last.maxPc !== null || flow.maxPc == null) {
                        throw new Error('Некорректное состояние добавления тарифной ступени');
                    }
                    tiers[tiers.length - 1] = { maxPc: flow.maxPc, amount: last.amount };
                    tiers.push({ maxPc: null, amount: value });
                }
                await db.rpWorkSettings.update({ where: { id: flow.settingsId }, data: { lifeTierRates: serializeLifeTiers(tiers) } });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, `✅ Тарифная ступень добавлена. Всего ступеней: ${tiers.length}.`);
                await showLifeTierMenuAfterInput(context, flow);
                return true;
            }
            case 'lifeTierEdit': {
                const value = parseInputNumber(raw);
                if (value === null) {
                    await sendInputPrompt(context, '❌ Введите неотрицательное число.\n\n' + getFlowPrompt(flow), flow.menuPage);
                    return true;
                }
                const tiers = [...flow.tiers];
                const tier = tiers[flow.index];
                if (!tier) throw new Error('Тарифная ступень больше не существует');

                if (flow.step === 'max') {
                    const previousMax = flow.index > 0 ? Number(tiers[flow.index - 1].maxPc ?? 0) : 0;
                    const nextMax = tiers[flow.index + 1]?.maxPc ?? null;
                    if (value <= previousMax || (nextMax !== null && value >= nextMax)) {
                        const limitHint = nextMax === null
                            ? `Граница должна быть больше ${fmt(previousMax)} ПК.`
                            : `Граница должна быть больше ${fmt(previousMax)} и меньше ${fmt(nextMax)} ПК.`;
                        await sendInputPrompt(context, `❌ ${limitHint}\n\n${getFlowPrompt(flow)}`, flow.menuPage);
                        return true;
                    }
                    tier.maxPc = value;
                } else {
                    tier.amount = value;
                }

                await db.rpWorkSettings.update({ where: { id: flow.settingsId }, data: { lifeTierRates: serializeLifeTiers(tiers) } });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, '✅ Тарифная ступень обновлена.');
                await showLifeTierMenuAfterInput(context, flow);
                return true;
            }
            case 'goalTierAdd': {
                const value = parseInputNumber(raw);
                if (value === null) {
                    await sendInputPrompt(context, '❌ Введите неотрицательное число.\n\n' + getFlowPrompt(flow), flow.menuPage);
                    return true;
                }
                if (flow.step === 'boundary') {
                    const previousMax = flow.tiers.length > 1 ? Number(flow.tiers[flow.tiers.length - 2].maxPc ?? 0) : 0;
                    if (value <= previousMax) {
                        await sendInputPrompt(context, `❌ Новая граница должна быть больше ${fmt(previousMax)} ПК.\n\n${getFlowPrompt(flow)}`, flow.menuPage);
                        return true;
                    }
                    const next: PendingInputFlow = { ...flow, step: 'amount', maxPc: value };
                    pendingInputFlows.set(key, next);
                    await sendInputPrompt(context, getFlowPrompt(next), flow.menuPage);
                    return true;
                }
                const tiers = [...flow.tiers];
                if (tiers.length === 0) tiers.push({ maxPc: null, amount: value });
                else {
                    const last = tiers[tiers.length - 1];
                    if (last.maxPc !== null || flow.maxPc == null) throw new Error('Некорректное состояние добавления ступени');
                    tiers[tiers.length - 1] = { maxPc: flow.maxPc, amount: last.amount };
                    tiers.push({ maxPc: null, amount: value });
                }
                await db.rpWritingGoal.updateMany({ where: { id: flow.goalId, userId: flow.userId, allianceId: flow.allianceId }, data: { tierRates: serializeLifeTiers(tiers) } });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, `✅ Тариф для цели обновлён. Ступеней: ${tiers.length}.`);
                await renderGoalTierMenu(context, flow.userId, flow.allianceId, flow.goalId, 0);
                return true;
            }
            case 'goalTierEdit': {
                const value = parseInputNumber(raw);
                if (value === null) {
                    await sendInputPrompt(context, '❌ Введите неотрицательное число.\n\n' + getFlowPrompt(flow), flow.menuPage);
                    return true;
                }
                const tiers = [...flow.tiers];
                const tier = tiers[flow.index];
                if (!tier) throw new Error('Тарифная ступень больше не существует');
                if (flow.step === 'max') {
                    const previousMax = flow.index > 0 ? Number(tiers[flow.index - 1].maxPc ?? 0) : 0;
                    const nextMax = tiers[flow.index + 1]?.maxPc ?? null;
                    if (value <= previousMax || (nextMax !== null && value >= nextMax)) {
                        const hint = nextMax === null ? `Граница должна быть больше ${fmt(previousMax)} ПК.` : `Граница должна быть между ${fmt(previousMax)} и ${fmt(nextMax)} ПК.`;
                        await sendInputPrompt(context, `❌ ${hint}\n\n${getFlowPrompt(flow)}`, flow.menuPage);
                        return true;
                    }
                    tier.maxPc = value;
                } else tier.amount = value;
                await db.rpWritingGoal.updateMany({ where: { id: flow.goalId, userId: flow.userId, allianceId: flow.allianceId }, data: { tierRates: serializeLifeTiers(tiers) } });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, '✅ Тарифная ступень цели обновлена.');
                await renderGoalTierMenu(context, flow.userId, flow.allianceId, flow.goalId, 0);
                return true;
            }
            case 'goalSettingNumber': {
                const value = parseInputNumber(raw);
                const isIntegerField = flow.field === 'minimumPc';
                if (value === null || (isIntegerField && !Number.isInteger(value))) {
                    const hint = isIntegerField
                        ? 'Введите неотрицательное целое число.'
                        : 'Введите неотрицательное число; точка и запятая поддерживаются.';
                    await sendInputPrompt(context, `❌ ${hint}\n\n${flow.prompt}`, 2);
                    return true;
                }
                const goal = await getOwnedGoal(flow.userId, flow.allianceId, flow.goalId);
                if (!goal) throw new Error('Цель не найдена');
                await db.rpWritingGoal.updateMany({
                    where: { id: flow.goalId, userId: flow.userId, allianceId: flow.allianceId },
                    data: { [flow.field]: value }
                });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, '✅ Настройка этой цели сохранена.');
                await renderGoalAdvancedSettings(context, flow.userId, flow.allianceId, flow.goalId);
                return true;
            }
            case 'goalSettingText': {
                const value = raw.replace(/\s+/g, ' ').trim();
                if (!value || value.length > 40) {
                    await sendInputPrompt(context, `❌ Название должно содержать от 1 до 40 символов.\n\n${flow.prompt}`, 2);
                    return true;
                }
                const goal = await getOwnedGoal(flow.userId, flow.allianceId, flow.goalId);
                if (!goal) throw new Error('Цель не найдена');
                await db.rpWritingGoal.updateMany({
                    where: { id: flow.goalId, userId: flow.userId, allianceId: flow.allianceId },
                    data: { [flow.field]: value }
                });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, '✅ Название дополнительной выплаты сохранено.');
                await renderGoalAdvancedSettings(context, flow.userId, flow.allianceId, flow.goalId);
                return true;
            }
            case 'goalTemplateName': {
                const name = raw.replace(/\s+/g, ' ').trim();
                if (!name || name.length > 40) {
                    await sendInputPrompt(context, 'Название должно содержать от 1 до 40 символов. Введите название шаблона:', flow.menuPage);
                    return true;
                }
                const goal = await getOwnedGoal(flow.userId, flow.allianceId, flow.goalId);
                if (!goal) throw new Error('Цель для сохранения шаблона не найдена');
                const code = await createGoalTemplate(flow.userId, flow.allianceId, name, goal);
                pendingInputFlows.delete(key);
                await sendContextMessage(context, `✅ Шаблон «${name}» сохранён для этой ролевой.\nКод применения: ${code}\n\nЭтот код не действует в других ролевых.`);
                await renderGoalConfig(context, flow.userId, flow.allianceId, flow.goalId);
                return true;
            }
            case 'goalTemplateCode': {
                const code = normalizeTemplateCode(raw);
                const template = await db.rpWorkTemplate.findFirst({ where: { allianceId: flow.allianceId, code } });
                if (!template) {
                    await sendInputPrompt(context, '❌ Шаблон с таким кодом не найден в этой ролевой. Проверьте код и повторите ввод:', flow.menuPage);
                    return true;
                }
                const config = parseTemplateConfig(template);
                await db.rpWritingGoal.updateMany({
                    where: { id: flow.goalId, userId: flow.userId, allianceId: flow.allianceId },
                    data: {
                        trackingMode: config.trackingMode,
                        trackingHashtags: JSON.stringify(config.trackingHashtags),
                        hashtag: config.trackingHashtags[0] ?? null,
                        tierRates: serializeLifeTiers(config.tierRates),
                        ratePerPc: config.ratePerPc,
                        minimumPc: config.minimumPc,
                        extraPaymentEnabled: config.extraPaymentEnabled,
                        extraPaymentLabel: config.extraPaymentLabel,
                        extraPaymentAmount: config.extraPaymentAmount,
                        completionNotified: false,
                        completionNotifiedSuccess: null
                    }
                });
                pendingInputFlows.delete(key);
                await sendContextMessage(context, `✅ Настройки цели обновлены по шаблону «${template.name}».`);
                await renderGoalConfig(context, flow.userId, flow.allianceId, flow.goalId);
                return true;
            }
        }
    } catch (error: any) {
        pendingInputFlows.delete(key);
        await Logger(`RP work input error for user ${flow.userId}: ${error?.message ?? error}`);
        await sendContextMessage(context, '❌ Не удалось сохранить значение. Проверьте логи.');
        try {
            if (flow.kind === 'lifeTierAdd' || flow.kind === 'lifeTierEdit') await showLifeTierMenuAfterInput(context, flow);
            else if (flow.kind === 'goalTierAdd' || flow.kind === 'goalTierEdit') await renderGoalTierMenu(context, flow.userId, flow.allianceId, flow.goalId, 0);
            else if (flow.kind === 'goalTemplateName' || flow.kind === 'goalTemplateCode') await renderGoalConfig(context, flow.userId, flow.allianceId, flow.goalId);
            else if (flow.kind === 'goalSettingNumber' || flow.kind === 'goalSettingText') await renderGoalAdvancedSettings(context, flow.userId, flow.allianceId, flow.goalId);
            else await showSettingsAfterInput(context, flow);
        } catch { /* avoid a secondary error */ }
        return true;
    }
}

async function getOrCreateSettings(userId: number, allianceId: number): Promise<RpWorkSettings> {
    const settings = await db.rpWorkSettings.upsert({
        where: { userId_allianceId: { userId, allianceId } },
        create: {
            userId,
            allianceId,
            ratePerPc: 0,
            highSeniority: false,
            seniorityBonus: 0,
            bonusLabel: 'Дополнительная выплата',
            minimumPcPerYear: 10,
            workScope: 'all',
            workHashtag: null,
            workYearStart: null,
            workYearEnd: null,
            lifeHashtag: '',
            lifeTierRates: serializeLifeTiers([])
        },
        update: {}
    });

    // One-time compatibility migration: the old version stored one pay configuration
    // per character. Copy it into each already existing goal, then never copy it again.
    if (!(settings as any).goalSettingsMigrated) {
        const legacyGoals = await db.rpWritingGoal.findMany({ where: { userId, allianceId }, select: { id: true } });
        if (legacyGoals.length > 0) {
            await db.rpWritingGoal.updateMany({
                // Only seed goals that still have untouched per-goal defaults.
                // Never overwrite a goal that has already received custom settings.
                where: {
                    userId,
                    allianceId,
                    ratePerPc: 0,
                    minimumPc: 10,
                    extraPaymentEnabled: false,
                    extraPaymentAmount: 0,
                    extraPaymentLabel: 'Дополнительная выплата'
                },
                data: {
                    ratePerPc: Math.max(0, Number(settings.ratePerPc ?? 0)),
                    minimumPc: Math.max(0, Math.trunc(Number(settings.minimumPcPerYear ?? 10))),
                    extraPaymentEnabled: Boolean(settings.highSeniority),
                    extraPaymentLabel: String(settings.bonusLabel || 'Дополнительная выплата').slice(0, 40),
                    extraPaymentAmount: Math.max(0, Number(settings.seniorityBonus ?? 0))
                }
            });
        }
        await db.rpWorkSettings.update({ where: { id: settings.id }, data: { goalSettingsMigrated: true } });
        (settings as any).goalSettingsMigrated = true;
    }

    // Migrate legacy array storage exactly once. This also clears the old
    // preconfigured #жизнь sample, but never clears a hashtag selected later
    // by the user: modern storage carries a version marker in the same String field.
    if (!isModernLifeTierStorage(settings.lifeTierRates)) {
        const currentTag = normalizeHashtag(String(settings.lifeHashtag ?? ''));
        const currentTiers = parseLifeTiers(settings.lifeTierRates);
        const isOldDefault = currentTag === 'жизнь' && (currentTiers.length === 0 || isLegacyLifeSample(currentTiers));
        return db.rpWorkSettings.update({
            where: { id: settings.id },
            data: {
                lifeHashtag: isOldDefault ? '' : settings.lifeHashtag,
                lifeTierRates: serializeLifeTiers(isOldDefault ? [] : currentTiers)
            }
        });
    }
    return settings;
}

async function renderSettingsMenu(
    context: any,
    userId: number,
    allianceId: number,
    _settings: RpWorkSettings,
    _requestedPage: number = 0
): Promise<void> {
    const goalsCount = await db.rpWritingGoal.count({ where: { userId, allianceId } });
    const text = `🎯 Цели персонажа\n\n` +
        `У каждой цели собственные даты, норма ПК, учёт постов, ставка и дополнительные выплаты.\n\n` +
        `Сохранённых целей: ${goalsCount}\n\n` +
        `Расчёты справочные. Бот ничего не начисляет и не переводит автоматически.`;

    const keyboard = new KeyboardBuilder()
        .callbackButton({ label: '➕ Создать цель', payload: { command: 'rp_work_settings', action: 'goal_create_overall', menuPage: 2 }, color: 'positive' }).row()
        .callbackButton({ label: `📋 Мои цели (${goalsCount})`, payload: { command: 'rp_work_settings', action: 'goal_list', goalPage: 0, menuPage: 2 }, color: 'secondary' }).row()
        .callbackButton({ label: '↩ Карточка персонажа', payload: { command: 'card_enter' }, color: 'secondary' })
        .inline().oneTime();

    await Send_Message(context.peerId, text, keyboard);
}

async function renderLifeTierMenu(
    context: any,
    userId: number,
    allianceId: number,
    settings: RpWorkSettings,
    requestedPage: number = 0
): Promise<void> {
    const tiers = parseLifeTiers(settings.lifeTierRates);
    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(tiers.length / pageSize));
    const page = Math.min(Math.max(0, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 0), totalPages - 1);
    const visible = tiers.slice(page * pageSize, (page + 1) * pageSize);

    let text = `🏷 Дополнительный тариф${settings.lifeHashtag ? ` для #${settings.lifeHashtag}` : ''}\n\n`;
    if (tiers.length === 0) {
        text += 'Тарифные ступени не настроены.\nДобавьте первую ступень — она будет действовать для постов любого размера, пока не появятся следующие ступени.';
    } else {
        text += `Всего ступеней: ${tiers.length}\n`;
        text += visible.map((tier, offset) => {
            const index = page * pageSize + offset;
            const range = tier.maxPc === null
                ? (index === 0 ? 'посты любого размера' : `свыше ${fmt(tiers[index - 1].maxPc ?? 0)} ПК`)
                : `${index === 0 ? 'до' : `свыше ${fmt(tiers[index - 1].maxPc ?? 0)} — до`} ${fmt(tier.maxPc)} ПК`;
            return `${index + 1}. ${range} — ${fmt(tier.amount)}`;
        }).join('\n');
        text += `\n\nСтраница ${page + 1}/${totalPages}. Показано ${visible.length} из ${tiers.length}. Последняя ступень всегда действует без верхней границы.`;
    }

    const keyboard = new KeyboardBuilder();
    for (let i = 0; i < visible.length; i++) {
        const tierIndex = page * pageSize + i;
        const tier = visible[i];
        const label = tier.maxPc === null
            ? `${tierIndex + 1}. Свыше ${tierIndex > 0 ? fmt(tiers[tierIndex - 1].maxPc ?? 0) : '0'} ПК`
            : `${tierIndex + 1}. До ${fmt(tier.maxPc)} ПК`;
        keyboard.callbackButton({
            label: label.slice(0, 40),
            payload: { command: 'rp_work_settings', action: 'life_tier_edit', tierIndex, menuPage: 1 },
            color: 'secondary'
        }).row();
    }
    if (page > 0) {
        keyboard.callbackButton({
            label: '← Пред. стр.',
            payload: { command: 'rp_work_settings', action: 'life_tier_menu', tierPage: page - 1, menuPage: 1 },
            color: 'secondary'
        });
    }
    if (page + 1 < totalPages) {
        keyboard.callbackButton({
            label: 'След. стр. →',
            payload: { command: 'rp_work_settings', action: 'life_tier_menu', tierPage: page + 1, menuPage: 1 },
            color: 'secondary'
        });
    }
    if (page > 0 || page + 1 < totalPages) keyboard.row();
    keyboard.callbackButton({
        label: '➕ Добавить ступень',
        payload: { command: 'rp_work_settings', action: 'life_tier_add', menuPage: 1 },
        color: 'positive'
    }).row();
    keyboard.callbackButton({
        label: '🗑 Отключить тариф',
        payload: { command: 'rp_work_settings', action: 'life_tier_disable', menuPage: 1 },
        color: 'negative'
    });
    keyboard.callbackButton({
        label: '↩ Учёт постов',
        payload: { command: 'rp_work_settings', menuPage: 1 },
        color: 'secondary'
    }).row().inline().oneTime();

    await Send_Message(context.peerId, text, keyboard);
}

async function renderLifeTierEditMenu(
    context: any,
    userId: number,
    allianceId: number,
    settings: RpWorkSettings,
    tierIndex: number
): Promise<void> {
    const tiers = parseLifeTiers(settings.lifeTierRates);
    const tier = tiers[tierIndex];
    if (!tier) {
        await sendContextMessage(context, '❌ Тарифная ступень не найдена.');
        await renderLifeTierMenu(context, userId, allianceId, settings, 0);
        return;
    }

    const lower = tierIndex === 0 ? 'от 0 ПК' : `свыше ${fmt(tiers[tierIndex - 1].maxPc ?? 0)} ПК`;
    const upper = tier.maxPc === null ? 'без верхней границы' : `до ${fmt(tier.maxPc)} ПК`;
    const text = `✏ Редактирование ступени ${tierIndex + 1}/${tiers.length}\n\n` +
        `Диапазон: ${lower}, ${upper}\n` +
        `Выплата за пост: ${fmt(tier.amount)}` +
        (tier.maxPc === null ? '\n\nЭто последняя ступень. Чтобы добавить следующий диапазон, вернитесь и нажмите «Добавить ступень».' : '');

    const keyboard = new KeyboardBuilder()
        .callbackButton({
            label: '💰 Изменить выплату',
            payload: { command: 'rp_work_settings', action: 'life_tier_edit_amount', tierIndex, menuPage: 1 },
            color: 'secondary'
        }).row();
    if (tier.maxPc !== null) {
        keyboard.callbackButton({
            label: '📏 Изменить границу ПК',
            payload: { command: 'rp_work_settings', action: 'life_tier_edit_max', tierIndex, menuPage: 1 },
            color: 'secondary'
        }).row();
    }
    keyboard.callbackButton({
        label: '🗑 Удалить ступень',
        payload: { command: 'rp_work_settings', action: 'life_tier_delete', tierIndex, menuPage: 1 },
        color: 'negative'
    }).row();
    keyboard.callbackButton({
        label: '↩ К тарифным ступеням',
        payload: { command: 'rp_work_settings', action: 'life_tier_menu', tierPage: Math.floor(tierIndex / 3), menuPage: 1 },
        color: 'secondary'
    }).inline().oneTime();
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
        case 'life_configure_tag': return 'life_configure_tag_menu';
        case 'goal_create_tag': return 'goal_tag_menu';
        default: return 'menu';
    }
}

async function getAllianceHashtags(allianceId: number): Promise<string[]> {
    const rows: Array<{ hashtag: string }> = await prisma.monitorHashtag.findMany({
        where: { monitor: { id_alliance: allianceId } },
        select: { hashtag: true }
    });
    return Array.from(new Set<string>(rows.map((row: { hashtag: string }) => normalizeHashtag(row.hashtag))))
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b, 'ru'));
}

async function startGoalSettingNumberFlow(
    context: any,
    userId: number,
    allianceId: number,
    goalId: number,
    field: 'ratePerPc' | 'minimumPc' | 'extraPaymentAmount',
    prompt: string
): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) {
        await sendContextMessage(context, '❌ Цель не найдена.');
        return;
    }
    const flow: PendingInputFlow = { kind: 'goalSettingNumber', userId, allianceId, goalId, menuPage: 2, field, prompt };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, prompt, 2);
}

async function startGoalSettingTextFlow(
    context: any,
    userId: number,
    allianceId: number,
    goalId: number,
    field: 'extraPaymentLabel',
    prompt: string
): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) {
        await sendContextMessage(context, '❌ Цель не найдена.');
        return;
    }
    const flow: PendingInputFlow = { kind: 'goalSettingText', userId, allianceId, goalId, menuPage: 2, field, prompt };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, prompt, 2);
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

async function startSettingTextFlow(
    context: any, userId: number, allianceId: number, settingsId: number, menuPage: number,
    field: 'bonusLabel', prompt: string
): Promise<void> {
    const flow: PendingInputFlow = { kind: 'settingText', userId, allianceId, settingsId, menuPage, field, prompt };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, prompt, menuPage);
}

async function startWorkYearFlow(context: any, userId: number, allianceId: number, settingsId: number, menuPage: number): Promise<void> {
    const flow: PendingInputFlow = { kind: 'workYear', userId, allianceId, settingsId, menuPage, step: 'start' };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, 'Введите дату начала периода в формате ДД.ММ.ГГГГ:', menuPage);
}

async function startGoalFlow(context: any, userId: number, allianceId: number, hashtag: string | null, menuPage: number): Promise<void> {
    const flow: PendingInputFlow = { kind: 'goal', userId, allianceId, menuPage, hashtag, step: 'target' };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, `Введите цель в ПК-строках${hashtag ? ` для #${hashtag}` : ''}:`, menuPage);
}

async function startGoalEditFlow(context: any, userId: number, allianceId: number, goal: any, menuPage: number): Promise<void> {
    const flow: PendingInputFlow = {
        kind: 'goal', userId, allianceId, menuPage, hashtag: goal.hashtag ?? null,
        goalId: goal.id, targetPc: Number(goal.targetPc), step: 'target'
    };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, `Изменение плана «${goal.name}». Введите новую цель в ПК-строках (текущая: ${fmt(goal.targetPc)}):`, menuPage);
}

async function startLifeTierAddFlow(context: any, userId: number, allianceId: number, settings: RpWorkSettings, menuPage: number): Promise<void> {
    const tiers = parseLifeTiers(settings.lifeTierRates);
    const flow: PendingInputFlow = {
        kind: 'lifeTierAdd', userId, allianceId, settingsId: settings.id, menuPage,
        step: tiers.length === 0 ? 'amount' : 'boundary', tiers
    };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, getFlowPrompt(flow), menuPage);
}

async function startLifeTierEditFlow(
    context: any,
    userId: number,
    allianceId: number,
    settings: RpWorkSettings,
    menuPage: number,
    tierIndex: number,
    step: 'max' | 'amount'
): Promise<void> {
    const tiers = parseLifeTiers(settings.lifeTierRates);
    if (!Number.isInteger(tierIndex) || tierIndex < 0 || tierIndex >= tiers.length) {
        await sendContextMessage(context, '❌ Тарифная ступень не найдена.');
        await renderLifeTierMenu(context, userId, allianceId, settings, 0);
        return;
    }
    if (step === 'max' && tiers[tierIndex].maxPc === null) {
        await sendContextMessage(context, 'Последняя ступень не имеет верхней границы. Для создания нового диапазона используйте «Добавить ступень».');
        await renderLifeTierEditMenu(context, userId, allianceId, settings, tierIndex);
        return;
    }
    const flow: PendingInputFlow = {
        kind: 'lifeTierEdit', userId, allianceId, settingsId: settings.id, menuPage,
        step, index: tierIndex, tiers
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
        case 'settingText':
            return flow.prompt;
        case 'workYear':
            return flow.step === 'start'
                ? 'Введите дату начала периода в формате ДД.ММ.ГГГГ:'
                : 'Введите дату окончания периода в формате ДД.ММ.ГГГГ:';
        case 'goal':
            if (flow.step === 'target') return `Введите цель в ПК-строках${flow.hashtag ? ` для #${flow.hashtag}` : ''}:`;
            return flow.step === 'start'
                ? 'Введите дату начала плана в формате ДД.ММ.ГГГГ:'
                : 'Введите дату окончания плана в формате ДД.ММ.ГГГГ:';
        case 'lifeTierAdd':
            if (flow.step === 'boundary') {
                const previousMax = flow.tiers.length > 1 ? Number(flow.tiers[flow.tiers.length - 2].maxPc ?? 0) : 0;
                return `Введите новую верхнюю границу ПК для текущей последней ступени (она сохранит свою выплату). Значение должно быть больше ${fmt(previousMax)} ПК:`;
            }
            return flow.tiers.length === 0
                ? 'Введите выплату за посты любого размера. Это будет первая ступень без верхней границы:'
                : `Введите выплату за пост свыше ${fmt(flow.maxPc ?? 0)} ПК:`;
        case 'lifeTierEdit': {
            const tier = flow.tiers[flow.index];
            if (flow.step === 'max') {
                return `Введите новую верхнюю границу для ступени ${flow.index + 1} (текущая: ${fmt(tier.maxPc ?? 0)} ПК):`;
            }
            return `Введите новую выплату для ступени ${flow.index + 1} (текущая: ${fmt(tier.amount)}):`;
        }
        case 'goalTierAdd':
            if (flow.step === 'boundary') {
                const previousMax = flow.tiers.length > 1 ? Number(flow.tiers[flow.tiers.length - 2].maxPc ?? 0) : 0;
                return `Введите верхнюю границу ПК для последней ступени. Она должна быть больше ${fmt(previousMax)} ПК:`;
            }
            return flow.tiers.length === 0 ? 'Введите выплату для постов любого размера:' : `Введите выплату за посты свыше ${fmt(flow.maxPc ?? 0)} ПК:`;
        case 'goalTierEdit': {
            const tier = flow.tiers[flow.index];
            return flow.step === 'max'
                ? `Введите новую верхнюю границу ступени ${flow.index + 1} (сейчас ${fmt(tier.maxPc ?? 0)} ПК):`
                : `Введите новую выплату для ступени ${flow.index + 1} (сейчас ${fmt(tier.amount)}):`;
        }
        case 'goalSettingNumber': return flow.prompt;
        case 'goalSettingText': return flow.prompt;
        case 'goalTemplateName': return 'Введите название шаблона настроек цели (до 40 символов):';
        case 'goalTemplateCode': return 'Введите код шаблона, созданного в этой ролевой:';
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

async function showLifeTierMenuAfterInput(context: any, flow: PendingInputFlow): Promise<void> {
    const settings = await getOrCreateSettings(flow.userId, flow.allianceId);
    await renderLifeTierMenu(context, flow.userId, flow.allianceId, settings, 0);
}

async function getOwnedGoal(userId: number, allianceId: number, goalId: number): Promise<any | null> {
    if (!Number.isInteger(goalId) || goalId <= 0) return null;
    return db.rpWritingGoal.findFirst({ where: { id: goalId, userId, allianceId } });
}

function parseGoalHashtags(raw: unknown): string[] {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
        const value = JSON.parse(raw);
        if (!Array.isArray(value)) return [];
        return Array.from(new Set(value.map((tag: any) => normalizeHashtag(String(tag))).filter(Boolean)));
    } catch {
        return [];
    }
}

function getGoalTrackingHashtags(goal: any): string[] {
    const configured = parseGoalHashtags(goal.trackingHashtags);
    if (configured.length > 0) return configured;
    // Backward compatibility: old goals used a single `hashtag` field.
    return goal.hashtag ? [normalizeHashtag(String(goal.hashtag))] : [];
}

function isGoalHashtagMode(goal: any): boolean {
    return String(goal.trackingMode ?? 'all') === 'hashtags' || Boolean(goal.hashtag && parseGoalHashtags(goal.trackingHashtags).length === 0);
}

function describeGoalTracking(goal: any): string {
    if (!isGoalHashtagMode(goal)) return 'все отслеживаемые посты';
    const tags = getGoalTrackingHashtags(goal);
    return tags.length > 0 ? tags.map(tag => `#${tag}`).join(', ') : 'выбранные хештеги (пока ничего не выбрано)';
}

async function updateGoalTracking(userId: number, allianceId: number, goalId: number, mode: 'all' | 'hashtags', hashtags: string[]): Promise<void> {
    const cleanTags = Array.from(new Set(hashtags.map(normalizeHashtag).filter(Boolean)));
    await db.rpWritingGoal.updateMany({
        where: { id: goalId, userId, allianceId },
        data: {
            trackingMode: mode,
            trackingHashtags: JSON.stringify(cleanTags),
            hashtag: mode === 'hashtags' ? (cleanTags[0] ?? null) : null,
            completionNotified: false,
                            completionNotifiedSuccess: null
        }
    });
}

async function toggleGoalHashtag(userId: number, allianceId: number, goalId: number, hashtag: string): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal || !hashtag) return;
    const tags = getGoalTrackingHashtags(goal);
    const next = tags.includes(hashtag) ? tags.filter(tag => tag !== hashtag) : [...tags, hashtag];
    await updateGoalTracking(userId, allianceId, goalId, 'hashtags', next);
}

async function renderGoalConfig(context: any, userId: number, allianceId: number, goalId: number): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) {
        await sendContextMessage(context, '❌ Цель не найдена.');
        await renderGoalList(context, userId, allianceId, 0);
        return;
    }
    const tags = getGoalTrackingHashtags(goal);
    const templatesCount = await db.rpWorkTemplate.count({ where: { allianceId } });
    const trackingText = describeGoalTracking(goal);
    const text = `⚙ Настройки цели «${goal.name}»\n\n` +
        `Учёт постов: ${trackingText}\n` +
        `Шаблонов в этой ролевой: ${templatesCount}\n\n` +
        `Норма, ставка, доплата и тариф настраиваются в углублённых настройках этой цели.`;
    const keyboard = new KeyboardBuilder()
        .callbackButton({ label: '📝 Все посты', payload: { command: 'rp_work_settings', action: 'goal_tracking_all', goalId, menuPage: 2 }, color: !isGoalHashtagMode(goal) ? 'positive' : 'secondary' })
        .callbackButton({ label: `🏷 Хештеги (${tags.length})`, payload: { command: 'rp_work_settings', action: 'goal_tracking_tags_menu', goalId, hashtagPage: 0, menuPage: 2 }, color: isGoalHashtagMode(goal) ? 'positive' : 'secondary' }).row()
        .callbackButton({ label: '💾 Сохранить шаблон', payload: { command: 'rp_work_settings', action: 'goal_template_save', goalId, menuPage: 2 }, color: 'secondary' })
        .callbackButton({ label: '🔑 Применить код', payload: { command: 'rp_work_settings', action: 'goal_template_apply', goalId, menuPage: 2 }, color: 'secondary' }).row()
        .callbackButton({ label: '🔧 Углублённые настройки', payload: { command: 'rp_work_settings', action: 'goal_advanced', goalId, menuPage: 2 }, color: 'primary' }).row()
        .callbackButton({ label: '↩ К цели', payload: { command: 'rp_work_settings', action: 'goal_view', goalId, weekPage: 0, menuPage: 2 }, color: 'secondary' })
        .callbackButton({ label: '↩ К списку целей', payload: { command: 'rp_work_settings', action: 'goal_list', goalPage: 0, menuPage: 2 }, color: 'secondary' }).row()
        .inline().oneTime();
    await Send_Message(context.peerId, text, keyboard);
}

async function renderGoalAdvancedSettings(context: any, userId: number, allianceId: number, goalId: number): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) {
        await sendContextMessage(context, '❌ Цель не найдена.');
        await renderGoalList(context, userId, allianceId, 0);
        return;
    }

    const minimumPc = Number(goal.minimumPc ?? 10);
    const ratePerPc = Number(goal.ratePerPc ?? 0);
    const extraEnabled = Boolean(goal.extraPaymentEnabled);
    const extraLabel = String(goal.extraPaymentLabel || 'Дополнительная выплата');
    const extraAmount = Number(goal.extraPaymentAmount ?? 0);
    const tiersCount = parseLifeTiers(goal.tierRates).length;
    const period = `${formatDate(startOfUtcDay(new Date(goal.startDate)))}–${formatDate(startOfUtcDay(new Date(goal.endDate)))}`;
    const text = `🔧 Углублённые настройки «${goal.name}»\n\n` +
        `Период цели: ${period}\n` +
        `Минимум для допуска к выплате: ${minimumPc} ПК\n` +
        `Ставка: ${fmt(ratePerPc)} за ПК-строку\n` +
        `${extraLabel}: ${extraEnabled ? fmt(extraAmount) : 'выключена'}\n` +
        `Дополнительные тарифные ступени: ${tiersCount}\n\n` +
        `Эти значения относятся только к выбранной цели.`;

    const keyboard = new KeyboardBuilder()
        .callbackButton({ label: '💰 Ставка за ПК-строку', payload: { command: 'rp_work_settings', action: 'goal_edit_rate', goalId, menuPage: 2 }, color: 'secondary' }).row()
        .callbackButton({ label: '📏 Минимум ПК за период', payload: { command: 'rp_work_settings', action: 'goal_edit_minimum', goalId, menuPage: 2 }, color: 'secondary' }).row()
        .callbackButton({ label: extraEnabled ? '✨ Доплата: включена' : '✨ Доплата: выключена', payload: { command: 'rp_work_settings', action: 'goal_toggle_extra_payment', goalId, menuPage: 2 }, color: extraEnabled ? 'positive' : 'secondary' })
        .callbackButton({ label: '✏ Название', payload: { command: 'rp_work_settings', action: 'goal_edit_extra_label', goalId, menuPage: 2 }, color: 'secondary' })
        .callbackButton({ label: '💵 Сумма', payload: { command: 'rp_work_settings', action: 'goal_edit_extra_amount', goalId, menuPage: 2 }, color: 'secondary' }).row()
        .callbackButton({ label: `⚖ Тарифные ступени (${tiersCount})`, payload: { command: 'rp_work_settings', action: 'goal_tier_menu', goalId, tierPage: 0, menuPage: 2 }, color: 'secondary' }).row()
        .callbackButton({ label: '📊 Прогноз по этой цели', payload: { command: 'rp_work_settings', action: 'goal_forecast', goalId, menuPage: 2 }, color: 'positive' }).row()
        .callbackButton({ label: '↩ К настройкам цели', payload: { command: 'rp_work_settings', action: 'goal_config', goalId, menuPage: 2 }, color: 'secondary' })
        .inline().oneTime();
    await Send_Message(context.peerId, text, keyboard);
}

async function renderGoalHashtagPicker(context: any, userId: number, allianceId: number, goalId: number, requestedPage: number): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
    const hashtags = await getAllianceHashtags(allianceId);
    if (hashtags.length === 0) {
        await sendContextMessage(context, 'В этой ролевой нет доступных хештегов мониторов.');
        await renderGoalConfig(context, userId, allianceId, goalId);
        return;
    }
    const pageSize = 4;
    const totalPages = Math.max(1, Math.ceil(hashtags.length / pageSize));
    const page = Math.min(Math.max(0, Math.trunc(requestedPage || 0)), totalPages - 1);
    const visible = hashtags.slice(page * pageSize, (page + 1) * pageSize);
    const selected = new Set(getGoalTrackingHashtags(goal));
    const keyboard = new KeyboardBuilder();
    for (let i = 0; i < visible.length; i++) {
        const tag = visible[i];
        keyboard.callbackButton({
            label: `${selected.has(tag) ? '✅' : '▫️'} #${tag}`.slice(0, 40),
            payload: { command: 'rp_work_settings', action: 'goal_tracking_toggle_tag', goalId, hashtag: tag, hashtagPage: page, menuPage: 2 },
            color: selected.has(tag) ? 'positive' : 'secondary'
        });
        if (i % 2 === 1 || i === visible.length - 1) keyboard.row();
    }
    if (page > 0) keyboard.callbackButton({ label: '← Пред. стр.', payload: { command: 'rp_work_settings', action: 'goal_tracking_tags_menu', goalId, hashtagPage: page - 1, menuPage: 2 }, color: 'secondary' });
    if (page + 1 < totalPages) keyboard.callbackButton({ label: 'След. стр. →', payload: { command: 'rp_work_settings', action: 'goal_tracking_tags_menu', goalId, hashtagPage: page + 1, menuPage: 2 }, color: 'secondary' });
    if (page > 0 || page + 1 < totalPages) keyboard.row();
    keyboard.callbackButton({ label: '✅ Готово', payload: { command: 'rp_work_settings', action: 'goal_tracking_tags_done', goalId, menuPage: 2 }, color: 'positive' });
    keyboard.callbackButton({ label: '📝 Все посты', payload: { command: 'rp_work_settings', action: 'goal_tracking_all', goalId, menuPage: 2 }, color: 'secondary' }).row();
    keyboard.callbackButton({ label: '↩ К настройкам цели', payload: { command: 'rp_work_settings', action: 'goal_config', goalId, menuPage: 2 }, color: 'secondary' }).row().inline().oneTime();
    await Send_Message(context.peerId, `Выберите один или несколько хештегов для цели «${goal.name}». Повторное нажатие снимает выбор.\n\nВыбрано: ${[...selected].map(tag => `#${tag}`).join(', ') || 'ничего'}\nСтраница ${page + 1}/${totalPages}`, keyboard);
}

async function renderGoalTierMenu(context: any, userId: number, allianceId: number, goalId: number, requestedPage: number): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
    const tiers = parseLifeTiers(goal.tierRates);
    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(tiers.length / pageSize));
    const page = Math.min(Math.max(0, Math.trunc(requestedPage || 0)), totalPages - 1);
    const visible = tiers.slice(page * pageSize, (page + 1) * pageSize);
    let text = `⚖ Тариф для цели «${goal.name}»\n\n`;
    if (tiers.length === 0) text += 'Тариф не настроен. Добавьте первую ступень: она будет применяться к любому размеру поста.';
    else text += `Ступеней: ${tiers.length}\n` + visible.map((tier, i) => {
        const index = page * pageSize + i;
        const range = tier.maxPc === null ? (index === 0 ? 'любого размера' : `свыше ${fmt(tiers[index - 1].maxPc)}`) : `${index === 0 ? 'до' : `свыше ${fmt(tiers[index - 1].maxPc)} — до`} ${fmt(tier.maxPc)} ПК`;
        return `${index + 1}. ${range} — ${fmt(tier.amount)}`;
    }).join('\n');
    const keyboard = new KeyboardBuilder();
    for (let i = 0; i < visible.length; i++) {
        const index = page * pageSize + i;
        const tier = visible[i];
        const label = tier.maxPc === null ? `${index + 1}. Последняя` : `${index + 1}. До ${fmt(tier.maxPc)}`;
        keyboard.callbackButton({ label: label.slice(0, 40), payload: { command: 'rp_work_settings', action: 'goal_tier_edit', goalId, tierIndex: index, menuPage: 2 }, color: 'secondary' });
    }
    if (visible.length > 0) keyboard.row();
    if (page > 0) keyboard.callbackButton({ label: '← Пред. стр.', payload: { command: 'rp_work_settings', action: 'goal_tier_menu', goalId, tierPage: page - 1, menuPage: 2 }, color: 'secondary' });
    if (page + 1 < totalPages) keyboard.callbackButton({ label: 'След. стр. →', payload: { command: 'rp_work_settings', action: 'goal_tier_menu', goalId, tierPage: page + 1, menuPage: 2 }, color: 'secondary' });
    if (page > 0 || page + 1 < totalPages) keyboard.row();
    keyboard.callbackButton({ label: '➕ Добавить ступень', payload: { command: 'rp_work_settings', action: 'goal_tier_add', goalId, menuPage: 2 }, color: 'positive' });
    if (tiers.length > 0) keyboard.callbackButton({ label: '🗑 Отключить тариф', payload: { command: 'rp_work_settings', action: 'goal_tier_disable', goalId, menuPage: 2 }, color: 'negative' });
    keyboard.row().callbackButton({ label: '↩ Настройки цели', payload: { command: 'rp_work_settings', action: 'goal_config', goalId, menuPage: 2 }, color: 'secondary' }).row().inline().oneTime();
    await Send_Message(context.peerId, `${text}\n\nСтраница ${page + 1}/${totalPages}. Последняя ступень всегда без верхней границы.`, keyboard);
}

async function renderGoalTierEditMenu(context: any, userId: number, allianceId: number, goalId: number, tierIndex: number): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
    const tiers = parseLifeTiers(goal.tierRates);
    const tier = tiers[tierIndex];
    if (!tier) { await sendContextMessage(context, '❌ Ступень не найдена.'); await renderGoalTierMenu(context, userId, allianceId, goalId, 0); return; }
    const lower = tierIndex === 0 ? 'от 0 ПК' : `свыше ${fmt(tiers[tierIndex - 1].maxPc ?? 0)} ПК`;
    const upper = tier.maxPc === null ? 'без верхней границы' : `до ${fmt(tier.maxPc)} ПК`;
    const keyboard = new KeyboardBuilder()
        .callbackButton({ label: '💰 Изменить выплату', payload: { command: 'rp_work_settings', action: 'goal_tier_edit_amount', goalId, tierIndex, menuPage: 2 }, color: 'secondary' }).row();
    if (tier.maxPc !== null) keyboard.callbackButton({ label: '📏 Изменить границу ПК', payload: { command: 'rp_work_settings', action: 'goal_tier_edit_max', goalId, tierIndex, menuPage: 2 }, color: 'secondary' }).row();
    keyboard.callbackButton({ label: '🗑 Удалить ступень', payload: { command: 'rp_work_settings', action: 'goal_tier_delete', goalId, tierIndex, menuPage: 2 }, color: 'negative' }).row();
    keyboard.callbackButton({ label: '↩ К тарифу цели', payload: { command: 'rp_work_settings', action: 'goal_tier_menu', goalId, tierPage: Math.floor(tierIndex / 3), menuPage: 2 }, color: 'secondary' }).inline().oneTime();
    await Send_Message(context.peerId, `Редактирование ступени ${tierIndex + 1}/${tiers.length} для «${goal.name}»\n\nДиапазон: ${lower}, ${upper}\nВыплата: ${fmt(tier.amount)}`, keyboard);
}

async function startGoalTierAddFlow(context: any, userId: number, allianceId: number, goalId: number): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
    const tiers = parseLifeTiers(goal.tierRates);
    const flow: PendingInputFlow = { kind: 'goalTierAdd', userId, allianceId, goalId, menuPage: 2, step: tiers.length === 0 ? 'amount' : 'boundary', tiers };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, getFlowPrompt(flow), 2);
}

async function startGoalTierEditFlow(context: any, userId: number, allianceId: number, goalId: number, tierIndex: number, step: 'max' | 'amount'): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) { await sendContextMessage(context, '❌ План не найден.'); return; }
    const tiers = parseLifeTiers(goal.tierRates);
    if (!Number.isInteger(tierIndex) || tierIndex < 0 || tierIndex >= tiers.length) { await sendContextMessage(context, '❌ Ступень не найдена.'); return; }
    if (step === 'max' && tiers[tierIndex].maxPc === null) { await sendContextMessage(context, 'У последней ступени нет верхней границы. Добавьте следующую ступень, чтобы ограничить её.'); return; }
    const flow: PendingInputFlow = { kind: 'goalTierEdit', userId, allianceId, goalId, menuPage: 2, step, index: tierIndex, tiers };
    pendingInputFlows.set(getInputFlowKey(context), flow);
    await sendInputPrompt(context, getFlowPrompt(flow), 2);
}

function normalizeTemplateCode(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

type GoalTemplateConfig = {
    trackingMode: 'all' | 'hashtags';
    trackingHashtags: string[];
    tierRates: WorkTier[];
    ratePerPc: number;
    minimumPc: number;
    extraPaymentEnabled: boolean;
    extraPaymentLabel: string;
    extraPaymentAmount: number;
};

function parseTemplateConfig(template: any): GoalTemplateConfig {
    let config: any = {};
    try { config = JSON.parse(String(template.config ?? '{}')); } catch { config = {}; }
    const tags: string[] = Array.isArray(config.trackingHashtags) ? Array.from(new Set<string>(config.trackingHashtags.map((tag: any) => normalizeHashtag(String(tag))).filter((tag: string) => Boolean(tag)))) : [];
    const tiers = Array.isArray(config.tierRates) ? parseLifeTiers(JSON.stringify({ version: 2, tiers: config.tierRates })) : [];
    const mode = config.trackingMode === 'hashtags' ? 'hashtags' : 'all';
    const ratePerPc = Number(config.ratePerPc ?? 0);
    const minimumPc = Number(config.minimumPc ?? 10);
    const extraPaymentAmount = Number(config.extraPaymentAmount ?? 0);
    return {
        trackingMode: mode,
        trackingHashtags: mode === 'hashtags' ? tags : [],
        tierRates: tiers,
        ratePerPc: Number.isFinite(ratePerPc) && ratePerPc >= 0 ? ratePerPc : 0,
        minimumPc: Number.isInteger(minimumPc) && minimumPc >= 0 ? minimumPc : 10,
        extraPaymentEnabled: Boolean(config.extraPaymentEnabled),
        extraPaymentLabel: String(config.extraPaymentLabel || 'Дополнительная выплата').slice(0, 40),
        extraPaymentAmount: Number.isFinite(extraPaymentAmount) && extraPaymentAmount >= 0 ? extraPaymentAmount : 0
    };
}

async function generateUniqueTemplateCode(allianceId: number): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 30; attempt++) {
        let code = '';
        for (let i = 0; i < 7; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
        const existing = await db.rpWorkTemplate.findFirst({ where: { allianceId, code } });
        if (!existing) return code;
    }
    throw new Error('Не удалось сгенерировать уникальный код шаблона');
}

async function createGoalTemplate(userId: number, allianceId: number, name: string, goal: any): Promise<string> {
    const config = {
        version: 2,
        trackingMode: isGoalHashtagMode(goal) ? 'hashtags' : 'all',
        trackingHashtags: getGoalTrackingHashtags(goal),
        tierRates: parseLifeTiers(goal.tierRates),
        ratePerPc: Number(goal.ratePerPc ?? 0),
        minimumPc: Number(goal.minimumPc ?? 10),
        extraPaymentEnabled: Boolean(goal.extraPaymentEnabled),
        extraPaymentLabel: String(goal.extraPaymentLabel || 'Дополнительная выплата'),
        extraPaymentAmount: Number(goal.extraPaymentAmount ?? 0)
    };
    const code = await generateUniqueTemplateCode(allianceId);
    await db.rpWorkTemplate.create({
        data: { allianceId, createdByUserId: userId, name, code, config: JSON.stringify(config) }
    });
    return code;
}

function buildGoalTariffSummary(goal: any, posts: StoredPost[]): string {
    const tiers = parseLifeTiers(goal.tierRates);
    if (tiers.length === 0) return 'Тариф за посты: не настроен.\n';
    let total = 0;
    for (const post of posts) {
        const index = findTierIndex(post.pc, tiers);
        if (index >= 0) total += tiers[index].amount;
    }
    return `Тариф: ${tiers.length} ступ. · прогноз по ${posts.length} постам: ${fmt(total)}\n`;
}

async function renderGoalList(context: any, userId: number, allianceId: number, requestedPage: number): Promise<void> {
    const goals = await db.rpWritingGoal.findMany({
        where: { userId, allianceId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    if (goals.length === 0) {
        const keyboard = new KeyboardBuilder()
            .callbackButton({ label: '↩ Цели персонажа', payload: { command: 'rp_work_settings' }, color: 'secondary' })
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
    keyboard.callbackButton({ label: '↩ Цели персонажа', payload: { command: 'rp_work_settings', menuPage: 2 }, color: 'secondary' }).row().inline().oneTime();
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
    const posts = await getPostsForGoal(userId, allianceId, goal, startDate, endExclusive);
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
        `Учёт: ${describeGoalTracking(goal)}\n` +
        `${buildGoalTariffSummary(goal, posts)}\n` +
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
        label: '✏ Изменить план',
        payload: { command: 'rp_work_settings', action: 'goal_edit', goalId: goal.id, menuPage: 2 },
        color: 'primary'
    });
    keyboard.callbackButton({
        label: '⚙ Настройки цели',
        payload: { command: 'rp_work_settings', action: 'goal_config', goalId: goal.id, menuPage: 2 },
        color: 'primary'
    }).row();
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

async function sendGoalForecast(context: any, userId: number, allianceId: number, goalId: number): Promise<void> {
    const goal = await getOwnedGoal(userId, allianceId, goalId);
    if (!goal) {
        await sendContextMessage(context, '❌ Цель не найдена.');
        return;
    }

    const start = startOfUtcDay(new Date(goal.startDate));
    const end = startOfUtcDay(new Date(goal.endDate));
    if (start.getTime() > end.getTime()) {
        await sendContextMessage(context, '❌ Даты цели настроены некорректно.');
        return;
    }

    const posts = await getPostsForGoal(userId, allianceId, goal, start, addUtcDays(end, 1));
    const totalPc = sumPc(posts);
    const minimumPc = Math.max(0, Math.trunc(Number(goal.minimumPc ?? 10)));
    const minimumMet = totalPc >= minimumPc;
    const ratePerPc = Math.max(0, Number(goal.ratePerPc ?? 0));
    const basePay = minimumMet ? totalPc * ratePerPc : 0;
    const tiers = parseLifeTiers(goal.tierRates);
    let tierPay = 0;
    for (const post of posts) {
        const index = findTierIndex(post.pc, tiers);
        if (index >= 0) tierPay += tiers[index].amount;
    }
    const extraEnabled = Boolean(goal.extraPaymentEnabled);
    const extraAmount = minimumMet && extraEnabled ? Math.max(0, Number(goal.extraPaymentAmount ?? 0)) : 0;
    const totalPay = basePay + (minimumMet ? tierPay : 0) + extraAmount;
    const bonusLabel = String(goal.extraPaymentLabel || 'Дополнительная выплата');

    const report = `📊 Прогноз по цели «${goal.name}»\n` +
        `Период: ${formatDate(start)}–${formatDate(end)}\n\n` +
        `ПК-строк: ${fmt(totalPc)}\n` +
        `Минимум для допуска: ${minimumPc} ПК — ${minimumMet ? 'выполнен' : 'не выполнен'}\n` +
        `Ставка: ${fmt(ratePerPc)} за ПК-строку\n` +
        `Основная выплата: ${fmt(basePay)}\n` +
        `Дополнительный тариф за посты: ${fmt(minimumMet ? tierPay : 0)}\n` +
        `${bonusLabel}: ${fmt(extraAmount)}${extraEnabled ? '' : ' (выключена)'}\n` +
        `Итого прогноз: ${fmt(totalPay)}\n\n` +
        `Учёт: ${describeGoalTracking(goal)}\n` +
        `⚠ Это прогноз. Бот не начисляет и не переводит средства.`;

    const keyboard = new KeyboardBuilder()
        .callbackButton({ label: '↩ Углублённые настройки', payload: { command: 'rp_work_settings', action: 'goal_advanced', goalId, menuPage: 2 }, color: 'secondary' })
        .inline().oneTime();
    const parts = splitVkMessage(report);
    for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) await Send_Message(context.peerId, parts[i], keyboard);
        else await sendContextMessage(context, parts[i]);
    }
}

async function getPosts(userId: number, allianceId: number, startDate: Date, endExclusive: Date, hashtag: string | string[] | null): Promise<StoredPost[]> {
    const where: any = {
        userId,
        date: { gte: startDate, lt: endExclusive },
        topicMonitor: { monitor: { id_alliance: allianceId } }
    };
    if (Array.isArray(hashtag)) {
        if (hashtag.length === 0) return [];
        where.hashtags = { some: { hashtag: { in: hashtag.map(normalizeHashtag) }, allianceId } };
    } else if (hashtag) {
        where.hashtags = { some: { hashtag: normalizeHashtag(hashtag), allianceId } };
    }
    return prisma.postStatistic.findMany({ where, select: { date: true, pc: true } });
}

async function getPostsForGoal(userId: number, allianceId: number, goal: any, startDate: Date, endExclusive: Date): Promise<StoredPost[]> {
    return isGoalHashtagMode(goal)
        ? getPosts(userId, allianceId, startDate, endExclusive, getGoalTrackingHashtags(goal))
        : getPosts(userId, allianceId, startDate, endExclusive, null);
}

/** Text appended to per-post notifications for goals active on the post date. */
export async function RP_Work_GetProgressNotificationText(
    userId: number,
    allianceId: number,
    postHashtags: string[],
    referenceDate: Date = new Date()
): Promise<string> {
    const dayStart = startOfUtcDay(referenceDate);
    const dayEnd = addUtcDays(dayStart, 1);
    const hashtags = new Set(postHashtags.map(normalizeHashtag));
    const goals = await db.rpWritingGoal.findMany({
        where: {
            userId,
            allianceId,
            startDate: { lt: dayEnd },
            endDate: { gte: dayStart }
        },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }]
    });

    const lines: string[] = [];
    for (const goal of goals) {
        const goalTags = getGoalTrackingHashtags(goal);
        const filtersByTags = isGoalHashtagMode(goal);
        if (filtersByTags && !goalTags.some((tag: string) => hashtags.has(tag))) continue;
        const start = startOfUtcDay(new Date(goal.startDate));
        const end = startOfUtcDay(new Date(goal.endDate));
        if (dayStart.getTime() < start.getTime() || dayStart.getTime() > end.getTime()) continue;
        const posts = await getPostsForGoal(userId, allianceId, goal, start, addUtcDays(end, 1));
        const total = sumPc(posts);
        const percent = goal.targetPc > 0 ? total / goal.targetPc * 100 : 0;
        const scope = describeGoalTracking(goal);
        lines.push(`• ${goal.name} (${scope}): ${fmt(percent)}% · ${fmt(total)}/${fmt(goal.targetPc)} ПК`);
    }

    return lines.length > 0 ? `🎯 Выполнение планов:\n${lines.join('\n')}\n` : '';
}

const goalNotificationLocks = new Set<number>();
const goalReconciliationLocks = new Set<string>();

/** Checks early completion and expired goals. A goal receives only one terminal notification. */
export async function RP_Work_CheckGoalNotificationsForUser(userId: number, allianceId: number): Promise<void> {
    const goals = await db.rpWritingGoal.findMany({
        where: { userId, allianceId, completionNotified: false },
        orderBy: [{ endDate: 'asc' }, { id: 'asc' }]
    });
    const today = startOfUtcDay(new Date());

    for (const goal of goals) {
        if (goalNotificationLocks.has(goal.id)) continue;
        goalNotificationLocks.add(goal.id);
        try {
            const start = startOfUtcDay(new Date(goal.startDate));
            const end = startOfUtcDay(new Date(goal.endDate));
            if (today.getTime() < start.getTime()) continue;

            const posts = await getPostsForGoal(userId, allianceId, goal, start, addUtcDays(end, 1));
            const actual = sumPc(posts);
            const target = Number(goal.targetPc);
            const completed = actual >= target;
            const expired = today.getTime() > end.getTime();
            if (!completed && !expired) continue;

            // Determine the actual date the cumulative total first crossed the target,
            // so a delayed checker can still correctly label an early completion.
            let accumulated = 0;
            let completionDate: Date | null = null;
            for (const post of [...posts].sort((a, b) => a.date.getTime() - b.date.getTime())) {
                accumulated += post.pc;
                if (accumulated >= target) {
                    completionDate = startOfUtcDay(post.date);
                    break;
                }
            }
            const early = completed && completionDate !== null && completionDate.getTime() < end.getTime();

            const user = await prisma.user.findFirst({ where: { id: userId } });
            if (!user) continue;
            const account = await prisma.account.findFirst({ where: { idvk: user.idvk } });
            if (!account) continue;

            let message: string;
            if (completed) {
                const reachedOn = completionDate ?? today;
                const remainingDays = Math.max(0, Math.floor((end.getTime() - reachedOn.getTime()) / 86400000));
                message = `🎉 Поздравляем, план «${goal.name}» выполнен!\n` +
                    `Результат: ${fmt(actual)} из ${fmt(target)} ПК (${fmt(actual / target * 100)}%).\n` +
                    (early
                        ? `⏩ Вы завершили план раньше назначенного срока (${formatDate(reachedOn)}). До окончания оставалось ${remainingDays} дн.`
                        : '✅ План выполнен в запланированный срок.');
            } else {
                const deficit = Math.max(0, target - actual);
                message = `😔 План «${goal.name}» завершён, но цель не достигнута.\n` +
                    `Результат: ${fmt(actual)} из ${fmt(target)} ПК (${fmt(target > 0 ? actual / target * 100 : 0)}%).\n` +
                    `Не хватило: ${fmt(deficit)} ПК.\n` +
                    `Ну вы, батюшка, немного лох. План был, а строки не наролились.`;
            }

            if (user.notification_topic) {
                await Send_Message(account.idvk, message);
            }
            await db.rpWritingGoal.update({ where: { id: goal.id }, data: { completionNotified: true, completionNotifiedSuccess: completed } });
        } catch (error: any) {
            await Logger(`RP goal notification error for goal ${goal.id}: ${error?.message ?? error}`);
        } finally {
            goalNotificationLocks.delete(goal.id);
        }
    }
}

/**
 * Reconciles terminal plan notifications after a post was deleted, edited or restored.
 * A previously completed plan can become incomplete after a deletion/edit; a previously
 * failed plan can become completed after an edit/restore. In both cases the old terminal
 * state is reopened and the normal checker emits the new, correct terminal notification.
 */
export async function RP_Work_ReconcileGoalStatisticsForUser(
    userId: number,
    allianceId: number,
    reason: string = 'изменения статистики поста'
): Promise<void> {
    const lockKey = `${userId}:${allianceId}`;
    if (goalReconciliationLocks.has(lockKey)) return;
    goalReconciliationLocks.add(lockKey);
    try {
    const goals = await db.rpWritingGoal.findMany({
        where: { userId, allianceId },
        orderBy: [{ endDate: 'asc' }, { id: 'asc' }]
    });
    if (goals.length === 0) return;

    const today = startOfUtcDay(new Date());
    const user = await prisma.user.findFirst({ where: { id: userId } });
    const account = user
        ? await prisma.account.findFirst({ where: { idvk: user.idvk } })
        : null;
    const changed: Array<{ name: string; actual: number; target: number; completed: boolean }> = [];

    for (const goal of goals) {
        if (!goal.completionNotified) continue;

        const start = startOfUtcDay(new Date(goal.startDate));
        const end = startOfUtcDay(new Date(goal.endDate));
        const posts = await getPostsForGoal(userId, allianceId, goal, start, addUtcDays(end, 1));
        const actual = sumPc(posts);
        const target = Number(goal.targetPc);
        const completed = actual >= target;

        let previouslyNotifiedSuccess: boolean | null | undefined = goal.completionNotifiedSuccess;
        if (previouslyNotifiedSuccess === null || previouslyNotifiedSuccess === undefined) {
            // Backward compatibility for goals notified before this field existed:
            // before the deadline only successful completion could have been notified.
            if (completed) {
                await db.rpWritingGoal.update({
                    where: { id: goal.id },
                    data: { completionNotifiedSuccess: true }
                });
                continue;
            }
            if (today.getTime() > end.getTime()) {
                // At/after expiration a legacy notification may already have been a failure.
                await db.rpWritingGoal.update({
                    where: { id: goal.id },
                    data: { completionNotifiedSuccess: false }
                });
                continue;
            }
            previouslyNotifiedSuccess = true;
        }

        if (previouslyNotifiedSuccess === completed) continue;

        await db.rpWritingGoal.update({
            where: { id: goal.id },
            data: {
                completionNotified: false,
                completionNotifiedSuccess: null
            }
        });
        if (!completed && today.getTime() <= end.getTime()) {
            changed.push({ name: goal.name, actual, target, completed });
        }
    }

    if (changed.length > 0 && user && account && user.notification_topic) {
        const lines = changed.map(item => {
            const percent = item.target > 0 ? item.actual / item.target * 100 : 0;
            return `• ${item.name}: ${fmt(item.actual)} / ${fmt(item.target)} ПК (${fmt(percent)}%) — ${item.completed ? 'цель снова выполнена' : 'цель больше не выполнена'}`;
        });
        const message = `🔄 Статус целей пересчитан после ${reason}.\n` +
            `Изменения статистики повлияли на ранее отправленные уведомления:\n${lines.join('\n')}\n` +
            `Прогресс пересчитан по сохранённым постам.`;
        try {
            await Send_Message(account.idvk, message);
        } catch (error: any) {
            await Logger(`RP goal reconciliation notification error for user ${userId}: ${error?.message ?? error}`);
        }
    }

    // Re-send a terminal result only when the current state is eligible and was reopened.
    await RP_Work_CheckGoalNotificationsForUser(userId, allianceId);
    } finally {
        goalReconciliationLocks.delete(lockKey);
    }
}

/** Periodic sweep for plans whose end date passed while no post event was received. */
export async function RP_Work_Goals_CheckDeadlines(): Promise<void> {
    try {
        const today = startOfUtcDay(new Date());
        const groups = await db.rpWritingGoal.findMany({
            where: { completionNotified: false, endDate: { lt: today } },
            select: { userId: true, allianceId: true }
        });
        const seen = new Set<string>();
        for (const group of groups) {
            const key = `${group.userId}:${group.allianceId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            await RP_Work_CheckGoalNotificationsForUser(group.userId, group.allianceId);
        }
    } catch (error: any) {
        await Logger(`RP goal deadline checker error: ${error?.message ?? error}`);
    }
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
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        const value = Array.isArray(parsed) ? parsed : parsed?.version === 2 && Array.isArray(parsed?.tiers) ? parsed.tiers : null;
        if (!Array.isArray(value) || value.length === 0) return [];
        const tiers: WorkTier[] = value.map((item: any) => ({
            maxPc: item?.maxPc === null ? null : Number(item?.maxPc),
            amount: Number(item?.amount)
        }));
        if (tiers.some((tier, index) => {
            const isLast = index === tiers.length - 1;
            const validBoundary = isLast
                ? tier.maxPc === null
                : tier.maxPc !== null && Number.isFinite(tier.maxPc) && tier.maxPc > (index > 0 ? Number(tiers[index - 1].maxPc ?? 0) : 0);
            return !validBoundary || !Number.isFinite(tier.amount) || tier.amount < 0;
        })) return [];
        return tiers;
    } catch {
        return [];
    }
}

function serializeLifeTiers(tiers: WorkTier[]): string {
    return JSON.stringify({ version: 2, tiers });
}

function isModernLifeTierStorage(raw: string | null | undefined): boolean {
    if (!raw) return false;
    try {
        const value = JSON.parse(raw);
        return !Array.isArray(value) && value?.version === 2 && Array.isArray(value?.tiers);
    } catch {
        return false;
    }
}

function isLegacyLifeSample(tiers: WorkTier[]): boolean {
    const sample: WorkTier[] = [
        { maxPc: 500, amount: 3 },
        { maxPc: 800, amount: 5 },
        { maxPc: 1200, amount: 7 },
        { maxPc: 1500, amount: 10 },
        { maxPc: 2000, amount: 15 },
        { maxPc: null, amount: 20 }
    ];
    return tiers.length === sample.length && tiers.every((tier, index) =>
        tier.maxPc === sample[index].maxPc && Math.abs(tier.amount - sample[index].amount) < 0.000001
    );
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
    return Number(value ?? 0).toFixed(2);
}

function sumPc(posts: StoredPost[]): number {
    return posts.reduce((sum, post) => sum + post.pc, 0);
}