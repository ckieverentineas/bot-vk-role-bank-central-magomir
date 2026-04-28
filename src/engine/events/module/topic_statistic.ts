import prisma from "./prisma_client";
import { Calc_Bonus_Activity } from "./alliance/monitor";
import { applyMonitorTopicSettings, getTopicRewardCoinId } from "./topic_monitor_settings";

// Рассчитывает статистику поста ТОЧНО как в пкметре
export function calculatePostStats(text: string): {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  pc: number;
  mb: number;
  sentences: number;
  postPercentage: number;
  commentPercentage: number;
  discussionPercentage: number;
} {
    if (!text || text.trim().length === 0) {
        return {
            characters: 0,
            charactersNoSpaces: 0,
            words: 0,
            pc: 0,
            mb: 0,
            sentences: 0,
            postPercentage: 0,
            commentPercentage: 0,
            discussionPercentage: 0
        };
    }
    
    // 1. Общее количество символов (как в пкметре: "Cимволов:")
    const characters = text.length;
    
    // 2. Символы без пробелов (как в пкметре: "Cимволов без пробелов:")
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    
    // 3. Слова (как в пкметре: "Cлов:")
    // Используем ту же логику, что и в Counter_PK_Module
    let passedString = text;
    passedString = passedString.replace(/(^\s*)|(\s*$)/gi, '');
    passedString = passedString.replace(/\s\s+/g, ' '); 
    passedString = passedString.replace(/,/g, ' ');  
    passedString = passedString.replace(/;/g, ' ');
    passedString = passedString.replace(/\//g, ' ');  
    passedString = passedString.replace(/\\/g, ' ');  
    passedString = passedString.replace(/{/g, ' ');
    passedString = passedString.replace(/}/g, ' ');
    passedString = passedString.replace(/\n/g, ' ');  
    passedString = passedString.replace(/\./g, ' '); 
    passedString = passedString.replace(/[\{\}]/g, ' ');
    passedString = passedString.replace(/[\(\)]/g, ' ');
    passedString = passedString.replace(/[[\]]/g, ' ');
    passedString = passedString.replace(/[ ]{2,}/gi, ' ');
    const wordsArray = passedString.trim().split(/\s+/);
    const words = wordsArray.length;
    
    // 4. ПК и МБ (как в пкметре) - ДВА ЗНАКА ПОСЛЕ ЗАПЯТОЙ
    const pc = characters / 102;
    const mb = characters / 35;
    
    // 5. Предложения (как в пкметре)
    const sentencesMatch = text.match(/[^.!?]+[.!?]+/g);
    const sentences = sentencesMatch ? sentencesMatch.length : 0;
    
    // 6. Проценты (как в пкметре)
    const postPercentage = (characters / 16384 * 100);
    const commentPercentage = (characters / 280 * 100);
    const discussionPercentage = (characters / 4096 * 100);

    return {
        characters,
        charactersNoSpaces,
        words,
        pc: parseFloat(pc.toFixed(2)), // Два знака как в пкметре
        mb: parseFloat(mb.toFixed(2)),
        sentences,
        postPercentage: parseFloat(postPercentage.toFixed(2)),
        commentPercentage: parseFloat(commentPercentage.toFixed(2)),
        discussionPercentage: parseFloat(discussionPercentage.toFixed(2))
    };
}

// Получаем количество ПК строк ДЛЯ ПРОВЕРКИ (округляем ВНИЗ)
export function getPcLinesForCheck(pc: number): number {
    return Math.floor(pc);
}

// Получаем количество ПК строк ДЛЯ ОТОБРАЖЕНИЯ (с двумя знаками)
export function getPcLinesForDisplay(pc: number): number {
    return parseFloat(pc.toFixed(2));
}

// Рассчитывает награду за пост
export function calculateReward(topicMonitor: any, characters: number): number {
    if (!topicMonitor.rewardEnabled) return 0;
    
    const pcLines = getPcLinesForCheck(characters / 102);
    console.log(`🎯 Расчет награды: символы=${characters}, ПК=${(characters/102).toFixed(2)}, ПК строк=${pcLines}, минимально требуется: ${topicMonitor.rewardMinLines || 1}`);
    
    // Проверяем минимальное количество ПК строк для награды - если 0, награждаем любые посты
    if (topicMonitor.rewardMinLines && topicMonitor.rewardMinLines > 0 && pcLines < topicMonitor.rewardMinLines) {
        console.log(`⚠ Недостаточно ПК строк для награды: ${pcLines} < ${topicMonitor.rewardMinLines}`);
        return 0;
    }

    let rewardAmount = 0;

    if (topicMonitor.uniformReward) {
        // Единая награда
        rewardAmount = topicMonitor.uniformReward;
        console.log(`💰 Единая награда: ${rewardAmount}`);
    } else if (topicMonitor.linesRewards) {
        // Награда за ПК строки
        const rewards = parseLinesRewards(topicMonitor.linesRewards);
        console.log(`📊 Настроенные награды за строки:`, rewards);
        
        if (rewards.length > 0) {
            // Сортируем по убыванию lines, чтобы найти самую большую подходящую награду
            const sortedRewards = [...rewards].sort((a, b) => b.lines - a.lines);
            
            // Находим подходящую награду (самую большую, для которой хватает строк)
            for (const rewardConfig of sortedRewards) {
                if (pcLines >= rewardConfig.lines) {
                    rewardAmount = rewardConfig.reward;
                    console.log(`💰 Награда за ${pcLines} ПК строк (требуется ${rewardConfig.lines}): ${rewardAmount}`);
                    break;
                }
            }
            
            if (rewardAmount === 0) {
                console.log(`⚠ Не найдено подходящей награды для ${pcLines} ПК строк`);
            }
        } else {
            console.log(`⚠ Массив наград пуст`);
        }
    } else {
        console.log(`⚠ Награды не настроены (uniformReward и linesRewards отсутствуют)`);
    }

    return rewardAmount;
}

// Парсим JSON из строки
export function parseLinesRewards(jsonString: string | null): Array<{lines: number, reward: number}> {
    if (!jsonString) return [];
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error(`❌ Ошибка парсинга linesRewards: ${e}`);
        return [];
    }
}

