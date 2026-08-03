// engine/events/module/role_management/role_assigner.ts

import { KeyboardBuilder } from 'vk-io';
import prisma from '../prisma_client';
import { 
    Input_Number,
    Send_Message_Question,
    Send_Message_Smart
} from '../../../core/helper';
import { ico_list } from '../data_center/icons_lib';
import { answerTimeLimit } from '../../../..';

export async function RoleAssigner(context: any, allianceId: number, cursor: number) {
    // ===== ШАГ 1: ВВОД UID =====
    const uid = await Input_Number(
        context,
        `Введите 💳UID банковского счета получателя:`,
        true
    );
    
    if (!uid) {
        await context.send('❌ Выдача роли отменена.');
        return;
    }
    
    // ===== ШАГ 2: ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ =====
    const targetUser = await prisma.user.findFirst({
        where: { 
            id: uid,
            id_alliance: allianceId
        }
    });
    
    if (!targetUser) {
        await context.send(`❌ Пользователь с UID ${uid} не найден в вашем альянсе.`);
        return;
    }
    
    // ===== ШАГ 3: ПОЛУЧАЕМ РОЛИ =====
    const roles = await prisma.customRole.findMany({
        where: { allianceId },
        orderBy: { name: 'asc' }
    });
    
    if (roles.length === 0) {
        await context.send('❌ Нет созданных кастомных ролей. Сначала создайте роль через !права настроить.');
        return;
    }
    
    // ===== ШАГ 4: ПОКАЗЫВАЕМ ТЕКУЩУЮ РОЛЬ =====
    const currentRole = targetUser.customRoleId 
        ? roles.find(r => r.id === targetUser.customRoleId) 
        : null;
    
    let text = `👤 Пользователь: ${targetUser.name} (UID: ${targetUser.id})\n`;
    if (currentRole) {
        text += `👑 Текущая роль: ${currentRole.name}\n\n`;
    } else {
        text += `👑 Текущая роль: не назначена\n\n`;
    }
    text += `Выберите новую роль:`;
    
    // ===== ШАГ 5: ВЫБОР РОЛИ (с пагинацией) =====
    let rolePage = 0;
    const ROLES_PER_PAGE = 5;
    let selectedRole: any = null;
    
    while (!selectedRole) {
        const pageRoles = roles.slice(
            rolePage * ROLES_PER_PAGE,
            (rolePage + 1) * ROLES_PER_PAGE
        );
        const totalPages = Math.ceil(roles.length / ROLES_PER_PAGE);
        
        let roleText = `👤 ${targetUser.name} (UID: ${targetUser.id})\n`;
        if (currentRole) {
            roleText += `👑 Текущая роль: ${currentRole.name}\n\n`;
        } else {
            roleText += `👑 Текущая роль: не назначена\n\n`;
        }
        roleText += `📄 Страница ${rolePage + 1} из ${totalPages}\n\n`;
        
        for (let i = 0; i < pageRoles.length; i++) {
            const role = pageRoles[i];
            const userCount = await prisma.user.count({
                where: { customRoleId: role.id }
            });
            const isSelected = role.id === targetUser.customRoleId;
            roleText += `${isSelected ? '✅' : '👑'} ${role.name} (${userCount} пользователей)\n`;
        }
        
        const keyboard = new KeyboardBuilder();
        
        for (let i = 0; i < pageRoles.length; i++) {
            const role = pageRoles[i];
            const isSelected = role.id === targetUser.customRoleId;
            keyboard.textButton({
                label: `${isSelected ? '✅' : ''} ${role.name.slice(0, 25)}`,
                payload: { 
                    command: 'select_role_assign', 
                    roleId: role.id,
                    userId: targetUser.id,
                    rolePage
                },
                color: isSelected ? 'positive' : 'secondary'
            }).row();
        }
        
        // Навигация
        if (rolePage > 0) {
            keyboard.textButton({
                label: `← Назад`,
                payload: { command: 'roles_prev_assign', rolePage: rolePage - 1, userId: targetUser.id },
                color: 'secondary'
            });
        }
        if (rolePage < totalPages - 1) {
            keyboard.textButton({
                label: `Вперед →`,
                payload: { command: 'roles_next_assign', rolePage: rolePage + 1, userId: targetUser.id },
                color: 'secondary'
            });
        }
        if (rolePage > 0 || rolePage < totalPages - 1) {
            keyboard.row();
        }
        
        // Кнопка снятия роли
        if (currentRole) {
            keyboard.textButton({
                label: `❌ Снять роль`,
                payload: { 
                    command: 'remove_role', 
                    userId: targetUser.id
                },
                color: 'negative'
            }).row();
        }
        
        const response = await Send_Message_Question(context, roleText, keyboard.oneTime());
        
        if (response.exit) return;
        if (!response.payload) continue;
        
        if (response.payload.command === 'roles_prev_assign') {
            rolePage = response.payload.rolePage;
            continue;
        }
        if (response.payload.command === 'roles_next_assign') {
            rolePage = response.payload.rolePage;
            continue;
        }
        if (response.payload.command === 'assign_cancel') {
            await context.send('❌ Выдача роли отменена.');
            return;
        }
        if (response.payload.command === 'remove_role') {
            await removeRoleFromUser(context, response.payload.userId);
            return;
        }
        if (response.payload.command === 'select_role_assign') {
            selectedRole = await prisma.customRole.findFirst({
                where: { id: response.payload.roleId }
            });
        }
    }
    
    if (!selectedRole) return;
    
    // ===== ШАГ 6: НАЗНАЧАЕМ РОЛЬ =====
    await prisma.user.update({
        where: { id: targetUser.id },
        data: { customRoleId: selectedRole.id }
    });
    
    await Send_Message_Smart(
        context,
        `Пользователю ${targetUser.name} (UID: ${targetUser.id}) назначена роль "${selectedRole.name}"`,
        'admin_and_client',
        targetUser
    );
}

async function removeRoleFromUser(context: any, userId: number) {
    const user = await prisma.user.findFirst({
        where: { id: userId }
    });
    
    if (!user) {
        await context.send('❌ Пользователь не найден.');
        return;
    }
    
    const role = user.customRoleId 
        ? await prisma.customRole.findFirst({
            where: { id: user.customRoleId }
        })
        : null;
    
    if (!role) {
        await context.send('❌ У пользователя нет кастомной роли.');
        return;
    }
    
    await prisma.user.update({
        where: { id: userId },
        data: { customRoleId: null }
    });
    
    await Send_Message_Smart(
        context,
        `С пользователя ${user.name} (UID: ${user.id}) снята роль "${role.name}"`,
        'admin_and_client',
        user
    );
}