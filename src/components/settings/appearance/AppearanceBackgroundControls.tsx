import type { CSSProperties } from 'react';
import { cn } from '../../../utils/cn';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import type { CustomThemeConfig } from '../../../contexts/settings/types';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type BackgroundConfig = NonNullable<CustomThemeConfig['background']>;
type ParticleConfig = NonNullable<BackgroundConfig['particles']>;
type ParticleType = NonNullable<ParticleConfig['type']>;
type BackgroundType = NonNullable<BackgroundConfig['type']>;
type BackgroundPosition = NonNullable<BackgroundConfig['position']>;

const BACKGROUND_TYPES: readonly BackgroundType[] = ['image', 'video', 'particles'];
const BACKGROUND_POSITIONS: readonly BackgroundPosition[] = ['cover', 'contain', 'center', 'repeat'];
const PARTICLE_TYPES: readonly ParticleType[] = ['stars', 'snow', 'rain'];

function ToggleRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-copy">
        <p className="settings-toggle-title">{label}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        data-state={checked ? 'checked' : 'unchecked'}
        className="settings-toggle-switch"
      >
        <span className="settings-toggle-thumb" data-state={checked ? 'checked' : 'unchecked'} />
      </button>
    </div>
  );
}

interface AppearanceBackgroundControlsProps {
  accentRangeStyles: { className?: string; style?: CSSProperties };
  background: BackgroundConfig | undefined;
  onChange: (background: BackgroundConfig) => void;
  t: Translate;
}

