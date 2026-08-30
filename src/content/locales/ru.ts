/**
 * L3: русские строки. Этот файл — источник истины по набору ключей: английская
 * локаль типизирована по нему, так что пропущенный ключ ломает сборку.
 *
 * Словарь терминов, обязательный к соблюдению везде, включая справочник:
 *   забег         — одна попытка от входа до смерти
 *   уровень       — этаж здания (Уровень 0, Уровень 1)
 *   сущность      — всё, что здесь живёт
 *   рассудок      — шкала NERVE, падает в темноте и тишине
 *   выносливость  — шкала дыхания, тратится на бег и на удары
 *   шум           — событие, на которое сходятся сущности
 *   износ         — состояние оружия, падает с каждым ударом
 *   блок          — полное гашение одного входящего удара
 *   спуск         — точка перехода на уровень ниже
 *   припасы       — всё, что можно унести
 *   в руках       — слот, из которого бьют и которым пользуются
 */

import type { LocaleString } from '@core/i18n';

export const RU = {
  // ── общее ────────────────────────────────────────────────────────────────
  'ui.back': 'Назад',
  'ui.close': 'Закрыть',
  'ui.on': 'вкл',
  'ui.off': 'выкл',
  'ui.reset': 'Сбросить',
  'ui.confirm': 'Точно?',
  'ui.yes': 'Да',
  'ui.no': 'Нет',
  'ui.none': 'не назначено',
  'ui.pressKey': 'Нажмите клавишу…',
  'ui.seconds': '{value} с',
  'ui.percent': '{value}%',

  // ── меню ─────────────────────────────────────────────────────────────────
  'menu.title': 'ВЫХОДА НЕТ',
  'menu.subtitle': 'Ты уже внутри. Осталось решить, надолго ли.',
  'menu.continue': 'Продолжить забег',
  'menu.newRun': 'Новый забег',
  'menu.guide': 'Справочник',
  'menu.settings': 'Настройки',
  'menu.resume': 'Вернуться в игру',
  'menu.toMenu': 'В главное меню',
  'menu.paused': 'ПАУЗА',
  'menu.pausedNote': 'Здание ждёт. Оно умеет ждать.',
  'menu.newRunWarning': 'Текущий забег будет потерян.',

  // ── настройки ────────────────────────────────────────────────────────────
  'settings.title': 'НАСТРОЙКИ',
  'settings.language': 'Язык',
  'settings.audio': 'Звук',
  'settings.volumeMaster': 'Общая громкость',
  'settings.volumeEffects': 'Эффекты',
  'settings.volumeAmbient': 'Фон',
  'settings.video': 'Изображение',
  'settings.brightness': 'Яркость',
  'settings.uiScale': 'Масштаб интерфейса',
  'settings.debugOverlay': 'Отладочный оверлей',
  'settings.controls': 'Управление',
  'settings.controlsHint': 'Щёлкните по строке и нажмите новую клавишу. ESC — отмена.',
  'settings.conflict': 'Занято: {action}',
  'settings.resetBindings': 'Вернуть раскладку по умолчанию',
  'settings.danger': 'Опасная зона',
  'settings.wipeRun': 'Стереть сохранённый забег',
  'settings.wipeSettings': 'Сбросить все настройки',
  'settings.wipeRunDone': 'Забег стёрт.',
  'settings.wipeSettingsDone': 'Настройки сброшены.',

  // ── названия действий для переназначения ─────────────────────────────────
  'action.up': 'Вперёд',
  'action.down': 'Назад',
  'action.left': 'Влево',
  'action.right': 'Вправо',
  'action.sprint': 'Бежать',
  'action.crouch': 'Присесть',
  'action.interact': 'Взаимодействие',
  'action.use': 'Использовать из рук',
  'action.throwItem': 'Бросить',
  'action.drop': 'Выложить',
  'action.inventory': 'Сумка',
  'action.flashlight': 'Фонарь',
  'action.guide': 'Справочник',
  'action.pause': 'Пауза',
  'action.debug': 'Отладка',
  'action.restart': 'Заново',

  // ── подписи клавиш ───────────────────────────────────────────────────────
  'key.Space': 'Пробел',
  'key.ShiftLeft': 'Shift',
  'key.ShiftRight': 'Shift пр.',
  'key.ControlLeft': 'Ctrl',
  'key.ControlRight': 'Ctrl пр.',
  'key.AltLeft': 'Alt',
  'key.Tab': 'Tab',
  'key.Enter': 'Enter',
  'key.Escape': 'Esc',
  'key.Backquote': 'Ё',
  'key.ArrowUp': '↑',
  'key.ArrowDown': '↓',
  'key.ArrowLeft': '←',
  'key.ArrowRight': '→',
  'key.Mouse': 'Мышь',

  // ── интерфейс забега ─────────────────────────────────────────────────────
  'hud.health': 'ТЕЛО',
  'hud.hunger': 'ЕДА',
  'hud.thirst': 'ВОДА',
  'hud.stamina': 'СИЛЫ',
  'hud.sanity': 'НЕРВЫ',
  'hud.hand': 'В РУКАХ',
  'hud.empty': 'пустые руки',
  'hud.ready': 'ГОТОВО',
  'hud.handEmptyDescription': 'Предмет не выбран',
  'hud.charge': 'заряд',
  'hud.weight': 'вес',
  'hud.wear': 'износ',
  'hud.level': 'УРОВЕНЬ {value}',
  'hud.broken': 'сломано',

  // ── подсказки: {key} подставляется из текущей раскладки ──────────────────
  'hint.move': '{move} — идти. Мышь — куда смотришь.',
  'hint.search': '{key} — обыскать',
  'hint.pickup': '{key} — подобрать',
  'hint.descend': '{key} — спуститься',
  'hint.useHand': '{key} — использовать',
  'hint.flashlight': '{key} — включить фонарь',
  'hint.inventory': '{key} — сумка',
  'hint.throwItem': '{key} — бросить',
  'hint.sprint': '{key} — бежать, и это слышно',
  'hint.crouch': '{key} — присесть: тихо, медленно, без драки',
  'hint.guide': '{key} — справочник',
  'hint.exhausted': 'Дыхания нет.',
  'hint.heavy': 'Столько не унести.',
  'hint.full': 'В сумке нет места.',
  'hint.nothing': 'Пусто.',
  'hint.darkness': 'Слишком темно, чтобы что-то разглядеть.',
  'hint.listen': 'Рядом что-то двигалось.',
  'hint.weaponBroken': 'Оружие развалилось.',
  'hint.noStamina': 'Руки не поднимаются.',

  // ── сумка ────────────────────────────────────────────────────────────────
  'inventory.title': 'СУМКА',
  'inventory.help': 'Тащите мышью. Правая кнопка — взять в руки. {drop} — выложить.',
  'inventory.cells': {
    one: '{count} ячейка',
    few: '{count} ячейки',
    many: '{count} ячеек',
  },
  'inventory.tooltipWeight': 'Вес: {value}',
  'inventory.count': {
    one: '{count} штука',
    few: '{count} штуки',
    many: '{count} штук',
  },

  // ── итоги ────────────────────────────────────────────────────────────────
  'summary.title': 'ЗДАНИЕ ОСТАВЛЯЕТ ТЕБЯ СЕБЕ',
  'summary.time': 'Времени внутри',
  'summary.levels': 'Спусков',
  'summary.collected': 'Собрано',
  'summary.distance': 'Пройдено',
  'summary.tiles': {
    one: '{count} шаг',
    few: '{count} шага',
    many: '{count} шагов',
  },
  'summary.seed': 'Зерно',
  'summary.restart': '{key} — войти снова, с новым зерном',
  'summary.toMenu': '{key} — в меню',

  'cause.injury': 'До тебя дотянулись.',
  'cause.starvation': 'Ноги перестали держать.',
  'cause.thirst': 'Ты высох.',
  'cause.unknown': 'Ты остановился.',

  'level.level0': 'Уровень 0',
  'level.level1': 'Уровень 1',

  // ── бой ──────────────────────────────────────────────────────────────────
  'combat.hit': {
    one: 'Попал',
    few: 'Задел {count} сразу',
    many: 'Задел {count} сразу',
  },
  'combat.blockedByYou': 'Блок',
  'combat.blockedByThem': 'Отбито',
  'combat.miss': 'Мимо',
  'combat.broke': 'Оружие сломалось',
  'combat.tired': 'Сил на удар не осталось',

  // ── справочник ───────────────────────────────────────────────────────────
  'guide.title': 'СПРАВОЧНИК',
  'guide.controls.mouse': 'Куда смотришь; правая кнопка в сумке — взять в руки',

  // ── предметы ─────────────────────────────────────────────────────────────
  'item.item.hands.name': 'Голые руки',
  'item.item.hands.desc': 'Лучше, чем ничего. Ненамного.',
  'item.item.water.name': 'Бутылка воды',
  'item.item.water.desc': 'Тёплая, невкусная, пить можно.',
  'item.item.soda.name': 'Газировка из автомата',
  'item.item.soda.desc': 'Сахар и статическое электричество.',
  'item.item.crackers.name': 'Пачка крекеров',
  'item.item.crackers.desc': 'Сухие до царапин в горле.',
  'item.item.canned.name': 'Консервы',
  'item.item.canned.desc': 'Без этикетки. Всё ещё запаяны.',
  'item.item.medkit.name': 'Аптечка',
  'item.item.medkit.desc': 'Разобрана, но не до конца.',
  'item.item.bandage.name': 'Бинт',
  'item.item.bandage.desc': 'Останавливает худшее.',
  'item.item.flashlight.name': 'Фонарь',
  'item.item.flashlight.desc': 'Держи в руках и включай.',
  'item.item.battery.name': 'Батарея',
  'item.item.battery.desc': 'Кормит фонарь, который в руках.',
  'item.item.pipe.name': 'Стальная труба',
  'item.item.pipe.desc': 'Тяжёлая, громкая, бьёт всех вокруг.',
  'item.item.wrench.name': 'Разводной ключ',
  'item.item.wrench.desc': 'Замах короткий, зато быстрый.',
  'item.item.noisemaker.name': 'Заводной будильник',
  'item.item.noisemaker.desc': 'Брось. И окажись в другом месте.',

  'container.container.crate.name': 'Ящик с припасами',
  'container.container.locker.name': 'Железный шкаф',
  'container.container.bag.name': 'Брошенная сумка',
  'container.exit.name': 'Спуск',

  'creature.creature.drifter.name': 'Бродяга',
  'creature.creature.hound.name': 'Гончая',
  'creature.creature.bloom.name': 'Нарост',
} as const satisfies Record<string, LocaleString>;

export type TextKey = keyof typeof RU;
