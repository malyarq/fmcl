# Роадмап FriendLauncher

## Текущий Milestone

- Milestone: `v0.4.0`
- Тема: Launcher Truth And Product Polish
- Статус: активен, Phases 15-17 завершены, Phase 18 в closeout
- Обновлено: `2026-04-17`

## Зачем Нужен Этот Milestone

У FMCL уже есть широкий набор сценариев, но screenshot-backed аудит от `2026-04-14` показал более узкий, но важный класс дефектов доверия: противоречивые launch states, устаревшие loader summaries, broken-looking fallback art, raw localization keys и несколько оставшихся проблем на плотных surface-ах. Milestone `v0.4.0` закрывает эти дефекты без расширения архитектурного scope и без новых feature-направлений.

## Что Уже Проверено

Текущий browser-backed walkthrough этого milestone теперь покрывает `manual-verification.html?view=dashboard`, `manual-verification.html?view=modpack-details` и `manual-verification.html?view=phase-17-polish`. Вместе эти view подтверждают:

- branded fallback art на классическом hero, когда у сборки нет artwork
- truthful loader summary для активной launch-конфигурации
- локализованные waiting, downloading и failure states на launch surface
- видимые read-only advanced settings во время активного запуска
- pack-provided runtime dependencies, читаемый requirement copy и dense detail navigation на modpack details
- branded fallback cover на catalog surface, coherent compact-nav active state и русские preset names без raw settings keys

## Статус Фаз

| Фаза | Статус | Результат |
|------|--------|-----------|
| 15. Launch Truth And Shared Surface Contracts | Завершена | Branded fallback art, truthful loader summary, синхронизированные launch stages, локализованный runtime copy и read-only busy-state settings |
| 16. Modpack Detail Integrity And Discoverable Dense Navigation | Завершена | Truthful dependency semantics, читаемый requirement copy и discoverable dense navigation |
| 17. Catalog, Compact Nav, And Settings Localization Polish | Завершена | Каталожная legibility, fallback imagery, compact-nav truth и оставшаяся localization cleanup |
| 18. Verification And Release Truth | В процессе | Focused automation, three-view browser proof, release-doc truth и финальный milestone gate |

## Что Уже Даёт `v0.4.0`

- Launch progress больше не скатывается к ложному `0%`, когда реальный прогресс ещё неопределён
- Classic launch feedback теперь согласован между CTA, status card и runtime stage transitions
- Отсутствующий hero artwork заменяется осмысленным FMCL fallback вместо broken-image состояния
- Advanced launch settings остаются видимыми для справки и становятся read-only во время активного запуска
- Runtime settings и launch-adjacent controls теперь уважают выбранный язык лаунчера на audited classic surface
- Modpack details теперь помечает pack-provided runtime dependencies как удовлетворённые и показывает читаемый requirement copy для несовпадений
- Dense detail navigation больше не зависит от горизонтального tab-scroll как базового паттерна доступа к ключевым секциям
- Catalog cards и compact navigation теперь держат fallback imagery и active-state truth согласованными на audited desktop shell
- Audited settings surface теперь показывает локализованные preset names и не протекает raw localization keys в shipped UI

## Что Осталось До Закрытия

До статуса shipped остался только ограниченный closeout Phase 18:

- финальная repo-wide проверка через `npm test`, `npm run lint`, `npx tsc --noEmit` и `npm run build -- --publish never`
- только тот packaging-truth cleanup, который действительно нужен для прохождения этого gate без расширения продуктового scope
