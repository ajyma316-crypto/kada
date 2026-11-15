/**
 * ПРАВИЛА ФИКХА, ИСПОЛЬЗУЕМЫЕ В РАСЧЁТАХ
 * ======================================
 * Этот файл — единственное место, где хранятся религиозные параметры.
 * Интерфейс и калькулятор только читают их. Чтобы исправить правило,
 * специалисту достаточно отредактировать данные ниже — код менять не нужно.
 *
 * ВАЖНО: правила собраны по общеизвестным положениям классических учебников
 * каждого мазхаба и НЕ прошли проверку квалифицированным муфтием/факихом.
 * Поле `review` фиксирует статус проверки. Пока статус `unverified`,
 * интерфейс показывает предупреждение.
 *
 * Возраст указывается в ЛУННЫХ (хиджрийских) годах — так он дан в источниках.
 */
import type { ExemptionKind, Madhab } from '../domain/types';

export interface L10n {
  ru: string;
  en: string;
  /** Кыргызский; если перевода нет, показывается русский текст. */
  ky?: string;
}

export type ReviewStatus = 'unverified' | 'reviewed';

export interface ExemptionRule {
  /** Освобождает ли такой период от возмещения. */
  exempt: boolean;
  /** Минимальная непрерывная длительность (в днях), начиная с которой период освобождает. */
  minConsecutiveDays?: number;
  note: L10n;
  disputed?: boolean;
}

export interface MadhabRules {
  id: Madhab;
  name: L10n;
  nameAr: string;
  review: { status: ReviewStatus; reviewer?: string; date?: string };
  bulugh: {
    /** Возраст булюга при отсутствии физических признаков (лунные годы). */
    defaultAgeLunar: number;
    /** Самый ранний возраст, с которого признаки булюга признаются (лунные годы). */
    minAgeLunar: { male: number | null; female: number };
    note: L10n;
    disputed: boolean;
  };
  hayd: { minDays: number | null; maxDays: number; note: L10n };
  nifas: { maxDays: number; note: L10n };
  witr: {
    status: L10n;
    /** Обязательно ли возмещать витр по этому мазхабу. */
    qadaRequired: boolean;
    note: L10n;
  };
  qadaTiming: L10n;
  order: L10n;
  exemptions: Record<ExemptionKind, ExemptionRule>;
  sources: string[]; // id из SOURCES
}

