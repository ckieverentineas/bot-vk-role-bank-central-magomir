import { promises as fs } from 'fs';
import { resolve } from 'path';
import { Logger, Send_Message } from './helper';
import { chat_id, group_id, vk } from '../..';

export async function Auto_Backup_DB() {
    const filePath = resolve(__dirname, './../../../prisma/dev.db'); // укажи правильный путь до файла
    let fileBuffer;

    try {
        fileBuffer = await fs.readFile(filePath);
    } catch (e) {
        await Send_Message(chat_id, '❌ Не удалось прочитать файл базы данных.');
        console.error('Ошибка чтения файла:', e);
        return;
    }

    // Прикрепляем файл как документ
    const document = await vk?.upload.messageDocument({
        peer_id: chat_id,
        title: 'dev.db',
        tags: 'backup',
        source: {
            value: fileBuffer
        }
    });

    if (!document || !document) {
        await Send_Message(chat_id, '❌ Не удалось загрузить файл');
        return;
    }
    await Send_Message(chat_id, '📦 Вот актуальный бекап базы данных:', undefined, document.url);
    await Logger(`success backup`);
}