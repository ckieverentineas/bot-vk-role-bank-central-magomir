type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'windy' | 'foggy' |
  'hurricane' | 'tornado' | 'meteor_shower' | 'earthquake' | 'volcano';

interface MonthConfig {
  temperature: { min: number; max: number };
  weatherWeights: Record<WeatherType, number>;
}

// Конфигурация месяцев
const MONTH_CONFIGS: Record<string, MonthConfig> = {
  янв: {
    temperature: { min: -40, max: -5 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 20, rain: 0,  storm: 0, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  фев: {
    temperature: { min: -20, max: -2 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 15, rain: 0,  storm: 0, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  мар: {
    temperature: { min: -2, max: 10 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 10, rain: 5,  storm: 5, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  апр: {
    temperature: { min: 5, max: 15 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 1, rain: 10,  storm: 6, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  май: {
    temperature: { min: 12, max: 22 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 0, rain: 15,  storm: 15, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  июн: {
    temperature: { min: 10, max: 30 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 0, rain: 30,  storm: 5, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  июл: {
    temperature: { min: 13, max: 35 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 0, rain: 15,  storm: 20, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  авг: {
    temperature: { min: 20, max: 40 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 0, rain: 5,  storm: 10, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  сен: {
    temperature: { min: 10, max: 20 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 0, rain: 15,  storm: 5, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  окт: {
    temperature: { min: 5, max: 15 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 0, rain: 20,  storm: 30, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  ноя: {
    temperature: { min: -3, max: 8 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 10, rain: 5,  storm: 15, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  },
  дек: {
    temperature: { min: -15, max: 3 },
    weatherWeights: { cloudy: 4, foggy: 4, sunny: 4, windy: 4, snow: 20, rain: 2,  storm: 2, tornado: 1, hurricane: 1, meteor_shower: 1, earthquake: 1, volcano: 1 }
  }
};

// Описания для типов погоды
const WEATHER_DESCRIPTIONS: Record<WeatherType, string[]> = {
  sunny: [
    'Солнце светит ярко, небо безоблачно.',
    'Ясная погода, отличный день для прогулок.',
    'Полный штиль, ни облачка на горизонте.',
    'Тепло и уютно, можно загорать.',
    'Яркое солнце освещает голубое небо, воздух тёплый и свежий.',
    'Безоблачное небо и тепло создают идеальную атмосферу для прогулки.',
    'Светит ясное солнце, даря хорошее настроение и заряд энергии.',
    'Тёплый солнечный день с лёгкой прохладой в тени.',
    'Палящие лучи солнца заливают всё вокруг ярким светом и теплом.',
    'Солнце безжалостно светит в чистом небе, воздух прогревается до жары.',
    'Яркое солнце не щадит ни тени — день наполнен жаром и светом.',
    'Небо ясное, солнце сияет так ярко, что хочется спрятаться в тень.',
    'Солнечный зной и сверкающий свет создают ощущение летнего пекла.',
  ],
  cloudy: [
    'Переменная облачность, местами просветы.',
    'Небо затянуто облаками, но сухо.',
    'Прохладно, но комфортно.',
    'Может пройти кратковременный дождь.',
    'Небо затянуто плотной серой пеленой, свет едва пробивается сквозь облака',
    'Серая мгла окутывает округу, делая день тусклым и спокойным.',
    'Облака сплелись в непроглядный покров, скрывая солнце и его жаркие краски.',
    'Тусклый свет пасмурного дня создаёт атмосферу задумчивости и тишины.',
    'Хмурое небо не обещает просвета, словно день застыл в серой грусти.',
    'Плотные облака прижимают горизонт, и кажется, что дождь вот-вот начнётся..',
    'День серый и неприветливый, солнце скрыто за тяжелыми тучами.',
    'В воздухе чувствуется влажность, а небо покрыто ровным слоем облаков.',
    'Облака заслонили свет, и мир окутался мягкой, спокойной дымкой.',
    'Пасмурный день с легкой сыростью в воздухе.',
  ],
  rain: [
    'Льёт как из ведра, не забудьте зонт.',
    'Небольшой моросящий дождик.',
    'Дождь будет весь день, дороги мокрые.',
    'Ожидается кратковременный ливень.',
    'Мягкий дождь тихо стучит по крышам, создавая уютную мелодию.',
    'Небо серое, капли дождя стекают по стеклам.',
    'Влажный воздух наполняет улицы свежестью, а дождь льёт без остановки.',
    'Дождевые потоки смывают пыль, окутывая мир в серо-голубую дымку.',
    'Влажный воздух пропитан запахом земли и свежести, капли ритмично играют на листьях.',
    'Скрытое за серыми тучами солнце тонет в морось, а мир окутан мягкой меланхолией.',
    'Ливень разбивает тишину, капли бьют по крышам и улицам, создавая оглушительный ритм.',
    'Небо хмурое и тяжёлое, дождь льёт стеной, скрывая все звуки и краски вокруг.',
    'Потоки воды смывают всё на своём пути, превращая окресности в реку.',
    'Густой дождь заливает улицы, а ветер срывает листья и уносит мелкие вещи.',
    'Непрерывный ливень, словно стихия, поглощает свет и звуки, оставляя лишь шум воды.',

  ],
  storm: [
    'Гроза! Молнии и порывы ветра.',
    'Ураганный ветер и сильный дождь.',
    'Буря разразилась над городом!',
    'Небо затянуто тяжёлыми тучами, и грохот грома разрывает тишину, предвещая бурю.',
    'Молнии вспыхивают вдалеке, освещая мрачный пейзаж, а ветер свистит в кронах деревьев.',
    'Грозовые тучи нависают над местностью, дождь бьёт порывами, словно разрывая пространство.',
    'В небе сверкают вспышки, и тяжёлый воздух напряжён ожиданием мощной грозы.',
    'Гром раскатывается с небес, а порывистый ветер гонит тучи и дождевые струи по улицам.',
  ],
  snow: [
    'Идёт пушистый снег, всё покрывается белым одеялом.',
    'Снежинки кружат в воздухе, зимняя сказка.',
    'Метель, почти ничего не видно.',
    'Пушистые снежинки тихо опускаются на землю, окутывая мир белоснежным покрывалом.',
    'Хрустящий снег под ногами и морозный воздух создают ощущение зимней сказки.',
    'Снегопад продолжится до вечера.',
    'Небо серое, но снежные хлопья падают нежно, словно замедляя время вокруг.',
    'Зимний ветер носит снежные вихри, превращая улицы в белоснежные просторы.',
    'Тишина снежного дня словно окутывает всё вокруг, придавая миру волшебное спокойствие..',
    'Снег валит густыми хлопьями, скрывая за собой всё вокруг белой пеленой.',
    'Мощная метель кружит и свистит, превращая улицы в снежные пустыни.',
    'Снежная буря не оставляет просветов укутывая все белоснежным одеялом.',
    'Снегопад идёт непрерывно.',
    'Леденящие порывы ветра и снежная пелена покрывают все вокруг.',
  ],
  windy: [
    'Сильный ветер срывает крыши!',
    'Порывы ветра до 20 м/с.',
    'На улице ветрено, но сухо.',
    'Воздух полон пыли и листьев.',
    'Сильный ветер гонит облака по небу, играя с листьями и шумя в кронах деревьев.',
    'Холодные порывы ветра пронизывают воздух, заставляя одежду развеваться.',
    'Ветер свистит между деревьями, поднимая ветки и листья в лёгкий вихрь.',
    'Сильные порывы ветра.',
    'Лёгкий, но постоянный ветер.',
    'Освежающий ветерок.',
  ],
  foggy: [
    'Густой туман, едва видно на несколько метров.',
    'Всё заволокло серой пеленой.',
    'Туман стоит над рекой, создавая атмосферу мистики.',
    'Хороший повод остаться дома.'
  ],
  hurricane: [
    'Ураган бушует! Порывы ветра до 30 м/с.',
    'Сильнейший ураган повреждает крыши домов.',
    'Деревья выворачиваются с корнями!',
    'Огромные волны разрушают береговую линию.'
  ],
  tornado: [
    'Торнадо приближается! Бегите в укрытие!',
    'Воздушный вихрь захватывает всё на своём пути.',
    'Крыши домов срываются, как бумага.',
    'Торнадо проносится по городу, оставляя хаос.'
  ],
  meteor_shower: [
    'Небо светится от падающих метеоритов.',
    'Метеоритный дождь освещает ночное небо.',
    'Люди выходят из домов, чтобы полюбоваться шоу.',
    'Некоторые метеориты падают рядом!'
  ],
  earthquake: [
    'Землетрясение! Здания трясёт, падают шкафы.',
    'Подземные толчки продолжаются уже несколько минут.',
    'Люди выбегают на улицы в панике.',
    'Где-то рухнула стена.'
  ],
  volcano: [
    'Вулкан проснулся! Лава течёт по склонам.',
    'Облако пепла закрывает солнце.',
    'Жители покидают свои дома.',
    'Грохот слышен даже на расстоянии.'
  ]
};

// Эмодзи для погоды
const WEATHER_EMOJIS: Record<WeatherType, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  rain: '🌧️',
  storm: '⛈️',
  snow: '🌨️',
  windy: '🌬️',
  foggy: '🌫️',
  hurricane: '🌀',
  tornado: '🌪️',
  meteor_shower: '🌠',
  earthquake: '🌋',
  volcano: '🌋'
};

function Random_Int_Array(koef: number) {
    let cals = Math.round(Math.random() * koef)
    if (cals == koef) {
        cals--
    }
    return cals
}
// Взвешенный случайный выбор
function weightedRandomKey<T extends Record<string, number>>(weights: T): keyof T {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Random_Int_Array(total);
    for (const key in weights) {
      rand -= weights[key];
      if (rand <= 0) return key as keyof T;
    }
    return Object.keys(weights)[0] as keyof T;
}
  
// Получить случайное описание для типа погоды
function getRandomDescription(type: WeatherType): string {
    const descriptions = WEATHER_DESCRIPTIONS[type];
    return descriptions[Random_Int_Array(descriptions.length)];
}
  
// Получить случайную погоду для месяца
function getWeatherForMonth(month: string): { type: WeatherType; description: string; emoji: string; temperature: number } {
    const config = MONTH_CONFIGS[month] || MONTH_CONFIGS['июн'];
    const weatherType = weightedRandomKey(config.weatherWeights);
    const temperature = Math.round(Math.random() * (config.temperature.max - config.temperature.min + 1) + config.temperature.min);
  
    return {
      type: weatherType,
      description: getRandomDescription(weatherType),
      emoji: WEATHER_EMOJIS[weatherType],
      temperature
    };
}

type DayForecast = {
    dayName: string;
    month: string;
    temperature: number;
    type: WeatherType;
};
  
function generateWeek(startMonthIndex: number, endMonthIndex: number): { forecastText: string; data: DayForecast[] } {
    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const months = Object.keys(MONTH_CONFIGS);
  
    const startMonth = months[startMonthIndex % months.length];
    const endMonth = months[endMonthIndex % months.length];
  
    const forecastText: string[] = [];
    const data: DayForecast[] = [];
  
    for (let i = 0; i < daysOfWeek.length; i++) {
      const dayName = daysOfWeek[i];
  
      let month = startMonth;
      // Первые 3 дня — в первом месяце, остальные — во втором
      if (i >= 3) {
        month = endMonth;
      }
  
      const weather = getWeatherForMonth(month);
      if ( i == 3) {
        forecastText.push(`${weather.emoji}${dayName} (${startMonth}-${endMonth}) ${weather.temperature}°C:\n${weather.description}\n\n`);
      } else {
        forecastText.push(`${weather.emoji}${dayName} (${month}) ${weather.temperature}°C:\n${weather.description}\n\n`);
      }
  
      data.push({
        dayName,
        month,
        temperature: weather.temperature,
        type: weather.type
      });
    }
  
    const summary = generateWeeklySummary(data);
  
    return {
      forecastText: forecastText.join('') + summary,
      data
    };
}

interface AnalyticsData {
    totalDays: number;
    totalTemp: number;
    minTemp: number;
    maxTemp: number;
  
    // Обычные события
    sunnyDays: number;
    rainDays: number;
    stormDays: number;
    snowDays: number;
  
    // Редкие явления
    hurricaneDays: number;
    tornadoDays: number;
    meteorShowerDays: number;
    earthquakeDays: number;
    volcanoDays: number;
}

type AnalyticsUpdater = (data: AnalyticsData) => void;

const analyticsRules: Record<WeatherType, AnalyticsUpdater[]> = {
  sunny: [
    data => data.sunnyDays++
  ],
  cloudy: [],
  rain: [
    data => data.rainDays++
  ],
  storm: [
    data => data.rainDays++,
    data => data.stormDays++
  ],
  snow: [
    data => data.snowDays++
  ],
  windy: [],
  foggy: [],

  // Редкие явления
  hurricane: [
    data => data.hurricaneDays++,
  ],
  tornado: [
    data => data.tornadoDays++,
  ],
  meteor_shower: [
    data => data.meteorShowerDays++,
  ],
  earthquake: [
    data => data.earthquakeDays++,
  ],
  volcano: [
    data => data.volcanoDays++,
  ]
};

interface SummaryLine {
    condition: (data: AnalyticsData) => boolean;
    text: (data: AnalyticsData) => string;
  }
  
  const SUMMARY_LINES: SummaryLine[] = [
    {
      condition: data => data.sunnyDays > 0,
      text: data => `☀️ Солнечных дней: ${data.sunnyDays}`
    },
    {
      condition: data => data.rainDays > 0,
      text: data => `🌧️ Дождливых дней: ${data.rainDays}`
    },
    {
      condition: data => data.stormDays > 0,
      text: data => `⛈️ Грозовых дней: ${data.stormDays}`
    },
    {
      condition: data => data.snowDays > 0,
      text: data => `🌨️ Снежных дней: ${data.snowDays}`
    }
];

interface RareEvent {
    condition: (data: AnalyticsData) => boolean;
    name: string;
    count: (data: AnalyticsData) => number;
  }
  
  const RARE_EVENTS: RareEvent[] = [
    {
      condition: data => data.hurricaneDays > 0,
      name: 'ураган',
      count: data => data.hurricaneDays
    },
    {
      condition: data => data.tornadoDays > 0,
      name: 'торнадо',
      count: data => data.tornadoDays
    },
    {
      condition: data => data.meteorShowerDays > 0,
      name: 'метеоритный дождь',
      count: data => data.meteorShowerDays
    },
    {
      condition: data => data.earthquakeDays > 0,
      name: 'землетрясение',
      count: data => data.earthquakeDays
    },
    {
      condition: data => data.volcanoDays > 0,
      name: 'извержение вулкана',
      count: data => data.volcanoDays
    }
  ];

  function generateWeeklySummary(weekData: {
    dayName: string;
    month: string;
    temperature: number;
    type: WeatherType;
  }[]) {
  
    const analytics: AnalyticsData = {
      totalDays: weekData.length,
      totalTemp: 0,
      minTemp: Infinity,
      maxTemp: -Infinity,
  
      sunnyDays: 0,
      rainDays: 0,
      stormDays: 0,
      snowDays: 0,
  
      hurricaneDays: 0,
      tornadoDays: 0,
      meteorShowerDays: 0,
      earthquakeDays: 0,
      volcanoDays: 0
    };
  
    for (const day of weekData) {
      analytics.totalTemp += day.temperature;
      analytics.minTemp = Math.min(analytics.minTemp, day.temperature);
      analytics.maxTemp = Math.max(analytics.maxTemp, day.temperature);
  
      const rules = analyticsRules[day.type] || [];
      for (const rule of rules) {
        rule(analytics);
      }
    }
  
    const avgTemp = Number((analytics.totalTemp / analytics.totalDays).toFixed(1));
  
    let summary = `\n📊 Общий прогноз:\n`;
    summary += `Средняя температура: ${avgTemp}°C\n`;
    summary += `Температурный диапазон: от ${analytics.minTemp}°C до ${analytics.maxTemp}°C\n`;
  
    // Обычные события
    const summaryLines = SUMMARY_LINES
      .filter(line => line.condition(analytics))
      .map(line => line.text(analytics));
  
    summary += summaryLines.join('\n') + '\n';
  
    // Редкие явления
    const rareEvents = RARE_EVENTS
      .filter(event => event.condition(analytics))
      .map(event => `${event.name} (${event.count(analytics)})`);
  
    if (rareEvents.length > 0) {
      summary += `⚠️ Редкие явления: ${rareEvents.join(', ')}\n`;
    }
  
    // Заключение
    let conclusion = '';
  
    if (avgTemp < 0) {
      conclusion = 'Холодно, как и положено зимой. Одевайтесь потеплее!';
    } else if (avgTemp < 15) {
      conclusion = 'Прохладно, но весна уже близко. Не забывайте зонт.';
    } else if (avgTemp < 25) {
      conclusion = 'Очень комфортная погода для прогулок и отдыха.';
    } else {
      conclusion = 'Жаркое лето во всю силу. Советуем найти тень и холодное питьё.';
    }
  
    // Особые комментарии по редким явлениям
    if (
      analytics.hurricaneDays +
      analytics.tornadoDays +
      analytics.earthquakeDays +
      analytics.volcanoDays > 0
    ) {
      conclusion += '\n⚠️ На этой неделе возможны чрезвычайные происшествия!';
    }
  
    summary += `📌 Заключение:\n${conclusion}\n\n`;
  
    return summary;
}

export function generateAllWeeks(): string {
    const months = Object.keys(MONTH_CONFIGS);
    let startMonthIndex = 0; // начальный случайный месяц
    let output = '';
  
    for (let weekNumber = 1; weekNumber <= 6; weekNumber++) {
      const currentMonth = months[startMonthIndex % months.length];
      const nextMonth = months[(startMonthIndex + 1) % months.length];
  
      output += `\n📅 Неделя ${weekNumber} (${currentMonth}-${nextMonth}):\n`;
  
      const { forecastText } = generateWeek(startMonthIndex, startMonthIndex + 1);
      output += forecastText + '\n';
  
      // Переходим к следующему месяцу для следующей недели
      startMonthIndex += 2;
    }
  
    return output;
}