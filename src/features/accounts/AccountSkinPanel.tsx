import React, { useCallback, useEffect, useState } from 'react'
import type { Account } from '@shared/types'
import type { AccountSkinState } from '@shared/contracts/account'
import { useSettings } from '../../contexts/SettingsContext'
import { useToast } from '../../contexts/ToastContext'
import { accountIPC } from '../../services/ipc/accountIPC'
import { externalLinksIPC } from '../../services/ipc/externalLinksIPC'
import { Button } from '../../components/ui/Button'
import { LazyImage } from '../../components/ui/LazyImage'

interface AccountSkinPanelProps {
  account: Account
}

export const AccountSkinPanel: React.FC<AccountSkinPanelProps> = ({ account }) => {
  const { t } = useSettings()
  const toast = useToast()
  const [skinState, setSkinState] = useState<AccountSkinState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSkinState = useCallback(async () => {
    if (account.type !== 'third-party') {
      setSkinState({
        supported: false,
        reason: 'offline',
      })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const nextState = await accountIPC.getSkinState(account.id)
      setSkinState(nextState)
      setError(null)
    } catch (nextError) {
      console.error('Failed to load account skin state:', nextError)
      setError(nextError instanceof Error ? nextError.message : (t('accounts.skinLoadError') || 'Failed to load skin state.'))
    } finally {
      setLoading(false)
    }
  }, [account.id, account.type, t])

  useEffect(() => {
    void loadSkinState()
  }, [loadSkinState])

  const handleRefresh = useCallback(async () => {
    if (account.type !== 'third-party' || !skinState?.supported) {
      return
    }

    setBusy(true)
    try {
      const nextState = await accountIPC.refreshSkinState(account.id)
      setSkinState(nextState)
      setError(null)
      toast.success(t('accounts.skinRefreshSuccess') || 'Skin preview refreshed.')
    } catch (nextError) {
      const errorMessage = nextError instanceof Error ? nextError.message : String(nextError)
      setError(errorMessage)
      toast.error(`${t('accounts.skinRefreshError') || 'Failed to refresh skin preview.'} ${errorMessage}`)
    } finally {
      setBusy(false)
    }
  }, [account.id, account.type, skinState?.supported, t, toast])

  const handleOpenProvider = useCallback(async () => {
    if (!skinState?.manageUrl) {
      return
    }

    try {
      const result = await externalLinksIPC.open({
        url: skinState.manageUrl,
        context: `account-skin:${account.id}`,
      })

      if (result.status === 'blocked') {
        toast.error(t('accounts.skinOpenBlocked') || 'The skin provider page was blocked.')
      } else if (result.status === 'cancelled') {
        toast.error(t('accounts.skinOpenCancelled') || 'Opening the skin provider page was cancelled.')
      }
    } catch (nextError) {
      const errorMessage = nextError instanceof Error ? nextError.message : String(nextError)
      toast.error(`${t('accounts.skinOpenError') || 'Failed to open the skin provider page.'} ${errorMessage}`)
    }
  }, [account.id, skinState?.manageUrl, t, toast])

  const providerName = skinState?.providerLabel
    ?? (account.skinProvider === 'littleskin'
      ? (t('accounts.skinProviderLittleSkin') || 'LittleSkin')
      : (t('accounts.skinProviderBlessing') || 'Blessing Skin'))
  const avatarUrl = skinState?.avatarUrl ?? account.avatar
  const isSupported = Boolean(skinState?.supported)
  const canRefreshSkin = account.type === 'third-party' && isSupported && !loading
  const canOpenProvider = Boolean(isSupported && skinState?.manageUrl)

  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('accounts.skinTitle') || 'Skin Management'}</h3>
          <p className="mt-1 text-sm leading-6 text-secondary">
          {t('accounts.skinDescription') || 'Preview the current skin and jump directly to the provider skin page.'}
        </p>
        </div>
        {isSupported && (
          <span className="kicker-label rounded-full border border-border/60 bg-background/72 px-3 py-1">
            {providerName}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="surface-muted flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border/60 bg-background/75 p-1">
          <div className="h-full w-full overflow-hidden rounded-xl bg-card/82">
            <LazyImage
              src={avatarUrl}
              alt={t('accounts.skinPreviewAlt') || 'Skin preview'}
              fallback="/icon.png"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {loading
              ? (t('accounts.skinLoading') || 'Loading skin information...')
              : isSupported
                ? providerName
                : skinState?.reason === 'offline'
                  ? (t('accounts.skinUnsupportedOffline') || 'Offline accounts do not have a provider skin page.')
                  : (t('accounts.skinUnsupportedProvider') || 'This account provider does not expose a supported skin page yet.')}
          </p>
          <p className="mt-1 text-sm leading-6 text-secondary">
            {isSupported
              ? (t('accounts.skinManageHint') || 'Refresh the preview or open the provider site to change skins.')
              : (t('accounts.skinUnsupportedHint') || 'Supported providers in this release: Blessing Skin and LittleSkin.')}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={handleRefresh}
            isLoading={busy}
            disabled={!canRefreshSkin || busy}
          >
            {t('accounts.skinRefresh') || 'Refresh Preview'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleOpenProvider}
            disabled={!canOpenProvider}
          >
            {t('accounts.skinOpenProvider') || 'Open Skin Site'}
          </Button>
        </div>
      </div>
    </div>
  )
}
