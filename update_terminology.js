const fs = require('fs');
const path = require('path');

// Файлы для обновления (относительные пути от текущей директории)
const filesToUpdate = [
    'src/engine/events/module/converter.ts',
    'src/engine/events/module/info.ts',
    'src/engine/events/module/alliance/alliance_converter_editor.ts',
    'src/engine/events/module/alliance/alliance_menu.ts',
    'src/engine/events/module/alliance/alliance_rank.ts',
    'src/engine/events/module/alliance/alliance_year_end.ts',
    'src/engine/events/module/alliance/monitor.ts',
    'src/engine/events/module/person/person.ts',
    'src/engine/events/module/rank/rank_alliance.ts',
    'src/engine/events/module/shop/alliance_shop_client.ts',
    'src/engine/events/module/tranzaction/operation_group.ts',
    'src/engine/events/module/tranzaction/operation_solo.ts',
    'src/engine/events/module/tranzaction/operation_sub.ts',
    'src/engine/events/module/tranzaction/person_editor.ts',
    'src/engine/player.ts',
    'src/engine/core/helper.ts'
];

// Шаблоны замены
const replacements = [
    // Простые замены
    { pattern: /факультет\b/gi, replacement: 'terminology.singular' },
    { pattern: /факультеты\b/gi, replacement: 'terminology.plural' },
    { pattern: /факультета\b/gi, replacement: 'terminology.genitive' },
    { pattern: /факультету\b/gi, replacement: 'terminology.dative' },
    { pattern: /факультетом\b/gi, replacement: 'terminology.instrumental' },
    { pattern: /факультете\b/gi, replacement: 'terminology.prepositional' },
    { pattern: /факультетов\b/gi, replacement: 'terminology.plural_genitive' },
    { pattern: /Факультет\b/g, replacement: 'terminology.singular.charAt(0).toUpperCase() + terminology.singular.slice(1)' },
    { pattern: /Факультеты\b/g, replacement: 'terminology.plural.charAt(0).toUpperCase() + terminology.plural.slice(1)' },
];

