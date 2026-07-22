import { promises as fs } from 'fs';
import { resolve } from 'path';
import { Logger, Send_Message } from './helper';
import { chat_id, vk } from '../..';
import prisma from '../events/module/prisma_client';

async function Send_Backup_Error(message: string): Promise<void> {
    try {
        await Send_Message(chat_id, message);
    } catch (error) {
        console.error('Ошибка отправки уведомления об автобекапе:', error);
    }
}

export async function Auto_Backup_DB(): Promise<void> {
    const filePath = resolve(__dirname, './../../../prisma/dev.db');

    try {
        const fileBuffer = await fs.readFile(filePath);

        // Прикрепляем файл как документ
        const document = await vk?.upload.messageDocument({
            peer_id: chat_id,
            title: 'dev.db',
            tags: 'backup',
            source: {
                value: fileBuffer
            }
        });

        if (!document) {
            await Send_Backup_Error('❌ Не удалось загрузить файл базы данных.');
            await Logger('backup failed: document upload returned empty result');
            return;
        }

        // [!] ИЗМЕНЕНИЕ: Отправляем бекап в финансовый чат альянса (id 10)
        // Вместо chat_id используем id_chat альянса
        // Для примера берем альянс с id = 10, но нужно получать динамически
        const alliance = await prisma.alliance.findFirst({
            where: { id: 10 } // или получать из конфига
        });
        
        const targetChatId = alliance?.id_chat || chat_id;
        
        const isSent = await Send_Message(
            targetChatId, 
            '📦 Вот актуальный бекап базы данных:', 
            undefined, 
            document.url
        );
        
        if (!isSent) {
            await Logger('backup failed: backup message was not delivered');
            return;
        }

        await Logger('success backup');
    } catch (error: any) {
        const errorMessage = error?.message ?? String(error);
        console.error('Ошибка автобекапа:', error);
        await Logger(`backup failed: ${errorMessage}`);
        await Send_Backup_Error(`❌ Автобекап не выполнен: ${errorMessage}`);
    }
}