import { useState } from 'react'
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Tag,
} from 'lucide-react'
import type { PipelineStage, ProposalVariant } from '../../types'
import type { ProposalOutcome } from '../../constants/pipeline'
import { PROPOSAL_OUTCOMES, STAGE_LABELS } from '../../constants/pipeline'
import { getVariantLabel, mockRegenerateText } from '../../utils/proposals'
import { Badge, Button, Card } from '../ui'

export interface VariantEditorState {
  variant: ProposalVariant
  text: string
  submitted: boolean
  outcome: PipelineStage | null
  saved: boolean
}

interface ProposalVariantEditorProps {
  state: VariantEditorState
  cannedText: string
  onChange: (text: string) => void
  onSubmitted: () => void
  onOutcome: (outcome: ProposalOutcome) => void
  onSaved: () => void
  onRegenerated: (text: string) => void
}

export function ProposalVariantEditor({
  state,
  cannedText,
  onChange,
  onSubmitted,
  onOutcome,
  onSaved,
  onRegenerated,
}: ProposalVariantEditorProps) {
  const [regenerating, setRegenerating] = useState(false)
  const [showOutcomePicker, setShowOutcomePicker] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(state.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = () => {
    setRegenerating(true)
    window.setTimeout(() => {
      onRegenerated(mockRegenerateText(cannedText, state.variant))
      setRegenerating(false)
    }, 900)
  }

  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-content dark:text-content-dark-default">
          {getVariantLabel(state.variant)}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {state.submitted && (
            <Badge variant="success" size="sm">
              Submitted
            </Badge>
          )}
          {state.outcome && (
            <Badge variant="info" size="sm">
              {STAGE_LABELS[state.outcome]}
            </Badge>
          )}
          {state.saved && (
            <Badge variant="neutral" size="sm">
              Draft saved
            </Badge>
          )}
        </div>
      </div>

      <div className="relative">
        {regenerating && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface/80 backdrop-blur-sm dark:bg-surface-dark-secondary/80">
            <Loader2 className="h-6 w-6 animate-spin text-brand dark:text-brand-light" />
          </div>
        )}
        <textarea
          value={state.text}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          disabled={regenerating}
          className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-border-dark dark:bg-surface-dark-tertiary dark:text-content-dark-default dark:placeholder:text-content-dark-muted dark:focus:border-brand-light"
          aria-label={`${getVariantLabel(state.variant)} proposal`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy Proposal'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onSaved}>
          <Save className="h-3.5 w-3.5" />
          Save Draft
        </Button>
        <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={regenerating}>
          <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
        <Button variant="primary-gradient" size="sm" onClick={onSubmitted}>
          <Send className="h-3.5 w-3.5" />
          Mark as Manually Submitted
        </Button>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setShowOutcomePicker((p) => !p)}>
            <Tag className="h-3.5 w-3.5" />
            Add Outcome
          </Button>
          {showOutcomePicker && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-border bg-surface py-1 shadow-elevated dark:border-border-dark dark:bg-surface-dark-secondary">
              {PROPOSAL_OUTCOMES.map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm text-content hover:bg-surface-tertiary dark:text-content-dark-default dark:hover:bg-surface-dark-tertiary"
                  onClick={() => {
                    onOutcome(outcome)
                    setShowOutcomePicker(false)
                  }}
                >
                  {STAGE_LABELS[outcome]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
