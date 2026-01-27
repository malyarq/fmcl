# Design System (Русский)

## Обзор

Design System FriendLauncher определяет стандарты визуального дизайна, компонентов и стилей для обеспечения консистентности интерфейса во всем приложении.

---

## Цветовая Палитра

### Основные Цвета

Проект использует **Zinc** как основную цветовую палитру с поддержкой темной и светлой темы.

#### Светлая Тема
- **Фон**: `bg-zinc-100`
- **Текст**: `text-zinc-900`
- **Поверхности**: `bg-white/80` с `backdrop-blur-sm`
- **Границы**: `border-zinc-300/50`

#### Темная Тема
- **Фон**: `bg-zinc-900`
- **Текст**: `text-white` / `text-zinc-100`
- **Поверхности**: `bg-zinc-800/80` с `backdrop-blur-sm`
- **Границы**: `border-zinc-700/50`

### Акцентные Цвета

Поддерживаются следующие акцентные цвета (настраиваются пользователем):
- **Emerald** (зеленый) - по умолчанию
- **Blue** (синий)
- **Purple** (фиолетовый)
- **Orange** (оранжевый)
- **Rose** (розовый)

Акцентные цвета используются для:
- Кнопок действий
- Прогресс-баров
- Акцентных элементов интерфейса
- Фокуса и hover состояний

### Семантические Цвета

#### Success (Успех)
- Светлая: `bg-green-500/90`, `text-white`
- Темная: `bg-green-600/90`, `text-white`
- Используется для: успешных операций, toast-уведомлений

#### Error (Ошибка)
- Светлая: `bg-red-500/90`, `text-white`
- Темная: `bg-red-600/90`, `text-white`
- Используется для: ошибок, предупреждений об опасных действиях

#### Warning (Предупреждение)
- Светлая: `bg-yellow-500/90`, `text-white`
- Темная: `bg-yellow-600/90`, `text-white`
- Используется для: предупреждений, toast-уведомлений

#### Info (Информация)
- Светлая: `bg-blue-500/90`, `text-white`
- Темная: `bg-blue-600/90`, `text-white`
- Используется для: информационных сообщений

---

## Типографика

### Шрифт

- **Основной шрифт**: `Inter`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`
- **Вес по умолчанию**: `400` (normal)

### Размеры Текста

Используется стандартная шкала Tailwind CSS:

- **xs**: `text-xs` (12px) - метки, подсказки
- **sm**: `text-sm` (14px) - основной текст, кнопки
- **base**: `text-base` (16px) - основной контент
- **lg**: `text-lg` (18px) - подзаголовки
- **xl**: `text-xl` (20px) - заголовки секций
- **2xl**: `text-2xl` (24px) - крупные заголовки

### Веса Шрифта

- **normal**: `font-normal` (400)
- **medium**: `font-medium` (500)
- **semibold**: `font-semibold` (600)
- **bold**: `font-bold` (700)
- **black**: `font-black` (900) - только для кнопки "Играть"

### Заголовки Секций

Заголовки секций используют следующий стиль:
```css
text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400
```

---

## Spacing (Отступы)

Используется стандартная шкала Tailwind CSS spacing (4px базовая единица):

### Рекомендуемые Значения

- **0.5** (2px): `gap-0.5`, `p-0.5` - минимальные отступы
- **1** (4px): `gap-1`, `p-1` - очень маленькие отступы
- **1.5** (6px): `gap-1.5`, `p-1.5` - маленькие отступы (между label и input)
- **2** (8px): `gap-2`, `p-2` - маленькие отступы
- **3** (12px): `gap-3`, `p-3` - средние отступы
- **4** (16px): `gap-4`, `p-4` - стандартные отступы (наиболее часто используемые)
- **6** (24px): `gap-6`, `p-6` - большие отступы
- **8** (32px): `gap-8`, `p-8` - очень большие отступы

### Применение

- **Между элементами формы**: `gap-1.5` или `gap-2`
- **Внутри карточек**: `p-4`
- **Между секциями**: `gap-6` или `gap-8`
- **В модальных окнах**: `p-4 sm:p-6` (адаптивно)
- **В grid**: `gap-4`

---

## Компоненты

### Button

Универсальный компонент кнопки с вариантами и размерами.

#### Варианты (Variants)
- **primary**: Основная кнопка (темная/светлая в зависимости от темы)
- **secondary**: Вторичная кнопка (светлая/темная с backdrop-blur)
- **danger**: Опасное действие (красная)
- **ghost**: Прозрачная кнопка без фона

#### Размеры (Sizes)
- **sm**: `px-3 py-1.5 text-xs`
- **md**: `px-4 py-2 text-sm` (по умолчанию)
- **lg**: `px-6 py-3 text-base`

#### Особенности
- Плавные переходы: `transition-all duration-300`
- Hover эффекты: `hover:scale-[1.02]`
- Active эффекты: `active:scale-[0.98]`
- Поддержка состояния загрузки: `isLoading`
- Поддержка прогресса: `progress` (0-100)

#### Примеры
```tsx
<Button variant="primary" size="md">Сохранить</Button>
<Button variant="danger" size="sm">Удалить</Button>
<Button variant="ghost" isLoading>Загрузка...</Button>
```

### Input

Поле ввода с поддержкой label и error.

#### Особенности
- Автоматический label с правильным стилем
- Валидация с отображением ошибок
- Поддержка темной/светлой темы
- Focus состояния с ring
- Backdrop blur эффект

#### Примеры
```tsx
<Input label="Имя модпака" error={errors.name} />
<Input type="number" label="Порт" />
```

### Select

Выпадающий список с поддержкой label, description и error.

#### Особенности
- Кастомная стрелка вниз
- Поддержка описания под полем
- Валидация с отображением ошибок
- Стилизация идентична Input

#### Примеры
```tsx
<Select label="Версия" error={errors.version}>
  <option value="1.20.1">1.20.1</option>