// Сериализуем в строку
export function serializeLinesRewards(rewards: Array<{lines: number, reward: number}>): string {
    return JSON.stringify(rewards);
}

// Старая функция для совместимости
export async function rewardForPost(
    topicMonitor: any, 
    userId: number,
    postId: number,
    characters: number,
    monitor: any
): Promise<number> {
    console.warn('⚠ Функция rewardForPost устарела');
    const effectiveTopicMonitor = applyMonitorTopicSettings(topicMonitor, monitor);
    const rewardAmount = calculateReward(effectiveTopicMonitor, characters);
    
    if (rewardAmount > 0) {
        try {
            // Обновляем запись статистики
            await prisma.postStatistic.update({
                where: {
                    topicMonitorId_postId: {
                        topicMonitorId: topicMonitor.id,
                        postId: postId
                    }
                },
                data: {
                    rewardGiven: true,
                    rewardAmount: rewardAmount
                }
            });
            
            console.log(`✅ Статистика обновлена: награда ${rewardAmount} отмечена`);
            
            // Получаем пользователя
            const user = await prisma.user.findFirst({
                where: { id: userId }
            });
            
            if (!user) {
                console.error(`❌ Пользователь с ID ${userId} не найден`);
                return 0;
            }
            
            // Начисляем награду
            await Calc_Bonus_Activity(
                user.idvk,
                '+',
                rewardAmount,
                'ролевой пост',
                `https://vk.com/topic${monitor.idvk}_${topicMonitor.topicId}?post=${postId}`,
                { ...monitor, id_coin: getTopicRewardCoinId(monitor) }
            );
            
            console.log(`✅ Награда ${rewardAmount} начислена пользователю ${user.name} (${user.idvk})`);
            
            return rewardAmount;
            
        } catch (error) {
            console.error(`❌ Ошибка при начислении награды: ${error}`);
            return 0;
        }
    }

    return 0;
}
