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
    while (!exit) {
        const templates = await prisma.notificationTemplate.findMany({
            where: { allianceId: user.id_alliance },
            orderBy: { name: 'asc' }
        });
        const keyboard = new KeyboardBuilder();
        // VK допускает максимум 6 рядов в inline-клавиатуре. Показываем до 8 шаблонов,
        // размещая по два удаления в ряд; остальные доступны после удаления/пересоздания.
        for (let index = 0; index < Math.min(templates.length, 8); index += 2) {
            const first = templates[index];
            keyboard.textButton({ label: `❌ ${first.name.slice(0, 25)}`, payload: { command: 'notification_template_delete', id: first.id }, color: 'negative' });
            const second = templates[index + 1];
            if (second) {
                keyboard.textButton({ label: `❌ ${second.name.slice(0, 25)}`, payload: { command: 'notification_template_delete', id: second.id }, color: 'negative' });
            }
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
