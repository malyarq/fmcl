# IPC-контракты

IPC — внутренняя граница приложения между sandboxed renderer и Electron main process. Это не публичный сетевой API, но совместимость важна: renderer, preload и main собираются и поставляются вместе.

## Источники истины

| Что | Источник |
| --- | --- |
| Разрешённые имена каналов | `shared/contracts/ipcChannels.ts` |
| Типы preload-доменов | `shared/contracts/*` |
| Поддерживаемый namespace | `shared/contracts/windowApi.ts` |
| Exposed capabilities | `electron/preload.ts`, `electron/preload/bridges/*` |
| Поведение main process | `electron/ipc/ipcManager.ts`, `electron/ipc/handlers/*` |
| Валидация на границе | `electron/ipc/validation/*` |
| Доступ renderer | `src/services/ipc/*` |
| Читаемый список каналов | [Карта контрактов](contracts-map.md) |

TypeScript contracts и runtime validation определяют payload shape. Карта каналов — поддерживаемый индекс, а не замена коду.

## Чеклист изменения

При добавлении или изменении cross-process операции:

1. Опишите typed request/result в `shared/contracts/*` или общем доменном типе.
2. При необходимости добавьте канал в `shared/contracts/ipcChannels.ts`.
3. Откройте узкую capability через domain preload bridge.
4. Добавьте её в `BurrowApi`, если она относится к `window.api`.
5. Провалидируйте в main process каждое значение, которым управляет renderer.
6. Зарегистрируйте тонкий handler, передающий работу domain service.
7. Добавьте или обновите renderer wrapper в `src/services/ipc/*`.
8. Покройте success, invalid input и failure focused-тестами.
9. Обновите обе карты контрактов.
10. Запустите проверки ниже.

```bash
npm run contracts:check
npm run ipc:check
npm run architecture:check
npx tsc -p tsconfig.json --noEmit
```

## Правила совместимости

- Удаление или переименование канала либо обязательного поля — breaking change для packaged app boundary.
- Новое optional field обычно совместимо, если каждый consumer учитывает его отсутствие.
- Нельзя переиспользовать существующее имя канала с другим смыслом.
- Секреты и privileged filesystem data не должны попадать в renderer DTO.
- UI-код вызывает typed wrapper или узкую capability `window.api.<domain>`; универсального renderer IPC API больше нет.

## Renderer surface

`window.api` — единственный Electron capability global. `npm run architecture:check` запрещает raw channel strings, устаревшие globals и возврат универсального renderer bridge в `src/`.
