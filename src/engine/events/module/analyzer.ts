import { Analyzer, User } from "@prisma/client"
import prisma from "./prisma_client"
import { randomInt } from "crypto"
import { chat_id, vk } from "../../.."
import { Person_Get } from "./person/person"
import { Logger } from "../../core/helper"

export async function Analyzer_Init(id_user: number) {
    const analyzer: Analyzer | null = await prisma.analyzer.findFirst({ where: { id_user: id_user } })
    if (!analyzer) {
        const analyze_init: Analyzer | null = await prisma.analyzer.create({ data: { id_user: id_user } })
        if (analyze_init) { console.log(`Analyzer module activation for user UID ${id_user}`) }
    }
}

interface Achivied {
    uid: number,
    name: string,
    subname: String[]
    description: string,
    counter: number
}

export async function Analyzer_Birthday_Counter(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const id_user = user.id
    await Analyzer_Init(id_user)
    const analyzer: Analyzer | null = await prisma.analyzer.findFirst({ where: { id_user: id_user } })
    const birthday: Achivied[] = [
        { uid: 1, name: "Ученик", subname: ["Новичок", "Маленький Маг", "Ботаник"], description: "Награда по достижению 1 года в ролевой", counter: 1 }, 
        { uid: 2, name: "Первокурсник", subname: ["Молодой Чародей", "Надежда Хогвартса", "Избранник"], description: "Награда по достижению 2 года в ролевой", counter: 2 },
        { uid: 3, name: "Второкурсник", subname: ["Блестящий Ученик", "Одаренный Маг", "Мастер Иллюзий"], description: "Награда по достижению 3 года в ролевой", counter: 3 },
        { uid: 4, name: "Третьекурсник", subname: ["Талантливый Волшебник", "Мастер Чародейства", "Охотник на Сокровища"], description: "Награда по достижению 4 года в ролевой", counter: 4 },
        { uid: 5, name: "Четвертокурсник", subname: ["Покровитель Знаний", "Мастер Заклинаний", "Владыка Интриг"], description: "Награда по достижению 5 года в ролевой", counter: 5 },
        { uid: 6, name: "Пятёркокурсник", subname: ["Герой Хогвартса", "Магистр Трансфигурации", "Чародей-Исследователь"], description: "Награда по достижению 6 года в ролевой", counter: 6 },
        { uid: 7, name: "Шестикурсник", subname: ["Маг Совершенства", "Повелитель Элементов", "Мастер Артефактов"], description: "Награда по достижению 7 года в ролевой", counter: 7 },
        { uid: 8, name: "Седьмикурсник", subname: ["Герой Войны", "Магистр Яда", "Воитель Света"], description: "Награда по достижению 8 года в ролевой", counter: 8 },
        { uid: 9, name: "Абсолютный Чемпион Хогвартса", subname: ["Неукротимый Лидер", "Повелитель Тьмы", "Маг Великого Уровня"], description: "Награда по достижению 9 года в ролевой", counter: 9 },
        { uid: 10, name: "Магистр Закона", subname: ["Воплощение Справедливости", "Чемпион Ордена Феникса", "Покровитель Мира"], description: "Награда по достижению 10 года в ролевой", counter: 10 },
        { uid: 11, name: "Владыка Заклинаний", subname: ["Магистр Огня", "Повелитель Времени", "Покровитель Магии"], description: "Награда по достижению 11 года в ролевой", counter: 11 },
        { uid: 12, name: "Маг-Странник", subname: ["Покоритель Бездны", "Владыка Ночи", "Мастер Тайн"], description: "Награда по достижению 12 года в ролевой", counter: 12 },
        { uid: 13, name: "Хранитель Равновесия", subname: ["Магистр Баланса", "Владыка Стихий", "Покровитель Природы"], description: "Награда по достижению 13 года в ролевой", counter: 13 },
        { uid: 14, name: "Герой Легенды", subname: ["Мастер Легендарных Искусств", "Повелитель Миров", "Чемпион Хаоса"], description: "Награда по достижению 14 года в ролевой", counter: 14 },
        { uid: 15, name: "Волшебный Король", subname: ["Легендарный Маг", "Правитель Волшебного Мира", "Властелин Тайн"], description: "Награда по достижению 15 года в ролевой", counter: 15 },
    ]
    if (analyzer) {
        const analyze_birthday_counter: Analyzer | null = await prisma.analyzer.update({ where: { id: analyzer.id }, data: { birthday: { increment: 1 } } })
        if (analyze_birthday_counter) { 
            console.log(`Analyzer module detected birthday for user UID ${id_user}`)
            for (const i in birthday) {
                if (analyze_birthday_counter.birthday >= birthday[i].counter) {
                    const achive_check = await prisma.achievement.findFirst({ where: { uid: birthday[i].uid, id_user: id_user } })
                    if (!achive_check) {
                        const achive_add = await prisma.achievement.create({ data: { uid: birthday[i].uid, name: `🎁 ${birthday[i].name} - ${birthday[i].subname[randomInt(0, 3)]}`, id_user: id_user } })
                        if (achive_add) {
                            const xp = randomInt(1, 15)
                            await prisma.user.update({ where: { id: id_user }, data: { medal: { increment: xp } } })
                            await vk?.api.messages.send({
                                peer_id: user.idvk,
                                random_id: 0,
                                message: `🌟 Получено достижение:\n${achive_add.name}`
                            })
                            await vk?.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `🌟 @id${user.idvk}(${user.name}) (UID: ${user.id}) выполняет достижение:\n${achive_add.name} и получает на счет ${xp}🧙.`
                            })
                        }
                    }
                }
            }
        }
    }
}

