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
		const answer = await context.question(`${ico_list['load'].ico} Вы подходите к терминалу РП-Банка, экран оживает и появляется сообщение: \n— Система распознала новый биометрический профиль. Для доступа к банковским операциям требуется согласие на обработку персональных данных. \nНа сенсорной панели появился договор. \n${ico_list['help'].ico} У вас есть 5 минут на принятие решения!`,
			{	
				keyboard: Keyboard.builder()
				.textButton({ label: '✏', payload: { command: 'Согласиться' }, color: 'positive' }).row()
				.textButton({ label: '👣', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime(),
				answerTimeLimit
			}
		);
		if (answer.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания подтверждения согласия истекло!`) }
		if (!/да|yes|Согласиться|конечно|✏/i.test(answer.text|| '{}')) {
			await context.send(`${ico_list['stop'].ico} Вы отказались дать свое согласие, доступ к системам банка заблокирован. Терминал отключается.`);
			return;
		}
		//приветствие игрока
		const visit = await context.question(`${ico_list['load'].ico} Подтвердив согласие, вы получаете доступ к личному кабинету. На голографическом дисплее отображается служебный дроид, выполняющий системные процедуры.`,
			{ 	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Подойти и поздороваться', payload: { command: 'Согласиться' }, color: 'positive' }).row()
				.textButton({ label: 'Ждать, пока дроид закончит', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime().inline(),
				answerTimeLimit
			}
		);
		if (visit.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания активности истекло!`) }
		const save = await prisma.account.create({	data: {	idvk: context.senderId } })
		const info = await User_Info(context)
		await context.send(`${ico_list['load'].ico} Дроид завершает работу и обращается к вам: \n— Синхронизация завершена. Добро пожаловать в систему РП-Банка. \nНа экране появляется ваша идентификационная карта.\n${ico_list['save'].ico} Профиль создан, ${info.first_name}\n${ico_list['cardg'].ico} GUID: ${save.id}. \n${ico_list['monitor'].ico} idvk: ${save.idvk}\n${ico_list['date'].ico} Дата регистрации: ${save.crdate}\n`)
		await Logger(`In database created new user with uid [${save.id}] and idvk [${context.senderId}]`)
		await context.send(`${ico_list['warn'].ico} Рекомендуется ознакомиться с руководством по эксплуатации системы "РП-Банк":`,{ 	
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