export function AppearanceBackgroundControls({
  accentRangeStyles,
  background,
  onChange,
  t,
}: AppearanceBackgroundControlsProps) {
  const update = <K extends keyof BackgroundConfig>(key: K, value: BackgroundConfig[K]) => {
    onChange({ ...background, [key]: value });
  };
  const updateVideo = (video: NonNullable<BackgroundConfig['video']>) => {
    update('video', { ...background?.video, ...video });
  };
  const updateParticles = (particles: ParticleConfig) => {
    update('particles', { ...background?.particles, ...particles });
  };
  const backgroundType = background?.type || 'image';
  const sliderClassName = cn('settings-slider', accentRangeStyles.className);

  return (
    <CollapsibleSection title={t('settings.background_effects') || 'Background Effects'} defaultExpanded={false}>
      <div
        className="surface-muted min-w-0 space-y-4 p-4"
        data-appearance-owner="background"
        data-testid="appearance-background-controls"
      >
        <div className="surface-inline space-y-1 p-3" data-testid="appearance-background-scope">
          <p className="kicker-label">{t('settings.background_preview_title')}</p>
          <p className="text-sm leading-6 text-secondary">{t('settings.background_scope_desc')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t('settings.background_type')}</label>
          <Select
            value={backgroundType}
            aria-label={t('settings.background_type')}
            onChange={(event) => {
              const nextType = event.target.value as BackgroundType;
              if (BACKGROUND_TYPES.includes(nextType)) {
                update('type', nextType);
              }
            }}
          >
            <option value="image">{t('settings.background_type_image')}</option>
            <option value="video">{t('settings.background_type_video')}</option>
            <option value="particles">{t('settings.background_type_particles')}</option>
          </Select>
        </div>

        {backgroundType === 'image' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('settings.background_image_url')}</label>
            <Input
              value={background?.image || ''}
              aria-label={t('settings.background_image_url')}
              onChange={(event) => update('image', event.target.value)}
              placeholder={t('settings.background_image_url_placeholder')}
              className="w-full"
            />
            <p className="text-xs text-secondary">{t('settings.background_image_url_hint')}</p>
          </div>
        )}

        {backgroundType === 'video' && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('settings.background_video_url')}</label>
              <Input
                value={background?.video?.url || ''}
                aria-label={t('settings.background_video_url')}
                onChange={(event) => updateVideo({ url: event.target.value })}
                placeholder={t('settings.background_video_url_placeholder')}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="flex justify-between text-sm font-medium text-foreground">
                  <span>{t('settings.background_volume')}</span>
                  <span>{Math.round((background?.video?.volume ?? 0) * 100)}%</span>
                </label>
                <input
                  type="range"
                  aria-label={t('settings.background_volume')}
                  min="0"
                  max="1"
                  step="0.1"
                  value={background?.video?.volume ?? 0}
                  onChange={(event) => updateVideo({ volume: Number.parseFloat(event.target.value) })}
                  className={sliderClassName}
                  style={accentRangeStyles.style}
                />
              </div>
              <div className="pt-6">
                <ToggleRow
                  label={t('settings.background_autopause')}
                  checked={Boolean(background?.video?.autoPause)}
                  onToggle={() => updateVideo({ autoPause: !background?.video?.autoPause })}
                />
              </div>
            </div>
          </div>
        )}

        {backgroundType === 'particles' && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('settings.background_particle_type')}</label>
              <Select
                value={background?.particles?.type || 'stars'}
                aria-label={t('settings.background_particle_type')}
                onChange={(event) => {
                  const nextType = event.target.value as ParticleType;
                  updateParticles({ type: PARTICLE_TYPES.includes(nextType) ? nextType : 'stars' });
                }}
              >
                <option value="stars">{t('settings.background_particle_type_stars')}</option>
                <option value="snow">{t('settings.background_particle_type_snow')}</option>
                <option value="rain">{t('settings.background_particle_type_rain')}</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="flex justify-between text-sm font-medium text-foreground">
                  <span>{t('settings.background_intensity')}</span>
                  <span>{background?.particles?.intensity ?? 50}</span>
                </label>
                <input
                  type="range"
                  aria-label={t('settings.background_intensity')}
                  min="10"
                  max="100"
                  value={background?.particles?.intensity ?? 50}
                  onChange={(event) => updateParticles({ intensity: Number.parseInt(event.target.value, 10) })}
                  className={sliderClassName}
                  style={accentRangeStyles.style}
                />
              </div>
              <div className="space-y-2">
                <label className="flex justify-between text-sm font-medium text-foreground">
                  <span>{t('settings.background_speed')}</span>
                  <span>{background?.particles?.speed ?? 2}</span>
                </label>
                <input
                  type="range"
                  aria-label={t('settings.background_speed')}
                  min="1"
                  max="20"
                  step="0.5"
                  value={background?.particles?.speed ?? 2}
                  onChange={(event) => updateParticles({ speed: Number.parseFloat(event.target.value) })}
                  className={sliderClassName}
                  style={accentRangeStyles.style}
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 border-t border-border pt-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="flex justify-between text-sm font-medium text-foreground">
              <span>{t('settings.background_blur')}</span>
              <span>{background?.blur ?? 0}px</span>
            </label>
            <input
              type="range"
              aria-label={t('settings.background_blur')}
              min="0"
              max="20"
              value={background?.blur ?? 0}
              onChange={(event) => update('blur', Number.parseInt(event.target.value, 10))}
              className={sliderClassName}
              style={accentRangeStyles.style}
            />
          </div>
          <div className="space-y-2">
            <label className="flex justify-between text-sm font-medium text-foreground">
              <span>{t('settings.background_opacity')}</span>
              <span>{Math.round((background?.opacity ?? 1) * 100)}%</span>
            </label>
            <input
              type="range"
              aria-label={t('settings.background_opacity')}
              min="0"
              max="1"
              step="0.1"
              value={background?.opacity ?? 1}
              onChange={(event) => update('opacity', Number.parseFloat(event.target.value))}
              className={sliderClassName}
              style={accentRangeStyles.style}
            />
          </div>
          {backgroundType === 'image' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('settings.background_position')}</label>
              <Select
                value={background?.position || 'cover'}
                aria-label={t('settings.background_position')}
                onChange={(event) => {
                  const nextPosition = event.target.value as BackgroundPosition;
                  if (BACKGROUND_POSITIONS.includes(nextPosition)) {
                    update('position', nextPosition);
                  }
                }}
              >
                <option value="cover">{t('settings.background_position_cover')}</option>
                <option value="contain">{t('settings.background_position_contain')}</option>
                <option value="center">{t('settings.background_position_center')}</option>
                <option value="repeat">{t('settings.background_position_repeat')}</option>
              </Select>
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}
