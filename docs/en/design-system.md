# Design System (English)

## Overview

FriendLauncher Design System defines visual design standards, components, and styles to ensure interface consistency throughout the application.

---

## Color Palette

### Primary Colors

The project uses **Zinc** as the primary color palette with support for dark and light themes.

#### Light Theme
- **Background**: `bg-zinc-100`
- **Text**: `text-zinc-900`
- **Surfaces**: `bg-white/80` with `backdrop-blur-sm`
- **Borders**: `border-zinc-300/50`

#### Dark Theme
- **Background**: `bg-zinc-900`
- **Text**: `text-white` / `text-zinc-100`
- **Surfaces**: `bg-zinc-800/80` with `backdrop-blur-sm`
- **Borders**: `border-zinc-700/50`

### Accent Colors

The following accent colors are supported (user-configurable):
- **Emerald** (green) - default
- **Blue**
- **Purple**
- **Orange**
- **Rose**

Accent colors are used for:
- Action buttons
- Progress bars
- Accent interface elements
- Focus and hover states

### Semantic Colors

#### Success
- Light: `bg-green-500/90`, `text-white`
- Dark: `bg-green-600/90`, `text-white`
- Used for: successful operations, toast notifications

#### Error
- Light: `bg-red-500/90`, `text-white`
- Dark: `bg-red-600/90`, `text-white`
- Used for: errors, dangerous action warnings

#### Warning
- Light: `bg-yellow-500/90`, `text-white`
- Dark: `bg-yellow-600/90`, `text-white`
- Used for: warnings, toast notifications

#### Info
- Light: `bg-blue-500/90`, `text-white`
- Dark: `bg-blue-600/90`, `text-white`
- Used for: informational messages

---

## Typography

### Font

- **Primary font**: `Inter`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`
- **Default weight**: `400` (normal)

### Text Sizes

Uses standard Tailwind CSS scale:

- **xs**: `text-xs` (12px) - labels, hints
- **sm**: `text-sm` (14px) - body text, buttons
- **base**: `text-base` (16px) - main content
- **lg**: `text-lg` (18px) - subheadings
- **xl**: `text-xl` (20px) - section headings
- **2xl**: `text-2xl` (24px) - large headings

### Font Weights

- **normal**: `font-normal` (400)
- **medium**: `font-medium` (500)
- **semibold**: `font-semibold` (600)
- **bold**: `font-bold` (700)
- **black**: `font-black` (900) - only for "Play" button

### Section Headings

Section headings use the following style:
```css
text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400
```

---

## Spacing

Uses standard Tailwind CSS spacing scale (4px base unit):

### Recommended Values

- **0.5** (2px): `gap-0.5`, `p-0.5` - minimal spacing
- **1** (4px): `gap-1`, `p-1` - very small spacing
- **1.5** (6px): `gap-1.5`, `p-1.5` - small spacing (between label and input)
- **2** (8px): `gap-2`, `p-2` - small spacing
- **3** (12px): `gap-3`, `p-3` - medium spacing
- **4** (16px): `gap-4`, `p-4` - standard spacing (most commonly used)
- **6** (24px): `gap-6`, `p-6` - large spacing
- **8** (32px): `gap-8`, `p-8` - very large spacing

### Usage

- **Between form elements**: `gap-1.5` or `gap-2`
- **Inside cards**: `p-4`
- **Between sections**: `gap-6` or `gap-8`
- **In modals**: `p-4 sm:p-6` (responsive)
- **In grids**: `gap-4`

---

## Components

### Button

Universal button component with variants and sizes.

#### Variants
- **primary**: Primary button (dark/light depending on theme)
- **secondary**: Secondary button (light/dark with backdrop-blur)
- **danger**: Dangerous action (red)
- **ghost**: Transparent button without background

#### Sizes
- **sm**: `px-3 py-1.5 text-xs`
- **md**: `px-4 py-2 text-sm` (default)
- **lg**: `px-6 py-3 text-base`

#### Features
- Smooth transitions: `transition-all duration-300`
- Hover effects: `hover:scale-[1.02]`
- Active effects: `active:scale-[0.98]`
- Loading state support: `isLoading`
- Progress support: `progress` (0-100)

#### Examples
```tsx
<Button variant="primary" size="md">Save</Button>
<Button variant="danger" size="sm">Delete</Button>
<Button variant="ghost" isLoading>Loading...</Button>
```

### Input

Input field with label and error support.

#### Features
- Automatic label with correct styling
- Validation with error display
- Dark/light theme support
- Focus states with ring
- Backdrop blur effect

#### Examples
```tsx
<Input label="Modpack name" error={errors.name} />
<Input type="number" label="Port" />
```

### Select

Dropdown with label, description, and error support.

#### Features
- Custom down arrow
- Description support below field
- Validation with error display
- Styling identical to Input

#### Examples
```tsx
<Select label="Version" error={errors.version}>
  <option value="1.20.1">1.20.1</option>
