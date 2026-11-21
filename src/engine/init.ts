import { PrismaClient } from "@prisma/client";
import { HearManager } from "@vk-io/hear";
import { IQuestionMessageContext } from "vk-io-question";
import { root } from "..";
import { Logger, Send_Message } from "./core/helper";

const prisma = new PrismaClient()

export function InitGameRoutes(hearManager: HearManager<IQuestionMessageContext>): void {
	hearManager.hear(/init/, async (context: any) => {
		if (context.senderId != root) { return }
		const roles = [ 'user', 'admin', 'root']
		const res = { count_role: 0, count_shop: 0, count_item: 0, count_alliance: 0 }
		for (const rol of roles) {
			const rol_check = await prisma.role.findFirst({ where: { name: rol } })
			if (!rol_check) { 
				const rol_cr = await prisma.role.create({ data: { name: rol } }) 
				await Logger(`In database, init role id ${rol_cr.id} name ${rol_cr.name} for users by admin ${context.senderId}`)
				res.count_role++
			} else {
				await Logger(`In database, already init role id ${rol_check.id} name ${rol_check.name} for users by admin ${context.senderId}`)
			}
		}
		const categories_shop = [ `Питомцы`, `Магические предметы`, `Артефакты и реликвии`, `Спорт`]
		for (const cat of categories_shop) {
			const cat_check = await prisma.category.findFirst({ where: { name: cat } })
			if (!cat_check) { 
				const cat_cr = await prisma.category.create({ data: { name: cat } }) 
				await Logger(`In database, init category shop id: ${cat_cr.id} name: ${cat_cr.name} for users by admin ${context.senderId}`)
				res.count_shop++
			} else {
				await Logger(`In database, already init category shop id ${cat_check.id} name ${cat_check.name} for users by admin ${context.senderId}`)
			}
		}
		const items = [
			{ 
				target: `Питомцы`, item: [
					{ name: `Хомячок`, description: ``, price: 10, type: 'unlimited', image: 'photo-225517872_457252023' },
					{ name: `Лягушка`, description: ``, price: 10, type: 'unlimited', image: 'photo-225517872_457252003' }, 
					{ name: `Жаба`, description: ``, price: 15, type: 'unlimited', image: 'photo-225517872_457251995' },
					{ name: `Крыса`, description: ``, price: 25, type: 'unlimited', image: 'photo-225517872_457251999' }, 
					{ name: `Кот (любого раскраса, кроме черного)`, description: ``, price: 50, type: 'unlimited', image: 'photo-225517872_457251997' },
					{ name: `Кот черный`, description: ``, price: 60, type: 'unlimited', image: 'photo-225517872_457251998' }, 
					{ name: `Хорек`, description: ``, price: 90, type: 'unlimited', image: 'photo-225517872_457252024' },
					{ name: `Капибара`, description: ``, price: 110, type: 'unlimited', image: 'photo-225517872_457251996' }, 
					{ name: `Сова`, description: ``, price: 150, type: 'unlimited', image: 'photo-225517872_457252019' },
					{ name: `Енот`, description: ``, price: 155, type: 'unlimited', image: 'photo-225517872_457251994' }, 
					{ name: `Лис`, description: ``, price: 180, type: 'unlimited', image: 'photo-225517872_457252001' },
					{ name: `Лукотрус`, description: ``, price: 220, type: 'unlimited', image: 'photo-225517872_457252002' }, 
					{ name: `Шишуга`, description: ``, price: 300, type: 'unlimited', image: 'photo-225517872_457252025' },
					{ name: `Нюхлер`, description: ``, price: 400, type: 'unlimited', image: 'photo-225517872_457252007' },
				]
			},
			{ 
				target: `Магические предметы`, item: [
					{ name: `Фальшивые волшебные палочки-надувалочки`, description: `При взмахе превращается в случайный предмет.`, price: 160, type: 'unlimited', image: 'photo-225517872_457252021' },
					{ name: `Безголовая шляпа`, description: `Делает невидимой только голову.`, price: 160, type: 'unlimited', image: 'photo-225517872_457251990' }, 
					{ name: `Вредноскоп`, description: `Способен выявлять опасность и предупреждать о ней.`, price: 175, type: 'unlimited', image: 'photo-225517872_457251991' },
					{ name: `Драчливый телескоп`, description: `Бьет гирькой в глаз любому, кто попытается посмотреть в него.`, price: 175, type: 'unlimited', image: 'photo-225517872_457251993' }, 
					{ name: `Кусачая кружка`, description: `Чашка, неожиданно кусающая пьющего из неё за нос.`, price: 180, type: 'unlimited', image: 'photo-225517872_457252000' },
					{ name: `Перуанский порошок мгновенной тьмы`, description: `Щепотка, подброшенная в воздух, погружает в мгновенный мрак территорию на несколько метров вокруг.`, price: 185, type: 'unlimited', image: 'photo-225517872_457252012' }, 
					{ name: `Сапоги-скороходы`, description: `Значительно ускоряют походку и увеличивают шаг.`, price: 185, type: 'unlimited', image: 'photo-225517872_457252017' },
					{ name: `Одежда-щит`, description: `Защищает волшебника от слабых и средних заклинаний. От непростительных — не поможет. Действует 3 месяца с момента первого применения.`, price: 192, type: 'unlimited', image: 'photo-225517872_457252009' }, 
				]
			},
			{ 
				target: `Артефакты и реликвии`, item: [
					{ name: `Делюминатор`, description: `Используется для того, чтобы «вытянуть» свет из помещения или из уличных фонарей. Свет хранится в делюминаторе, пока его не вернут в источник освещения.`, price: 500, type: 'unlimited', image: 'photo-225517872_457251992' },
					{ name: `Маховик времени`, description: `Используется для того, чтобы посещать несколько лекций одновременно. С его помощью можно заново пережить недавнее прошлое, но изменить его нельзя. Действует в течение ролевого года с момента первого использования!`, price: 990, type: 'unlimited', image: 'photo-225517872_457252005' }, 
					{ name: `Мантия-невидимка`, description: `Действует в течение ролевого года с момента первого использования!`, price: 1500, type: 'unlimited', image: 'photo-225517872_457252004' },
					{ name: `Святой тапок`, description: `Заставляет собеседника соглашаться с вами и не бесить. Активируется шлепком собеседника по попе. Не действует на администрацию!`, price: 150, type: 'unlimited', image: 'photo-225517872_457252018' },
					{ name: `Ремень-худобздень`, description: `Делает фигуру стройнее, пока надет на владельца`, price: 100, type: 'unlimited', image: 'photo-225517872_457252014' },
					{ name: `Очки-нескрывайки`, description: `Позволяют видеть сквозь стены и иные препятствия`, price: 170, type: 'unlimited', image: 'photo-225517872_457252011' },
					{ name: `Рубаха-летяга`, description: `Если надеть ее на себя и потереть пуговицу, человек будет летать без метлы час. Можно использовать 5 раз с момента первого использования, затем становится обычной рубахой.`, price: 160, type: 'unlimited', image: 'photo-225517872_457252016' },
					{ name: `ОстроУх`, description: `Позволяет подслушать разговор на расстоянии 300 метров. Через стену - 200 метров`, price: 120, type: 'unlimited', image: 'photo-225517872_457252010' },
					{ name: `Робот-рукожоп`, description: `Робот для выполнения повседневных задач, материт хозяина, но выполняет приказы`, price: 200, type: 'unlimited', image: 'photo-225517872_457252015' },
				]
			},
			{ 
				target: `Спорт`, item: [
					{ name: `Форма для квиддича`, description: `Для ловца, охотника и загонщика. В наличии все расцветки.`, price: 40, type: 'unlimited', image: 'photo-225517872_457252022' },
					{ name: `Обмундирование вратаря`, description: `В комплект входит форма, шлем, защита ног и рук, доспех.`, price: 55, type: 'unlimited', image: 'photo-225517872_457252008' }, 
					{ name: `Набор для игры в квиддич`, description: `1 квофл, 2 бладжера, 2 биты, 1 снитч.`, price: 90, type: 'unlimited', image: 'photo-225517872_457252006' },
					{ name: `Спортивная метла`, description: `В ассортименте.`, price: 110, type: 'unlimited', image: 'photo-225517872_457252020' }, 
					{ name: `Полный комплект для квиддича`, description: `Набор для квиддича, обмундирование для любой позиции, метла. В наличии все расцветки.`, price: 200, type: 'unlimited', image: 'photo-225517872_457252013' }, 
				]
			}
		]
		for (const el of items) {
			const category = await prisma.category.findFirst({ where: { name: el.target } })
			if (!category) { await context.send(`Нет категории ${el.target}`); continue }
			for (const item of el.item) {
				const item_check = await prisma.item.findFirst({ where: { name: item.name, id_category: category.id } })
				if (!item_check) { 
					const item_cr = await prisma.item.create({ data: { name: item.name, description: item.description, price: item.price, id_category: category.id, type: item.type, image: item.image } }) 
					await Logger(`In database, init item shop id: ${item_cr.id} name: ${item_cr.name} for users by admin ${context.senderId}`)
					res.count_item++
				} else {
					const item_up = await prisma.item.update({ where: { id: item_check.id }, data: { description: item.description, image: item.image } })
					await Logger(`In database, already init item shop id: ${item_check.id} name: ${item_check.name} and updated for users by admin ${context.senderId}`)
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
			`https://vk.com/rp_tv`, `https://vk.com/new_mm`,
			`https://vk.com/megale_du_nama`, `https://vk.com/harrypotterpotteroman`,
			`https://vk.com/marjoramrg`
		]
		/*for (const alli of alliance) {
			const temp = alli.replace(/.*[/]/, "");
			const [group] = await vk.api.groups.getById({ group_id: temp });
			if (!group) { continue }
			const alli_check = await prisma.alliance.findFirst({ where: { idvk: group.id } })
			if (!alli_check) {
				const alli_cr = await prisma.alliance.create({ data: { name: group.name!, idvk: group.id!, }})
				await Logger(`In database, init alliance id: ${alli_cr.id} name: ${alli_cr.name} for users by admin ${context.senderId}`)
				res.count_alliance++
			} else {
				await Logger(`In database, already init alliance id: ${alli_check.id} name: ${alli_check.name} for users by admin ${context.senderId}`)
			}
		}*/
		await Send_Message(context.senderId, `✅ Игра инициализирована успешно.\n\n 👫 Добавлено новых ролей: ${res.count_role}\n 🎪 Добавлено новых магазинов: ${res.count_shop}\n 👜 Добавлено новых предметов: ${res.count_item}\n 🏠 Добавлено новых союзов: ${res.count_alliance}`)
	})
}