export async function Analyzer_Kvass_Counter(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const id_user = user.id
    await Analyzer_Init(id_user)
    const analyzer: Analyzer | null = await prisma.analyzer.findFirst({ where: { id_user: id_user } })
    const birthday: Achivied[] = [
        { uid: 16, name: "Новичок", subname: ["Низкий старт", "Повышенный градус", "Кайфулечки"], description: "Первое сливочное пиво", counter: 1 }, 
        { uid: 17, name: "Знаток", subname: ["Знаток", "Искушенный", "Опытный"], description: "Пять сливочных пив", counter: 5 },
        { uid: 18, name: "Эксперт", subname: ["Эксперт", "Мастер", "Продвинутый"], description: "Десять сливочных пив", counter: 10 },
        { uid: 19, name: "Маг", subname: ["Маг", "Чародей", "Волшебник"], description: "Пятнадцать сливочных пив", counter: 15 },
        { uid: 20, name: "Винодел", subname: ["Сварщик", "Мастер дегустации", "Продвинутый сомелье"], description: "Двадцать пять сливочных пив", counter: 20 },
        { uid: 21, name: "Хозяин винодельни", subname: ["Бухлозавр", "Магистр виноделия", "Король виноделов"], description: "Пятьдесят сливочных пив", counter: 25 },
        { uid: 22, name: "Сомелье", subname: ["Любитель", "Мастер-сомелье", "Король сомелье"], description: "Сто сливочных пив", counter: 30 },
        { uid: 23, name: "Почетный клиент", subname: ["Почетный клиент", "Любитель вина", "Винный гурман"], description: "Двести сливочных пив", counter: 50 },
        { uid: 24, name: "Винный магнат", subname: ["Винный магнат", "Богатый винодел", "Император виноделия"], description: "Четыреста сливочных пив", counter: 60 },
        { uid: 25, name: "Винный гуру", subname: ["Винный гуру", "Мастер-гурман", "Легенда вина"], description: "Восемьсот сливочных пив", counter: 70 },
        { uid: 26, name: "Винный магистр", subname: ["Винный магистр", "Магистр виноделия", "Крылатый винодел"], description: "Тысяча двести сливочных пив", counter: 80 },
        { uid: 27, name: "Винный король", subname: ["Винный король", "Король виноделия", "Винный бог"], description: "Две тысячи пятьсот сливочных пив", counter: 90 },
        { uid: 28, name: "Винный император", subname: ["Винный император", "Император виноделия", "Всемогущий винодел"], description: "Пять тысяч сливочных пив", counter: 100 },
        { uid: 29, name: "Винный бог", subname: ["Винный бог", "Бог виноделия", "Всевышний винодел"], description: "Десять тысяч сливочных пив", counter: 120 },
        { uid: 30, name: "Винный титан", subname: ["Винный титан", "Титан виноделия", "Непобедимый винодел"], description: "Двадцать тысяч сливочных пив", counter: 150 },
    ]
    if (analyzer) {
        const analyze_birthday_counter: Analyzer | null = await prisma.analyzer.update({ where: { id: analyzer.id }, data: { beer: { increment: 1 } } })
        if (analyze_birthday_counter) { 
            await Logger(`In a analyzer, module detected kvass for user UID ${id_user} by user ${context.peerId}`)
            for (const i in birthday) {
                if (analyze_birthday_counter.beer >= birthday[i].counter) {
                    const achive_check = await prisma.achievement.findFirst({ where: { uid: birthday[i].uid, id_user: id_user } })
                    if (!achive_check) {
                        const achive_add = await prisma.achievement.create({ data: { uid: birthday[i].uid, name: `🥃 ${birthday[i].name} - ${birthday[i].subname[randomInt(0, 3)]}`, id_user: id_user } })
                        if (achive_add) {
                            const xp = randomInt(1, 15)
                            await prisma.user.update({ where: { id: id_user }, data: { medal: { increment: xp } } })
                            await vk?.api.messages.send({
                                peer_id: user.idvk,
                                random_id: 0,
                                message: `🌟 Получено достижение:\n${achive_add.name}`
                            })
                            await vk?.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `🌟 @id${user.idvk}(${user.name}) (UID: ${user.id}) выполняет достижение:\n${achive_add.name} и получает на счет ${xp}🔘.`
                            })
                        }
                    }
                }
            }
        }
    }
}

