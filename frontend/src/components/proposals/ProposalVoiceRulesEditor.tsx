import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Save, Upload } from 'lucide-react'
import {
  getProposalRules,
  isRejectedRulesImageFile,
  PROPOSAL_RULES_ACCEPT,
  saveProposalRules,
  uploadProposalRulesFile,
} from '../../api/settings'
import { PageError } from '../PageStates'
import { Button, Card } from '../ui'
import { labelClassName, textareaClassName } from '../../utils/form'

interface ProposalVoiceRulesEditorProps {
  /** When true, content is always visible (Settings page). When false, collapsible header. */
  alwaysOpen?: boolean
  title?: string
}

export function ProposalVoiceRulesEditor({
  alwaysOpen = false,
  title = 'Proposal voice rules',
}: ProposalVoiceRulesEditorProps) {
  const [open, setOpen] = useState(alwaysOpen)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProposalRules()
      setText(data.text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposal rules.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const data = await saveProposalRules(text)
      setText(data.text)
      setSuccess('Rules saved — used as the base for every proposal generation.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rules.')
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = async (file: File | null) => {
    if (!file) return
    setError(null)
    setSuccess(null)

    if (isRejectedRulesImageFile(file)) {
      setError(
        'Image files cannot be used for proposal rules. Upload .md, .txt, .skills, or .pdf instead.',
      )
      return
    }

    setUploading(true)
    try {
      const data = await uploadProposalRulesFile(file)
      setText(data.text)
      setSuccess('File uploaded — review the extracted rules below, then Save if you edit them.')
      if (!alwaysOpen) setOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload rules file.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const body = (
    <div className="space-y-4">
      <p className="text-sm text-content-secondary dark:text-content-dark-secondary">
        These are the base voice rules for every proposal. Per-job custom instructions in Proposal
        Studio layer on top — they do not replace these rules.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-content-muted dark:text-content-dark-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rules…
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="proposal-voice-rules" className={labelClassName}>
              Rules text
            </label>
            <textarea
              id="proposal-voice-rules"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={textareaClassName}
              placeholder="One rule per line, or paste markdown…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary-gradient" size="sm" onClick={() => void handleSave()} disabled={saving || uploading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save rules'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload file'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={PROPOSAL_RULES_ACCEPT}
              className="hidden"
              onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs text-content-muted dark:text-content-dark-muted">
            Supported uploads: .md, .txt, .skills, .pdf (text extracted). Images are not accepted.
          </p>
        </>
      )}

      {error && <PageError message={error} onRetry={() => setError(null)} />}
      {success && (
        <p className="text-sm text-semantic-success dark:text-semantic-success-light">{success}</p>
      )}
    </div>
  )

  if (alwaysOpen) {
    return (
      <Card variant="default" padding="md" className="space-y-4">
        <h2 className="text-base font-semibold text-content dark:text-content-dark-default">{title}</h2>
        {body}
      </Card>
    )
  }

  return (
    <Card variant="glass" padding="md">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <h2 className="text-base font-semibold text-content dark:text-content-dark-default">{title}</h2>
        <span className="text-xs text-content-muted dark:text-content-dark-muted">
          {open ? 'Hide' : 'Show & edit'}
        </span>
      </button>
      {open && <div className="mt-4">{body}</div>}
    </Card>
  )
}