/** Общие для всех четырёх мазхабов положения. */
export const COMMON_RULES = {
  haydNoQada: {
    ru: 'Женщина не совершает намаз во время хайда (менструации) и нифаса (послеродового кровотечения) и не возмещает эти намазы. Это положение единогласно (иджма‘) у четырёх мазхабов.',
    en: 'A woman does not pray during hayd (menstruation) or nifas (post-natal bleeding) and does not make those prayers up. This is agreed upon (ijma‘) by the four madhhabs.',
    ky: 'Аял киши хайз (айыз) жана нифас (төрөттөн кийинки кан) учурунда намаз окубайт жана ал намаздарды каза кылбайт. Бул жобо төрт мазхабда бир ооздон кабыл алынган (ижма).',
  },
  deliberateMissed: {
    ru: 'По четырём мазхабам намазы, пропущенные без уважительной причины (в том числе умышленно), обязательно возмещать. Существует мнение меньшинства учёных (Ибн Хазм; Ибн Таймийя), что умышленно оставленный намаз не возмещается, а требуется покаяние и увеличение добровольных намазов. Приложение следует позиции четырёх мазхабов — при сомнениях обратитесь к учёному.',
    en: 'According to the four madhhabs, prayers missed without valid excuse (including deliberately) must be made up. A minority view (Ibn Hazm; Ibn Taymiyya) holds that a deliberately abandoned prayer is not made up, but requires repentance and extra voluntary prayers. The app follows the four madhhabs — consult a scholar if in doubt.',
    ky: 'Төрт мазхаб боюнча себепсиз (анын ичинде атайылап) калтырылган намаздарды сөзсүз каза кылуу керек. Аалымдардын азчылыгынын (Ибн Хазм; Ибн Таймия) пикири боюнча атайылап калтырылган намаз каза кылынбайт, тообо кылып, нафил намаздарды көбөйтүү талап кылынат. Тиркеме төрт мазхабдын позициясын карманат — шектенсеңиз, аалымга кайрылыңыз.',
  },
  bulughSigns: {
    ru: 'Булюг (совершеннолетие) наступает прежде всего по физическим признакам (у юношей — поллюция, у девушек — менструация или беременность). Возраст из таблицы применяется, только если признаки не появились раньше. Если вы помните, когда появились признаки, — укажите дату булюга напрямую.',
    en: 'Bulugh (legal maturity) is established primarily by physical signs (for boys — wet dream, for girls — menstruation or pregnancy). The age in the table applies only if no signs appeared earlier. If you remember when the signs appeared, enter the date of bulugh directly.',
    ky: 'Балагат (шарият боюнча бойго жетүү) биринчи кезекте дене белгилери менен аныкталат (эркек балада — ихтилам, кыз балада — айыз же кош бойлуулук). Таблицадагы жаш белгилер эртерээк пайда болбосо гана колдонулат. Белгилер качан пайда болгонун эстесеңиз, балагат күнүн түз көрсөтүңүз.',
  },
  travel: {
    ru: 'Путешествие не уменьшает количество намазов: меняется только число ракаатов (сокращение). Поэтому периоды поездок не вычитаются из расчёта.',
    en: 'Travel does not reduce the number of prayers, only the number of rak‘ahs (shortening). Travel periods are therefore not subtracted.',
    ky: 'Сапар намаздардын санын азайтпайт, рекеттердин саны гана кыскарат. Ошондуктан сапар мезгилдери эсептен алынбайт.',
  },
  approximation: {
    ru: 'Если точное количество неизвестно, учёные рекомендуют возмещать столько, чтобы появилась уверенность или преобладающее предположение (галабат аз-занн), что долг погашен. Поэтому калькулятор округляет в сторону осторожности — в пользу большего числа намазов.',
    en: 'When the exact number is unknown, scholars advise making up enough prayers to reach certainty or a predominant belief (ghalabat al-zann) that the debt is cleared. The calculator therefore rounds in the cautious direction — towards more prayers.',
    ky: 'Так сан белгисиз болсо, аалымдар карыз төлөндү деген ишеним же басымдуу ой (галабат аз-занн) пайда болгонго чейин каза кылууну сунушташат. Ошондуктан калькулятор этияттык тарапка — көбүрөөк намаз тарапка тегеректейт.',
  },
} satisfies Record<string, L10n>;

const EX_BEFORE_ISLAM: ExemptionRule = {
  exempt: true,
  note: {
    ru: 'Человек, принявший Ислам, не возмещает намазы времени до принятия Ислама (единогласно). Вероотступничество (ридда) — отдельный вопрос с разногласиями, этот пункт его не охватывает.',
    en: 'A person who embraced Islam does not make up prayers from before Islam (agreed). Apostasy (riddah) is a separate disputed issue not covered here.',
    ky: 'Исламды кабыл алган адам Исламга чейинки намаздарды каза кылбайт (бир ооздон). Диндан чыгуу (ридда) — өзүнчө талаштуу маселе, бул пункт аны камтыбайт.',
  },
};

const EX_KNOWN_HAYD: ExemptionRule = {
  exempt: true,
  note: { ru: 'Известные даты хайда — не возмещаются.', en: 'Known hayd dates — not made up.', ky: 'Хайздын белгилүү күндөрү — каза кылынбайт.' },
};
const EX_KNOWN_NIFAS: ExemptionRule = {
  exempt: true,
  note: { ru: 'Известные даты нифаса — не возмещаются.', en: 'Known nifas dates — not made up.', ky: 'Нифастын белгилүү күндөрү — каза кылынбайт.' },
};
const EX_OTHER: ExemptionRule = {
  exempt: true,
  disputed: true,
  note: {
    ru: 'Иной период, который вы считаете освобождающим. Это ваше собственное суждение — уточните его у учёного.',
    en: 'Another period you consider exempting. This is your own judgement — verify it with a scholar.',
    ky: 'Сиз бошотот деп эсептеген башка мезгил. Бул өзүңүздүн пикириңиз — аалымдан тактаңыз.',
  },
};

