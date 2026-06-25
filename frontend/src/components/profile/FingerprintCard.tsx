import { Sparkles } from 'lucide-react'
import type { ExtractedProfile, ProfileFingerprint } from '../../types'
import { Badge, Card } from '../ui'

interface FingerprintCardProps {
  fingerprint: ProfileFingerprint
  extracted?: ExtractedProfile
}

function TagList({ items, variant = 'neutral' }: { items: string[]; variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant={variant} size="sm">
          {item}
        </Badge>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-content-dark-muted">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function FingerprintCard({ fingerprint, extracted }: FingerprintCardProps) {
  return (
    <Card variant="glass" padding="lg" className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-content dark:text-content-dark-default">
            Profile fingerprint
          </h2>
          <p className="text-sm text-content-secondary dark:text-content-dark-secondary">
            AI-generated summary of your freelance positioning
          </p>
        </div>
      </div>

      {extracted?.headline && (
        <Section title="Headline">
          <p className="text-base font-medium text-content dark:text-content-dark-default">
            {extracted.headline}
          </p>
        </Section>
      )}

      {extracted?.summary && (
        <Section title="Summary">
          <p className="text-sm leading-relaxed text-content-secondary dark:text-content-dark-secondary">
            {extracted.summary}
          </p>
        </Section>
      )}

      {extracted && extracted.skills.length > 0 && (
        <Section title="Skills">
          <TagList items={extracted.skills} variant="info" />
        </Section>
      )}

      <Section title="Primary niche">
        <p className="text-base font-medium text-brand dark:text-brand-light">
          {fingerprint.primaryNiche}
        </p>
      </Section>

      <Section title="Secondary niches">
        <TagList items={fingerprint.secondaryNiches} variant="info" />
      </Section>

      <Section title="Strongest services">
        <TagList items={fingerprint.strongestServices} />
      </Section>

      <Section title="Portfolio strengths">
        <ul className="space-y-1.5 text-sm text-content-secondary dark:text-content-dark-secondary">
          {fingerprint.portfolioStrengths.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="text-brand dark:text-brand-light">·</span>
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ideal clients">
        <TagList items={fingerprint.idealClients} variant="success" />
      </Section>

      <Section title="Writing tone">
        <p className="text-sm italic leading-relaxed text-content-secondary dark:text-content-dark-secondary">
          {fingerprint.writingTone}
        </p>
      </Section>

      <Section title="Best-fit job types">
        <TagList items={fingerprint.bestFitJobTypes} variant="success" />
      </Section>

      <Section title="Avoid job types">
        <TagList items={fingerprint.avoidJobTypes} variant="warning" />
      </Section>
    </Card>
  )
}
