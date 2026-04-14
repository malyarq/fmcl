# Роадмап FriendLauncher

## Текущий Milestone

- Milestone: `v0.3.0`
- Тема: адаптивный UX-hardening и эргономика лаунчера
- Статус: завершён
- Обновлено: `2026-04-14`

## Зачем Нужен Этот Milestone

У FMCL уже был широкий набор функций, но в ежедневном использовании оставались дыры в доверии: неадаптивные layout-ы, готовые темы без честного применения в обоих режимах, чрезмерно вложенные settings, неочевидное состояние запуска и неудобные или нестабильные modpack-сценарии. Milestone `v0.3.0` закрывает именно эти проблемы, не меняя базовую архитектуру лаунчера.

## Проверенные Поверхности Лаунчера

В live walkthrough этого milestone были пройдены поверхности лаунчера на `1440x1100` и `900x1180`:

- экран приветствия и onboarding tour
- домашний dashboard и явные состояния запуска
- settings, accounts и continuity до управления скинами
- create, list, browser, details, export и add-mod маршруты для модпаков
- share flow и import-share сценарий
- screenshots gallery и lightbox
- utilities: mirrors и statistics
- secondary content flow на примере datapack management

## Статус Фаз

| Фаза | Статус | Результат |
|------|--------|-----------|
| 11. Adaptive Layout And Interaction Foundations | Завершена | Адаптивный shell rhythm, anchored overlays, безопасные относительно окна меню и shipped fallback assets |
| 12. Theme Truth And Settings IA Simplification | Завершена | Честные preset themes в светлом и тёмном режиме, лучший contrast и более плоская навигация по settings |
| 13. Launch Trust And Modpack Workflow Ergonomics | Завершена | Явные launch stages, busy-state feedback, truthful modpack dependencies и более устойчивые browser/card flows |
| 14. Manual Verification And Release Truth | Завершена | Multi-size browser walkthrough evidence, bounded follow-up capture, обновлённые release docs и зелёный финальный gate |

## Что Даёт `v0.3.0`

- Адаптивный layout и interaction safety на стартовом размере окна и на более узких desktop-ширинах
- Согласованный sizing rhythm для основных контролов, карточек и overlays на обновлённых поверхностях
- Preset themes, которые действительно перекрашивают лаунчер в light и dark mode без нечитаемых состояний
- Более плоскую settings-навигацию для частых задач вместо глубокого tab-inside-tab drill-down
- Явный launch progress и busy-state truth на основном play surface
- Более надёжные create, browse и installed-modpack quick-action сценарии
- Очистку placeholder и fallback assets на классических поверхностях лаунчера
- Manual browser verification на нескольких размерах окна как часть release truth, а не необязательный polish

## Следующие Кандидаты

Это вероятные следующие шаги после `v0.3.0`, но не зафиксированный scope текущего milestone:

- automated visual-regression coverage для reusable manual-verification seam
- более богатый modpack metadata, dependency context и changelog detail в browser/install сценариях
- отдельный activity-center UX для downloads, installs и background tasks
- дополнительные dashboard density или layout presets сверх текущего adaptive shell
- более глубокие account/session conveniences и финальный аудит low-traffic localization и fallback seams