export const MADHAB_RULES: Record<Madhab, MadhabRules> = {
  hanafi: {
    id: 'hanafi',
    name: { ru: 'Ханафитский', en: 'Hanafi', ky: 'Ханафий' },
    nameAr: 'الحنفي',
    review: { status: 'unverified' },
    bulugh: {
      defaultAgeLunar: 15,
      minAgeLunar: { male: 12, female: 9 },
      disputed: true,
      note: {
        ru: 'При отсутствии признаков — 15 лунных лет (мнение имамов Абу Юсуфа и Мухаммада, по нему дана фетва). Мнение Абу Ханифы — 18 лет для юношей и 17 для девушек. Признаки признаются не ранее 12 лет у юношей и 9 лет у девушек.',
        en: 'Without signs — 15 lunar years (view of Abu Yusuf and Muhammad, on which fatwa is given). Abu Hanifa’s view — 18 for boys and 17 for girls. Signs are recognised no earlier than 12 for boys and 9 for girls.',
        ky: 'Белгилер болбосо — 15 хижрий жыл (имам Абу Юсуф менен Мухаммаддын пикири, фатва ушуга берилген). Абу Ханифанын пикири — эркек балага 18, кыз балага 17 жаш. Белгилер эркек балада 12 жаштан, кыз балада 9 жаштан эрте таанылбайт.',
      },
    },
    hayd: {
      minDays: 3,
      maxDays: 10,
      note: {
        ru: 'Хайд — минимум 3 суток, максимум 10 суток. Кровь сверх 10 суток считается истихадой (болезненным кровотечением), в это время намаз обязателен.',
        en: 'Hayd — minimum 3 days, maximum 10 days. Bleeding beyond 10 days is istihadah, during which prayer is obligatory.',
        ky: 'Хайз — эң аз 3 сутка, эң көп 10 сутка. 10 суткадан ашкан кан истихада (оорулуу кан) болуп эсептелет, бул убакта намаз парз.',
      },
    },
    nifas: {
      maxDays: 40,
      note: {
        ru: 'Нифас — максимум 40 суток, минимального срока нет.',
        en: 'Nifas — maximum 40 days, no minimum.',
        ky: 'Нифас — эң көп 40 сутка, эң аз мөөнөтү жок.',
      },
    },
    witr: {
      status: { ru: 'ваджиб', en: 'wajib', ky: 'важиб' },
      qadaRequired: true,
      note: {
        ru: 'Витр — ваджиб; пропущенный витр обязательно возмещается.',
        en: 'Witr is wajib; a missed witr must be made up.',
        ky: 'Витр — важиб; калтырылган витр сөзсүз каза кылынат.',
      },
    },
    qadaTiming: {
      ru: 'Возмещать можно в любое время, кроме трёх запретных: восход солнца, зенит и закат.',
      en: 'Make-up prayers can be performed at any time except the three prohibited times: sunrise, zenith and sunset.',
      ky: 'Каза намаздарды үч тыюу салынган убакыттан башка каалаган убакта окууга болот: күн чыгып жатканда, күн так төбөдө турганда жана күн батып жатканда.',
    },
    order: {
      ru: 'Соблюдение очерёдности обязательно для того, у кого пропущено менее шести намазов (сахиб ат-тартиб). При шести и более пропущенных очерёдность снимается.',
      en: 'Sequence is obligatory for someone with fewer than six missed prayers (sahib al-tartib). With six or more, the sequence requirement lapses.',
      ky: 'Алтыдан аз намазы калган адам үчүн (сахиб ат-тартиб) ирээтти сактоо милдеттүү. Алты же андан көп намаз калса, ирээт талабы түшөт.',
    },
    exemptions: {
      before_islam: EX_BEFORE_ISLAM,
      insanity: {
        exempt: true,
        minConsecutiveDays: 2,
        disputed: true,
        note: {
          ru: 'Если безумие длилось более суток (более пяти намазов), эти намазы не возмещаются; если меньше — возмещаются. Калькулятор освобождает только периоды от 2 полных дней.',
          en: 'If insanity lasted more than a day and night (more than five prayers), those prayers are not made up; if less, they are. The calculator only exempts periods of 2+ full days.',
          ky: 'Акыл-эс жоготуу бир суткадан ашык (беш намаздан көп) созулса, ал намаздар каза кылынбайт; аз болсо — каза кылынат. Калькулятор 2 толук күндөн кем эмес мезгилдерди гана бошотот.',
        },
      },
      unconsciousness: {
        exempt: true,
        minConsecutiveDays: 2,
        disputed: true,
        note: {
          ru: 'Потеря сознания более суток (более пяти намазов) освобождает от возмещения; менее — нет. Калькулятор освобождает только периоды от 2 полных дней.',
          en: 'Unconsciousness for more than a day and night (more than five prayers) exempts; less does not. The calculator only exempts periods of 2+ full days.',
          ky: 'Эс-учун бир суткадан ашык (беш намаздан көп) жоготуу каза кылуудан бошотот; аз болсо — бошотпойт. Калькулятор 2 толук күндөн кем эмес мезгилдерди гана бошотот.',
        },
      },
      hayd_known: EX_KNOWN_HAYD,
      nifas_known: EX_KNOWN_NIFAS,
      other: EX_OTHER,
    },
    sources: ['hidaya', 'nur_idah', 'radd_muhtar'],
  },

  shafii: {
    id: 'shafii',
    name: { ru: 'Шафиитский', en: 'Shafi‘i', ky: 'Шафиий' },
    nameAr: 'الشافعي',
    review: { status: 'unverified' },
    bulugh: {
      defaultAgeLunar: 15,
      minAgeLunar: { male: 9, female: 9 },
      disputed: false,
      note: {
        ru: 'При отсутствии признаков — 15 полных лунных лет. Признаки (поллюция, менструация) признаются не ранее примерно 9 лунных лет.',
        en: 'Without signs — 15 full lunar years. Signs (wet dream, menstruation) are recognised from approximately 9 lunar years.',
        ky: 'Белгилер болбосо — толук 15 хижрий жыл. Белгилер (ихтилам, айыз) болжол менен 9 хижрий жаштан тартып таанылат.',
      },
    },
    hayd: {
      minDays: 1,
      maxDays: 15,
      note: {
        ru: 'Хайд — минимум сутки, максимум 15 суток; обычно 6–7 дней.',
        en: 'Hayd — minimum one day and night, maximum 15 days; usually 6–7 days.',
        ky: 'Хайз — эң аз бир сутка, эң көп 15 сутка; адатта 6–7 күн.',
      },
    },
    nifas: {
      maxDays: 60,
      note: { ru: 'Нифас — максимум 60 суток, обычно 40.', en: 'Nifas — maximum 60 days, usually 40.', ky: 'Нифас — эң көп 60 сутка, адатта 40.' },
    },
    witr: {
      status: { ru: 'сунна муаккада', en: 'sunnah mu’akkadah', ky: 'бекем сүннөт (муаккада)' },
      qadaRequired: false,
      note: {
        ru: 'Витр — подтверждённая сунна, его возмещение не обязательно. Возмещение сунн, привязанных ко времени, считается желательным (мустахабб).',
        en: 'Witr is an emphasised sunnah; making it up is not obligatory. Making up time-bound sunnahs is considered recommended (mustahabb).',
        ky: 'Витр — бекем сүннөт, аны каза кылуу милдеттүү эмес. Убакытка байланган сүннөттөрдү каза кылуу жакшы (мустахаб) деп эсептелет.',
      },
    },
    qadaTiming: {
      ru: 'Обязательные намазы можно возмещать в любое время, включая нежелательные.',
      en: 'Obligatory prayers may be made up at any time, including disliked times.',
      ky: 'Парз намаздарды каалаган убакта, анын ичинде макрух убактарда да каза кылууга болот.',
    },
    order: {
      ru: 'Соблюдение очерёдности при возмещении желательно (сунна), но не обязательно.',
      en: 'Keeping the sequence when making up is recommended (sunnah) but not obligatory.',
      ky: 'Каза кылууда ирээтти сактоо сүннөт, бирок милдеттүү эмес.',
    },
    exemptions: {
      before_islam: EX_BEFORE_ISLAM,
      insanity: {
        exempt: true,
        note: {
          ru: 'Намазы, всё время которых прошло в состоянии безумия, не возмещаются.',
          en: 'Prayers whose entire time passed in a state of insanity are not made up.',
          ky: 'Бүт убактысы акыл-эс жоготуу абалында өткөн намаздар каза кылынбайт.',
        },
      },
      unconsciousness: {
        exempt: true,
        disputed: true,
        note: {
          ru: 'Намазы, всё время которых прошло без сознания (не по своей вине), не возмещаются.',
          en: 'Prayers whose entire time passed unconscious (not by one’s own fault) are not made up.',
          ky: 'Бүт убактысы эс-учун жоготуп (өз күнөөсүз) өткөн намаздар каза кылынбайт.',
        },
      },
      hayd_known: EX_KNOWN_HAYD,
      nifas_known: EX_KNOWN_NIFAS,
      other: EX_OTHER,
    },
    sources: ['minhaj', 'majmu'],
  },

  maliki: {
    id: 'maliki',
    name: { ru: 'Маликитский', en: 'Maliki', ky: 'Маликий' },
    nameAr: 'المالكي',
    review: { status: 'unverified' },
    bulugh: {
      defaultAgeLunar: 18,
      minAgeLunar: { male: null, female: 9 },
      disputed: true,
      note: {
        ru: 'Известное (машхур) мнение — 18 лунных лет при отсутствии признаков. В мазхабе есть и другие мнения (15, 16, 17 лет). Уточните у учёного.',
        en: 'The well-known (mashhur) view — 18 lunar years without signs. Other views within the madhhab exist (15, 16, 17). Verify with a scholar.',
        ky: 'Белгилүү (машхур) пикир — белгилер болбосо 18 хижрий жыл. Мазхабдын ичинде башка пикирлер да бар (15, 16, 17). Аалымдан тактаңыз.',
      },
    },
    hayd: {
      minDays: null,
      maxDays: 15,
      note: {
        ru: 'Для поклонения минимального срока хайда нет; максимум для впервые увидевшей — 15 суток. Для женщины с привычкой действуют правила истизхара.',
        en: 'For worship there is no minimum for hayd; the maximum for a first-timer is 15 days. A woman with a habit follows the rules of istizhar.',
        ky: 'Ибадат үчүн хайздын эң аз мөөнөтү жок; биринчи жолу көргөн аял үчүн эң көбү — 15 сутка. Адаты бар аял истизхар эрежелерин карманат.',
      },
    },
    nifas: {
      maxDays: 60,
      note: { ru: 'Нифас — максимум 60 суток.', en: 'Nifas — maximum 60 days.', ky: 'Нифас — эң көп 60 сутка.' },
    },
    witr: {
      status: { ru: 'сунна муаккада', en: 'sunnah mu’akkadah', ky: 'бекем сүннөт (муаккада)' },
      qadaRequired: false,
      note: {
        ru: 'Витр — подтверждённая сунна. Согласно известному мнению, витр не возмещается после того, как совершён фаджр.',
        en: 'Witr is an emphasised sunnah. According to the well-known view, witr is not made up after Fajr has been prayed.',
        ky: 'Витр — бекем сүннөт. Белгилүү пикир боюнча, багымдат окулгандан кийин витр каза кылынбайт.',
      },
    },
    qadaTiming: {
      ru: 'Возмещать пропущенные обязательные намазы следует безотлагательно и можно в любое время.',
      en: 'Missed obligatory prayers should be made up promptly and may be prayed at any time.',
      ky: 'Калтырылган парз намаздарды кечиктирбей каза кылуу керек жана каалаган убакта окууга болот.',
    },
    order: {
      ru: 'Очерёдность требуется при небольшом числе пропущенных намазов (обычно до четырёх-пяти); при большом — нет.',
      en: 'Sequence is required with a small number of missed prayers (usually up to four or five); not with a large number.',
      ky: 'Калган намаздар аз болсо (адатта төрт-бешке чейин) ирээт талап кылынат; көп болсо — талап кылынбайт.',
    },
    exemptions: {
      before_islam: EX_BEFORE_ISLAM,
      insanity: {
        exempt: true,
        note: {
          ru: 'Если безумие охватило всё время намаза (включая вынужденное время), он не возмещается.',
          en: 'If insanity covered the whole prayer time (including the necessary time), it is not made up.',
          ky: 'Акыл-эс жоготуу намаздын бүт убактысын (зарыл убакытты кошо) камтыса, ал каза кылынбайт.',
        },
      },
      unconsciousness: {
        exempt: true,
        disputed: true,
        note: {
          ru: 'Если потеря сознания охватила всё время намаза (включая вынужденное время), он не возмещается.',
          en: 'If unconsciousness covered the whole prayer time (including the necessary time), it is not made up.',
          ky: 'Эс-учун жоготуу намаздын бүт убактысын (зарыл убакытты кошо) камтыса, ал каза кылынбайт.',
        },
      },
      hayd_known: EX_KNOWN_HAYD,
      nifas_known: EX_KNOWN_NIFAS,
      other: EX_OTHER,
    },
    sources: ['risala', 'mukhtasar_khalil'],
  },

  hanbali: {
    id: 'hanbali',
    name: { ru: 'Ханбалитский', en: 'Hanbali', ky: 'Ханбалий' },
    nameAr: 'الحنبلي',
    review: { status: 'unverified' },
    bulugh: {
      defaultAgeLunar: 15,
      minAgeLunar: { male: null, female: 9 },
      disputed: false,
      note: {
        ru: 'При отсутствии признаков — 15 полных лунных лет. Менструация признаётся не ранее 9 лет.',
        en: 'Without signs — 15 full lunar years. Menstruation is recognised from 9 years.',
        ky: 'Белгилер болбосо — толук 15 хижрий жыл. Айыз 9 жаштан тартып таанылат.',
      },
    },
    hayd: {
      minDays: 1,
      maxDays: 15,
      note: {
        ru: 'Хайд — минимум сутки, максимум 15 суток; обычно 6–7 дней.',
        en: 'Hayd — minimum one day and night, maximum 15 days; usually 6–7 days.',
        ky: 'Хайз — эң аз бир сутка, эң көп 15 сутка; адатта 6–7 күн.',
      },
    },
    nifas: {
      maxDays: 40,
      note: { ru: 'Нифас — максимум 40 суток.', en: 'Nifas — maximum 40 days.', ky: 'Нифас — эң көп 40 сутка.' },
    },
    witr: {
      status: { ru: 'сунна муаккада', en: 'sunnah mu’akkadah', ky: 'бекем сүннөт (муаккада)' },
      qadaRequired: false,
      note: {
        ru: 'Витр — подтверждённая сунна; его возмещение желательно, но не обязательно.',
        en: 'Witr is an emphasised sunnah; making it up is recommended but not obligatory.',
        ky: 'Витр — бекем сүннөт; аны каза кылуу жакшы, бирок милдеттүү эмес.',
      },
    },
    qadaTiming: {
      ru: 'Обязательные намазы возмещаются безотлагательно и в любое время, включая запретные.',
      en: 'Obligatory prayers are made up promptly and at any time, including prohibited times.',
      ky: 'Парз намаздар кечиктирилбей, каалаган убакта, анын ичинде тыюу салынган убактарда да каза кылынат.',
    },
    order: {
      ru: 'Очерёдность обязательна; она снимается при забывчивости или если есть опасение упустить время текущего намаза.',
      en: 'Sequence is obligatory; it lapses through forgetfulness or fear of missing the current prayer’s time.',
      ky: 'Ирээт милдеттүү; ал унутуп калганда же учурдагы намаздын убактысын өткөрүп жиберүү коркунучу болгондо түшөт.',
    },
    exemptions: {
      before_islam: EX_BEFORE_ISLAM,
      insanity: {
        exempt: true,
        note: {
          ru: 'Намазы, пропущенные в состоянии безумия, не возмещаются.',
          en: 'Prayers missed during insanity are not made up.',
          ky: 'Акыл-эс жоготуу абалында калтырылган намаздар каза кылынбайт.',
        },
      },
      unconsciousness: {
        exempt: false,
        disputed: true,
        note: {
          ru: 'Потеря сознания приравнивается ко сну: пропущенные намазы ВОЗМЕЩАЮТСЯ. Поэтому такой период не вычитается.',
          en: 'Unconsciousness is treated like sleep: missed prayers ARE made up. Such a period is therefore not subtracted.',
          ky: 'Эс-учун жоготуу уйкуга теңелет: калтырылган намаздар КАЗА КЫЛЫНАТ. Ошондуктан мындай мезгил эсептен алынбайт.',
        },
      },
      hayd_known: EX_KNOWN_HAYD,
      nifas_known: EX_KNOWN_NIFAS,
      other: EX_OTHER,
    },
    sources: ['zad', 'mughni'],
  },
};