</Select>
```

### Modal

Модальное окно с плавными анимациями.

#### Особенности
- Плавное появление/исчезновение (300ms)
- Закрытие по ESC
- Закрытие по клику вне окна
- Адаптивные размеры и отступы
- Backdrop blur эффект

#### Размеры
- Максимальная ширина: `max-w-lg`
- Адаптивные отступы: `p-2 sm:p-4 md:p-8`
- Адаптивная высота: `max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh]`

#### Примеры
```tsx
<Modal isOpen={isOpen} onClose={onClose} title="Создать модпак">
  <p>Содержимое модального окна</p>
</Modal>
```

### Toast

Уведомление с автоматическим скрытием.

#### Типы
- **success**: Успешная операция (зеленый)
- **error**: Ошибка (красный)
- **warning**: Предупреждение (желтый)
- **info**: Информация (синий)

#### Особенности
- Автоматическое скрытие через 5 секунд (настраивается)
- Плавная анимация появления/исчезновения
- Возможность закрыть вручную
- Иконки для каждого типа

#### Примеры
```tsx
// Используется через ToastContext
const { showToast } = useToast();
showToast('success', 'Модпак успешно создан');
```

### ConfirmDialog

Диалог подтверждения для замены `window.confirm()`.

#### Варианты
- **default**: Стандартное подтверждение
- **danger**: Опасное действие (красная кнопка)

#### Примеры
```tsx
// Используется через ConfirmContext
const { confirm } = useConfirm();
const result = await confirm('Вы уверены?', { variant: 'danger' });
```

### ErrorMessage

Компонент для отображения ошибок.

#### Варианты
- **standalone**: Отдельный блок ошибки
- **inline**: Встроенная ошибка в форме

#### Примеры
```tsx
<ErrorMessage message="Произошла ошибка" variant="standalone" />
<ErrorMessage message={errors.name} variant="inline" />
```

### LoadingSpinner

Спиннер загрузки.

#### Размеры
- **sm**: `w-4 h-4`
- **md**: `w-6 h-6` (по умолчанию)
- **lg**: `w-8 h-8`
- **xl**: `w-12 h-12`

#### Варианты
- **primary**: Основной (zinc цвета)
- **secondary**: Вторичный
- **accent**: Акцентный (использует текущий цвет текста)

#### Примеры
```tsx
<LoadingSpinner size="md" />
<LoadingSpinner size="lg" variant="accent" className="text-blue-500" />
```

### SkeletonLoader

Skeleton loader для состояний загрузки.

#### Варианты
- **text**: Текстовые строки
- **circular**: Круг (для аватаров)
- **rectangular**: Прямоугольник
- **rounded**: Скругленный прямоугольник

#### Особенности
- Поддержка множественных строк для text варианта
- Анимация pulse
- Настраиваемые размеры

#### Примеры
```tsx
<SkeletonLoader variant="text" lines={3} />
<SkeletonLoader variant="rounded" width="100%" height="200px" />
```

### ProgressBar

Прогресс-бар с поддержкой меток и анимации.

#### Размеры
- **sm**: `h-1`
- **md**: `h-2` (по умолчанию)
- **lg**: `h-3`

#### Особенности
- Анимированный shimmer эффект
- Поддержка меток (label, valueLabel)
- Отображение процентов внутри бара
- Автоматическое форматирование байтов (через `formatBytes`)

#### Примеры
```tsx
<ProgressBar value={50} label="Загрузка" valueLabel="50%" />
<ProgressBar value={75} showPercentage height="lg" />
```

### Tooltip

Подсказка при наведении.

#### Позиции
- **top**: Сверху
- **bottom**: Снизу (по умолчанию)
- **left**: Слева
- **right**: Справа

#### Особенности
- Автоматическое позиционирование
- Задержка появления (настраивается)
- Плавные анимации
- Поддержка keyboard navigation

#### Примеры
```tsx
<Tooltip content="Подсказка" position="top">
  <button>Наведите на меня</button>
