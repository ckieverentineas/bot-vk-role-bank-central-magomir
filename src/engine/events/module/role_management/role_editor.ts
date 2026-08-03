import { KeyboardBuilder } from 'vk-io';
import prisma from '../prisma_client';
import { 
    Confirm_User_Success, 
    Input_Text,
    Send_Message_Question,
    Send_Message_Smart
} from '../../../core/helper';
import { ico_list } from '../data_center/icons_lib';
import { answerTimeLimit } from '../../../..';
import { PERMISSIONS_LIST, getPermissionsByCategory } from './role_permissions';

export async function RoleEditor(context: any, roleId: number, allianceId: number, cursor: number, currentPage: number = 0) {
    const role = await prisma.customRole.findFirst({
        where: { id: roleId, allianceId }
    });
    
    if (!role) {
        await context.send('❌ Роль не найдена.');
        return;
    }
    
    let exit = false;
    let permissionPage = currentPage;
    const PERMISSIONS_PER_PAGE = 5;
    
    while (!exit) {
        const allPermissions = PERMISSIONS_LIST;
        const totalPermissions = allPermissions.length;
        const pagePermissions = allPermissions.slice(
            permissionPage * PERMISSIONS_PER_PAGE,
            (permissionPage + 1) * PERMISSIONS_PER_PAGE
        );
        const totalPages = Math.ceil(totalPermissions / PERMISSIONS_PER_PAGE);
        
        let text = `${ico_list['config'].ico} Редактирование роли "${role.name}"\n\n`;
        text += `👥 Пользователей с этой ролью: ${await prisma.user.count({ where: { customRoleId: roleId } })}\n\n`;
        text += `📋 Права (страница ${permissionPage + 1} из ${totalPages}):\n\n`;
        
        for (const perm of pagePermissions) {
            const value = role[perm.key as keyof typeof role] as boolean;
            text += `${value ? '✅' : '❌'} ${perm.label}\n`;
            text += `   ${perm.description}\n\n`;
        }
        
        text += `💡 Нажмите на право, чтобы переключить его.\n`;
        text += `🔄 Зеленые кнопки = право включено, красные = выключено.\n`;
        text += `⚠️ По умолчанию все права выключены.`;
        
        const keyboard = new KeyboardBuilder();
        
        for (const perm of pagePermissions) {
            const value = role[perm.key as keyof typeof role] as boolean;
            keyboard.textButton({
                label: `${value ? '✅' : '❌'} ${perm.label.slice(0, 25)}`,
                payload: { 
                    command: 'toggle_permission', 
                    permission: perm.key,
                    roleId: role.id,
                    currentValue: value,
                    permissionPage
                },
                color: value ? 'positive' : 'negative'
            }).row();
        }
        
        if (totalPermissions > PERMISSIONS_PER_PAGE) {
            if (permissionPage > 0) {
                keyboard.textButton({
                    label: `← Назад`,
                    payload: { 
                        command: 'perms_prev', 
                        roleId: role.id,
                        permissionPage: permissionPage - 1,
                        cursor
                    },
                    color: 'secondary'
                });
            }
            if (permissionPage < totalPages - 1) {
                keyboard.textButton({
                    label: `Вперед →`,
                    payload: { 
                        command: 'perms_next', 
                        roleId: role.id,
                        permissionPage: permissionPage + 1,
                        cursor
                    },
                    color: 'secondary'
                });
            }
            if (permissionPage > 0 || permissionPage < totalPages - 1) {
                keyboard.row();
            }
        }
        
        keyboard.textButton({
            label: `✏️ Переименовать`,
            payload: { command: 'rename_role', roleId: role.id, cursor },
            color: 'secondary'
        }).row();
        
        keyboard.textButton({
            label: `🔄 Сбросить все права`,
            payload: { command: 'reset_permissions', roleId: role.id, cursor },
            color: 'negative'
        }).row();
        
        const response = await Send_Message_Question(context, text, keyboard.oneTime());
        
        if (response.exit) {
            exit = true;
            continue;
        }
        
        if (!response.payload) continue;
        
        const payload = response.payload;
        
        switch (payload.command) {
            case 'toggle_permission':
                await togglePermission(context, payload, roleId);
                break;
            case 'rename_role':
                await renameRole(context, roleId, allianceId, cursor);
                exit = true;
                break;
            case 'reset_permissions':
                await resetPermissions(context, roleId);
                break;
            case 'perms_prev':
                permissionPage = payload.permissionPage;
                break;
            case 'perms_next':
                permissionPage = payload.permissionPage;
                break;
            case 'back_to_roles':
                exit = true;
                break;
        }
    }
}

async function togglePermission(context: any, payload: any, roleId: number) {
    const { permission, currentValue, permissionPage, cursor } = payload;
    const newValue = !currentValue;
    
    await prisma.customRole.update({
        where: { id: roleId },
        data: { [permission]: newValue }
    });
    
    const permInfo = PERMISSIONS_LIST.find(p => p.key === permission);
    await context.send(
        `${newValue ? '✅' : '❌'} Право "${permInfo?.label || permission}" ${newValue ? 'включено' : 'выключено'}`
    );
    
    // ===== ВОЗВРАЩАЕМСЯ НА ТУ ЖЕ СТРАНИЦУ =====
    const role = await prisma.customRole.findFirst({
        where: { id: roleId }
    });
    
    if (role) {
        const alliance = await prisma.alliance.findFirst({
            where: { CustomRole: { some: { id: roleId } } }
        });
        
        if (alliance) {
            // Вызываем RoleEditor с сохранением страницы
            await RoleEditor(context, roleId, alliance.id, cursor, permissionPage);
        }
    }
}

async function renameRole(context: any, roleId: number, allianceId: number, cursor: number) {
    const role = await prisma.customRole.findFirst({
        where: { id: roleId, allianceId }
    });
    
    if (!role) {
        await context.send('❌ Роль не найдена.');
        return;
    }
    
    const newName = await Input_Text(
        context,
        `Текущее название: "${role.name}"\nВведите новое название (до 50 символов):`,
        50
    );
    
    if (!newName) {
        await context.send('❌ Переименование отменено.');
        return;
    }
    
    const existing = await prisma.customRole.findFirst({
        where: { 
            allianceId, 
            name: newName,
            id: { not: roleId }
        }
    });
    
    if (existing) {
        await context.send(`❌ Роль с названием "${newName}" уже существует!`);
        return;
    }
    
    await prisma.customRole.update({
        where: { id: roleId },
        data: { name: newName }
    });
    
    await Send_Message_Smart(
        context,
        `Роль переименована: "${role.name}" → "${newName}"`,
        'admin_solo'
    );
}

async function resetPermissions(context: any, roleId: number) {
    const confirm = await Confirm_User_Success(
        context,
        'сбросить все права у этой роли? (все права станут "выключены")'
    );
    
    if (!confirm.status) {
        await context.send('❌ Сброс отменен.');
        return;
    }
    
    const allPermissions = PERMISSIONS_LIST.map(p => p.key);
    const updateData: any = {};
    for (const key of allPermissions) {
        updateData[key] = false;
    }
    
    await prisma.customRole.update({
        where: { id: roleId },
        data: updateData
    });
    
    await context.send('✅ Все права сброшены.');
}