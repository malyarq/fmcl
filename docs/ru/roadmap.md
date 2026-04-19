# Роадмап FriendLauncher

## Текущий Milestone

- Milestone: `v0.5.0`
- Тема: Experience Reinvention And Brand Reset
- Статус: Phase 24 завершена, closeout подтверждён, milestone готов к закрытию
- Обновлено: `2026-04-19`

## Зачем Нужен Этот Milestone

FMCL дошёл до стадии, где проблема была уже не только в correctness. Лаунчер начал дрейфовать визуально и поведенчески: shell мог скрывать контент, бренд использовался противоречиво, плотные route-ы спорили за иерархию, темы и локали были непоследовательны, а degraded-state всё ещё выглядели как технические остатки. Milestone `v0.5.0` приводит эти surface-ы к одному намеренному и проверяемому продукту без расширения scope новыми фичами.

## Проверенная Closeout Surface

Текущая closeout-matrix привязана к browser-backed seam `manual-verification.html` и к committed lane `npm run test:visual:closeout`. Owned Phase 24 набор для review покрывает:

- `manual-verification.html?view=phase-24-home-closeout`
- `manual-verification.html?view=phase-24-modpacks-closeout`
- `manual-verification.html?view=phase-24-degraded-closeout`
- `manual-verification.html?view=phase-24-theme-dark`
- `manual-verification.html?view=phase-24-theme-light`
- `manual-verification.html?view=phase-24-locale-en`
- `manual-verification.html?view=phase-24-locale-ru`

Вместе эти view подтверждают:

- shared shell clearance и route-owned CTA hierarchy на launcher home и modpack flow
- dense modpack browser и details surface под реалистичной desktop-нагрузкой
- representative degraded route и secondary-content failure на shipped productized fallback surface
- явное dark/light сравнение на одной и той же shell-owned appearance surface
- явное EN/RU сравнение с видимыми датами, счётчиками, translated copy и secondary content

## Статус Фаз

| Фаза | Статус | Результат |
|------|--------|-----------|
| 19. Baseline Stability, Scope, And Shell Invariants | Завершена | Shared safe-zone shell contract, один primary action на контекст и flow-first geometry для dense-route |
| 20. Brand System, Shared Tokens, And Surface Migration | Завершена | Канонический brand contract, shared launcher tokens и нейтральная artwork fallback policy |
| 21. Dense Surface IA, Navigation, And CTA Hierarchy | Завершена | Читаемые dense catalog/details route и truthful runtime summary для create/edit flow |
| 22. Theme Truth And Interaction-State Fidelity | Завершена | Читаемые dark/light state, последовательная accent propagation и locale-faithful formatting |
| 23. Fallback, Error, And Placeholder Productization | Завершена | Productized empty/degraded/error state и recovery-first fatal crash surface |
| 24. Verification, Locale, And Release Truth | Завершена | Curated closeout matrix, строгий screenshot regression lane, sync release truth и финальная closeout verification |

## Что Даёт `v0.5.0`

- Shell лаунчера теперь ведёт себя как единый desktop frame, а не как набор route-local spacing hack.
- Brand usage снова намеренный: launcher surface, onboarding и fallback state говорят на одном сдержанном визуальном языке.
- Modpack flow остаются читаемыми под плотными данными, длинными label и ограниченной desktop-шириной без дублирования или сокрытия primary action.
- Theme и locale различия теперь можно review-ить намеренно, а не находить случайно.
- Missing data, failed load и fatal crash теперь показывают recovery-safe product truth вместо raw internals или декоративных placeholder.
- Proof релиза больше не держится на словах: он живёт в переиспользуемой manual matrix и в committed Playwright screenshot lane.

## Ограниченные Residuals

- Production build по-прежнему печатает существующий large renderer chunk warning. На closeout он остаётся явно non-blocking, потому что финальный gate зелёный и в пределах этого milestone нет user-facing regression, завязанной на это предупреждение.