</Tooltip>
```

### LazyImage

Изображение с lazy loading.

#### Особенности
- Intersection Observer для lazy loading
- Fallback на нативный lazy loading
- Placeholder во время загрузки
- Автоматический fallback на дефолтную иконку при ошибке

#### Примеры
```tsx
<LazyImage src="/icon.png" alt="Icon" fallback="/default.png" />
```

---

## Анимации

### Переходы

Все переходы используют стандартную длительность:
- **Короткие**: `duration-200` (200ms) - hover эффекты
- **Стандартные**: `duration-300` (300ms) - основные переходы
- **Долгие**: `duration-500` (500ms) - сложные анимации

### Keyframes

Определены следующие keyframes в `src/index.css`:

- **fade-in-up**: Появление снизу вверх
- **fade-in**: Простое появление
- **slide-in-up**: Скольжение снизу вверх с масштабированием
- **scale-in**: Масштабирование при появлении
- **shimmer**: Эффект мерцания для прогресс-баров

### Accessibility

Все анимации учитывают `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  /* Анимации отключаются */
}
```

---

## Тени (Shadows)

### Уровни

- **sm**: `shadow-sm` - легкие тени для элементов
- **md**: `shadow-md` - стандартные тени
- **lg**: `shadow-lg` - тени для кнопок и карточек
- **xl**: `shadow-xl` - тени при hover
- **2xl**: `shadow-2xl` - тени для модальных окон

### Цветные Тени

Для акцентных элементов используются цветные тени:
- `shadow-zinc-900/20` - для primary кнопок
- `shadow-red-500/30` - для danger кнопок
- `shadow-black/30` - для модальных окон

---

## Скругления (Border Radius)

- **sm**: `rounded-sm` (2px)
- **md**: `rounded-md` (6px)
- **lg**: `rounded-lg` (8px) - стандартное для кнопок и полей ввода
- **xl**: `rounded-xl` (12px) - для карточек
- **2xl**: `rounded-2xl` (16px) - для модальных окон
- **full**: `rounded-full` - для круглых элементов

---

## Backdrop Blur

Используется для создания эффекта стекла (glassmorphism):

- **Слабое**: `backdrop-blur-sm`
- **Среднее**: `backdrop-blur-md`
- **Сильное**: `backdrop-blur-xl`

Применяется к:
- Модальным окнам
- Карточкам
- Sidebar
- Input и Select полям

---

## Адаптивность

### Breakpoints

Используются стандартные Tailwind breakpoints:

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Примеры Адаптивного Дизайна

```tsx
// Адаптивные отступы
className="p-2 sm:p-4 md:p-8"

// Адаптивный grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

// Адаптивный текст
className="text-base sm:text-lg md:text-xl"
```

---

## Правила Использования

### DO ✅

- Используйте стандартные компоненты из `src/components/ui`
- Следуйте системе spacing (4, 8, 12, 16, 24, 32...)
- Используйте семантические цвета для соответствующих состояний
- Добавляйте плавные переходы для интерактивных элементов
- Учитывайте темную и светлую тему
- Используйте адаптивные классы для разных размеров экрана

### DON'T ❌

- Не создавайте кастомные компоненты, если есть стандартный
- Не используйте произвольные значения spacing
- Не используйте `alert()` или `window.confirm()` - используйте Toast и ConfirmDialog
- Не игнорируйте темную тему
- Не забывайте про accessibility (aria-labels, keyboard navigation)
- Не используйте фиксированные размеры без адаптивности

---

## Примеры Композиции

### Форма с Валидацией

```tsx
<div className="flex flex-col gap-4">
  <Input
    label="Имя модпака"
    value={name}
    onChange={(e) => setName(e.target.value)}
    error={errors.name}
  />
  <Select
    label="Версия"
    value={version}
    onChange={(e) => setVersion(e.target.value)}
    error={errors.version}
  />
  <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
    <Button variant="primary" onClick={handleSave}>
      Сохранить
    </Button>
    <Button variant="ghost" onClick={onClose}>
      Отмена
    </Button>
  </div>
</div>
```

### Карточка с Состояниями Загрузки

```tsx
{isLoading ? (
  <SkeletonLoader variant="rounded" width="100%" height="200px" />
) : error ? (
  <ErrorMessage message={error} variant="standalone" />
) : (
  <div className="p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700">
    {/* Контент карточки */}
  </div>
)}
```

---

**Дата создания:** 27 января 2026  
**Версия:** 1.0
