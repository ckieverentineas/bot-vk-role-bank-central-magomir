import { KeyboardBuilder } from "vk-io";
import { Fixed_Number_To_Five } from "./helper";
import { ico_list } from "../events/module/data_center/icons_lib";
import { answerTimeLimit } from "../..";

interface Item {
    id: number;
    name: string;
    // Добавьте другие необходимые поля
}

interface Payload {
    command: string;
    id_item_sent: number;
    id_item: number;
}

export async function Simply_Carusel_Selector<T>(context: any, prompt: string, items: T[], infoExtractor: (item: T) => Promise<string>, labelExtractor: (item: T) => string, payloadExtractor: (item: T, index: number) => Payload): Promise<number | null> { 
    // Возвращаем id элемента или null
    let item_check = false;
    let item_sel: number | null = null;
    let id_builder_sent = 0;

    if (items.length > 0) {
        while (!item_check) {
            const keyboard = new KeyboardBuilder();
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent);
            let event_logger = `${ico_list['question'].ico} ${prompt}:\n\n`;
            const limiter = 5;

            if (items.length > 0) {
                let counter = 0;
                for (let i = id_builder_sent; i < items.length && counter < limiter; i++) {
                    const item = items[i];
                    const label = labelExtractor(item); // Получаем метку
                    const payload = payloadExtractor(item, i); // Получаем payload
                    const info = await infoExtractor(item)
                    keyboard.textButton({ label, payload, color: 'secondary' }).row();
                    event_logger += `\n\n${info}`;
                    counter++;
                }
                event_logger += `\n\n${items.length > 1 ? `~~~~ ${Math.min(id_builder_sent + limiter, items.length)} из ${items.length} ~~~~` : ''}`;


                // Предыдущий элемент
                if (items.length > limiter && id_builder_sent > limiter - 1) {
                    keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'item_control_multi', id_item_sent: id_builder_sent - limiter }, color: 'secondary' });
                }
                // Следующий элемент
                if (items.length > limiter && id_builder_sent < items.length - limiter) {
                    keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'item_control_multi', id_item_sent: id_builder_sent + limiter }, color: 'secondary' });
                }
            } else {
                event_logger = `${ico_list['warn'].ico} У вас еще нет элементов.`;
            }

            const answer: any = await context.question(`${event_logger}`, { keyboard: keyboard.inline(), answerTimeLimit });

            if (answer.isTimeout) {
                return await context.send(`${ico_list['time'].ico} Время ожидания выбора элемента истекло!`);
            }

            if (!answer.payload) {
                await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`);
            } else {
                if (answer.text === `${ico_list['next'].ico}` || answer.text === `${ico_list['back'].ico}`) {
                    id_builder_sent = answer.payload.id_item_sent;
                } else {
                    item_sel = answer.payload.id_item;
                    item_check = true;
                }
            }
        }
    }

    return item_sel; // Возвращаем выбранный элемент
}
/*
// Пример использования функции
const person = await prisma.user.findMany<{ id: number; name: string; id_alliance: number }>({
    where: { id_account: account?.id }
});

const selectedPerson = await createCarousel(
    context,
    `dskgksrgk`
    person,
    (item) => `${ico_list['person'].ico} ${item.id}-${item.name.slice(0, 30)}`, // labelExtractor
    (item, index) => ({ command: 'builder_control', id_item_sent: index, id_item: item.id }) // payloadExtractor
);*/
