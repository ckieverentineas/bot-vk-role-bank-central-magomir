const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateChests() {
    console.log('🚀 Начинаем миграцию системы сундуков...');
    
    // 1. Получаем все альянсы
    const alliances = await prisma.alliance.findMany();
    
    for (const alliance of alliances) {
        console.log(`📦 Обрабатываем альянс: ${alliance.name} (ID: ${alliance.id})`);
        
        // 2. Создаем сундук "Основное" для альянса
        const mainChest = await prisma.allianceChest.create({
            data: {
                name: "Основное",
                id_alliance: alliance.id,
                id_parent: null,
                order: 0
            }
        });
        
        console.log(`   ✅ Создан сундук "Основное" (ID: ${mainChest.id})`);
        
        // 3. Находим всех пользователей альянса
        const users = await prisma.user.findMany({
            where: { id_alliance: alliance.id }
        });
        
        console.log(`   👥 Найдено пользователей: ${users.length}`);
        
        // 4. Для каждого пользователя привязываем все его предметы к "Основное"
        let totalItems = 0;
        
        for (const user of users) {
            const inventories = await prisma.inventory.findMany({
                where: { id_user: user.id }
            });
            
            for (const inv of inventories) {
                await prisma.chestItemLink.create({
                    data: {
                        id_chest: mainChest.id,
                        id_inventory: inv.id
                    }
                });
                totalItems++;
            }
        }
        
        console.log(`   📦 Привязано предметов: ${totalItems}`);
    }
    
    console.log('✅ Миграция завершена успешно!');
}

migrateChests()
    .catch(e => {
        console.error('❌ Ошибка миграции:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });