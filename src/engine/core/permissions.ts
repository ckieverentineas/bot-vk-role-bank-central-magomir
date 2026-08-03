import { User, CustomRole } from '@prisma/client';
import prisma from '../events/module/prisma_client';

export const ACCESS_LEVELS = {
    USER: 0,
    ADMIN: 1,
    ROOT: 2,
};

export type Permission = keyof Omit<CustomRole, 'id' | 'name' | 'allianceId' | 'alliance' | 'createdAt' | 'updatedAt' | 'users'>;

export async function getAccessLevel(user: User | null): Promise<number> {
    if (!user) return ACCESS_LEVELS.USER;
    
    const systemRole = await prisma.role.findFirst({ 
        where: { id: user.id_role } 
    });
    
    if (systemRole?.name === 'root') return ACCESS_LEVELS.ROOT;
    if (systemRole?.name === 'admin') return ACCESS_LEVELS.ADMIN;
    
    return ACCESS_LEVELS.USER;
}

export async function getUserCustomRole(user: User): Promise<CustomRole | null> {
    if (!user.customRoleId) return null;
    return await prisma.customRole.findFirst({
        where: { id: user.customRoleId }
    });
}

export async function hasPermission(
    user: User | null, 
    permission: Permission
): Promise<boolean> {
    if (!user) return false;
    
    const accessLevel = await getAccessLevel(user);
    if (accessLevel === ACCESS_LEVELS.ROOT) return true;
    
    if (accessLevel === ACCESS_LEVELS.ADMIN) {
        const customRole = await getUserCustomRole(user);
        if (customRole) {
            return customRole[permission] === true;
        }
        return true;
    }
    
    const customRole = await getUserCustomRole(user);
    if (customRole) {
        return customRole[permission] === true;
    }
    
    return false;
}

export async function hasAllPermissions(
    user: User | null, 
    permissions: Permission[]
): Promise<boolean> {
    if (!user) return false;
    for (const permission of permissions) {
        if (!(await hasPermission(user, permission))) return false;
    }
    return true;
}

export async function hasAnyPermission(
    user: User | null, 
    permissions: Permission[]
): Promise<boolean> {
    if (!user) return false;
    for (const permission of permissions) {
        if (await hasPermission(user, permission)) return true;
    }
    return false;
}

export async function getUserPermissions(user: User): Promise<Record<Permission, boolean>> {
    const result: Record<Permission, boolean> = {} as any;
    
    const allPermissions: Permission[] = [
        'canMassOperations', 'canMassKick',
        'canManageRoles', 'canManageRolesAssign',
        'canManageShops', 'canManageAbilities', 'canManageSkills',
        'canManageChests', 'canManageLegacy', 'canManageBackgrounds',
        'canManageFacults', 'canManageClassSettings', 'canManageYearEnd',
        'canManageSalary', 'canManageFinance', 'canManageConverter',
        'canManageScoopins', 'canManageMonitors', 'canManageTopics',
        'canViewAllUsers', 'canViewInventoryAll',
        'canEditAllUsers', 'canEditInventoryAll', 'canGiveItemsAll', 'canEditCoins',
        'canUpgradeOthers', 'canAssignAbility', 'canAssignSkill',
        'canAssignShopOwner'
    ];
    
    for (const permission of allPermissions) {
        result[permission] = await hasPermission(user, permission);
    }
    
    return result;
}

export async function isAdmin(user: User | null): Promise<boolean> {
    if (!user) return false;
    const level = await getAccessLevel(user);
    return level >= ACCESS_LEVELS.ADMIN;
}

export async function isRoot(user: User | null): Promise<boolean> {
    if (!user) return false;
    const level = await getAccessLevel(user);
    return level === ACCESS_LEVELS.ROOT;
}