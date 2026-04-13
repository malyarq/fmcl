# Роадмап FriendLauncher

## Текущий Milestone

- Milestone: `v0.2.0`
- Тема: единая UI-система и переработка пользовательского опыта
- Статус: завершён
- Обновлено: `2026-04-13`

## Зачем Нужен Этот Milestone

У FMCL уже был широкий набор функций, но продукт всё ещё ощущался как набор отдельных модулей. Milestone `v0.2.0` приводит существующую поверхность лаунчера к одному состоянию: единая визуальная система, честное применение темы, синхронные EN/RU тексты, более удобные сценарии работы с модпаками и ручная проверка реального опыта перед закрытием milestone.

## Проверенные Поверхности Лаунчера

В live walkthrough этого milestone были пройдены:

- экран приветствия и onboarding tour
- домашний dashboard и основной play flow
- settings, accounts и переход к управлению скинами
- modpack list, browser, details, export и add-mod маршруты
- share flow и import-share сценарий
- screenshots gallery и lightbox
- utilities: mirrors и statistics
- secondary content flow на примере datapack management

## Статус Фаз

| Фаза | Статус | Результат |
|------|--------|-----------|
| 7. UI System Foundations | Завершена | Общие визуальные примитивы, язык shell, согласованные иконки и document-level theme behavior |
| 8. Core Route Rollout And UI Correctness | Завершена | Обновлённые home, onboarding, settings/accounts и основные modpack-маршруты с синхронной EN/RU локализацией |
| 9. Secondary Surface Alignment And UX Polish | Завершена | Share, screenshots, utilities, secondary content management, reduced motion и accessibility polish |
| 10. Manual Experience Verification And Release Truth | Завершена | Записанное browser walkthrough evidence, обновлённые release-facing docs и закрытый финальный repository gate |

## Что Даёт `v0.2.0`

- Один общий UI-язык для shell, карточек, форм, диалогов и feedback states
- Theme и accent changes, которые заметно применяются ко всему лаунчеру, а не к отдельным виджетам
- Обновлённые core routes без смеси плейсхолдеров, пропавших иконок и legacy one-off styling
- Secondary surfaces, которые ощущаются частью того же продукта, а не оставшимися утилитами
- Manual browser verification как часть milestone truth, а не необязательный polish

## Следующие Кандидаты

Это вероятные следующие шаги после `v0.2.0`, но не зафиксированный scope текущего milestone:

- automated visual-regression coverage для ключевых поверхностей лаунчера
- более богатые theme packs или layout presets
- новые локали помимо английского и русского
- дополнительная персонализация плотности интерфейса и состава dashboard
