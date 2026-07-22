import { Keyboard, KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { Logger, Send_Message, Input_Text } from "../../../core/helper";
import { answerTimeLimit, chat_id, timer_text } from "../../../..";
import { Person_Get } from "../person/person";
import { Alliance } from "@prisma/client";
import { ico_list } from "../data_center/icons_lib";

// Интерфейс для настроек
interface ClassSettings {
  id: number;
  allianceId: number;
  mode: 'default' | 'custom' | 'free';
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  option4?: string | null;
  option5?: string | null;
  option6?: string | null;
  updatedAt?: Date;
}

// Стандартные значения
const DEFAULT_OPTIONS = {
  option1: "Ученик",
  option2: "Житель",
  option3: "Профессор",
  option4: "Декан",
  option5: "Бизнесвумен(мэн)",
  option6: "Другое"
};

// Получение настроек положений для альянса
export async function getClassSettings(allianceId: number): Promise<ClassSettings> {
  let settings = await prisma.allianceClassSetting.findFirst({
    where: { allianceId }
  });
  
  if (!settings) {
    // Создаем дефолтные настройки если их нет
    settings = await prisma.allianceClassSetting.create({
      data: {
        allianceId,
        mode: "default",
        ...DEFAULT_OPTIONS
      }
    });
  }
  
  // Приводим тип к ClassSettings с помощью as
  return settings as unknown as ClassSettings;
}

// Получение списка опций для отображения
export async function getClassOptions(allianceId: number): Promise<string[]> {
    const settings = await getClassSettings(allianceId);
    
    if (settings.mode === "free") {
        return []; // Пустой массив для свободного ввода
    }
    
    // Для default и custom режимов возвращаем ТОЛЬКО непустые опции
    const options = [];
    
    if (settings.option1 && settings.option1.trim()) options.push(settings.option1);
    if (settings.option2 && settings.option2.trim()) options.push(settings.option2);
    if (settings.option3 && settings.option3.trim()) options.push(settings.option3);
    if (settings.option4 && settings.option4.trim()) options.push(settings.option4);
    if (settings.option5 && settings.option5.trim()) options.push(settings.option5);
    if (settings.option6 && settings.option6.trim()) options.push(settings.option6);
    
    return options;
}

// Проверка режима
export async function isFreeInputMode(allianceId: number): Promise<boolean> {
  const settings = await getClassSettings(allianceId);
  return settings.mode === "free";
}

export async function Alliance_Class_Settings_Printer(context: any) {
  const user = await Person_Get(context);
  if (!user || !user.id_alliance || user.id_alliance <= 0) {
    return await context.send(`${ico_list['warn'].ico} Вы не состоите в альянсе!`);
  }
  
  const alliance = await prisma.alliance.findFirst({ 
    where: { id: user.id_alliance } 
  });
  
  if (!alliance) {
    return await context.send(`${ico_list['warn'].ico} Альянс не найден!`);
  }
  
  let settings = await getClassSettings(alliance.id);
  
  let settingsTr = false;
  while (!settingsTr) {
    const keyboard = new KeyboardBuilder();
    
    // Отображаем текущий режим
    let currentModeText = "";
    let optionsList = "";
    
    switch (settings.mode) {
      case 'default':
        currentModeText = "⚙ Стандартные кнопки (6 фиксированных)";
        optionsList = `1. ${settings.option1}\n2. ${settings.option2}\n3. ${settings.option3}\n4. ${settings.option4}\n5. ${settings.option5}\n6. ${settings.option6}`;
        break;
      case 'custom':
        currentModeText = "🎨 Кастомные кнопки (свои названия)";
        optionsList = `1. ${settings.option1 || '(не задано)'}\n2. ${settings.option2 || '(не задано)'}\n3. ${settings.option3 || '(не задано)'}\n4. ${settings.option4 || '(не задано)'}\n5. ${settings.option5 || '(не задано)'}\n6. ${settings.option6 || '(не задано)'}`;
        break;
      case 'free':
        currentModeText = "✏ Произвольный ввод (без кнопок)";
        optionsList = "Пользователи вводят положение вручную";
        break;
    }
    
    // Кнопки управления в зависимости от режима
    if (settings.mode === 'default') {
      keyboard.textButton({ 
        label: '🎨 Переключить в кастомные кнопки', 
        payload: { command: 'switch_to_custom' }, 
        color: 'secondary' 
      }).row();
    } else if (settings.mode === 'custom') {
      keyboard.textButton({ 
        label: '⚙ Переключить в стандартные кнопки', 
        payload: { command: 'switch_to_default' }, 
        color: 'secondary' 
      }).row();
    }
    
    if (settings.mode !== 'free') {
      keyboard.textButton({ 
        label: '✏ Переключить в произвольный ввод', 
        payload: { command: 'switch_to_free' }, 
        color: 'secondary' 
      }).row();
    } else {
      keyboard.textButton({ 
        label: '⚙ Вернуться к стандартным кнопкам', 
        payload: { command: 'switch_to_default' }, 
        color: 'secondary' 
      }).row();
    }
    
    if (settings.mode === 'custom') {
      keyboard.textButton({ 
        label: '✏ Настроить кастомные кнопки', 
        payload: { command: 'edit_custom_buttons' }, 
        color: 'secondary' 
      }).row();
    }
    
    keyboard.textButton({ 
      label: `${ico_list['back'].ico} Отмена`, 
      payload: { command: 'back' }, 
      color: 'secondary' 
    });
    
    const message = `${ico_list['config'].ico} Настройки положений для альянса "${alliance.name}":\n\n` +
      `📊 Текущий режим: ${currentModeText}\n\n` +
      `📋 Доступные опции:\n${optionsList}\n\n` +
      `ℹ️ Выберите режим работы системы:`;
    
    const answer = await context.question(message, {
      keyboard: keyboard.inline(),
      answerTimeLimit
    });
    
    if (answer.isTimeout) {
      return await context.send(`${ico_list['time'].ico} Время ожидания выбора истекло!`);
    }
    
    const payload = answer.payload;
    if (!payload) {
      await context.send(`${ico_list['help'].ico} Жмите только по кнопкам!`);
      continue;
    }
    
    switch (payload.command) {
      case 'switch_to_default':
        await updateSettingsMode(alliance.id, 'default', DEFAULT_OPTIONS, context);
        settings = await getClassSettings(alliance.id);
        break;
      
      case 'switch_to_custom':
        // При переключении в кастомный режим сохраняем текущие значения
        await updateSettingsMode(alliance.id, 'custom', {
          option1: settings.option1 || DEFAULT_OPTIONS.option1,
          option2: settings.option2 || DEFAULT_OPTIONS.option2,
          option3: settings.option3 || DEFAULT_OPTIONS.option3,
          option4: settings.option4 || DEFAULT_OPTIONS.option4,
          option5: settings.option5 || DEFAULT_OPTIONS.option5,
          option6: settings.option6 || DEFAULT_OPTIONS.option6
        }, context);
        settings = await getClassSettings(alliance.id);
        break;
      
      case 'switch_to_free':
        await updateSettingsMode(alliance.id, 'free', {
          option1: null,
          option2: null,
          option3: null,
          option4: null,
          option5: null,
          option6: null
        }, context);
        settings = await getClassSettings(alliance.id);
        break;
      
      case 'edit_custom_buttons':
        await editCustomButtons(alliance.id, context);
        settings = await getClassSettings(alliance.id);
        break;
      
      case 'back':
        settingsTr = true;
        await context.send(`${ico_list['stop'].ico} Настройки положений сохранены.`);
        break;
      
      default:
        await context.send(`${ico_list['help'].ico} Неизвестная команда!`);
    }
  }
}

// Обновление режима настроек
async function updateSettingsMode(
  allianceId: number, 
  mode: 'default' | 'custom' | 'free', 
  options: any,
  context: any
) {
  await prisma.allianceClassSetting.upsert({
    where: { allianceId },
    update: {
      mode,
      ...options,
      updatedAt: new Date()
    },
    create: {
      allianceId,
      mode,
      ...options
    }
  });
  
  const modeText = mode === 'default' ? 'стандартные кнопки' : 
                   mode === 'custom' ? 'кастомные кнопки' : 
                   'произвольный ввод';
  
  await context.send(`${ico_list['success'].ico} Режим изменен на "${modeText}"!`);
  
  // Логируем в чат
  const user = await Person_Get(context);
  const alliance = await prisma.alliance.findFirst({ where: { id: allianceId } });
  
  await Send_Message(chat_id, 
    `${ico_list['config'].ico} Изменение режима положений\n` +
    `${ico_list['message'].ico} Режим: ${modeText}\n` +
    `${ico_list['person'].ico} @id${user?.idvk}(${user?.name}) (UID: ${user?.id})\n` +
    `${ico_list['alliance'].ico} ${alliance?.name}`
  );
}

async function editCustomButtons(allianceId: number, context: any) {
    const settings = await getClassSettings(allianceId);
    const alliance = await prisma.alliance.findFirst({ where: { id: allianceId } });
    
    await context.send(`${ico_list['config'].ico} Редактирование кастомных кнопок для "${alliance?.name}":\n\n` +
        `Текущие значения:\n1. ${settings.option1 || '(не задано)'}\n2. ${settings.option2 || '(не задано)'}\n3. ${settings.option3 || '(не задано)'}\n4. ${settings.option4 || '(не задано)'}\n5. ${settings.option5 || '(не задано)'}\n6. ${settings.option6 || '(не задано)'}\n\n` +
        `🔹 "Пропустить" — оставить\n🔹 "Удалить" — убрать кнопку\n🔹 "Готово" — завершить`);
    
    const newOptions: any = {};
    const optionKeys = ['option1', 'option2', 'option3', 'option4', 'option5', 'option6'];
    
    for (let i = 0; i < optionKeys.length; i++) {
        const key = optionKeys[i];
        const currentValue = settings[key] || '';
        
        const optionText = await context.question(
            `Кнопка ${i + 1} (текущее: "${currentValue}"):`,
            timer_text
        );
        
        if (optionText.isTimeout) return;
        
        const input = optionText.text.trim();
        
        if (input.toLowerCase() === 'готово') break;
        if (input.toLowerCase() === 'пропустить') {
            if (currentValue) newOptions[key] = currentValue;
            continue;
        }
        if (input.toLowerCase() === 'удалить') {
            newOptions[key] = '';
            continue;
        }
        if (input.length > 40) {
            await context.send(`⚠ Макс 40 символов`);
            i--;
            continue;
        }
        newOptions[key] = input;
    }
    
    if (Object.keys(newOptions).length > 0) {
        await prisma.allianceClassSetting.update({ where: { allianceId }, data: newOptions });
        await context.send(`✅ Сохранено!`);
    }
}

// Функция для получения клавиатуры с положениями
export async function getClassKeyboard(allianceId: number): Promise<KeyboardBuilder | null> {
  const settings = await getClassSettings(allianceId);
  
  if (settings.mode === 'free') {
    return null; // Нет клавиатуры для произвольного ввода
  }
  
  const keyboard = new KeyboardBuilder();
  const options = await getClassOptions(allianceId);
  
  if (options.length === 0) {
    return null;
  }
  
  // Размещаем кнопки по 2 в ряд
  for (let i = 0; i < options.length; i += 2) {
    if (options[i]) {
      keyboard.textButton({ 
        label: options[i], 
        payload: { command: 'select_class', class: options[i] }, 
        color: 'secondary' 
      });
    }
    
    if (options[i + 1]) {
      keyboard.textButton({ 
        label: options[i + 1], 
        payload: { command: 'select_class', class: options[i + 1] }, 
        color: 'secondary' 
      });
    }
    
    if (i + 2 < options.length) {
      keyboard.row();
    }
  }
  
  return keyboard.inline();
}

// Получение текста для отображения в редакторе персонажа
export async function getClassSettingsText(allianceId: number): Promise<string> {
  const settings = await getClassSettings(allianceId);
  
  switch (settings.mode) {
    case 'default':
      return '⚙ Режим: Стандартные кнопки';
    case 'custom':
      return '🎨 Режим: Кастомные кнопки';
    case 'free':
      return '✏ Режим: Произвольный ввод';
    default:
      return '⚙ Режим настроек положений';
  }
}