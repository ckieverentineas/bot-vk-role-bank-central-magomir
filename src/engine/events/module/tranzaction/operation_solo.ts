import { Alliance, AllianceCoin, AllianceFacult, BalanceCoin, BalanceFacult, ItemStorage, User } from "@prisma/client"
import { Person_Get } from "../person/person"
import { Accessed, Confirm_User_Success, Fixed_Number_To_Five, Get_Url_Picture, Input_Text, Keyboard_Index, Logger, Send_Message, Send_Message_Question, Send_Message_Smart, Send_Coin_Operation_Notification, Input_Number } from "../../../core/helper"
import { Keyboard, KeyboardBuilder } from "vk-io"
import { answerTimeLimit, chat_id, timer_text } from "../../../.."
import { Person_Coin_Printer_Self } from "../person/person_coin"
import { Facult_Coin_Printer_Self } from "../alliance/facult_rank"
import prisma from "../prisma_client"
import { Back, Ipnut_Gold, Ipnut_Message } from "./operation_global"
import { Sub_Menu } from "./operation_sub"
import { ico_list } from "../data_center/icons_lib"
import { InventoryType } from "../data_center/standart"
import { getTerminology } from "../alliance/terminology_helper"
import { getUserSkillsForDisplay } from "../skills/user_skill_display"

interface LightAllianceCoin {
    id: number;
    name: string;
    smile: string;
    point: boolean;
    converted: boolean;
    converted_point: boolean;
    sbp_on: boolean;
    course_medal: number;
    course_coin: number;
}