</Select>
```

### Modal

Modal window with smooth animations.

#### Features
- Smooth appear/disappear (300ms)
- Close on ESC
- Close on outside click
- Responsive sizes and spacing
- Backdrop blur effect

#### Sizes
- Max width: `max-w-lg`
- Responsive padding: `p-2 sm:p-4 md:p-8`
- Responsive height: `max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh]`

#### Examples
```tsx
<Modal isOpen={isOpen} onClose={onClose} title="Create Modpack">
  <p>Modal content</p>
</Modal>
```

### Toast

Notification with automatic dismissal.

#### Types
- **success**: Successful operation (green)
- **error**: Error (red)
- **warning**: Warning (yellow)
- **info**: Information (blue)

#### Features
- Automatic dismissal after 5 seconds (configurable)
- Smooth appear/disappear animation
- Manual close option
- Icons for each type

#### Examples
```tsx
// Used via ToastContext
const { showToast } = useToast();
showToast('success', 'Modpack created successfully');
```

### ConfirmDialog

Confirmation dialog to replace `window.confirm()`.

#### Variants
- **default**: Standard confirmation
- **danger**: Dangerous action (red button)

#### Examples
```tsx
// Used via ConfirmContext
const { confirm } = useConfirm();
const result = await confirm('Are you sure?', { variant: 'danger' });
```

### ErrorMessage

Component for displaying errors.

#### Variants
- **standalone**: Separate error block
- **inline**: Inline error in form

#### Examples
```tsx
<ErrorMessage message="An error occurred" variant="standalone" />
<ErrorMessage message={errors.name} variant="inline" />
```

### LoadingSpinner

Loading spinner.

#### Sizes
- **sm**: `w-4 h-4`
- **md**: `w-6 h-6` (default)
- **lg**: `w-8 h-8`
- **xl**: `w-12 h-12`

#### Variants
- **primary**: Primary (zinc colors)
- **secondary**: Secondary
- **accent**: Accent (uses current text color)

#### Examples
```tsx
<LoadingSpinner size="md" />
<LoadingSpinner size="lg" variant="accent" className="text-blue-500" />
```

### SkeletonLoader

Skeleton loader for loading states.

#### Variants
- **text**: Text lines
- **circular**: Circle (for avatars)
- **rectangular**: Rectangle
- **rounded**: Rounded rectangle

#### Features
- Multiple lines support for text variant
- Pulse animation
- Customizable sizes

#### Examples
```tsx
<SkeletonLoader variant="text" lines={3} />
<SkeletonLoader variant="rounded" width="100%" height="200px" />
```

### ProgressBar

Progress bar with label and animation support.

#### Sizes
- **sm**: `h-1`
- **md**: `h-2` (default)
- **lg**: `h-3`

#### Features
- Animated shimmer effect
- Label support (label, valueLabel)
- Percentage display inside bar
- Automatic byte formatting (via `formatBytes`)

#### Examples
```tsx
<ProgressBar value={50} label="Downloading" valueLabel="50%" />
<ProgressBar value={75} showPercentage height="lg" />
```

### Tooltip

Tooltip on hover.

#### Positions
- **top**: Top
- **bottom**: Bottom (default)
- **left**: Left
- **right**: Right

#### Features
- Automatic positioning
- Appearance delay (configurable)
- Smooth animations
- Keyboard navigation support

#### Examples
```tsx
<Tooltip content="Tooltip" position="top">
  <button>Hover me</button>
