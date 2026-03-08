import { addDays } from 'date-fns'

export interface SM2Input {
  quality: number // 0–5 (mapped from practice performance)
  previousEase: number // ≥1.3
  previousInterval: number // days
  repetitionNumber: number
}

export interface SM2Output {
  ease: number
  interval: number // days
  nextReviewDate: string // ISO date
}

/**
 * SM-2 algorithm for spaced repetition.
 * Quality mapping from practice:
 * 0 errors, 0 hints → quality 5
 * 1 error → quality 4
 * 2 errors → quality 3
 * 3 errors → quality 2
 * 4+ errors → quality 1
 * Complete failure / gave up → quality 0
 */
export function calculateSM2(input: SM2Input): SM2Output {
  let ease =
    input.previousEase + (0.1 - (5 - input.quality) * (0.08 + (5 - input.quality) * 0.02))
  ease = Math.max(1.3, ease)

  let interval: number
  if (input.quality < 3) {
    interval = 1
  } else if (input.repetitionNumber === 1) {
    interval = 1
  } else if (input.repetitionNumber === 2) {
    interval = 6
  } else {
    interval = Math.round(input.previousInterval * ease)
  }

  const nextReviewDate = addDays(new Date(), interval).toISOString()
  return { ease, interval, nextReviewDate }
}

/**
 * Map practice performance to SM-2 quality (0-5).
 */
export function practiceToQuality(errors: number, hints: number): number {
  if (errors >= 4 || hints >= 3) return 0
  const total = errors + Math.min(hints, 2)
  if (total === 0) return 5
  if (total === 1) return 4
  if (total === 2) return 3
  if (total === 3) return 2
  return 1
}
