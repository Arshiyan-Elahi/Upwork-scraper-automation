import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { SafetyPanel } from '../components/SafetyPanel'
import { ProposalVoiceRulesEditor } from '../components/proposals'
import { LlmSettingsPanel } from '../components/settings/LlmSettingsPanel'
import { Button, Card } from '../components/ui'
import { useTheme, type Theme } from '../theme/ThemeProvider'
import type { ProposalVariant } from '../types'
import { labelClassName, selectClassName } from '../utils/form'

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [defaultVariant, setDefaultVariant] = useState<ProposalVariant>('premium')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
          Settings
        </h1>
        <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
          Workspace preferences, proposal voice rules, and encrypted LLM credentials.
        </p>
      </div>

      <SafetyPanel dismissible={false} />

      <LlmSettingsPanel />

      <ProposalVoiceRulesEditor alwaysOpen title="Proposal voice rules" />

      <Card variant="default" padding="md" className="space-y-4">
        <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
          Appearance
        </h2>
        <div className="flex flex-wrap gap-2">
          {(['light', 'dark'] as Theme[]).map((t) => (
            <Button
              key={t}
              variant={theme === t ? 'primary-gradient' : 'secondary'}
              size="sm"
              onClick={() => setTheme(t)}
            >
              {t === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      <Card variant="default" padding="md" className="space-y-4">
        <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
          Proposal defaults
        </h2>
        <div>
          <label htmlFor="default-variant" className={labelClassName}>
            Default proposal variant
          </label>
          <select
            id="default-variant"
            value={defaultVariant}
            onChange={(e) => setDefaultVariant(e.target.value as ProposalVariant)}
            className={selectClassName}
          >
            <option value="short">Short</option>
            <option value="premium">Premium</option>
            <option value="direct">Direct</option>
          </select>
        </div>
      </Card>

      <Button variant="primary-gradient" onClick={handleSave}>
        {saved ? 'Saved!' : 'Save preferences'}
      </Button>
    </div>
  )
}