</Tooltip>
```

### LazyImage

Image with lazy loading.

#### Features
- Intersection Observer for lazy loading
- Fallback to native lazy loading
- Placeholder during loading
- Automatic fallback to default icon on error

#### Examples
```tsx
<LazyImage src="/icon.png" alt="Icon" fallback="/default.png" />
```

---

## Animations

### Transitions

All transitions use standard duration:
- **Short**: `duration-200` (200ms) - hover effects
- **Standard**: `duration-300` (300ms) - main transitions
- **Long**: `duration-500` (500ms) - complex animations

### Keyframes

The following keyframes are defined in `src/index.css`:

- **fade-in-up**: Appear from bottom to top
- **fade-in**: Simple appear
- **slide-in-up**: Slide from bottom with scaling
- **scale-in**: Scale on appear
- **shimmer**: Shimmer effect for progress bars

### Accessibility

All animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  /* Animations are disabled */
}
```

---

## Shadows

### Levels

- **sm**: `shadow-sm` - light shadows for elements
- **md**: `shadow-md` - standard shadows
- **lg**: `shadow-lg` - shadows for buttons and cards
- **xl**: `shadow-xl` - shadows on hover
- **2xl**: `shadow-2xl` - shadows for modals

### Colored Shadows

Colored shadows are used for accent elements:
- `shadow-zinc-900/20` - for primary buttons
- `shadow-red-500/30` - for danger buttons
- `shadow-black/30` - for modals

---

## Border Radius

- **sm**: `rounded-sm` (2px)
- **md**: `rounded-md` (6px)
- **lg**: `rounded-lg` (8px) - standard for buttons and inputs
- **xl**: `rounded-xl` (12px) - for cards
- **2xl**: `rounded-2xl` (16px) - for modals
- **full**: `rounded-full` - for circular elements

---

## Backdrop Blur

Used to create glassmorphism effect:

- **Weak**: `backdrop-blur-sm`
- **Medium**: `backdrop-blur-md`
- **Strong**: `backdrop-blur-xl`

Applied to:
- Modals
- Cards
- Sidebar
- Input and Select fields

---

## Responsiveness

### Breakpoints

Uses standard Tailwind breakpoints:

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Responsive Design Examples

```tsx
// Responsive padding
className="p-2 sm:p-4 md:p-8"

// Responsive grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

// Responsive text
className="text-base sm:text-lg md:text-xl"
```

---

## Usage Guidelines

### DO ✅

- Use standard components from `src/components/ui`
- Follow spacing system (4, 8, 12, 16, 24, 32...)
- Use semantic colors for corresponding states
- Add smooth transitions for interactive elements
- Consider dark and light themes
- Use responsive classes for different screen sizes

### DON'T ❌

- Don't create custom components if a standard one exists
- Don't use arbitrary spacing values
- Don't use `alert()` or `window.confirm()` - use Toast and ConfirmDialog
- Don't ignore dark theme
- Don't forget accessibility (aria-labels, keyboard navigation)
- Don't use fixed sizes without responsiveness

---

## Composition Examples

### Form with Validation

```tsx
<div className="flex flex-col gap-4">
  <Input
    label="Modpack name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    error={errors.name}
  />
  <Select
    label="Version"
    value={version}
    onChange={(e) => setVersion(e.target.value)}
    error={errors.version}
  />
  <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
    <Button variant="primary" onClick={handleSave}>
      Save
    </Button>
    <Button variant="ghost" onClick={onClose}>
      Cancel
    </Button>
  </div>
</div>
```

### Card with Loading States

```tsx
{isLoading ? (
  <SkeletonLoader variant="rounded" width="100%" height="200px" />
) : error ? (
  <ErrorMessage message={error} variant="standalone" />
) : (
  <div className="p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700">
    {/* Card content */}
  </div>
)}
```

---

**Created:** January 27, 2026  
**Version:** 1.0
