import { Keyboard } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, chat_id } from "../../../..";
import { User_Info } from "../tool";
import { Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
import { Person_Detector } from "./person";
import { ico_list } from "../data_center/icons_lib";

export async function Account_Register(context: any) {
    //проверяем есть ли пользователь в базах данных
	const user_check = await prisma.account.findFirst({ where: { idvk: context.senderId } })
	//если пользователя нет, то начинаем регистрацию
	if (!user_check) {
		//согласие на обработку
		const answer = await context.question(`${ico_list['load'].ico} Вы входите в Центробанк Магомира, из ниоткуда перед вами предстали два орка и произнесли: \n— Министр Магии говорил нам о вас. Но прежде чем продолжить, распишитесь здесь о своем согласии на обработку персональных данных. \nВ тот же миг в ваших руках магическим образом появился пергамент. \n${ico_list['help'].ico} У вас есть 5 минут на принятие решения!`,
			{	
				keyboard: Keyboard.builder()
				.textButton({ label: '✏', payload: { command: 'Согласиться' }, color: 'positive' }).row()
				.textButton({ label: '👣', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime(),
				answerTimeLimit
			}
		);
		if (answer.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания подтверждения согласия истекло!`) }
		if (!/да|yes|Согласиться|конечно|✏/i.test(answer.text|| '{}')) {
			await context.send(`${ico_list['cancel'].ico} Вы отказались дать свое согласие, а живым отсюда никто не уходил, вас упаковали!`);
			return;
		}
		//приветствие игрока
		const visit = await context.question(`${ico_list['load'].ico} Поставив свою подпись, вы, стараясь не смотреть косо на орков, вошли в личный кабинет Центробанка, и увидели домашнего эльфа, наводящего порядок, ужас и страх.`,
			{ 	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Подойти и поздороваться', payload: { command: 'Согласиться' }, color: 'positive' }).row()
				.textButton({ label: 'Ждать, пока эльф закончит', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime().inline(),
				answerTimeLimit
			}
		);
		if (visit.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания активности истекло!`) }
		const save = await prisma.account.create({	data: {	idvk: context.senderId } })
		const info = await User_Info(context)
		await context.send(`${ico_list['load'].ico} Эльф отвлекся от дел, заприметив вас, подошел и сказал.\n— Добро пожаловать в мир меча и магии! \nИ протянул вам вашу карточку.\n${ico_list['save'].ico} Вы получили картотеку, ${info.first_name}\n${ico_list['cardg'].ico} GUID: ${save.id}. \n${ico_list['monitor'].ico} idvk: ${save.idvk}\n${ico_list['date'].ico} Дата регистрации: ${save.crdate}\n`)
		await Logger(`In database created new user with uid [${save.id}] and idvk [${context.senderId}]`)
		await context.send(`${ico_list['warn'].ico} Настоятельно рекомендуем ознакомиться с инструкцией эксплуатации системы "Центробанк Магомира":`,{ 	
			keyboard: Keyboard.builder()
			.urlButton({ label: '⚡ Инструкция', url: `https://vk.com/@bank_mm-instrukciya-po-polzovaniu-botom-centrobanka-magomira` }).row().inline().oneTime(),
			answerTimeLimit
		})
		const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: context.senderId } })
		const ans_selector = `${ico_list['save'].ico} Сохранение аккаунта [${!check_bbox ? "легально" : "НЕЛЕГАЛЬНО"}] GUID-${save.id}:\n👤 @id${save.idvk}(${info.first_name} ${info?.last_name})`
		await Send_Message(chat_id, `${ans_selector}`)
		await Person_Detector(context)
		await Keyboard_Index(context, `${ico_list['help'].ico} Подсказка: Когда все операции вы успешно завершили, напишите [!банк] без квадратных скобочек, а затем нажмите кнопку: ✅Подтвердить авторизацию!`)
	} else {
		await Person_Detector(context)
		await Keyboard_Index(context, `${ico_list['load'].ico} Загрузка, пожалуйста, подождите...`)
	}
}