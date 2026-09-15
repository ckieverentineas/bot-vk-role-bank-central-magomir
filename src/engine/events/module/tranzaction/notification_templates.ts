import { Keyboard, KeyboardBuilder } from 'vk-io';
import { answerTimeLimit } from '../../../..';
import { Input_Text } from '../../../core/helper';
import { Person_Get } from '../person/person';
import prisma from '../prisma_client';

export async function NotificationTemplate_Menu(context: any): Promise<void> {
    const user = await Person_Get(context);
    if (!user?.id_alliance || user.id_alliance <= 0) {
        await context.send('❌ Сначала выберите персонажа ролевого проекта.');
        return;
    }

    let exit = false;
    let page = 0;
    while (!exit) {
        const templates = await prisma.notificationTemplate.findMany({
            where: { allianceId: user.id_alliance },
            orderBy: { name: 'asc' }
        });
        const keyboard = new KeyboardBuilder();
        const pageSize = 6;
        const start = page * pageSize;
        const visible = templates.slice(start, start + pageSize);
        for (let index = 0; index < visible.length; index += 2) {
            const first = visible[index];
            keyboard.textButton({ label: `❌ ${first.name.slice(0, 25)}`, payload: { command: 'notification_template_delete', id: first.id }, color: 'negative' });
            const second = visible[index + 1];
            if (second) {
                keyboard.textButton({ label: `❌ ${second.name.slice(0, 25)}`, payload: { command: 'notification_template_delete', id: second.id }, color: 'negative' });
            }
            keyboard.row();
        }
        if (templates.length > pageSize) {
            if (page > 0) keyboard.textButton({ label: '◀️', payload: { command: 'notification_template_prev' }, color: 'secondary' });
            if (start + pageSize < templates.length) keyboard.textButton({ label: '▶️', payload: { command: 'notification_template_next' }, color: 'secondary' });
            keyboard.row();
        }
        keyboard.textButton({ label: '➕ Создать шаблон', payload: { command: 'notification_template_create' }, color: 'positive' }).inline();

        const description = templates.length
            ? templates.map(template => `• ${template.name}: ${template.text}`).join('\n')
            : 'Шаблонов пока нет.';
        const answer: any = await context.question(`📝 Шаблоны уведомлений для проекта\n\n${description}`, { keyboard, answerTimeLimit });
        if (answer.isTimeout || answer.payload?.command === 'notification_template_exit') {
            exit = true;
            continue;
        }
        if (answer.payload?.command === 'notification_template_prev') { page = Math.max(0, page - 1); continue; }
        if (answer.payload?.command === 'notification_template_next') { page = Math.min(Math.ceil(templates.length / pageSize) - 1, page + 1); continue; }
        if (answer.payload?.command === 'notification_template_create') {
            const name = await Input_Text(context, 'Введите название шаблона:', 80);
            const text = await Input_Text(context, 'Введите текст шаблона уведомления:', 3000);
            if (!name || !text) continue;
            try {
                await prisma.notificationTemplate.create({ data: { allianceId: user.id_alliance, name, text } });
                await context.send(`✅ Шаблон «${name}» создан.`);
            } catch {
                await context.send('❌ Шаблон с таким названием уже существует.');
            }
        } else if (answer.payload?.command === 'notification_template_delete') {
            await prisma.notificationTemplate.deleteMany({ where: { id: Number(answer.payload.id), allianceId: user.id_alliance } });
            await context.send('✅ Шаблон удалён.');
        }
    }
}
