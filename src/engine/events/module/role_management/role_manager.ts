import { KeyboardBuilder } from 'vk-io';
import prisma from '../prisma_client';
import { Person_Get } from '../person/person';
import { 
    Confirm_User_Success, 
    Input_Text, 
    Send_Message_Question,
    Send_Message_Smart
} from '../../../core/helper';
import { hasPermission, isAdmin } from '../../../core/permissions';
import { ico_list } from '../data_center/icons_lib';
import { answerTimeLimit } from '../../../..';
import { RoleEditor } from './role_editor';
import { RoleAssigner } from './role_assigner';

// Главное меню управления ролями
export async function RoleManager_Menu(context: any) {
    const user = await Person_Get(context);
    if (!user) {
        await context.send('❌ Сначала выберите персонажа.');
        return;
    }
    
    if (!(await hasPermission(user, 'canManageRoles')) && !(await isAdmin(user))) {
        await context.send('❌ У вас нет прав на управление ролями.');
        return;
    }
    
    const alliance = await prisma.alliance.findFirst({
        where: { id: user.id_alliance ?? 0 }
    });
    
    if (!alliance) {
        await context.send('❌ Вы не состоите в альянсе.');
        return;
    }
    
    let exit = false;
    let cursor = 0;
    const ITEMS_PER_PAGE = 4;
    
    while (!exit) {
        const customRoles = await prisma.customRole.findMany({
            where: { allianceId: alliance.id },
            orderBy: { name: 'asc' }
        });
        
        const totalRoles = customRoles.length;
        const pageRoles = customRoles.slice(cursor, cursor + ITEMS_PER_PAGE);
        const totalPages = Math.ceil(totalRoles / ITEMS_PER_PAGE);
        const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;
        
        let text = `${ico_list['config'].ico} Управление кастомными ролями для "${alliance.name}":\n\n`;
        
        if (customRoles.length === 0) {
            text += '📭 Нет созданных кастомных ролей.\n\n';
            text += '➕ Создайте первую роль (например: "Гейм-мастер", "Хранитель")\n\n';
        } else {
            text += '📊 Существующие роли:\n\n';
            for (let i = 0; i < pageRoles.length; i++) {
                const role = pageRoles[i];
                const itemNumber = cursor + i + 1;
                const userCount = await prisma.user.count({
                    where: { customRoleId: role.id }
                });
                text += `${itemNumber}. 👑 ${role.name} (${userCount} пользователей)\n`;
            }
            text += `\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
        }
        
        text += '💡 Кастомные роли позволяют гибко настраивать права.\n';
        
        const keyboard = new KeyboardBuilder();
        
        for (const role of pageRoles) {
            keyboard.textButton({
                label: `👑 ${role.name.slice(0, 25)}`,
                payload: { command: 'role_edit', roleId: role.id, cursor },
                color: 'secondary'
            });
            keyboard.textButton({
                label: `❌`,
                payload: { command: 'role_delete', roleId: role.id, cursor },
                color: 'negative'
            }).row();
        }
        
        if (cursor > 0) {
            keyboard.textButton({
                label: `← Назад`,
                payload: { command: 'roles_prev', cursor: Math.max(0, cursor - ITEMS_PER_PAGE) },
                color: 'secondary'
            });
        }
        if (cursor + ITEMS_PER_PAGE < totalRoles) {
            keyboard.textButton({
                label: `Вперед →`,
                payload: { command: 'roles_next', cursor: cursor + ITEMS_PER_PAGE },
                color: 'secondary'
            });
        }
        if (cursor > 0 || cursor + ITEMS_PER_PAGE < totalRoles) {
            keyboard.row();
        }
        
        keyboard.textButton({
            label: `➕ Создать роль`,
            payload: { command: 'role_create', cursor },
            color: 'positive'
        }).row();
        
        keyboard.textButton({
            label: `👥 Выдать роль`,
            payload: { command: 'role_assign', cursor },
            color: 'primary'
        }).row();
        
        const response = await Send_Message_Question(context, text, keyboard.oneTime());
        
        if (response.exit) {
            exit = true;
            continue;
        }
        
        if (!response.payload) continue;
        
        const payload = response.payload;
        
        switch (payload.command) {
            case 'role_edit':
                await RoleEditor(context, payload.roleId, alliance.id, payload.cursor);
                break;
            case 'role_delete':
                await deleteRole(context, payload.roleId, alliance.id, payload.cursor);
                break;
            case 'role_create':
                await createRole(context, alliance.id, payload.cursor);
                break;
            case 'role_assign':
                await RoleAssigner(context, alliance.id, payload.cursor);
                break;
            case 'roles_prev':
                cursor = payload.cursor;
                break;
            case 'roles_next':
                cursor = payload.cursor;
                break;
            case 'roles_exit':
                exit = true;
                break;
        }
    }
    
    await context.send(`✅ Выход из меню управления ролями.`);
}

async function createRole(context: any, allianceId: number, cursor: number) {
    const name = await Input_Text(context, 
        `👑 Создание новой роли\n\nВведите название роли (до 50 символов):\n` +
        `💡 Например: "Гейм-мастер", "Хранитель", "Смотритель"`,
        50
    );
    
    if (!name) {
        await context.send('❌ Создание роли отменено.');
        return;
    }
    
    const existing = await prisma.customRole.findFirst({
        where: { allianceId, name }
    });
    
    if (existing) {
        await context.send(`❌ Роль с названием "${name}" уже существует!`);
        return;
    }
    
    const newRole = await prisma.customRole.create({
        data: {
            name,
            allianceId,
        }
    });
    
    await context.send(`✅ Роль "${newRole.name}" создана!`);
    await RoleEditor(context, newRole.id, allianceId, cursor);
}

async function deleteRole(context: any, roleId: number, allianceId: number, cursor: number) {
    const role = await prisma.customRole.findFirst({
        where: { id: roleId, allianceId },
        include: { users: true }
    });
    
    if (!role) {
        await context.send('❌ Роль не найдена.');
        return;
    }
    
    const userCount = role.users.length;
    const warningText = userCount > 0 
        ? `удалить роль "${role.name}"?\n\n⚠️ ВНИМАНИЕ! У ${userCount} пользователей есть эта роль. После удаления роли у них сбросятся кастомные права!`
        : `удалить роль "${role.name}"?`;
    
    const confirm = await Confirm_User_Success(context, warningText);
    
    if (!confirm.status) {
        await context.send('❌ Удаление отменено.');
        return;
    }
    
    if (userCount > 0) {
        await prisma.user.updateMany({
            where: { customRoleId: roleId },
            data: { customRoleId: null }
        });
    }
    
    await prisma.customRole.delete({
        where: { id: roleId }
    });
    
    await Send_Message_Smart(
        context,
        `Удалена роль: "${role.name}"`,
        'admin_solo'
    );
}