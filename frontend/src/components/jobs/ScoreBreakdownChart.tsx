import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import type { ScoreBreakdown } from '../../types'
import { SCORE_DIMENSIONS } from '../../constants/pipeline'
import { Card } from '../ui'

interface ScoreBreakdownChartProps {
  breakdown: ScoreBreakdown
}

export function ScoreBreakdownChart({ breakdown }: ScoreBreakdownChartProps) {
  const data = SCORE_DIMENSIONS.map(({ key, label }) => ({
    dimension: label,
    value: breakdown[key],
    fullMark: 100,
  }))

  return (
    <Card variant="default" padding="md">
      <h2 className="mb-4 text-base font-semibold text-content dark:text-content-dark-default">
        Score breakdown
      </h2>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="currentColor" className="text-border dark:text-border-dark" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              className="text-content-secondary dark:text-content-dark-secondary"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'currentColor', fontSize: 10 }}
              className="text-content-muted dark:text-content-dark-muted"
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 space-y-2">
        {SCORE_DIMENSIONS.map(({ key, label }) => {
          const value = breakdown[key]
          return (
            <li key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-content-secondary dark:text-content-dark-secondary">
                  {label}
                </span>
                <span className="font-medium tabular-nums text-content dark:text-content-dark-default">
                  {value}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
                <div
                  className="h-full rounded-full bg-gradient-brand transition-all"
                  style={{ width: `${value}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
