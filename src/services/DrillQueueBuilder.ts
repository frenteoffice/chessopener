import type { UserProgress } from '@/types/progress'
import { decayConfidence } from './ProgressCalculator'

/**
 * Build a drill queue: weakest lines first, then due-for-review.
 */
export function buildDrillQueue(
  progress: UserProgress,
  lineIds: string[],
  count: number = 20
): string[] {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const scored = lineIds.map((lineId) => {
    const lp = progress.lines[lineId]
    const confidence = lp
      ? decayConfidence(lp.confidence, daysSince(lp.lastPracticed))
      : 0
    const nextReview = lp?.nextReviewDate?.slice(0, 10) ?? ''
    const isDue = nextReview && nextReview <= today
    return { lineId, confidence, isDue }
  })

  // Sort: due first, then by lowest confidence
  scored.sort((a, b) => {
    if (a.isDue && !b.isDue) return -1
    if (!a.isDue && b.isDue) return 1
    return a.confidence - b.confidence
  })

  return scored.slice(0, count).map((s) => s.lineId)
}

function daysSince(isoDate: string): number {
  const d = new Date(isoDate)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
}