export async function Analyzer_Convert_MO_Counter(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const id_user = user.id
    await Analyzer_Init(id_user)
    const analyzer: Analyzer | null = await prisma.analyzer.findFirst({ where: { id_user: id_user } })
    const birthday: Achivied[] = [
        { uid: 76, name: "Новичок в конвертации", subname: ["Малоопытный", "Опытный", "Профессионал"], description: "Конвертируйте свой первый магический опыт в галеоны. Достигните указанного количества галеонов, чтобы получить достижение.", counter: 1 },
        { uid: 77, name: "Магический обменник", subname: ["Надежный обменник", "Опытный обменник", "Профессиональный обменник"], description: "Конвертируйте свой магический опыт в галеоны на регулярной основе. Достигните указанного количества конвертаций, чтобы получить достижение.", counter: 5 },
        { uid: 78, name: "Магический экономист", subname: ["Начальный уровень", "Базовый уровень", "Продвинутый уровень"], description: "Увеличивайте свой доход в игре, конвертируя больше магического опыта в галеоны. Достигните указанного количества галеонов, чтобы получить достижение.", counter: 10 },
        { uid: 79, name: "Магический магнат", subname: ["Начинающий магнат", "Опытный магнат", "Профессиональный магнат"], description: "Станьте богатым и влиятельным в игре, конвертируя огромные объемы магического опыта в галеоны. Достигните указанного объема накоплений, чтобы получить достижение.", counter: 15 },
        { uid: 80, name: "Магический миллионер", subname: ["Начинающий миллионер", "Опытный миллионер", "Профессиональный миллионер"], description: "Заработайте миллионы галеонов, конвертируя магический опыт в галеоны. Достигните указанного объема накоплений, чтобы получить достижение.", counter: 25 },
        { uid: 81, name: "Магический магнат-инвестор", subname: ["Начинающий магнат-инвестор", "Опытный магнат-инвестор", "Профессиональный магнат-инвестор"], description: "Инвестируйте свои галеоны и получайте еще больше магического опыта для конвертации. Достигните указанного объема вложений, чтобы получить достижение.", counter: 50 },
        { uid: 82, name: "Магический банкир", subname: ["Начинающий банкир", "Опытный банкир", "Профессиональный банкир"], description: "Управляйте своими финансами в игре как профессионал, конвертируя магический опыт и инвестируя свои галеоны. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 100 },
        { uid: 83, name: "Магический магнат-бизнесмен", subname: ["Начинающий магнат-бизнесмен", "Опытный магнат-бизнесмен", "Профессиональный магнат-бизнесмен"], description: "Откройте свой собственный бизнес в игре и зарабатывайте миллионы галеонов, конвертируя магический опыт в галеоны. Достигните указанного уровня бизнес-мастерства, чтобы получить достижение.", counter: 200 },
        { uid: 84, name: "Магический магнат-магистр", subname: ["Начинающий магнат-магистр", "Опытный магнат-магистр", "Профессиональный магнат-магистр"], description: "Станьте магистром в конвертации магического опыта в галеоны, заработайте огромное количество галеонов и получите уникальные награды. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 400 },
        { uid: 85, name: "Магический магнат-император", subname: ["Начинающий магнат-император", "Опытный магнат-император", "Профессиональный магнат-император"], description: "Станьте императором в конвертации магического опыта в галеоны, заработайте невероятные богатства и получите самые редкие и ценные награды. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 800 },
        { uid: 86, name: "Магический магистр-волшебник", subname: ["Начинающий магистр-волшебник", "Опытный магистр-волшебник", "Профессиональный магистр-волшебник"], description: "Станьте магистром в конвертации магического опыта в галеоны и волшебства, достигнув высокого уровня мастерства. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 1200 },
        { uid: 87, name: "Магический магистр-алхимик", subname: ["Начинающий магистр-алхимик", "Опытный магистр-алхимик", "Профессиональный магистр-алхимик"], description: "Станьте магистром в алхимии и конвертации магического опыта в галеоны, достигнув высокого уровня мастерства. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 2500 },
        { uid: 88, name: "Магический магистр-чародей", subname: ["Начинающий магистр-чародей", "Опытный магистр-чародей", "Профессиональный магистр-чародей"], description: "Станьте магистром в чародействе и конвертации магического опыта в галеоны, достигнув высокого уровня мастерства. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 5000 },
        { uid: 89, name: "Магический властелин", subname: ["Начинающий властелин", "Опытный властелин", "Профессиональный властелин"], description: "Станьте властелином в конвертации магического опыта в галеоны, достигнув высшего уровня мастерства. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 10000 },
        { uid: 90, name: "Магический богатырь", subname: ["Начинающий богатырь", "Опытный богатырь", "Профессиональный богатырь"], description: "Станьте легендарным в конвертации магического опыта в галеоны, достигнув невероятного уровня мастерства. Достигните указанного уровня мастерства, чтобы получить достижение.", counter: 20000 }
    ]
    if (analyzer) {
        const analyze_birthday_counter: Analyzer | null = await prisma.analyzer.update({ where: { id: analyzer.id }, data: { convert_mo: { increment: 1 } } })
        if (analyze_birthday_counter) { 
            console.log(`Analyzer module detected convert MO for user UID ${id_user}`)
            for (const i in birthday) {
                if (analyze_birthday_counter.convert_mo >= birthday[i].counter) {
                    const achive_check = await prisma.achievement.findFirst({ where: { uid: birthday[i].uid, id_user: id_user } })
                    if (!achive_check) {
                        const achive_add = await prisma.achievement.create({ data: { uid: birthday[i].uid, name: `✨ ${birthday[i].name} - ${birthday[i].subname[randomInt(0, 3)]}`, id_user: id_user } })
                        if (achive_add) {
                            const xp = randomInt(1, 15)
                            await prisma.user.update({ where: { id: id_user }, data: { medal: { increment: xp } } })
                            await vk?.api.messages.send({
                                peer_id: user.idvk,
                                random_id: 0,
                                message: `🌟 Получено достижение:\n${achive_add.name}`
                            })
                            await vk?.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `🌟 @id${user.idvk}(${user.name}) (UID: ${user.id}) выполняет достижение:\n${achive_add.name} и получает на счет ${xp}🧙.`
                            })
                        }
                    }
                }
            }
        }
    }
}

export async function Analyzer_Buying_Counter(context: any) {
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const id_user = user.id
    await Analyzer_Init(id_user)
    const analyzer: Analyzer | null = await prisma.analyzer.findFirst({ where: { id_user: id_user } })
    const birthday: Achivied[] = [
        { uid: 91, name: "Первая покупка", subname: ["Маленький шаг", "Начальный этап", "Путь к успеху"], description: "Совершите свою первую покупку в косом переулке.", counter: 1 },
        { uid: 92, name: "Покупка года", subname: ["Лучшая покупка", "Покупка года", "Самая крутая покупка"], description: "Купите самый дорогой предмет в косом переулке.", counter: 5 },
        { uid: 93, name: "Торговец года", subname: ["Лучший торговец", "Торговец года", "Самый успешный торговец"], description: "Продайте самый дорогой предмет в косом переулке.", counter: 10 },
        { uid: 94, name: "Завсегдатай маголавки", subname: ["Регулярный покупатель", "Постоянный клиент", "Любимец торговцев"], description: "Совершите 5 покупок в косом переулке.", counter: 15 },
        { uid: 95, name: "Коллекционер", subname: ["Начинающий коллекционер", "Опытный коллекционер", "Профессиональный коллекционер"], description: "Купите все доступные виды питомцев, снаряжения для квиддича и волшебных палочек в косом переулке.", counter: 25 },
        { uid: 96, name: "Волшебная коллекция", subname: ["Начальная коллекция", "Средняя коллекция", "Лучшая коллекция"], description: "Купите все виды питомцев в косом переулке.", counter: 50 },
        { uid: 97, name: "Мастер квиддича", subname: ["Начинающий мастер", "Опытный мастер", "Профессиональный мастер"], description: "Купите все виды снаряжения для квиддича в косом переулке.", counter: 100 },
        { uid: 98, name: "Магический зоопарк", subname: ["Маленький зоопарк", "Средний зоопарк", "Большой зоопарк"], description: "Купите все доступные виды питомцев в косом переулке.", counter: 200 },
        { uid: 99, name: "Коллекционер палочек", subname: ["Начинающий коллекционер", "Опытный коллекционер", "Профессиональный коллекционер"], description: "Купите все виды волшебных палочек в косом переулке.", counter: 400 },
        { uid: 100, name: "Квиддичный фанат", subname: ["Начинающий фанат", "Опытный фанат", "Профессиональный фанат"], description: "Купите все виды снаряжения для квиддича и питомцев, связанных с квиддичем в косом переулке.", counter: 800 },
        { uid: 101, name: "Магический миллионер", subname: ["Начинающий миллионер", "Опытный миллионер", "Профессиональный миллионер"], description: "Потратьте 10000 галеонов в косом переулке.", counter: 1200 },
        { uid: 102, name: "Лучший друг питомцев", subname: ["Начинающий друг", "Друг на все времена", "Лучший друг"], description: "Купите и выращивайте каждого питомца в косом переулке.", counter: 2500 },
        { uid: 103, name: "Магический торговец", subname: ["Начинающий торговец", "Опытный торговец", "Профессиональный торговец"], description: "Продайте 100 предметов в косом переулке.", counter: 5000 },
        { uid: 104, name: "Магический магнат", subname: ["Начинающий магнат", "Опытный магнат", "Профессиональный магнат"], description: "Потратьте 1000 галеонов в косом переулке.", counter: 10000 },
        { uid: 105, name: "Король маголавки", subname: ["Маленький король", "Средний король", "Великий король"], description: "Совершите 10 покупок питомцев, снаряжения для квиддича и волшебных палочек в косом переулке.", counter: 20000 },
    ]
    if (analyzer) {
        const analyze_birthday_counter: Analyzer | null = await prisma.analyzer.update({ where: { id: analyzer.id }, data: { buying: { increment: 1 } } })
        if (analyze_birthday_counter) { 
            console.log(`Analyzer module detected buying for user UID ${id_user}`)
            for (const i in birthday) {
                if (analyze_birthday_counter.buying >= birthday[i].counter) {
                    const achive_check = await prisma.achievement.findFirst({ where: { uid: birthday[i].uid, id_user: id_user } })
                    if (!achive_check) {
                        const achive_add = await prisma.achievement.create({ data: { uid: birthday[i].uid, name: `🛒 ${birthday[i].name} - ${birthday[i].subname[randomInt(0, 3)]}`, id_user: id_user } })
                        if (achive_add) {
                            const xp = randomInt(1, 15)
                            await prisma.user.update({ where: { id: id_user }, data: { medal: { increment: xp } } })
                            await vk?.api.messages.send({
                                peer_id: user.idvk,
                                random_id: 0,
                                message: `🌟 Получено достижение:\n${achive_add.name}`
                            })
                            await vk?.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `🌟 @id${user.idvk}(${user.name}) (UID: ${user.id}) выполняет достижение:\n${achive_add.name} и получает на счет ${xp}🔘.`
                            })
                        }
                    }
                }
            }
        }
    }
}
/*
export async function Analyzer_THERE_Counter(context: any) {
    const user: any = await prisma.user.findFirst({ where: { idvk: context.peerId } })
    const id_user = user.id
    await Analyzer_Init(id_user)
    const analyzer: Analyzer | null = await prisma.analyzer.findFirst({ where: { id_user: id_user } })
    const birthday: Achivied[] = [
        { uid: 0, name: "", subname: [], description: "", counter: 0 }, 
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
        { uid: 0, name: "", subname: [], description: "", counter: 0 },
    ]
    if (analyzer) {
        const analyze_birthday_counter: Analyzer | null = await prisma.analyzer.update({ where: { id: analyzer.id }, data: { THERE: { increment: 1 } } })
        if (analyze_birthday_counter) { 
            console.log(`Analyzer module detected beer bambuke premium for user UID ${id_user}`)
            for (const i in birthday) {
                if (analyze_birthday_counter.THERE >= birthday[i].counter) {
                    const achive_check = await prisma.achievement.findFirst({ where: { uid: birthday[i].uid, id_user: id_user } })
                    if (!achive_check) {
                        const achive_add = await prisma.achievement.create({ data: { uid: birthday[i].uid, name: `THERE ${birthday[i].name} - ${birthday[i].subname[randomInt(0, 3)]}`, id_user: id_user } })
                        if (achive_add) {
                            const xp = randomInt(1, 15)
                            await prisma.user.update({ where: { id: id_user }, data: { xp: { increment: xp } } })
                            await vk?.api.messages.send({
                                peer_id: user.idvk,
                                random_id: 0,
                                message: `🌟 Получено достижение:\n${achive_add.name}`
                            })
                            await vk?.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `🌟 @id${user.idvk}(${user.name}) (UID: ${user.id}) выполняет достижение:\n${achive_add.name} и получает на счет ${xp}🧙.`
                            })
                        }
                    }
                }
            }
        }
    }
}
*/