// Специальные замены для контекстных строк
const contextualReplacements = [
    // Для person.ts
    { 
        file: 'src/engine/events/module/person/person.ts',
        patterns: [
            { 
                pattern: /let event_logger = `\$\{ico_list\['facult'\]\.ico\} Выберите факультет в/,
                replacement: 'let event_logger = `${ico_list[\'facult\'].ico} Выберите ${terminology.accusative} в`'
            },
            {
                pattern: /event_logger \+= `\\n\\n\$\{ico_list\['facult'\]\.ico\} Ролевой факультет №/,
                replacement: 'event_logger += `\\n\\n${ico_list[\'facult\'].ico} Ролевой ${terminology.singular} №`'
            },
            {
                pattern: /keyboard\.textButton\(\{ label: 'Нафиг учебу', payload: \{ command: 'builder_control_multi', target: \{ id: 0, name: 'Без факультета'/,
                replacement: 'keyboard.textButton({ label: \'Нафиг учебу\', payload: { command: \'builder_control_multi\', target: { id: 0, name: `Без ${terminology.genitive}`'
            },
            {
                pattern: /event_logger = `\$\{ico_list\['warn'\]\.ico\} Вы еще не открыли факультеты/,
                replacement: 'event_logger = `${ico_list[\'warn\'].ico} Вы еще не открыли ${terminology.plural}`'
            },
            {
                pattern: /Время ожидания выбора факультета истекло!/,
                replacement: 'Время ожидания выбора ${terminology.genitive} истекло!'
            }
        ]
    },
    // Для info.ts
    {
        file: 'src/engine/events/module/info.ts',
        patterns: [
            {
                pattern: /Факультет: \$\{facult_get \? facult_get\.name : `Без факультета`\}/,
                replacement: '${terminology.singular.charAt(0).toUpperCase() + terminology.singular.slice(1)}: ${facult_get ? facult_get.name : `Без ${terminology.genitive}`}'
            }
        ]
    },
    // Для alliance_rank.ts
    {
        file: 'src/engine/events/module/alliance/alliance_rank.ts',
        patterns: [
            {
                pattern: /на факультете \[/,
                replacement: 'на ${terminology.prepositional} ['
            },
            {
                pattern: /на факультете /,
                replacement: 'на ${terminology.prepositional} '
            }
        ]
    }
];

function updateFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`Файл не найден: ${filePath}`);
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Добавляем импорт если его нет
        if (!content.includes('from "./alliance/terminology_helper"') && 
            !content.includes('from "../alliance/terminology_helper"') &&
            !content.includes('from "../../alliance/terminology_helper"')) {
            
            // Определяем путь для импорта
            let importPath = '';
            if (filePath.includes('/alliance/')) {
                importPath = './terminology_helper';
            } else if (filePath.includes('/module/')) {
                importPath = './alliance/terminology_helper';
            } else if (filePath.includes('/events/')) {
                importPath = './module/alliance/terminology_helper';
            }
            
            if (importPath) {
                // Добавляем импорт после последнего импорта
                const importMatch = content.match(/(import.*\n)+/);
                if (importMatch) {
                    const lastImportEnd = importMatch[0].lastIndexOf('\n') + 1;
                    content = content.slice(0, lastImportEnd) + 
                             `import { getTerminology } from "${importPath}";\n` + 
                             content.slice(lastImportEnd);
                }
            }
        }
        
        // Применяем специальные контекстные замены
        const fileSpecific = contextualReplacements.find(f => f.file === filePath);
        if (fileSpecific) {
            fileSpecific.patterns.forEach(({ pattern, replacement }) => {
                content = content.replace(pattern, replacement);
            });
        }
        
        // Применяем общие замены
        replacements.forEach(({ pattern, replacement }) => {
            content = content.replace(pattern, `\${${replacement}}`);
        });
        
        // Добавляем получение терминологии в функции, где это необходимо
        if (content.includes('terminology.') && !content.includes('const terminology = await getTerminology')) {
            // Ищем функции async
            const functionRegex = /async function (\w+)|const (\w+) = async \(/g;
            let match;
            while ((match = functionRegex.exec(content)) !== null) {
                const functionName = match[1] || match[2];
                // Ищем место после открытия функции
                const functionStart = content.indexOf(match[0]);
                const bodyStart = content.indexOf('{', functionStart) + 1;
                
                // Вставляем получение терминологии в начало функции
                if (bodyStart > 0) {
                    const before = content.slice(0, bodyStart);
                    const after = content.slice(bodyStart);
                    
                    // Проверяем, есть ли уже alliance или user в функции
                    if (content.includes('alliance') || content.includes('user') || content.includes('alli_get')) {
                        const terminologyInsert = `\n    const terminology = await getTerminology(alliance?.id || alli_get?.id || user?.id_alliance || 0);`;
                        content = before + terminologyInsert + after;
                        break;
                    }
                }
            }
        }
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Обновлен: ${filePath}`);
        } else {
            console.log(`○ Без изменений: ${filePath}`);
        }
    } catch (error) {
        console.error(`✗ Ошибка при обновлении ${filePath}:`, error.message);
    }
}

// Создаем терминологию хелпер если его нет
const helperPath = path.join(__dirname, 'src/engine/events/module/alliance/terminology_helper.ts');
if (!fs.existsSync(helperPath)) {
    console.log('Создаю файл terminology_helper.ts...');
    const helperContent = `import prisma from "../prisma_client";

export interface AllianceTerminology {
    singular: string;        // факультет
    plural: string;         // факультеты
    genitive: string;       // факультета
    dative: string;         // факультету
    accusative: string;     // факультет
    instrumental: string;   // факультетом
    prepositional: string;  // факультете
    plural_genitive: string; // факультетов
}

export async function getTerminology(allianceId: number): Promise<AllianceTerminology> {
    const terminology = await prisma.allianceTerminology.findFirst({ 
        where: { id_alliance: allianceId } 
    });
    
    if (!terminology) {
        // Возвращаем значения по умолчанию
        return {
            singular: "факультет",
            plural: "факультеты",
            genitive: "факультета",
            dative: "факультету",
            accusative: "факультет",
            instrumental: "факультетом",
            prepositional: "факультете",
            plural_genitive: "факультетов"
        };
    }
    
    return {
        singular: terminology.singular,
        plural: terminology.plural,
        genitive: terminology.genitive,
        dative: terminology.dative,
        accusative: terminology.accusative,
        instrumental: terminology.instrumental,
        prepositional: terminology.prepositional,
        plural_genitive: terminology.plural_genitive
    };
}

export async function getTerminologyByUser(user: any): Promise<AllianceTerminology> {
    if (!user || !user.id_alliance) {
        return getTerminology(0);
    }
    return await getTerminology(user.id_alliance);
}

// Функции-помощники для конкретных падежей
export async function getSingular(allianceId: number): Promise<string> {
    const term = await getTerminology(allianceId);
    return term.singular;
}

export async function getPlural(allianceId: number): Promise<string> {
    const term = await getTerminology(allianceId);
    return term.plural;
}

export async function getGenitive(allianceId: number): Promise<string> {
    const term = await getTerminology(allianceId);
    return term.genitive;
}

export async function getPrepositional(allianceId: number): Promise<string> {
    const term = await getTerminology(allianceId);
    return term.prepositional;
}

export async function getAccusative(allianceId: number): Promise<string> {
    const term = await getTerminology(allianceId);
    return term.accusative;
}

// Функция для форматирования фраз с заменой
export function formatWithTerminology(text: string, terminology: AllianceTerminology): string {
    return text
        .replace(/факультет\\b/gi, terminology.singular)
        .replace(/факультеты\\b/gi, terminology.plural)
        .replace(/факультета\\b/gi, terminology.genitive)
        .replace(/факультету\\b/gi, terminology.dative)
        .replace(/факультетом\\b/gi, terminology.instrumental)
        .replace(/факультете\\b/gi, terminology.prepositional)
        .replace(/факультетов\\b/gi, terminology.plural_genitive);
}`;
    
    // Создаем директорию если ее нет
    const dir = path.dirname(helperPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(helperPath, helperContent, 'utf8');
    console.log('✓ Создан terminology_helper.ts');
}

// Запускаем обновление файлов
console.log('Начинаю обновление файлов...\n');
filesToUpdate.forEach(filePath => {
    updateFile(path.join(__dirname, filePath));
});

console.log('\n=== РУЧНЫЕ ИСПРАВЛЕНИЯ ===');
console.log('1. В каждом обновленном файле проверьте переменные:');
console.log('   - Убедитесь что alliance, alli_get или user доступны в функции');
console.log('   - Если нет, добавьте получение allianceId другим способом');
console.log('\n2. Проверьте строки с использованием терминологии:');
console.log('   - Некоторые замены могут требовать ручной корректировки');
console.log('   - Особенно в сложных шаблонных строках');
console.log('\n3. После обновления запустите:');
console.log('   npx prisma db push');
console.log('   npm run build');