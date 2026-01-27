import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
    try {
        console.log('Checking database structure...');
        
        // 1. Проверить таблицу CategoryChest
        const tableInfo = await prisma.$queryRaw`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='CategoryChest'
        `;
        
        console.log('\n=== CategoryChest Table Definition ===');
        console.log(JSON.stringify(tableInfo, null, 2));
        
        // 2. Проверить все индексы таблицы
        const indexes = await prisma.$queryRaw`
            SELECT name, sql FROM sqlite_master 
            WHERE type='index' AND tbl_name='CategoryChest'
        `;
        
        console.log('\n=== CategoryChest Indexes ===');
        console.log(JSON.stringify(indexes, null, 2));
        
        // 3. Проверить данные в таблице
        const data = await prisma.categoryChest.findMany({
            include: {
                chest: true
            }
        });
        
        console.log('\n=== CategoryChest Data ===');
        data.forEach(item => {
            console.log(`ID: ${item.id}, CategoryID: ${item.id_category}, Chest: ${item.chest?.name} (ID: ${item.id_chest})`);
        });
        
    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();