export interface Source {
  id: string;
  title: string;
  author: L10n;
  madhab: Madhab | 'general';
}

/** Классические труды, по которым специалист может проверить правила. */
export const SOURCES: Record<string, Source> = {
  hidaya: {
    id: 'hidaya',
    title: 'الهداية في شرح بداية المبتدي',
    author: { ru: 'Бурхануддин аль-Маргинани', en: 'Burhan al-Din al-Marghinani' },
    madhab: 'hanafi',
  },
  nur_idah: {
    id: 'nur_idah',
    title: 'نور الإيضاح ونجاة الأرواح',
    author: { ru: 'Хасан аш-Шурунбуляли', en: 'Hasan al-Shurunbulali' },
    madhab: 'hanafi',
  },
  radd_muhtar: {
    id: 'radd_muhtar',
    title: 'رد المحتار على الدر المختار',
    author: { ru: 'Ибн Абидин', en: 'Ibn ‘Abidin' },
    madhab: 'hanafi',
  },
  minhaj: {
    id: 'minhaj',
    title: 'منهاج الطالبين',
    author: { ru: 'Имам ан-Навави', en: 'Imam al-Nawawi' },
    madhab: 'shafii',
  },
  majmu: {
    id: 'majmu',
    title: 'المجموع شرح المهذب',
    author: { ru: 'Имам ан-Навави', en: 'Imam al-Nawawi' },
    madhab: 'shafii',
  },
  risala: {
    id: 'risala',
    title: 'الرسالة',
    author: { ru: 'Ибн Абу Зайд аль-Кайравани', en: 'Ibn Abi Zayd al-Qayrawani' },
    madhab: 'maliki',
  },
  mukhtasar_khalil: {
    id: 'mukhtasar_khalil',
    title: 'مختصر خليل',
    author: { ru: 'Халиль ибн Исхак', en: 'Khalil ibn Ishaq' },
    madhab: 'maliki',
  },
  zad: {
    id: 'zad',
    title: 'زاد المستقنع',
    author: { ru: 'Шарафуддин аль-Хаджжави', en: 'Sharaf al-Din al-Hajjawi' },
    madhab: 'hanbali',
  },
  mughni: {
    id: 'mughni',
    title: 'المغني',
    author: { ru: 'Ибн Кудама', en: 'Ibn Qudamah' },
    madhab: 'hanbali',
  },
};

export const MADHABS: Madhab[] = ['hanafi', 'shafii', 'maliki', 'hanbali'];

export function getRules(m: Madhab): MadhabRules {
  return MADHAB_RULES[m];
}
