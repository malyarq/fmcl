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
  }, [account.id, t, toast])

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

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{t('accounts.skinTitle') || 'Skin Management'}</h3>
        <p className="text-sm text-zinc-400">
          {t('accounts.skinDescription') || 'Preview the current skin and jump directly to the provider skin page.'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:items-center">
        <div className="w-20 h-20 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800/80">
          <LazyImage
            src={avatarUrl}
            alt={t('accounts.skinPreviewAlt') || 'Skin preview'}
            fallback="/icon.png"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {loading
              ? (t('accounts.skinLoading') || 'Loading skin information...')
              : skinState?.supported
                ? providerName
                : skinState?.reason === 'offline'
                  ? (t('accounts.skinUnsupportedOffline') || 'Offline accounts do not have a provider skin page.')
                  : (t('accounts.skinUnsupportedProvider') || 'This account provider does not expose a supported skin page yet.')}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {skinState?.supported
              ? (t('accounts.skinManageHint') || 'Refresh the preview or open the provider site to change skins.')
              : (t('accounts.skinUnsupportedHint') || 'Supported providers in this release: Blessing Skin and LittleSkin.')}
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleRefresh} isLoading={busy} disabled={loading}>
            {t('accounts.skinRefresh') || 'Refresh Preview'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleOpenProvider}
            disabled={!skinState?.supported || !skinState.manageUrl}
          >
            {t('accounts.skinOpenProvider') || 'Open Skin Site'}
          </Button>
        </div>
      </div>
    </div>
  )
}
