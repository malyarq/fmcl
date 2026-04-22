# Роадмап FriendLauncher

## Последний Релиз

- Релиз: `v0.6.0`
- Тема: Feedback-Driven Stabilization And Expansion
- Статус: shipped `2026-04-21`
- Текущее состояние планирования: активный milestone `v0.7.0` — Direct Feedback Closure And Interface Cohesion

## Следующий Запланированный Релиз

- Планируемый релиз: `v0.7.0`
- Тема: Direct Feedback Closure And Interface Cohesion
- Основной источник: актуальный набор прямого пользовательского фидбэка по лаунчеру
- Цель: закрыть оставшиеся прямые продуктовые gap'ы вокруг shell и sidebar drift, плотности catalog/details, надёжности guided content flow, предсказуемости settings и отсутствия одного shared control contract по всему лаунчеру
- Текущий прогресс: Phases `32-36` завершены. Они закрыли читаемость sidebar-header, native macOS shell truth, более спокойные fallback surface, truthful classic runtime labels, compact catalog shells, minimal card facts, details-tabs above the fold, first-read runtime truth, единый shared details content workspace, fixed create/add action rails, actionable async recovery, честные guided-content runtime boundaries, более лёгкий settings shell, видимый preset runtime truth, выровненный shared control contract и behavior-driven gating для settings proof routes. Дальше: заново прогнать manual verification по восстановленной settings surface, затем выполнить inserted Phase `36.1`.

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
| 32. Shell Identity And Sidebar Cohesion | Complete | Text-first sidebar header, более спокойная fallback identity и сдержанная native macOS shell truth |
| 33. Classic Truth And Catalog Density Repair | Complete | Truthful classic labels, компактные installed/remote catalogs и согласованная geometry у catalog actions |
| 34. Detail Hierarchy And Content Surface Cohesion | Complete | Details tabs above the fold, authoritative runtime truth и единый secondary content workspace |
| 35. Async Flow Reliability And Guided Content Honesty | Complete | Fixed create/add action rails, actionable mixed-success recovery, честная runtime-guidance для resource-pack и shader flow, и обновлённые proof-route описания под live async contract |
| 36. Settings Predictability And Shared Control Contract | Complete | Flattened settings shell chrome, preset-owned palette/runtime truth, centered shared controls, visible appearance-effect scope и behavior-driven settings proof gating |
| 36.1. Modpack UAT Follow-up And Workspace Cohesion | Planned | Cohesion для secondary workspace, calmer create-modpack recovery и закрытие modpack spillover из Phase 36 UAT |

## Остаточные Замечания

- Автоматическая верификация по Phase 36 зелёная, но перед milestone closeout всё ещё нужен свежий manual verification pass по восстановленной settings surface.
- Inserted Phase `36.1` остаётся открытой, потому что в UAT Phase 36 нашлись ещё и modpack workspace/create-flow spillover gap'ы вне settings-owned контракта.
