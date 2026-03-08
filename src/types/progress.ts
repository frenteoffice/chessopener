// Progress types for spaced repetition and per-line tracking

export interface LineProgress {
  lineId: string
  confidence: number // 0–100
  lastPracticed: string // ISO timestamp
  nextReviewDate: string // ISO timestamp (SM-2 output)
  totalAttempts: number
  successfulAttempts: number
  currentStreak: number
  bestStreak: number
  easeFactor: number // SM-2 ease factor (≥1.3)
  interval: number // days until next review
  moveErrors: Record<number, number> // ply → error count
}

export interface UserProgress {
  courseId: string
  lines: Record<string, LineProgress> // keyed by line ID
  lastSessionDate: string // ISO date
}
