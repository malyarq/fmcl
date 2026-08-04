import React, { useRef, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useVersions } from '../../features/launcher/hooks/useVersions';
import { useModSupportedVersions } from '../../features/launcher/hooks/useModSupportedVersions';
import { useModpackCreationDraft } from '../../features/modpacks/hooks/useModpackCreationDraft';
import { buildRuntimeDependencyState } from '../sidebar/modpackRuntimeDependencies';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { DegradedStateView } from '../layout/DegradedStateView';
import { cn } from '../../utils/cn';
import { CreationContentStep } from './create/CreationContentStep';
import { CreationRuntimeStep } from './create/CreationRuntimeStep';

interface ModpackCreationWizardProps {
  onBack: () => void;
  onCreated?: (modpackId: string) => void;
}

type WizardStep = 1 | 2 | 3;

export const ModpackCreationWizard: React.FC<ModpackCreationWizardProps> = ({
  onBack,
  onCreated,
}) => {
  const { t, getAccentStyles } = useSettings();
  const { versions } = useVersions();
  const {
    forgeVersions,
    fabricVersions,
    neoForgeVersions,
    optiFineVersions,
  } = useModSupportedVersions();
  const creation = useModpackCreationDraft();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const finishingRef = useRef(false);

  const isOptiFineSupported = optiFineVersions.includes(creation.draft.minecraftVersion);
  const runtime = buildRuntimeDependencyState({
    minecraftVersion: creation.draft.minecraftVersion.trim(),
    modLoaderType: creation.modLoaderType,
    useOptiFine: creation.draft.useOptiFine,
    isOptiFineSupported,
  });
  const busy = creation.isSubmitting || isFinishing;
  const canProceedFromStep1 = Boolean(creation.draft.name.trim()) && !creation.nameError;
  const canProceedFromStep2 = Boolean(
    creation.draft.version.trim() && creation.draft.minecraftVersion.trim(),
  );

  const handleNext = async () => {
    if (busy || creation.draftStatus === 'invalid') return;
    if (currentStep === 1) {
      if (creation.validateCurrentName()) return;
      setCurrentStep(2);
      return;
    }
    if (currentStep !== 2) return;
    if (creation.committedId) {
      setCurrentStep(3);
      return;
    }

    const result = await creation.create(runtime);
    if (result) setCurrentStep(3);
  };

  const handleBack = () => {
    if (busy) return;
    if (creation.committedId) return;
    if (currentStep > 1) setCurrentStep((step) => (step - 1) as WizardStep);
  };

  const handleFinish = async () => {
    if (!creation.committedId || finishingRef.current || creation.isSubmitting) return;
    finishingRef.current = true;
    setIsFinishing(true);
    try {
      const ready = await creation.retryCanonicalSync();
      if (!ready) return;
      const createdId = creation.committedId;
      creation.resetAfterCompletion();
      setCurrentStep(1);
      onCreated?.(createdId);
    } finally {
      finishingRef.current = false;
      setIsFinishing(false);
    }
  };

  const handleClose = () => {
    if (!busy) onBack();
  };

  const handleDiscardDraft = () => {
    if (!creation.resetDraft()) return;
    setCurrentStep(1);
  };

  const renderBasicsStep = () => (
    <div className="space-y-4">
      <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t('wizard.step1_desc') || 'Enter basic information about your modpack'}
      </div>
      <Input
        label={t('modpacks.name')}
        value={creation.draft.name}
        onChange={(event) => creation.updateDraft({ name: event.target.value })}
        onBlur={() => creation.validateCurrentName()}
        placeholder={t('modpacks.new_placeholder')}
        error={creation.nameError || undefined}
        maxLength={50}
        required
        autoFocus
      />
      <Textarea
        label={t('modpacks.description') || 'Description'}
        value={creation.draft.description}
        onChange={(event) => creation.updateDraft({ description: event.target.value })}
        placeholder={t('modpacks.description_placeholder')}
        maxLength={4_000}
        rows={3}
      />
    </div>
  );

  const renderDraftRecovery = () => (
    <DegradedStateView
      variant="error"
      layout="workspace"
      testId="modpack-creation-draft-recovery"
      title={t('wizard.invalid_draft_title') || 'Saved draft cannot be restored'}
      description={
        t('wizard.invalid_draft_desc')
        || 'The saved data is invalid. It was left untouched so you can discard it explicitly.'
      }
      footer={(
        <Button variant="secondary" onClick={handleDiscardDraft}>
          {t('wizard.discard_invalid_draft') || 'Discard invalid draft'}
        </Button>
      )}
    />
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-zinc-200 bg-white/60 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <Breadcrumbs
          items={[
            { label: t('modpacks.title') || 'Modpacks', onClick: busy ? undefined : handleClose },
            { label: t('modpacks.create_new') || 'Create New', active: true },
          ]}
        />
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={busy}
            className="flex items-center gap-2"
          >
            <span>←</span>
            {t('general.back') || 'Back'}
          </Button>
          <h2 className="flex-1 text-xl font-bold text-zinc-900 dark:text-white">
            {t('modpacks.create_new') || 'Create New Modpack'}
          </h2>
        </div>
      </div>

      <div className="min-h-0 flex-1" data-testid="modpack-creation-flow">
        <div className="mx-auto flex h-full min-h-0 max-w-2xl flex-col">
          <div
            className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
            data-testid="modpack-creation-scroll-region"
          >
            <div className="flex min-h-full flex-col gap-6 pb-2">
              <div className="flex items-center justify-between">
                {[1, 2, 3].map((step) => (
                  <React.Fragment key={step}>
                    <div className="flex flex-1 flex-col items-center">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all',
                          currentStep === step
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : currentStep > step
                              ? 'bg-emerald-500 text-white'
                              : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',
                        )}
                        style={currentStep === step ? getAccentStyles('bg').style : undefined}
                      >
                        {currentStep > step ? '✓' : step}
                      </div>
                      <div className="mx-auto mt-2 max-w-[4.5rem] text-center text-xs leading-tight text-zinc-500 dark:text-zinc-400">
                        {step === 1
                          ? t('wizard.step1_title') || 'Basic Info'
                          : step === 2
                            ? t('wizard.step2_title') || 'Version & Loader'
                            : t('wizard.step3_title') || 'Add mods'}
                      </div>
                    </div>
                    {step < 3 ? (
                      <div
                        className={cn(
                          'mx-2 h-0.5 flex-1 transition-all',
                          currentStep > step
                            ? 'bg-emerald-500'
                            : 'bg-zinc-200 dark:bg-zinc-700',
                        )}
                      />
                    ) : null}
                  </React.Fragment>
                ))}
              </div>

              {creation.draftStatus === 'restored' && currentStep === 1 ? (
                <div
                  className="surface-inline flex flex-col gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/8 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  data-testid="modpack-creation-draft-restored"
                  role="status"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {t('wizard.draft_restored_title') || 'Draft restored'}
                    </p>
                    <p className="text-secondary">
                      {t('wizard.draft_restored_desc') || 'Your unfinished modpack is ready to continue.'}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleDiscardDraft}>
                    {t('wizard.discard_draft') || 'Discard draft'}
                  </Button>
                </div>
              ) : null}

              <div className="min-h-[300px]">
                {creation.draftStatus === 'invalid' ? renderDraftRecovery() : null}
                {creation.draftStatus !== 'invalid' && currentStep === 1 ? renderBasicsStep() : null}
                {creation.draftStatus !== 'invalid' && currentStep === 2 ? (
                  <CreationRuntimeStep
                    draft={creation.draft}
                    runtime={runtime}
                    versions={versions}
                    forgeVersions={forgeVersions}
                    fabricVersions={fabricVersions}
                    neoForgeVersions={neoForgeVersions}
                    isOptiFineSupported={isOptiFineSupported}
                    updateDraft={creation.updateDraft}
                    t={t}
                    getAccentStyles={getAccentStyles}
                  />
                ) : null}
                {creation.draftStatus !== 'invalid' && currentStep === 3 ? (
                  <CreationContentStep
                    modpackId={creation.committedId}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="border-t border-zinc-200/80 bg-background/95 px-6 py-4 backdrop-blur dark:border-zinc-700/80"
            data-testid="modpack-creation-action-rail"
          >
            <div className="flex flex-col gap-3">
              {creation.error && !creation.nameError ? <ErrorMessage message={creation.error} /> : null}
              {creation.needsCanonicalSync ? (
                <div
                  className="rounded-2xl border border-amber-500/35 bg-amber-500/12 px-4 py-3 text-sm text-foreground"
                  data-testid="modpack-creation-recovery"
                  role="status"
                  aria-live="polite"
                >
                  {t('modpacks.create_post_commit_recovery')
                    || 'Created successfully. Some optional details can be updated later from this modpack.'}
                </div>
              ) : null}

              <div
                className="surface-card flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center"
                data-testid="modpack-creation-actions"
              >
                {currentStep > 1 && !creation.committedId ? (
                  <Button
                    variant="secondary"
                    onClick={handleBack}
                    className="w-full sm:w-auto"
                    disabled={busy}
                  >
                    {t('wizard.back') || 'Back'}
                  </Button>
                ) : null}
                {currentStep === 1 && creation.draftStatus === 'active' ? (
                  <Button
                    variant="secondary"
                    onClick={handleDiscardDraft}
                    className="w-full sm:w-auto"
                    disabled={busy}
                  >
                    {t('wizard.reset_draft') || 'Reset draft'}
                  </Button>
                ) : null}
                <div className="hidden sm:block sm:flex-1" />
                {currentStep < 3 ? (
                  <Button
                    variant="primary"
                    onClick={() => { void handleNext(); }}
                    className="w-full sm:w-auto"
                    disabled={
                      busy
                      || creation.draftStatus === 'invalid'
                      || (currentStep === 1 && !canProceedFromStep1)
                      || (currentStep === 2 && !canProceedFromStep2)
                    }
                    style={getAccentStyles('bg').style}
                    isLoading={creation.isSubmitting && currentStep === 2}
                  >
                    {t('wizard.next') || 'Next'}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => { void handleFinish(); }}
                    className="w-full sm:w-auto"
                    disabled={busy || !creation.committedId}
                    style={getAccentStyles('bg').style}
                    isLoading={busy}
                  >
                    {busy ? t('modpacks.creating') || 'Creating...' : t('wizard.finish') || 'Finish'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleClose}
                  className="w-full sm:w-auto"
                  disabled={busy}
                >
                  {t('general.cancel')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
