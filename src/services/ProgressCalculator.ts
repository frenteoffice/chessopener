import type { UserProgress, LineProgress } from '@/types/progress'

const DECAY_RATE = 0.03 // 3% per day

/**
 * Decay confidence for lines not practiced.
 */
export function decayConfidence(confidence: number, daysSinceLastPractice: number): number {
  const decayed = confidence * Math.pow(1 - DECAY_RATE, daysSinceLastPractice)
  return Math.max(0, Math.round(decayed))
}

/**
 * Get effective confidence for a line (with decay applied).
 */
export function getEffectiveConfidence(progress: UserProgress | null, lineId: string): number {
  if (!progress?.lines[lineId]) return 0
  const lp = progress.lines[lineId]
  return decayConfidence(lp.confidence, daysSince(lp.lastPracticed))
}

function daysSince(isoDate: string): number {
  const d = new Date(isoDate)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Create default LineProgress for a new line.
 */
export function createDefaultLineProgress(lineId: string): LineProgress {
  const now = new Date().toISOString()
  return {
    lineId,
    confidence: 0,
    lastPracticed: now,
    nextReviewDate: now,
    totalAttempts: 0,
    successfulAttempts: 0,
    currentStreak: 0,
    bestStreak: 0,
    easeFactor: 2.5,
    interval: 0,
    moveErrors: {},
  }
}

/**
 * Aggregate stats: lines mastered (≥80% confidence), average confidence.
 */
export function getOverallStats(progress: UserProgress | null, _totalLines: number): {
  mastered: number
  averageConfidence: number
  totalPracticeTime: number
} {
  if (!progress) {
    return { mastered: 0, averageConfidence: 0, totalPracticeTime: 0 }
  }
  const entries = Object.values(progress.lines)
  const mastered = entries.filter((lp) => decayConfidence(lp.confidence, daysSince(lp.lastPracticed)) >= 80).length
  const totalConf = entries.reduce(
    (sum, lp) => sum + decayConfidence(lp.confidence, daysSince(lp.lastPracticed)),
    0
  )
  const averageConfidence = entries.length > 0 ? Math.round(totalConf / entries.length) : 0
  return {
    mastered,
    averageConfidence,
    totalPracticeTime: 0, // Could track if we add session duration
  }
}
