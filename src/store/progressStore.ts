import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProgress, LineProgress } from '@/types/progress'
import {
  createDefaultLineProgress,
  decayConfidence,
} from '@/services/ProgressCalculator'
import { calculateSM2, practiceToQuality } from '@/services/SpacedRepetition'
import { buildDrillQueue } from '@/services/DrillQueueBuilder'

const STORAGE_KEY = 'chessopener-progress'

interface ProgressState {
  progress: UserProgress | null

  loadProgress: (courseId: string) => void
  recordAttempt: (lineId: string, success: boolean, moveErrors: number[], hintsUsed?: number) => void
  getConfidence: (lineId: string) => number
  getNextReviewDate: (lineId: string) => string
  getDueLines: (lineIds: string[]) => string[]
  getWeakestLines: (lineIds: string[], count?: number) => string[]
  resetLineProgress: (lineId: string) => void
  exportProgress: () => string
}

function daysSince(isoDate: string): number {
  const d = new Date(isoDate)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: null,

      loadProgress: (courseId: string) => {
        set((s) => {
          const existing = s.progress
          if (existing?.courseId === courseId) return {}
          return {
            progress: {
              courseId,
              lines: {},
              lastSessionDate: new Date().toISOString().slice(0, 10),
            },
          }
        })
      },

      recordAttempt: (
        lineId: string,
        success: boolean,
        moveErrors: number[],
        hintsUsed: number = 0
      ) => {
        set((s) => {
          const prog = s.progress
          if (!prog) return {}
          const lp = prog.lines[lineId] ?? createDefaultLineProgress(lineId)
          const quality = practiceToQuality(moveErrors.length, hintsUsed)
          const sm2 = calculateSM2({
            quality,
            previousEase: lp.easeFactor,
            previousInterval: lp.interval,
            repetitionNumber: lp.totalAttempts + 1,
          })

          // Practice scoring: base 100, -15 per error, -10 per hint
          const base = 100
          const penalty = moveErrors.length * 15 + hintsUsed * 10
          const confidenceDelta = Math.max(0, base - penalty)
          const newConfidence = Math.round(
            lp.confidence * 0.7 + confidenceDelta * 0.3
          )

          const moveErrorsRecord = { ...lp.moveErrors }
          for (const ply of moveErrors) {
            moveErrorsRecord[ply] = (moveErrorsRecord[ply] ?? 0) + 1
          }

          const newStreak = success ? lp.currentStreak + 1 : 0
          const newLp: LineProgress = {
            ...lp,
            confidence: Math.min(100, Math.max(0, newConfidence)),
            lastPracticed: new Date().toISOString(),
            nextReviewDate: sm2.nextReviewDate,
            totalAttempts: lp.totalAttempts + 1,
            successfulAttempts: lp.successfulAttempts + (success ? 1 : 0),
            currentStreak: newStreak,
            bestStreak: Math.max(lp.bestStreak, newStreak),
            easeFactor: sm2.ease,
            interval: sm2.interval,
            moveErrors: moveErrorsRecord,
          }

          return {
            progress: {
              ...prog,
              lines: { ...prog.lines, [lineId]: newLp },
              lastSessionDate: new Date().toISOString().slice(0, 10),
            },
          }
        })
      },

      getConfidence: (lineId: string) => {
        const prog = get().progress
        if (!prog?.lines[lineId]) return 0
        const lp = prog.lines[lineId]
        return decayConfidence(lp.confidence, daysSince(lp.lastPracticed))
      },

      getNextReviewDate: (lineId: string) => {
        const prog = get().progress
        return prog?.lines[lineId]?.nextReviewDate ?? ''
      },

      getDueLines: (lineIds: string[]) => {
        const prog = get().progress
        if (!prog) return []
        const today = new Date().toISOString().slice(0, 10)
        return lineIds.filter((id) => {
          const next = prog.lines[id]?.nextReviewDate?.slice(0, 10)
          return next && next <= today
        })
      },

      getWeakestLines: (lineIds: string[], count: number = 10) => {
        const prog = get().progress
        if (!prog) return lineIds.slice(0, count)
        return buildDrillQueue(prog, lineIds, count)
      },

      resetLineProgress: (lineId: string) => {
        set((s) => {
          const prog = s.progress
          if (!prog) return {}
          const { [lineId]: _, ...rest } = prog.lines
          return {
            progress: {
              ...prog,
              lines: rest,
            },
          }
        })
      },

      exportProgress: () => {
        return JSON.stringify(get().progress, null, 2)
      },
    }),
    { name: STORAGE_KEY, partialize: (s) => ({ progress: s.progress }) }
  )
)
