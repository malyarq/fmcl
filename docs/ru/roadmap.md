# Роадмап FriendLauncher

## Последний Релиз

- Релиз: `v0.6.0`
- Тема: Feedback-Driven Stabilization And Expansion
- Статус: shipped `2026-04-21`
- Текущее состояние планирования: активного milestone нет; следующий milestone должен стартовать от этого shipped baseline

## Зачем Вышел v0.6.0

`v0.6.0` был feedback-driven релизом на стабилизацию. У FMCL уже была нужная общая форма продукта, но в shipped состоянии лаунчер всё ещё ощущался шумным или неточным в нескольких критичных зонах: shell-поведение, modpack workflow, ownership в settings и границы content-management surface. Этот релиз сначала убрал такую product-weirdness, и только потом допустил одно ограниченное расширение возможностей.

## Что Доехало

- Shell лаунчера теперь ведёт себя ближе к native desktop surface и не конкурирует с platform chrome или громким fallback-branding.
- Browse, details, dependency-state и create/add flow для modpack теперь опираются на одну меньшую и более truthful runtime-модель.
- Settings теперь используют один явный appearance-state contract, более лёгкую shell hierarchy и контролы, которые честно объясняют свой scope вместо обещаний о широкой personalization-системе.
- Entry для resource-pack и shader теперь ведёт в один и тот же in-app guided browser, внутри route есть явный local `.zip` fallback, shader surface различает supported, needs-setup, unsupported и unverified runtime state без ложной уверенности в совместимости, а guided failure остаются на экране с named recovery path.

## Итоги По Фазам

| Фаза | Статус | Результат |
|------|--------|-----------|
| 28. Product Restraint And Native Shell Truth | Shipped | Native shell behavior, сдержанная identity, локальные update-сигналы и truthful reopen-state recovery |
| 29. Modpack Workflow Simplification And Runtime Truth | Shipped | Компактные catalog-controls, более чистая details hierarchy, config-first runtime truth и стабильное async recovery в create/add flow |
| 30. Settings Truth And Honest Personalization | Shipped | Детерминированный preset runtime, компактный settings shell, честное размещение контролов и bounded preset-adjacent customization |
| 31. Guided Content Browsers And Capability Expansion | Shipped | Canonical guided entry, явный local `.zip` fallback внутри route, честная shader capability guidance, named recoverable failure states и bounded-scope closeout proof |

## Остаточные Замечания

- Milestone audit пройден, все scoped requirements закрыты.
- Browser-based manual walkthrough в ходе archive closeout отдельно не перезапускался, поэтому real-shell sampling остаётся release-signoff debt, а не implementation gap.
