import { PrismaClient } from "@prisma/client";
import { HearManager } from "@vk-io/hear";
import { randomInt } from "crypto";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { IQuestionMessageContext } from "vk-io-question";
import { vk } from "..";

const prisma = new PrismaClient()

export function InitGameRoutes(hearManager: HearManager<IQuestionMessageContext>): void {
	hearManager.hear(/init/, async (context: any) => {
		const roles = [ 'user', 'admin' ]
		const res = { count_role: 0, count_shop: 0, count_item: 0, count_alliance: 0 }
		for (const rol of roles) {
			const rol_check = await prisma.role.findFirst({ where: { name: rol } })
			if (!rol_check) { 
				const rol_cr = await prisma.role.create({ data: { name: rol } }) 
				console.log(`Init role id: ${rol_cr.id} name: ${rol_cr.name} for users`)
				res.count_role++
			} else {
				console.log(`Already init role name: ${rol} for users`)
			}
		}
		const categories_shop = [ `Питомцы`, `Магические предметы`, `Артефакты и реликвии`, `Спорт`]
		for (const cat of categories_shop) {
			const cat_check = await prisma.category.findFirst({ where: { name: cat } })
			if (!cat_check) { 
				const cat_cr = await prisma.category.create({ data: { name: cat } }) 
				console.log(`Init category shop id: ${cat_cr.id} name: ${cat_cr.name} for users`)
				res.count_shop++
			} else {
				console.log(`Already init category shop name: ${cat} for users`)
			}
		}
		const items = [
			{ 
				target: `Питомцы`, item: [
					{ name: `Хомячок`, price: 10, type: 'unlimited' }, { name: `Лягушка`, price: 10, type: 'unlimited' }, 
					{ name: `Жаба`, price: 15, type: 'unlimited' }, { name: `Крыса`, price: 25, type: 'unlimited' }, 
					{ name: `Кот (любого раскраса, кроме черного)`, price: 50, type: 'unlimited' }, { name: `Кот черный`, price: 60, type: 'unlimited' }, 
					{ name: `Хорек`, price: 90, type: 'unlimited' }, { name: `Капибара`, price: 110, type: 'unlimited' }, 
					{ name: `Сова`, price: 150, type: 'unlimited' }, { name: `Енот`, price: 155, type: 'unlimited' }, 
					{ name: `Лис`, price: 180, type: 'unlimited' }, { name: `Лукотрус`, price: 220, type: 'unlimited' }, 
					{ name: `Шишуга`, price: 300, type: 'unlimited' }, { name: `Нюхлер`, price: 400, type: 'unlimited' },
				]
			},
			{ 
				target: `Магические предметы`, item: [
					{ name: `Фальшивые волшебные палочки-надувалочки`, price: 160, type: 'unlimited' }, { name: `Безголовая шляпа`, price: 160, type: 'unlimited' }, 
					{ name: `Вредноскоп`, price: 175, type: 'unlimited' }, { name: `Драчливый телескоп`, price: 175, type: 'unlimited' }, 
					{ name: `Кусачая кружка`, price: 180, type: 'unlimited' }, { name: `Перуанский порошок мгновенной тьмы`, price: 185, type: 'unlimited' }, 
					{ name: `Сапоги-скороходы`, price: 185, type: 'unlimited' }, { name: `Одежда-щит`, price: 192, type: 'unlimited' }, 
				]
			},
			{ 
				target: `Артефакты и реликвии`, item: [
					{ name: `Делюминатор`, price: 500, type: 'unlimited' }, { name: `Маховик времени`, price: 990, type: 'unlimited' }, 
					{ name: `Мантия-невидимка`, price: 1500, type: 'unlimited' },
				]
			},
			{ 
				target: `Спорт`, item: [
					{ name: `Форма для квиддича`, price: 40, type: 'unlimited' }, { name: `Обмундирование вратаря`, price: 55, type: 'unlimited' }, 
					{ name: `Набор для игры в квиддич`, price: 90, type: 'unlimited' }, { name: `Спортивная метла`, price: 110, type: 'unlimited' }, 
					{ name: `Полный комплект для квиддича`, price: 200, type: 'unlimited' }, 
				]
			}
		]
		for (const el of items) {
			const category = await prisma.category.findFirst({ where: { name: el.target } })
			if (!category) { await context.send(`Нет категории ${el.target}`); continue }
			for (const item of el.item) {
				const item_check = await prisma.item.findFirst({ where: { name: item.name, id_category: category.id } })
				if (!item_check) { 
					const item_cr = await prisma.item.create({ data: { name: item.name, price: item.price, id_category: category.id, type: item.type } }) 
					console.log(`Init item shop id: ${item_cr.id} name: ${item_cr.name} for users`)
					res.count_item++
				} else {
					console.log(`Already init category shop name: ${item.name} for users`)
				}
			}
		}
		const alliance = [
			`https://vk.com/public170217030`, `https://vk.com/hogwarts_anti`, 
			`https://vk.com/talentummagic`, `https://vk.com/bilmor`, 
			`https://vk.com/ilvermorny_magic`, `https://vk.com/academyofmagicartes`, 
			`https://vk.com/club220783818`, `https://vk.com/lva_academy`, 
			`https://vk.com/italian_magic_academy`, `https://vk.com/hogonline`, 
			`https://vk.com/ho_briston`, `https://vk.com/hawkford`, 
			`https://vk.com/a_kiris`, `https://vk.com/hogwarts.school_rp`, 
			`https://vk.com/koldovstoretz_russia`, `https://vk.com/hogwarts_magic_top`, 
			`https://vk.com/best_terra_britannia`, `https://vk.com/breakbills_academy`,
			`https://vk.com/unimagicalarts`, `https://vk.com/rolle_wizard`,
			//``, ``,
		]
		for (const alli of alliance) {
			const temp = alli.replace(/.*[/]/, "");
			const [group] = await vk.api.groups.getById({ group_id: temp });
			if (!group) { continue }
			const alli_check = await prisma.alliance.findFirst({ where: { idvk: group.id } })
			if (!alli_check) {
				const alli_cr = await prisma.alliance.create({ data: { name: group.name!, idvk: group.id!, }})
				console.log(`Init alliance id: ${alli_cr.id} name: ${alli_cr.name} for users`)
				res.count_alliance++
			} else {
				console.log(`Already init alliance name: ${group} for users`)
			}
		}
		context.send(`✅ Игра инициализирована успешно.\n\n 👫 Добавлено новых ролей: ${res.count_role}\n 🎪 Добавлено новых магазинов: ${res.count_shop}\n 👜 Добавлено новых предметов: ${res.count_item}\n 🏠 Добавлено новых союзов: ${res.count_alliance}`)
	})
}