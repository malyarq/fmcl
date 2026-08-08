# Дизайн-система

Здесь описан поддерживаемый UI-контракт. Каноническая реализация находится в `src/index.css`, `tailwind.config.js`, `src/contexts/settings/` и `src/components/ui/`.

Не копируйте из документа длинные наборы Tailwind-классов. Используйте semantic tokens и общие primitives, чтобы темы и accessibility оставались согласованными.

## Основа

### Айдентика

Публичное название продукта — **Burrow**, а функция совместной игры называется **Burrow Link**. Русский слоган: **Играй локально. Зови друга.** Продуктовый знак изображает компактный воксельный холм с освещённой факелом пещерой. Пещера остаётся главным акцентом, а трава, земля, камень и небольшой фрагмент руды сразу связывают знак с Minecraft-лаунчером без персонажей и конкурирующего мотива инструмента.

| Роль | Значение |
| --- | --- |
| Графит | `#151816` |
| Мятный | `#73C6A1` |
| Тёплый белый | `#F5F2E9` |
| Янтарный свет факела | `#FFB45C` |

`docs/assets/brand/burrow-app-icon.png` — канонический мастер. Из него создаются `public/launcher-mark.png`, `public/icon.png`, `public/icon-macos.png` и `public/icon.ico`; нельзя обрезать пещеру, уплощать направленный свет, перекрашивать ландшафт или помещать знак внутрь ещё одной брендовой рамки. У мастера прозрачный фон и безопасные поля со всех сторон, в том числе под передними блоками. Воксельный силуэт и альфа-край должны оставаться чистыми: без серых полос, сгенерированного фона и скруглённой квадратной маски. Для репозитория и социальных карточек используются `docs/assets/brand/burrow-social-preview.svg` и `.png`. Композиция с вордмарком может быть горизонтальной или вертикальной, но подробная иконка и название должны оставаться визуально раздельными. Пользовательский акцент может перекрашивать элементы управления, но не знак и вордмарк.

### Семантические цвета

Tailwind names связаны с runtime CSS variables:

| Semantic name | CSS variable |
| --- | --- |
| `background` | `--bg-app` |
| `card` | `--bg-card` |
| `overlay` | `--bg-overlay` |
| `sidebar` | `--bg-sidebar` |
| `foreground` | `--text-main` |
| `secondary` | `--text-secondary` |
| `muted` | `--text-muted` |
| `border` | `--border-default` |
| `border-active` | `--border-active` |
| error | `--color-error` |

Используйте `bg-card`, `text-secondary` и другие semantic names. Прямые Zinc values допустимы только для изолированных native-like или console surfaces, которые намеренно не следуют теме.

Акцентные действия используют `--accent-main`, `--accent-hover` и `--accent-content`. Готовые акценты: emerald, blue, purple, orange и rose; также поддерживается корректный custom hex.

### Темы и presets

Приложение поддерживает light и dark mode. Presets определены в `src/contexts/settings/theme-presets.ts`:

- `default`
- `midnight`
- `forest`
- `light-plus`
- `navy`

Смена preset должна сохранять явный override пользователя и показывать понятную цель reset. Не добавляйте локальный theme state внутрь компонента.

### Общие surface classes

Используйте классы из `src/index.css`:

- `surface-panel` — основной dialog или route surface
- `surface-card` — стандартная карточка
- `surface-muted` — спокойная вложенная секция
- `surface-inline` и `surface-soft` — компактный вложенный content/feedback
- `control-frame` и `control-label` — form controls
- `kicker-label` и `helper-text` — вспомогательная иерархия
- `settings-*` — общий layout contract настроек

Эти классы владеют radius, border, opacity, backdrop и shadows. Не собирайте тот же surface заново локальными классами route.

## Общие компоненты

Все primitives лежат в `src/components/ui/`.

| Компонент | Важный контракт |
| --- | --- |
| `Button` | Variants `primary`, `secondary`, `danger`, `ghost`; sizes `sm`, `md`, `lg`; geometry `default`, `catalog-primary`, `compact-control`, `utility`; поддерживает `isLoading` и `progress`. |
| `Input`, `Textarea` | Native attributes плюс `label`, `error` и container styling. Labels получают стабильные generated IDs. |
| `Select` | Native select плюс `label`, `description` и `error`. |
| `Modal` | Accessible dialog, focus trap/restore, topmost Escape, reduced motion и optional `closeDisabled`. |
| `ConfirmDialog` | Рендерится через `ConfirmProvider`; поддерживает default/danger confirmation и prompt input. |
| `Toast` | `success`, `error`, `warning`, `info`; повторяющиеся сообщения группируются. Используется через `ToastContext`. |
| `ErrorMessage` | Variants `default` и `inline`. |
| `LoadingSpinner`, `SkeletonLoader`, `ProgressBar` | Общие busy и progress states. |
| `AnchoredOverlay`, `Tooltip` | Viewport-aware portalled overlays; Tooltip по умолчанию открывается сверху через 300 ms. |
| `LazyImage`, `ArtworkFallback` | Кэшированные удалённые изображения и единая fallback-графика. |
| `Breadcrumbs`, `CollapsibleSection` | Общая навигация и disclosure behavior. |

Перед редким параметром прочитайте TypeScript props компонента: реализация остаётся API reference.

## Корректные примеры

```tsx
<Button variant="primary" size="md" isLoading={saving}>
  {label}
</Button>
```

```tsx
const toast = useToast();
toast.success(successMessage);
toast.showToast(warningMessage, 'warning');
```

```tsx
const { confirm } = useConfirm();
const approved = await confirm({
  title,
  message,
  variant: 'danger',
});
```

Не меняйте местами аргументы Toast, не передавайте positional arguments в `confirm` и не используйте удалённый вариант ErrorMessage `standalone`.

## Правила взаимодействия

- Один surface владеет primary action; вложенные карточки с ним не конкурируют.
- Disabled control остаётся читаемым и объясняет причину недоступности.
- Loading state не стирает actionable error или recoverable selection пользователя.
- Destructive action использует danger variant и называет затрагиваемый объект.
- Длинный локализованный label может переноситься; нельзя рассчитывать только на ширину английского текста.
- Menu/tooltip, который должен оставаться в viewport, использует `AnchoredOverlay`.

## Доступность

- У dialog есть accessible title и управляемый focus.
- Icon-only button требует `aria-label`.
- Tabs, disclosures, progress, errors и busy states отдают семантическое состояние.
- Keyboard behavior соответствует pointer behavior.
- Visible focus использует текущий accent.
- Анимации учитывают `prefers-reduced-motion` и app class `disable-animations`.
- Проверяйте light/dark, English/Russian, минимальное окно 800×600 и клавиатурную навигацию.

## Новый или изменённый primitive

1. Убедитесь, что существующий primitive или semantic class не решает задачу.
2. Делайте небольшой API на основе product semantics, а не class names одного route.
3. Добавьте focused tests на поведение и accessibility.
4. Мигрируйте хотя бы owning use case; не оставляйте два конкурирующих primitive.
5. При изменении публичного контракта обновите оба документа.
6. Запустите `npm run verify` и visual closeout.
