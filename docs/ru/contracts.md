## Контракты (Русский)

У проекта есть две публичные поверхности, которые должны оставаться стабильными:

1) **Имена IPC каналов + payload’ы** (renderer ↔ main)  
2) **`window.*` API**, которое отдаёт preload (renderer)

Каноничная карта (RU): [`docs/ru/contracts-map.md`](./contracts-map.md).

---

## Если меняешь IPC / preload

Если ты добавляешь/переименовываешь/удаляешь что-то в:

- `electron/ipc/handlers/*`
- `electron/ipc/ipcManager.ts`
- `electron/preload.ts`
- `electron/preload/bridges/*`

то обязательно обнови:

- `docs/en/contracts-map.md` + `docs/ru/contracts-map.md` (карта контрактов)
- `src/vite-env.d.ts` (типы для renderer)
- `src/services/ipc/*` (предпочтительный путь вызова)

---

## Предпочтительный путь в renderer

- **Нужно**: `src/services/ipc/<domain>IPC.ts`
- **Не нужно**: размазывать прямые `window.<bridge>.*` вызовы по UI
- **Не нужно**: `window.ipcRenderer` (escape hatch), если есть альтернатива

Если escape hatch всё-таки нужен — зафиксируй это в `contracts-map.md` и по возможности добавь типизированную обёртку.

---

## Простое правило про versioning

- Переименование канала или изменение payload’а = **breaking change**.
- Добавление нового необязательного поля обычно **не breaking**.

