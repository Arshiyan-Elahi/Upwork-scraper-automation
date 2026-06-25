import type { Job, ProposalVariant, Verdict } from '../types'

const VARIANT_LABELS: Record<ProposalVariant, string> = {
  short: 'Short',
  premium: 'Premium',
  direct: 'Direct',
}

export function buildDefaultProposalText(job: Job, variant: ProposalVariant): string {
  const portfolioNote =
    job.portfolioMatchIds.length > 0
      ? ' I have relevant portfolio work that maps closely to this brief.'
      : ''

  switch (variant) {
    case 'short':
      return `Hi — ${job.suggestedAngle}${portfolioNote} I can deliver within your timeline. ${job.discoveryQuestion}`
    case 'premium':
      return `${job.title} — this is exactly the kind of project I focus on.\n\n${job.suggestedAngle}\n\nWhat I would deliver:\n• Initial concepts aligned to your brief\n• Two focused revision rounds\n• Final files ready for production\n\n${portfolioNote.trim()}\n\n${job.discoveryQuestion}`
    case 'direct':
      return `I can start this week on "${job.title}". ${job.suggestedAngle}${portfolioNote} ${job.discoveryQuestion}`
  }
}

export function getVariantLabel(variant: ProposalVariant): string {
  return VARIANT_LABELS[variant]
}

export function mockRegenerateText(original: string, variant: ProposalVariant): string {
  const suffixes: Record<ProposalVariant, string> = {
    short: '\n\nHappy to jump on a quick call if helpful.',
    premium: '\n\nI prioritize clear communication and on-time delivery throughout.',
    direct: '\n\nLet me know if you want to see a relevant case study first.',
  }
  const trimmed = original.replace(/\n\nHappy to jump.*|\n\nI prioritize.*|\n\nLet me know.*$/s, '')
  return `${trimmed}${suffixes[variant]}`
}

export function buildVerdictExplanation(job: Job): { title: string; body: string } {
  if (job.verdict === null) {
    return { title: 'Not scored', body: 'This job has not been scored yet.' }
  }

  const titles: Record<Verdict, string> = {
    apply: 'Why Apply',
    maybe: 'Why Maybe',
    skip: 'Why Skip',
  }

  let body = job.suggestedAngle

  if (job.verdict === 'apply') {
    body += ` Match score of ${job.matchScore} with strong alignment across niche and portfolio dimensions.`
  } else if (job.verdict === 'maybe') {
    body += ` Score of ${job.matchScore} — worth reviewing but not a clear yes. Consider time investment vs. upside.`
    if (job.redFlags.length > 0) {
      body += ` Caution: ${job.redFlags[0]}`
    }
  } else {
    body =
      job.redFlags.length > 0
        ? job.redFlags.join('. ') + '.'
        : `Low match score (${job.matchScore}) and poor fit with your profile focus.`
    body += ` ${job.suggestedAngle}`
  }

  return { title: titles[job.verdict], body }
}