export async function Operation_Solo(context: any) {
    if (context.peerType == 'chat') { return }
    const user_adm: User | null | undefined = await Person_Get(context)
    if (await Accessed(context) == 1) { return }
    let name_check = false
	let datas: any = []
    let info_coin: { text: string, smile: string } | undefined = { text: ``, smile: `` }
	while (name_check == false) {
		const uid: any = await context.question( `🧷 Введите 💳UID банковского счета получателя:`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: `${ico_list['stop'].ico} ${ico_list['stop'].name}`, payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
        if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
		if (/^(0|-?[1-9]\d{0,5})$/.test(uid.text)) {
            const get_user = await prisma.user.findFirst({ where: { id: Number(uid.text) } })
            if (get_user && (user_adm?.id_alliance == get_user.id_alliance || get_user.id_alliance == 0 || get_user.id_alliance == -1 || await Accessed(context) == 3)) {
                info_coin = await Person_Coin_Printer_Self(context, get_user.id)
                const info_facult_rank = await Facult_Coin_Printer_Self(context, get_user.id)
                await Logger(`In a private chat, opened ${get_user.idvk} card UID ${get_user.id} is viewed by admin ${context.senderId}`)
                name_check = true
			    datas.push({id: `${uid.text}`})
                const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
                const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ where: { id: Number(get_user.id_facult) } })
                const singular = await getTerminology(alli_get?.id || 0, 'singular');
                const genitive = await getTerminology(alli_get?.id || 0, 'genitive');
                const facultTerminology = singular.charAt(0).toUpperCase() + singular.slice(1);
                const withoutFaculty = `Без ${genitive}`;
                // Получаем навыки для отображения (как в Card_Enter)
                let skillsTextAdmin = '';
                if (get_user.id_alliance && get_user.id_alliance > 0) {
                const displaySkills = await getUserSkillsForDisplay(get_user.id, get_user.id_alliance);
                
                if (displaySkills.length > 0) {
                    skillsTextAdmin = `\n`;
                    let currentCategory = '';
                    for (const skill of displaySkills) {
                    if (skill.categoryName !== currentCategory) {
                        currentCategory = skill.categoryName;
                        skillsTextAdmin += `\n📁 ${currentCategory}:\n`;
                    }
                    
                    const levelDisplay = skill.levelName || '❌ нет уровня';
                    skillsTextAdmin += `  ⚔️ ${skill.skillName}: ${levelDisplay}\n`;
                    
                    if (skill.missingRequirements && Object.keys(skill.missingRequirements).length > 0 && skill.nextLevelName) {
                        const missingParts = []
                        for (const [coinId, { current, required }] of Object.entries(skill.missingRequirements)) {
                        const coin = await prisma.allianceCoin.findFirst({ where: { id: parseInt(coinId) } });
                        missingParts.push(`${coin?.smile || '💰'} ${current}/${required}`);
                        }
                        if (missingParts.length > 0) {
                        skillsTextAdmin += `     📈 до ${skill.nextLevelName}: ${missingParts.join(', ')}\n`;
                        }
                    }
                    }
                }
                }

                await context.send(`🏦 Открыта следующая карточка: \n\n💳 UID: ${get_user.id} \n🕯 GUID: ${get_user.id_account} \n🔘 Жетоны: ${get_user.medal} \n🌕 S-coins: ${get_user.scoopins}\n👤 Имя: ${get_user.name} \n👑 Статус: ${get_user.class}  \n🔨 Профессия: ${get_user?.spec} \n🏠 Ролевая: ${get_user.id_alliance == 0 ? `Соло` : get_user.id_alliance == -1 ? `Не союзник` : alli_get?.name}\n${facult_get ? facult_get.smile : `🔮`} ${facultTerminology}: ${facult_get ? facult_get.name : withoutFaculty} \n🧷 Страница: https://vk.com/id${get_user.idvk}\n${info_coin?.text}${skillsTextAdmin}` )
            } else { 
                if (user_adm?.id_alliance != get_user?.id_alliance) {
                    await context.send(`💡 Игрок ${get_user?.name} ${get_user?.id} в ролевой AUID: ${get_user?.id_alliance}, в то время, как вы состоите в AUID: ${user_adm?.id_alliance}`)
                } else {
                    await context.send(`💡 Нет такого банковского счета!`) 
                }
            }
		} else {
            if (uid.text == `${ico_list['stop'].ico} ${ico_list['stop'].name}`) { 
                await context.send(`💡 Операции прерваны пользователем!`) 
                return await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
            }
			await context.send(`💡 Необходимо ввести корректный UID!`)
		}
	}
    const keyboard = new KeyboardBuilder()
    if (await Accessed(context) == 3) {
        keyboard.textButton({ label: '➕🔘', payload: { command: 'medal_up' }, color: 'secondary' })
        .textButton({ label: '➖🔘', payload: { command: 'medal_down' }, color: 'secondary' }).row()
    }
    keyboard.textButton({ label: `➕➖${info_coin?.smile.slice(0,30)}`, payload: { command: 'coin_engine' }, color: 'secondary' }).row()
    .textButton({ label: `♾️${info_coin?.smile.slice(0,30)}`, payload: { command: 'coin_engine_infinity' }, color: 'secondary' })
    //.textButton({ label: `👥➕➖${info_coin?.smile.slice(0,30)}`, payload: { command: 'coin_engine_multi' }, color: 'secondary' }).row()
    .textButton({ label: '📦 Хранилище', payload: { command: 'storage_engine' }, color: 'secondary' })
    .textButton({ label: '⚙', payload: { command: 'sub_menu' }, color: 'secondary' }).row()
    .textButton({ label: `🛍 Назначить магазин`, payload: { command: 'alliance_shop_owner_sel' }, color: 'secondary' })
    .textButton({ label: '💬', payload: { command: 'comment_person' }, color: 'secondary' })
    .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
    .oneTime().inline()
    const ans: any = await context.question(`✉ Доступны следующие операции с 💳UID: ${datas[0].id}`, { keyboard: keyboard, answerTimeLimit })
    if (ans.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${datas[0].id} истекло!`) }
    const config: any = {
        'back': Back,
        'sub_menu': Sub_Menu,
        'medal_up': Medal_Up,
        'medal_down': Medal_Down,
        'coin_engine': Coin_Engine,
        'coin_engine_infinity': Coin_Engine_Infinity,
        'coin_engine_multi': Coin_Engine_Multi,
        'comment_person': Comment_Person,
        'alliance_shop_owner_sel': Alliance_Shop_Owner_Selector,
        'storage_engine': Storage_Engine
    }
    if (ans?.payload?.command in config) {
        const commandHandler = config[ans.payload.command];
        const answergot = await commandHandler(Number(datas[0].id), context, user_adm)
    } else {
        await context.send(`⚙ Операция отменена пользователем.`)
    }
    await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
}

async function Comment_Person(id: number, context: any, user_adm: User) {
    const user_get: User | null = await prisma.user.findFirst({ where: { id } });
    if (!user_get) {
        return await context.send("❌ Пользователь не найден.");
    }
    const alliance = await prisma.alliance.findFirst({
        where: { id: user_get.id_alliance ?? 0 }
    });

    if (!alliance) {
        return await context.send("❌ Союз не найден.");
    }
    const comment = await Input_Text(context, `Текущий комментарий к персонажу [${user_get.name}]: [${user_get.comment}]\n Введите для изменения или отмените`, 3000)
    if (!comment) { return }
    const update_com = await prisma.user.update({ where: { id: user_get.id }, data: { comment: comment ?? '' } })
    if (!update_com) { return }
    await Send_Message_Smart(context, `"🔊" --> изменение комментария к персонажу ${user_get.name}\n🧷 Комментарий: ${update_com.comment}`, 'admin_and_client', user_get)
}

async function Storage_Engine(id: number, context: any, user_adm: User) {
    const user_get: User | null = await prisma.user.findFirst({ where: { id } });
    if (!user_get) {
        return await context.send("❌ Пользователь не найден.");
    }

    const alliance = await prisma.alliance.findFirst({
        where: { id: user_get.id_alliance ?? 0 }
    });

    if (!alliance) {
        return await context.send("❌ Союз не найден.");
    }

    // Вспомогательная функция для выбора сундука
    async function selectChestForStorage(allianceId: number): Promise<{chestId: number, chestName: string}> {
        // Получаем все сундуки альянса
        const allChests = await prisma.allianceChest.findMany({
            where: { id_alliance: allianceId },
            include: { Children: true },
            orderBy: [{ id_parent: 'asc' }, { order: 'asc' }]
        });
        
        // Ищем "Основное" сундук
        const mainChest = allChests.find(c => c.name === "Основное");
        const mainChests = allChests.filter(c => c.id_parent === null);
        
        // Формируем текст для выбора сундука
        let text = `🎒 Выберите сундук для выдачи предмета\n\n`;
        text += `Получатель: ${user_get!.name}\n\n`;
        text += `Доступные сундуки:\n`;
        
        if (mainChest) {
            text += `🔘 [${mainChest.id}] Основное\n`;
        } else {
            text += `🔘 [0] Основное (будет создан)\n`;
        }
        
        for (const chest of mainChests) {
            if (chest.name !== "Основное") {
                text += `🎒 [${chest.id}] ${chest.name}\n`;
            }
        }
        
        text += `\nВведите ID сундука${mainChest ? ` (или ${mainChest.id} для "Основное")` : ' (или 0 для "Основное")'}:`;
        
        const chestIdInput = await Input_Number(context, text, true);
        if (chestIdInput === false) {
            if (mainChest) return {chestId: mainChest.id, chestName: "Основное"};
            
            const newMainChest = await prisma.allianceChest.create({
                data: {
                    name: "Основное",
                    id_alliance: allianceId,
                    id_parent: null,
                    order: 0
                }
            });
            return {chestId: newMainChest.id, chestName: "Основное"};
        }
        
        let selectedChestId: number;
        let selectedChestName: string;
        
        if (chestIdInput === 0 || (mainChest && chestIdInput === mainChest.id)) {
            if (!mainChest) {
                const newMainChest = await prisma.allianceChest.create({
                    data: {
                        name: "Основное",
                        id_alliance: allianceId,
                        id_parent: null,
                        order: 0
                    }
                });
                selectedChestId = newMainChest.id;
                selectedChestName = "Основное";
            } else {
                selectedChestId = mainChest.id;
                selectedChestName = "Основное";
            }
        } else {
            const selectedChest = allChests.find(c => c.id === chestIdInput);
            if (!selectedChest) {
                await context.send(`❌ Сундук с ID ${chestIdInput} не найден. Используется "Основное".`);
                if (mainChest) return {chestId: mainChest.id, chestName: "Основное"};
                
                const newMainChest = await prisma.allianceChest.create({
                    data: {
                        name: "Основное",
                        id_alliance: allianceId,
                        id_parent: null,
                        order: 0
                    }
                });
                return {chestId: newMainChest.id, chestName: "Основное"};
            }
            selectedChestId = selectedChest.id;
            selectedChestName = selectedChest.name;
        }
        
        // Проверяем, есть ли сундучки в выбранном сундуке
        const childChests = allChests.filter(c => c.id_parent === selectedChestId);
        
        if (childChests.length > 0) {
            let childText = `🎒 Выбран сундук: ${selectedChestName}\n\n`;
            
            childText += `\nВыберите сундучок:\n`;
            childText += `🎒 [${selectedChestId}] Оставить в выбранном сундуке\n`;
            
            for (const child of childChests) {
                childText += `      🧳 [${child.id}] ${child.name}\n`;
            }
            
            childText += `\nВведите ID сундучка (или ${selectedChestId} для выбора текущего сундука):`;
            
            const childIdInput = await Input_Number(context, childText, true);
            if (childIdInput === false) return {chestId: selectedChestId, chestName: selectedChestName};
            
            if (childIdInput === selectedChestId) {
                // Оставляем выбранный сундук
                return {chestId: selectedChestId, chestName: selectedChestName};
            } else {
                // Проверяем, существует ли сундучок
                const selectedChild = childChests.find(c => c.id === childIdInput);
                if (!selectedChild) {
                    await context.send(`❌ Сундучок с ID ${childIdInput} не найден. Используется основной сундук.`);
                    return {chestId: selectedChestId, chestName: selectedChestName};
                }
                return {chestId: childIdInput, chestName: selectedChild.name};
            }
        }
        
        return {chestId: selectedChestId, chestName: selectedChestName};
    }

    let page = 0;
    const itemsPerPage = 4;

    while (true) {
        // Получаем все предметы
        const allItems = await prisma.itemStorage.findMany({
            where: {
                id_alliance: user_get.id_alliance ?? 0,
                hidden: false
            },
            orderBy: { id: "desc" }
        });

        // Рассчитываем пагинацию
        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = page * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const itemsOnPage = allItems.slice(startIndex, endIndex);

        if (itemsOnPage.length === 0 && totalItems > 0) {
            page = Math.max(0, totalPages - 1);
            continue;
        }

        // Формируем текст сообщения
        let messageText = `📦 Выберите предмет для выдачи`;
        if (totalPages > 1) {
            messageText += ` (Страница ${page + 1}/${totalPages})`;
        }
        messageText += `\n\n`;

        // Создаем клавиатуру
        const keyboard = new KeyboardBuilder();

        // Кнопки для предметов (максимум 5)
        for (let i = 0; i < itemsOnPage.length; i++) {
            const item = itemsOnPage[i];
            const buttonLabel = `${item.name} (${item.id})`;
            keyboard.textButton({
                label: buttonLabel.length > 40 ? buttonLabel.slice(0, 37) + '...' : buttonLabel,
                payload: { command: 'give_item', item_id: item.id, page: page },
                color: 'secondary'
            }).row();
        }

        // Навигация (если нужно)
        if (totalPages > 1) {
            if (page > 0) {
                keyboard.textButton({
                    label: '←',
                    payload: { command: 'navigate', page: page - 1 },
                    color: 'secondary'
                });
            }

            if (page < totalPages - 1) {
                keyboard.textButton({
                    label: '→',
                    payload: { command: 'navigate', page: page + 1 },
                    color: 'secondary'
                });
            }
            
            if (page > 0 || page < totalPages - 1) {
                keyboard.row();
            }
        }

        // Основные кнопки
        keyboard
            .textButton({
                label: '🆕 Создать',
                payload: { command: 'create_item' },
                color: 'positive'
            })
            .textButton({
                label: '❌ Выход',
                payload: { command: 'exit' },
                color: 'negative'
            }).row();

        const answer = await context.question(messageText, {
            keyboard: keyboard.inline(),
            answerTimeLimit
        });

        if (answer.isTimeout) {
            await context.send("⏰ Время ожидания истекло.");
            break;
        }

        if (answer.payload?.command === 'navigate') {
            page = answer.payload.page;
            continue;
        }

        if (answer.payload?.command === 'give_item') {
            const itemId = answer.payload.item_id;

            const item = await prisma.itemStorage.findFirst({
                where: { id: itemId }
            });

            if (!item) {
                await context.send("⚠ Предмет не найден.");
                continue;
            }

            // ВЫБОР СУНДУКА ПЕРЕД ВЫДАЧЕЙ
            const { chestId: targetChestId, chestName } = await selectChestForStorage(alliance.id);
            
            const confirmq = await context.question(`⁉ Вы уверены, что хотите выдать предмет "${item?.name}" игроку ${user_get.name} в сундук "${chestName}"?`,
                {
                    keyboard: Keyboard.builder()
                    .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                    .textButton({ label: 'Нет', payload: { command: 'not' }, color: 'secondary' }).row()
                    .textButton({ label: 'Скрыть', payload: { command: 'hidden' }, color: 'secondary' }).row()
                    .oneTime().inline(),
                    answerTimeLimit
                }
            );
            
            if (confirmq.isTimeout) { 
                await context.send(`⏰ Время ожидания на подтверждение операции выдачи предмета в хранилище игрока истекло!`);
                continue;
            }
            
            if (confirmq?.payload?.command === 'confirm') {
                // Создаем инвентарную запись
                const inventory = await prisma.inventory.create({
                    data: {
                        id_user: user_get.id,
                        id_item: item.id,
                        type: InventoryType.ITEM_STORAGE,
                        comment: `Получено от ${user_adm.name}`,
                        purchaseDate: new Date()
                    }
                });
                
                // Создаем связь предмета с сундуком
                await prisma.chestItemLink.create({
                    data: {
                        id_chest: targetChestId,
                        id_inventory: inventory.id
                    }
                });
                
                const notif = `"🎁" --> выдача товара "${item?.name}" игроку @id${user_get.idvk}(${user_get.name})${user_adm ? `\n🗿 Инициатор: @id${user_adm.idvk}(${user_adm.name})` : ''}\n🎒 Сундук: ${chestName}`;
                await Send_Message_Smart(context, notif, 'client_callback', user_get);
                if (user_adm) { 
                    await Send_Message(user_adm.idvk, notif); 
                }
                
                await context.send(`✅ Предмет "${item.name}" выдан игроку ${user_get.name} в сундук "${chestName}"`);
            }
            
            if (confirmq?.payload?.command === 'hidden') {
                const confirm: { status: boolean, text: string } = await Confirm_User_Success(
                    context, 
                    `скрыть предмет "${item?.name}" для выдачи игрокам? Соглашайтесь, если вы больше не планируете выдавать данный предмет игрокам, но их необходимо оставить в инвентарях`
                );
                if (!confirm.status) continue;
                
                await prisma.itemStorage.update({ 
                    where: { id: item.id }, 
                    data: { hidden: true } 
                });
                
                const notif = `"🎁" --> СКРЫТ для выдачи товар "${item?.name}" ${user_adm ? `\n🗿 Инициатор: @id${user_adm.idvk}(${user_adm.name})` : ''}`;
                await Send_Message_Smart(context, notif, 'admin_solo', user_adm);
                
                await context.send(`✅ Предмет "${item.name}" скрыт и больше не будет отображаться для выдачи`);
            }
            
            continue;
        }

        if (answer.payload?.command === 'create_item') {
            const name_answer = await context.question("✏ Введите название нового предмета:", { answerTimeLimit });
            if (name_answer.isTimeout) {
                await context.send("⏰ Время ввода истекло.");
                continue;
            }

            const desc_answer = await context.question("✏ Введите описание предмета:", { answerTimeLimit });
            if (desc_answer.isTimeout) {
                await context.send("⏰ Время ввода истекло.");
                continue;
            }
            
            const imageUrl = await context.question(`📷 Вставьте только ссылку на изображение (или "нет"):`, { answerTimeLimit });
            if (imageUrl.isTimeout) continue;
            
            const image_url = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text) ?? '';
            
            const newItem = await prisma.itemStorage.create({
                data: {
                    name: name_answer.text.trim(),
                    description: desc_answer.text.trim(),
                    id_alliance: user_get.id_alliance,
                    hidden: false,
                    image: image_url
                }
            });

            await context.send(`🆕 Предмет "${newItem.name}" создан и добавлен в хранилище.`);

            const confirm_answer = await context.question(
                `❓ Выдать этот предмет игроку ${user_get.name}?`,
                {
                    keyboard: Keyboard.builder()
                        .textButton({ label: 'Да', payload: { command: 'give_created' }, color: 'positive' })
                        .textButton({ label: 'Нет', payload: { command: 'skip_give' }, color: 'negative' })
                        .oneTime().inline(),
                    answerTimeLimit
                }
            );

            if (confirm_answer.isTimeout) {
                await context.send("⏰ Время ожидания истекло.");
                continue;
            }

            if (confirm_answer.payload?.command === 'give_created') {
                // ВЫБОР СУНДУКА ПЕРЕД ВЫДАЧЕЙ НОВОГО ПРЕДМЕТА
                const { chestId: targetChestId, chestName } = await selectChestForStorage(alliance.id);
                
                // Создаем инвентарную запись
                const inventory = await prisma.inventory.create({
                    data: {
                        id_user: user_get.id,
                        id_item: newItem.id,
                        type: InventoryType.ITEM_STORAGE,
                        comment: `Выдан админом @id${context.senderId}`,
                        purchaseDate: new Date()
                    }
                });
                
                // Создаем связь предмета с сундуком
                await prisma.chestItemLink.create({
                    data: {
                        id_chest: targetChestId,
                        id_inventory: inventory.id
                    }
                });
                
                const notif = `"🎁" --> выдача товара "${newItem?.name}" игроку @id${user_get.idvk}(${user_get.name})${user_adm ? `\n🗿 Инициатор: @id${user_adm.idvk}(${user_adm.name})` : ''}\n🎒 Сундук: ${chestName}`;
                await Send_Message_Smart(context, notif, 'client_callback', user_get);
                if (user_adm) { 
                    await Send_Message(user_adm.idvk, notif); 
                }
                
                await context.send(`✅ Новый предмет "${newItem.name}" создан и выдан игроку ${user_get.name} в сундук "${chestName}"`);
            } else if (confirm_answer.payload?.command === 'skip_give') {
                await context.send(`✅ Новый предмет "${newItem.name}" создан, но не выдан.`);
            } else {
                await context.send(`✅ Новый предмет "${newItem.name}" создан, но не выдан.`);
            }

            continue;
        }

        if (answer.payload?.command === 'exit') {
            await context.send("🚪 Операция завершена.");
            break;
        }
    }

    await Keyboard_Index(context, "💡 Как насчет еще одной операции?");
}

async function getChestName(chestId: number): Promise<string> {
    if (chestId === 0) return "Основное";
    
    const chest = await prisma.allianceChest.findFirst({
        where: { id: chestId }
    });
    
    return chest?.name || "Основное";
}

async function Alliance_Shop_Owner_Selector(id: number, context: any, user_adm: User) {
    const user_get: User | null = await prisma.user.findFirst({ where: { id } })
    if (!user_get) { return }
    const uid: any = await context.question( `🧷 Введите SUID магазина для назначения владельцем:`,
        {   
            keyboard: Keyboard.builder()
            .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
            .oneTime().inline(),
            timer_text
        }
    )
    if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
    if (/^(0|-?[1-9]\d{0,5})$/.test(uid.text)) {
        const get_alliance_shop = await prisma.allianceShop.findFirst({ where: { id: Number(uid.text) } })
        if (get_alliance_shop && (user_adm?.id_alliance == get_alliance_shop.id_alliance || user_get?.id_alliance == get_alliance_shop.id_alliance)) {
            const shop_up = await prisma.allianceShop.update({ where: { id: get_alliance_shop.id }, data: { id_user_owner: user_get.id } })
            const owner_old = await prisma.user.findFirst({ where: { id: get_alliance_shop.id_user_owner } })
            await Send_Message_Smart(context, `"🛍 Назначить владение магазином [${shop_up?.name}]" --> изменен владелец магазина ${owner_old?.id}-${owner_old?.name} -> ${shop_up.id_user_owner}-${user_get.name}`, 'admin_and_client', user_get)
        } else { 
            if (get_alliance_shop?.id_alliance != user_get?.id_alliance) {
                await context.send(`💡 Игрок ${user_get?.name} ${user_get?.id} в ролевой AUID: ${user_get?.id_alliance}, в то время, как магазин состоит в AUID: ${get_alliance_shop?.id_alliance}`)
            } else {
                await context.send(`💡 Нет такого магазина!`) 
            }
        }
    } else {
        if (uid.text == "🚫Отмена") { 
            return await context.send(`💡 Операции прерваны пользователем!`) 
            
        }
        await context.send(`💡 Необходимо ввести корректный UID!`)
    }
}
// модуль Министреских начислений
async function Medal_Up(id: number, context: any, user_adm: User) {
    const count: number = await Ipnut_Gold(context, 'начисления министерских жетонов') 
    const messa: string = await Ipnut_Message(context, 'начисления министерских жетонов')
    const user_get: User | null = await prisma.user.findFirst({ where: { id } })
    if (!user_get) { return }
    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal + count } })
    const notif_ans = await Send_Message(user_get.idvk, `🔔 Уведомление для ${user_get.name} (UID: ${user_get.id})\n💬 "+ ${count}🔘" --> ${user_get.medal} + ${count} = ${money_put.medal}\n🧷 Сообщение: ${messa}`)
    !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_get.name} не доставлено`) : await context.send(`⚙ Операция начисления министерских жетонов завершена успешно`)
    const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "+🔘" > ${money_put.medal-count}🔘+${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
    await Send_Message(chat_id, ans_log)
    await Logger(`In private chat, user ${user_get.idvk} got ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
}
async function Medal_Down(id: number, context: any, user_adm: User) {
    const count: number = await Ipnut_Gold(context, 'снятия министерских жетонов') 
    const messa: string = await Ipnut_Message(context, 'снятия министерских жетонов')
    const user_get: any = await prisma.user.findFirst({ where: { id } })
    if (user_get.medal-count >= 0) {
        const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal - count } })
        const notif_ans = await Send_Message(user_get.idvk, `🔔 Уведомление для ${user_get.name} (UID: ${user_get.id})\n💬 "- ${count}🔘" --> ${user_get.medal} - ${count} = ${money_put.medal}\n🧷 Сообщение: ${messa}`)
        !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_get.name} не доставлено`) : await context.send(`⚙ Операция снятия министерских жетонов завершена успешно`)
        const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
        await Send_Message(chat_id, ans_log)
        await Logger(`In private chat, user ${user_get.idvk} lost ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
    } else {
        const confirmq = await context.question(`⌛ Вы хотите снять ${count}🔘 жетонов c счета ${user_get.name}, но счет данного пользователя ${user_get.medal}. Уверены, что хотите сделать баланс: ${user_get.medal-count}`,
            {
                keyboard: Keyboard.builder()
                .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                .textButton({ label: 'Нет', payload: { command: 'gold_down' }, color: 'secondary' })
                .oneTime().inline(),
                answerTimeLimit
            }
        )
        if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на снятие галлеонов с ${user_get.name} истекло!`) }
        if (confirmq.payload.command === 'confirm') {
            const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal - count } })
            const notif_ans = await Send_Message(user_get.idvk, `🔔 Уведомление для ${user_get.name} (UID: ${user_get.id})\n💬 "- ${count}🔘" --> ${user_get.medal} - ${count} = ${money_put.medal}\n🧷 Сообщение: ${messa}`)
            !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_get.name} не доставлено`) : await context.send(`⚙ Операция снятия министерских жетонов завершена успешно`)
            const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
            await Send_Message(chat_id, ans_log)
            await Logger(`In private chat, user ${user_get.idvk} lost ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
        } else {
            await context.send(`💡 Нужно быть жестче! Греби жетоны`)
        }
    }
}
//Модуль мульти начислений
async function Coin_Engine_Multi(id: number, context: any, user_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: id } })
    const person: { coin: AllianceCoin | null, operation: string | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass = await prisma.allianceCoin.findMany({ 
        where: { id_alliance: Number(user?.id_alliance) },
        select: {
            id: true,
            name: true,
            smile: true,
            point: true,
            converted: true,
            converted_point: true,
            sbp_on: true,
            course_medal: true,
            course_coin: true
            // НЕ включаем новые поля: scoopins_converted, course_scoopins_medal, course_scoopins_coin
        }
    })
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let coin_check = false
    let id_builder_sent = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
        let event_logger = `❄ Выберите валюту, с которой будем делать отчисления:\n\n`
        const coin_pass = await prisma.allianceCoin.findMany({ 
            where: { id_alliance: Number(user?.id_alliance) },
            select: {
                id: true,
                name: true,
                smile: true,
                point: true,
                converted: true,
                converted_point: true,
                sbp_on: true,
                course_medal: true,
                course_coin: true
            }
        }) as LightAllianceCoin[];

        const builder_list: LightAllianceCoin[] = coin_pass;
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ 
                    label: `${builder.smile}-${builder.name.slice(0,30)}`, 
                    payload: { 
                        command: 'builder_control', 
                        id_builder_sent: i, 
                        target: builder  // Теперь builder содержит только выбранные поля
                    }, 
                    color: 'secondary' 
                }).row()
                event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                counter++
            }
            event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
            //предыдущий офис
            if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
            }
            //следующий офис
            if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
            }
        } else {
            event_logger = `💬 Админы ролевой еще не создали ролевые валюты`
            return context.send(`💬 Админы ролевой еще не создали ролевые валюты`)
        }
        const answer1: any = await context.question(`${event_logger}`,
            {	
                keyboard: keyboard.inline(), answerTimeLimit
            }
        )
        if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer1.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.text == '→' || answer1.text =='←') {
                id_builder_sent = answer1.payload.id_builder_sent
            } else {
                person.coin = answer1.payload.target
                coin_check = true
            }
        }
    }
    let answer_check = false
    while (answer_check == false) {
        const answer_selector = await context.question(`🧷 Укажите вариант операции:`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: '+', payload: { command: 'student' }, color: 'secondary' })
                .textButton({ label: '-', payload: { command: 'professor' }, color: 'secondary' })
                .oneTime().inline(), answerTimeLimit
            }
        )
        if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer_selector.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            person.operation = answer_selector.text
            answer_check = true
        }
    }
    const messa: string = await Ipnut_Message(context, `[массовая ${person.operation}${person.coin?.smile}]`)
    const users_target = await Ipnut_Message(context, `Введите список UID и сумм в формате:\n5-3402\n6-23.4\n7-53\n...`) 

    const lines = users_target.split('\n').map(line => line.trim());
    const uid_res: Array<{ id: number, amount: number }> = []

    for (const line of lines) {
        if (!line.includes('-')) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        const [uidStr, amountStr] = line.split('-').map(s => s.trim());
        const uid = parseInt(uidStr);
        const amount = parseFloat(amountStr);

        if (isNaN(uid) || isNaN(amount)) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        const user = await prisma.user.findFirst({ where: { id: uid } });
        if (!user) {
            await context.send(`❌ Пользователь с UID ${uid} не найден.`);
            continue;
        }

        uid_res.push({ id: uid, amount: amount });
    }
    let passer = true
    switch (person.operation) {
        case '+':
            for (const ui of uid_res) {
                const pers = await prisma.user.findFirst({ where: { id: ui.id } })
                if (!pers) { await context.send(`UID ${ui.id} не найдено`); continue }
                const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
                const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                if (!pers_bal_coin) { await context.send(`UID ${ui.id} не открыт валютный счет`); continue }
                const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin?.id }, data: { amount: { increment: ui.amount } } })
                const alliance = await prisma.alliance.findFirst({ 
                    where: { id: pers.id_alliance ?? 0 } 
                });
                const singular = await getTerminology(alliance?.id || 0, 'singular');
                const genitive = await getTerminology(alliance?.id || 0, 'genitive');
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    const rank_put_plus: BalanceFacult | null = rank_put_plus_check ? await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: ui.amount } } }) : null
                    facult_income = rank_put_plus ? `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check?.amount} ${person.operation} ${ui.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]` : ''
                }
                
                const notif_ans = await Send_Coin_Operation_Notification(
                    pers,
                    person.operation!,
                    ui.amount,
                    person.coin?.smile ?? '',
                    pers_bal_coin.amount,
                    money_put_plus.amount,
                    messa,
                    facult_income
                )
                
                const ans_log = `🚀 @id${context.senderId}(${user_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_plus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${ui.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui.id} не доставлено`) : await context.send(`✅ Успешное начисление для UID ${ui.id}`)
            }
            break;
        case '-':
            for (const ui of uid_res) {
                const pers = await prisma.user.findFirst({ where: { id: ui.id } })
                if (!pers) { await context.send(`UID ${ui.id} не найдено`); continue }
                const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
                const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                if (!pers_bal_coin) { await context.send(`UID ${ui.id} не открыт валютный счет`); continue }
                const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin.id }, data: { amount: { decrement: ui.amount } } })
                const alliance = await prisma.alliance.findFirst({ 
                    where: { id: pers.id_alliance ?? 0 } 
                });
                const singular = await getTerminology(alliance?.id || 0, 'singular');
                const genitive = await getTerminology(alliance?.id || 0, 'genitive');
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: ui.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${ui.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]`
                        }
                    }
                }
                
                const notif_ans = await Send_Coin_Operation_Notification(
                    pers,
                    person.operation!,
                    ui.amount,
                    person.coin?.smile ?? '',
                    pers_bal_coin.amount,
                    money_put_minus.amount,
                    messa,
                    facult_income
                )
                
                const ans_log = `🚀 @id${context.senderId}(${user_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_minus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${ui.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui.id} не доставлено`) : await context.send(`✅ Успешное снятие для UID ${ui.id}`)
            }
            break;
        default:
            passer = false
            break;
    }
    if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
}
//Модуль начислений
async function Coin_Engine(id: number, context: any, user_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: id } })
    const person: { coin: AllianceCoin | null, operation: string | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass = await prisma.allianceCoin.findMany({ 
        where: { id_alliance: Number(user?.id_alliance) },
        select: {
            id: true,
            name: true,
            smile: true,
            point: true,
            converted: true,
            converted_point: true,
            sbp_on: true,
            course_medal: true,
            course_coin: true
            // НЕ включаем новые поля: scoopins_converted, course_scoopins_medal, course_scoopins_coin
        }
    })
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let coin_check = false
    let id_builder_sent = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
        let event_logger = `❄ Выберите валюту, с которой будем делать отчисления:\n\n`
        const coin_pass = await prisma.allianceCoin.findMany({ 
            where: { id_alliance: Number(user?.id_alliance) },
            select: {
                id: true,
                name: true,
                smile: true,
                point: true,
                converted: true,
                converted_point: true,
                sbp_on: true,
                course_medal: true,
                course_coin: true
            }
        }) as LightAllianceCoin[];

        const builder_list: LightAllianceCoin[] = coin_pass;
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ 
                    label: `${builder.smile}-${builder.name.slice(0,30)}`, 
                    payload: { 
                        command: 'builder_control', 
                        id_builder_sent: i, 
                        target: builder  // Теперь builder содержит только выбранные поля
                    }, 
                    color: 'secondary' 
                }).row()        
                event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                counter++
            }
            event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
            //предыдущий офис
            if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
            }
            //следующий офис
            if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
            }
        } else {
            event_logger = `💬 Админы ролевой еще не создали ролевые валюты`
            return context.send(`💬 Админы ролевой еще не создали ролевые валюты`)
        }
        const answer1: any = await context.question(`${event_logger}`,
            {	
                keyboard: keyboard.inline(), answerTimeLimit
            }
        )
        if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer1.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.text == '→' || answer1.text =='←') {
                id_builder_sent = answer1.payload.id_builder_sent
            } else {
                person.coin = answer1.payload.target
                coin_check = true
            }
        }
    }
    let answer_check = false
    while (answer_check == false) {
        const answer_selector = await context.question(`🧷 Укажите вариант операции:`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: '+', payload: { command: 'student' }, color: 'secondary' })
                .textButton({ label: '-', payload: { command: 'professor' }, color: 'secondary' })
                .oneTime().inline(), answerTimeLimit
            }
        )
        if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer_selector.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            person.operation = answer_selector.text
            answer_check = true
        }
    }
    person.amount = await Ipnut_Gold(context, `[${person.operation}${person.coin?.smile}]`) 
    const messa: string = await Ipnut_Message(context, `[${person.operation}${person.coin?.smile}]`)
    const findas: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: user.id }})
    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })
    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user.id_alliance ?? 0 } 
    });
    const singular = await getTerminology(alliance?.id || 0, 'singular');
    const genitive = await getTerminology(alliance?.id || 0, 'genitive');
    let incomer = 0
    let facult_income = ``
    let passer = true
    switch (person.operation) {
        case '+':
            const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { increment: person.amount } } })
            incomer = money_put_plus.amount
            if (person.coin?.point == true && alli_fac) {
                const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                if (rank_put_plus_check) {
                    const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } })
                    if (rank_put_plus) {
                        facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]`
                    }
                }
            }
            break;
        case '-':
            const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { decrement: person.amount } } })
            incomer = money_put_minus.amount
            if (person.coin?.point == true && alli_fac) {
                const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                if (rank_put_plus_check) {
                    const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                    if (rank_put_plus) {
                        facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]`
                    }
                }
            }
            break;
    
        default:
            passer = false
            break;
    }
    if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
    await Send_Message_Smart(context, `"${person.operation} ${person.amount}${person.coin?.smile}" --> ${findas?.amount} ${person.operation} ${person.amount} = ${incomer}\n🧷 Сообщение: ${messa}\n${facult_income}`, 'admin_and_client',user)
    await Logger(`User ${user.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
}

//Модуль начислений бесконечнный
async function Coin_Engine_Infinity(id: number, context: any, user_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: id } })
    const person: { coin: AllianceCoin | null, operation: string | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass = await prisma.allianceCoin.findMany({ 
        where: { id_alliance: Number(user?.id_alliance) },
        select: {
            id: true,
            name: true,
            smile: true,
            point: true,
            converted: true,
            converted_point: true,
            sbp_on: true,
            course_medal: true,
            course_coin: true
            // НЕ включаем новые поля: scoopins_converted, course_scoopins_medal, course_scoopins_coin
        }
    })
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let infinity_pay = false
    while (!infinity_pay) {
        let coin_check = false
        let id_builder_sent = 0
        while (!coin_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            let event_logger = `❄ Выберите валюту, с которой будем делать отчисления:\n\n`
            const coin_pass = await prisma.allianceCoin.findMany({ 
                where: { id_alliance: Number(user?.id_alliance) },
                select: {
                    id: true,
                    name: true,
                    smile: true,
                    point: true,
                    converted: true,
                    converted_point: true,
                    sbp_on: true,
                    course_medal: true,
                    course_coin: true
                }
            }) as LightAllianceCoin[];

            const builder_list: LightAllianceCoin[] = coin_pass;
            if (builder_list.length > 0) {
                const limiter = 5
                let counter = 0
                for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                    const builder = builder_list[i]
                    keyboard.textButton({ 
                        label: `${builder.smile}-${builder.name.slice(0,30)}`, 
                        payload: { 
                            command: 'builder_control', 
                            id_builder_sent: i, 
                            target: builder  // Теперь builder содержит только выбранные поля
                        }, 
                        color: 'secondary' 
                    }).row()
                    event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                    counter++
                }
                event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
                //предыдущий офис
                if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                    keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
                }
                //следующий офис
                if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                    keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
                }
            } else {
                event_logger = `💬 Админы ролевой еще не создали ролевые валюты`
                return context.send(`💬 Админы ролевой еще не создали ролевые валюты`)
            }
            const answer1: any = await context.question(`${event_logger}`,
                {	
                    keyboard: keyboard.inline(), answerTimeLimit
                }
            )
            if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
            if (!answer1.payload) {
                await context.send(`💡 Жмите только по кнопкам с иконками!`)
            } else {
                if (answer1.text == '→' || answer1.text =='←') {
                    id_builder_sent = answer1.payload.id_builder_sent
                } else {
                    person.coin = answer1.payload.target
                    coin_check = true
                }
            }
        }
        let answer_check = false
        while (answer_check == false) {
            const answer_selector = await context.question(`🧷 Укажите вариант операции:`,
                {	
                    keyboard: Keyboard.builder()
                    .textButton({ label: '+', payload: { command: 'student' }, color: 'secondary' })
                    .textButton({ label: '-', payload: { command: 'professor' }, color: 'secondary' })
                    .oneTime().inline(), answerTimeLimit
                }
            )
            if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
            if (!answer_selector.payload) {
                await context.send(`💡 Жмите только по кнопкам с иконками!`)
            } else {
                person.operation = answer_selector.text
                answer_check = true
            }
        }
        person.amount = await Ipnut_Gold(context, `[${person.operation}${person.coin?.smile}]`) 
        const messa: string = await Ipnut_Message(context, `[${person.operation}${person.coin?.smile}]`)
        const findas: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: user.id }})
        const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })
        let incomer = 0
        let facult_income = ``
        let passer = true
        switch (person.operation) {
            case '+':
                const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { increment: person.amount } } })
                const alliance = await prisma.alliance.findFirst({ 
                    where: { id: user.id_alliance ?? 0 } 
                });
                const singular = await getTerminology(alliance?.id || 0, 'singular');
                const genitive = await getTerminology(alliance?.id || 0, 'genitive');
                incomer = money_put_plus.amount
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]`
                        }
                    }
                }
                break;
            case '-':
                const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { decrement: person.amount } } })
                const alliance2 = await prisma.alliance.findFirst({ 
                    where: { id: user.id_alliance ?? 0 } 
                });
                const singular2 = await getTerminology(alliance2?.id || 0, 'singular');
                const genitive2 = await getTerminology(alliance2?.id || 0, 'genitive');
                incomer = money_put_minus.amount
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive2} [${alli_fac.smile} ${alli_fac.name}]`
                        }
                    }
                }
                break;
            
            default:
                passer = false
                break;
        }
        if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
        
        const notif_ans = await Send_Coin_Operation_Notification(
            user,
            person.operation!,
            person.amount,
            person.coin?.smile ?? '',
            findas?.amount ?? 0,
            incomer,
            messa,
            facult_income
        )
        
        !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция завершена успешно`)
        const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "${person.operation}${person.coin?.smile}" > ${findas?.amount} ${person.operation} ${person.amount} = ${incomer} для @id${user.idvk}(${user.name}) 🧷: ${messa}\n${facult_income}`
        const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
        if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) } 
        await Logger(`User ${user.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
        const answer = await context.question(`${ico_list['load'].ico} Вы уверены, что хотите приступить к процедуре повторного отчисления?`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: 'Полностью', payload: { command: 'Согласиться' }, color: 'positive' }).row()
                .textButton({ label: 'Передумал(а)', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime(),
                answerTimeLimit
            }
        );
        if (answer.isTimeout) { infinity_pay = true; return await context.send(`⏰ Время ожидания подтверждения согласия истекло!`) }
        if (!/да|yes|Согласиться|конечно|✏|Полностью|полностью/i.test(answer.text|| '{}')) {
            await context.send(`${ico_list['stop'].ico} Вы отменили режим повторных операций!`)
            infinity_pay = true; 
        }
    }
}
