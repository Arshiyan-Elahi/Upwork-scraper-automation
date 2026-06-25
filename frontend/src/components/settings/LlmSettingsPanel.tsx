import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2, Trash2 } from 'lucide-react'
import {
  deleteLlmKey,
  getLlmSettings,
  saveLlmKey,
  setLlmGenerationProvider,
} from '../../api/settings'
import type { LlmProviderId, LlmSettings } from '../../types'
import { PageError } from '../PageStates'
import { Badge, Button, Card } from '../ui'
import { inputClassName, labelClassName, selectClassName } from '../../utils/form'

const PROVIDERS: { id: LlmProviderId; label: string; hint: string }[] = [
  { id: 'gemini', label: 'Google Gemini', hint: 'Structured analysis + generation' },
  { id: 'groq', label: 'Groq', hint: 'Fast text generation' },
  { id: 'claude', label: 'Claude (Anthropic)', hint: 'Text generation' },
  { id: 'openai', label: 'OpenAI', hint: 'Text generation' },
]

export function LlmSettingsPanel() {
  const [settings, setSettings] = useState<LlmSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftKeys, setDraftKeys] = useState<Record<LlmProviderId, string>>({
    gemini: '',
    groq: '',
    claude: '',
    openai: '',
  })
  const [savingProvider, setSavingProvider] = useState<LlmProviderId | null>(null)
  const [removingProvider, setRemovingProvider] = useState<LlmProviderId | null>(null)
  const [switchingProvider, setSwitchingProvider] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLlmSettings()
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load LLM settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const configuredProviders = useMemo(() => {
    if (!settings) return [] as LlmProviderId[]
    return PROVIDERS.filter((p) => settings.providers[p.id]?.configured).map((p) => p.id)
  }, [settings])

  const flashSuccess = (message: string) => {
    setSuccess(message)
    window.setTimeout(() => setSuccess(null), 2500)
  }

  const handleSaveKey = async (provider: LlmProviderId) => {
    const apiKey = draftKeys[provider].trim()
    if (!apiKey) return

    setSavingProvider(provider)
    setError(null)
    try {
      const saved = await saveLlmKey(provider, apiKey)
      setDraftKeys((prev) => ({ ...prev, [provider]: '' }))
      setSettings((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          providers: {
            ...prev.providers,
            [provider]: { configured: true, last4: saved.last4 },
          },
        }
      })
      flashSuccess(`${PROVIDERS.find((p) => p.id === provider)?.label ?? provider} key saved.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key.')
    } finally {
      setSavingProvider(null)
    }
  }

  const handleRemoveKey = async (provider: LlmProviderId) => {
    setRemovingProvider(provider)
    setError(null)
    try {
      await deleteLlmKey(provider)
      setDraftKeys((prev) => ({ ...prev, [provider]: '' }))
      flashSuccess('Stored key removed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove API key.')
    } finally {
      setRemovingProvider(null)
    }
  }

  const handleProviderChange = async (provider: LlmProviderId) => {
    if (!settings || settings.generation_provider === provider) return

    setSwitchingProvider(true)
    setError(null)
    try {
      const updated = await setLlmGenerationProvider(provider)
      setSettings(updated)
      flashSuccess('Generation provider updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update generation provider.')
    } finally {
      setSwitchingProvider(false)
    }
  }

  if (loading) {
    return (
      <Card variant="default" padding="md" className="flex items-center gap-2 text-sm text-content-secondary dark:text-content-dark-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading LLM settings…
      </Card>
    )
  }

  if (error && !settings) {
    return <PageError title="Could not load LLM settings" message={error} onRetry={() => void load()} />
  }

  return (
    <Card variant="default" padding="md" className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand" />
          <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
            LLM API keys
          </h2>
        </div>
        <p className="text-sm text-content-muted dark:text-content-dark-muted">
          Keys are sent once to the backend, encrypted at rest, and never shown again in full.
          Only the last four characters are displayed after saving.
        </p>
      </div>

      {error && settings && (
        <PageError message={error} onRetry={() => setError(null)} />
      )}

      {success && (
        <p className="text-sm text-semantic-success dark:text-semantic-success-light">{success}</p>
      )}

      <div>
        <label htmlFor="generation-provider" className={labelClassName}>
          Active generation provider
        </label>
        <select
          id="generation-provider"
          value={settings?.generation_provider ?? ''}
          disabled={switchingProvider || configuredProviders.length === 0}
          onChange={(e) => void handleProviderChange(e.target.value as LlmProviderId)}
          className={selectClassName}
        >
          {configuredProviders.length === 0 ? (
            <option value="">Configure a provider key first</option>
          ) : (
            configuredProviders.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS.find((p) => p.id === id)?.label ?? id}
              </option>
            ))
          )}
        </select>
        <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
          Used for proposal and follow-up text generation. Structured analysis always uses Gemini.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map(({ id, label, hint }) => {
          const status = settings?.providers[id]
          const configured = status?.configured ?? false
          const hasStoredKey = Boolean(status?.last4)

          return (
            <div
              key={id}
              className="rounded-xl border border-border bg-surface-secondary/40 p-4 dark:border-border-dark dark:bg-surface-dark-secondary/30"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-content dark:text-content-dark-default">{label}</p>
                  <p className="text-xs text-content-muted dark:text-content-dark-muted">{hint}</p>
                </div>
                <Badge variant={configured ? 'success' : 'neutral'} size="sm">
                  {configured
                    ? hasStoredKey
                      ? `Configured ••••${status?.last4}`
                      : 'Configured (server .env)'
                    : 'Not configured'}
                </Badge>
              </div>

              <div className="space-y-2">
                <label htmlFor={`llm-key-${id}`} className={labelClassName}>
                  {hasStoredKey ? 'Replace API key' : 'API key'}
                </label>
                <input
                  id={`llm-key-${id}`}
                  type="password"
                  autoComplete="off"
                  value={draftKeys[id]}
                  onChange={(e) =>
                    setDraftKeys((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                  placeholder="Paste key — cleared after save"
                  className={inputClassName}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!draftKeys[id].trim() || savingProvider === id}
                    onClick={() => void handleSaveKey(id)}
                  >
                    {savingProvider === id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save key'
                    )}
                  </Button>
                  {hasStoredKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removingProvider === id}
                      onClick={() => void handleRemoveKey(id)}
                    >
                      {removingProvider === id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Remove stored key
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
