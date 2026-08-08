# Design system

This document describes the maintained UI contract. The canonical implementation is `src/index.css`, `tailwind.config.js`, `src/contexts/settings/`, and `src/components/ui/`.

Do not copy long Tailwind class lists from this page into new components. Reuse semantic tokens and shared primitives so themes and accessibility behavior stay consistent.

## Foundations

### Brand identity

The public product name is **Burrow** and the multiplayer feature is **Burrow Link**. The English tagline is **Play local. Bring a friend.** The product mark is a compact voxel hillside opened around a warm torch-lit cave. The cave remains the focal point; grass, dirt, stone, and the small ore detail establish the Minecraft-launcher context without adding characters or a competing tool motif.

| Role | Value |
| --- | --- |
| Graphite | `#151816` |
| Burrow mint | `#73C6A1` |
| Warm white | `#F5F2E9` |
| Torch amber | `#FFB45C` |

`docs/assets/brand/burrow-app-icon.png` is the canonical artwork. It generates `public/launcher-mark.png`, `public/icon.png`, `public/icon-macos.png`, and `public/icon.ico`; do not crop the cave, flatten its directional lighting, recolor the terrain, or place the mark inside another brand frame. The master has a transparent background and safe space on every side, including below the foreground blocks. Keep the voxel silhouette and alpha edge clean: no grey bands, generated backdrop, or rounded-square mask. `docs/assets/brand/burrow-social-preview.svg` and `.png` are repository/social artwork. The primary lockup may be horizontal or vertical, but the wordmark must remain visually separate from the detailed icon. User-selected accents may customize controls, but they do not recolor the product mark or wordmark.

### Semantic colors

Tailwind names map to runtime CSS variables:

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

Use semantic names such as `bg-card` and `text-secondary`. Direct Zinc values are acceptable only for isolated native-like or console surfaces that intentionally do not follow theme tokens.

Accent actions use `--accent-main`, `--accent-hover`, and `--accent-content`. Preset accents are emerald, blue, purple, orange, and rose; a valid custom hex color is also supported.

### Themes and presets

The application supports light and dark modes. Presets are defined in `src/contexts/settings/theme-presets.ts`:

- `default`
- `midnight`
- `forest`
- `light-plus`
- `navy`

Preset changes must preserve explicit user overrides and expose a clear reset target. Do not add a local theme state to a component.

### Shared surface classes

Use the classes owned by `src/index.css`:

- `surface-panel` — major dialog or route surface
- `surface-card` — standard content card
- `surface-muted` — quiet nested section
- `surface-inline` and `surface-soft` — compact nested feedback/content
- `control-frame` and `control-label` — form controls
- `kicker-label` and `helper-text` — supporting hierarchy
- `settings-*` classes — the shared settings layout contract

These classes own radius, border, opacity, backdrop, and shadows. Avoid rebuilding the same surface with route-local classes.

## Shared components

All shared primitives live in `src/components/ui/`.

| Component | Important contract |
| --- | --- |
| `Button` | Variants `primary`, `secondary`, `danger`, `ghost`; sizes `sm`, `md`, `lg`; geometry `default`, `catalog-primary`, `compact-control`, `utility`; supports `isLoading` and `progress`. |
| `Input`, `Textarea` | Native attributes plus `label`, `error`, and container styling. Labels receive stable generated IDs. |
| `Select` | Native select plus `label`, `description`, and `error`. |
| `Modal` | Accessible dialog, focus trap/restore, topmost Escape handling, reduced motion, and optional `closeDisabled`. |
| `ConfirmDialog` | Rendered through `ConfirmProvider`; supports default/danger confirmation and prompt input. |
| `Toast` | `success`, `error`, `warning`, `info`; repeated messages are grouped. Use `ToastContext`. |
| `ErrorMessage` | Variants `default` and `inline`. |
| `LoadingSpinner`, `SkeletonLoader`, `ProgressBar` | Shared busy and progress states. |
| `AnchoredOverlay`, `Tooltip` | Viewport-aware portalled overlays; Tooltip defaults to `top` with a 300 ms delay. |
| `LazyImage`, `ArtworkFallback` | Cached remote images and centralized product/content fallback artwork. |
| `Breadcrumbs`, `CollapsibleSection` | Shared navigation and disclosure behavior. |

Read the component's TypeScript props before using an uncommon option; the implementation is the API reference.

## Correct usage

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

Do not swap the Toast arguments, pass positional arguments to `confirm`, or use the removed `standalone` ErrorMessage variant.

## Interaction rules

- One surface owns the primary action; nested cards do not compete with it.
- Disabled controls remain readable and explain why the action is unavailable.
- Loading state does not silently erase an actionable error or the user's recoverable selection.
- Destructive actions use the danger variant and name the affected object.
- Long localized labels may wrap; do not depend on English text width.
- Use `AnchoredOverlay` for menus/tooltips that must remain inside the viewport.

## Accessibility

- Every dialog needs an accessible title and managed focus.
- Icon-only buttons require `aria-label`.
- Tabs, disclosures, progress, errors, and busy states expose their semantic state.
- Keyboard behavior must match pointer behavior.
- Visible focus indicators use the current accent.
- Animations respect `prefers-reduced-motion` and the app's `disable-animations` class.
- Test light/dark themes, English/Russian copy, the minimum 800×600 window, and keyboard navigation.

## Adding or changing a primitive

1. Confirm that an existing primitive or semantic class cannot express the behavior.
2. Keep the API small and based on product semantics, not one route's class names.
3. Add focused tests for behavior and accessibility.
4. Migrate at least the owning use case; do not leave two competing primitives.
5. Update both design-system documents when the public contract changes.
6. Run `npm run verify` and the visual closeout.
