import { create } from 'zustand'
import { Chess } from 'chess.js'
import type { Line } from '@/types/course'
import type { Square } from '@/types/course'
import type { CSSProperties } from 'react'
import { validateMove } from '@/services/MoveValidator'
import { useCourseStore } from './courseStore'
import { useProgressStore } from './progressStore'

export type TrainingMode = 'learn' | 'practice' | 'drill' | 'time-trial'

export interface MoveResult {
  correct: boolean
  expectedSan: string
  playedSan: string
  explanation: string
  alternatives?: Array<{ san: string; evaluation: string; explanation: string }>
}

export interface HintData {
  targetSquare: Square
  piece: string
  fromSquare: Square
}

export interface HistoryEntry {
  san: string
  fen: string
  color: 'w' | 'b'
  correct: boolean
  hintUsed: boolean
  from?: string
  to?: string
}

interface TrainerState {
  mode: TrainingMode
  activeLine: Line | null
  currentPly: number
  fen: string
  moveHistory: HistoryEntry[]
  chess: Chess
  playerColor: 'white' | 'black'

  showExplanation: boolean
  highlightSquares: Record<string, CSSProperties>

  hintUsed: boolean
  hintPenalty: number
  lastMoveCorrect: boolean | null

  streak: number
  drillQueue: string[]

  timeRemaining: number
  timerRunning: boolean
  correctInTrial: number
  incorrectInTrial: number

  startLine: (lineId: string, mode: TrainingMode) => void
  attemptMove: (from: Square, to: Square, promotion?: string) => MoveResult | null
  advanceOpponentMove: () => void
  requestHint: () => HintData | null
  retryLine: () => void
  nextLine: () => void
  setMode: (mode: TrainingMode) => void
  tickTimer: () => void
  resetTrainer: () => void
}

function getTrunkFen(course: { trunkMoves: string[] }): string {
  const chess = new Chess()
  for (const san of course.trunkMoves) {
    chess.move(san)
  }
  return chess.fen()
}

export const useTrainerStore = create<TrainerState>((set, get) => ({
  mode: 'learn',
  activeLine: null,
  currentPly: 0,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moveHistory: [],
  chess: new Chess(),
  playerColor: 'white',

  showExplanation: true,
  highlightSquares: {},

  hintUsed: false,
  hintPenalty: 0,
  lastMoveCorrect: null,

  streak: 0,
  drillQueue: [],

  timeRemaining: 60,
  timerRunning: false,
  correctInTrial: 0,
  incorrectInTrial: 0,

  startLine: (lineId: string, mode: TrainingMode) => {
    const line = useCourseStore.getState().getLine(lineId)
    if (!line) return
    const course = useCourseStore.getState().course
    if (!course) return
    useProgressStore.getState().loadProgress(course.id)
    const trunkFen = getTrunkFen(course)
    const chess = new Chess(trunkFen)
    set({
      mode,
      activeLine: line,
      currentPly: 0,
      fen: trunkFen,
      moveHistory: [],
      chess,
      playerColor: course.color,
      showExplanation: mode === 'learn',
      highlightSquares: {},
      hintUsed: false,
      hintPenalty: 0,
      lastMoveCorrect: null,
      streak: 0,
    })
  },

  attemptMove: (from: Square, to: Square, promotion?: string) => {
    const { activeLine, currentPly, fen, chess } = get()
    if (!activeLine || currentPly >= activeLine.moves.length) return null
    const expected = activeLine.moves[currentPly]
    if (!expected.isUserMove) return null

    const result = validateMove(from, to, promotion, expected, fen)
    if (!result.correct) {
      set({ lastMoveCorrect: false })
      return result
    }

    const move = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' })
    if (!move) return result

    const newHistory = [
      ...get().moveHistory,
      {
        san: move.san,
        fen: chess.fen(),
        color: (move.color === 'w' ? 'w' : 'b') as 'w' | 'b',
        correct: true,
        hintUsed: get().hintUsed,
        from: move.from,
        to: move.to,
      },
    ]

    set({
      fen: chess.fen(),
      moveHistory: newHistory,
      chess,
      currentPly: currentPly + 1,
      lastMoveCorrect: true,
      highlightSquares: {},
    })

    return result
  },

  advanceOpponentMove: () => {
    const { activeLine, currentPly, chess } = get()
    if (!activeLine || currentPly >= activeLine.moves.length) return
    const moveData = activeLine.moves[currentPly]
    if (moveData.isUserMove) return

    const move = chess.move(moveData.san)
    if (!move) return

    const newHistory = [
      ...get().moveHistory,
      {
        san: move.san,
        fen: chess.fen(),
        color: (move.color === 'w' ? 'w' : 'b') as 'w' | 'b',
        correct: true,
        hintUsed: false,
        from: move.from,
        to: move.to,
      },
    ]

    set({
      fen: chess.fen(),
      moveHistory: newHistory,
      chess,
      currentPly: currentPly + 1,
    })
  },

  requestHint: () => {
    const { activeLine, currentPly } = get()
    if (!activeLine || currentPly >= activeLine.moves.length) return null
    const moveData = activeLine.moves[currentPly]
    if (!moveData.isUserMove) return null

    const pieceNames: Record<string, string> = {
      K: 'King',
      Q: 'Queen',
      R: 'Rook',
      B: 'Bishop',
      N: 'Knight',
      P: 'Pawn',
    }
    const piece = pieceNames[moveData.san[0]] ?? 'Piece'

    set((s) => ({
      hintUsed: true,
      hintPenalty: s.hintPenalty + 10,
      highlightSquares: {
        [moveData.from]: { backgroundColor: 'rgba(100, 200, 255, 0.5)' },
        [moveData.to]: { backgroundColor: 'rgba(34, 197, 94, 0.6)' },
      },
    }))

    return {
      targetSquare: moveData.to,
      piece,
      fromSquare: moveData.from,
    }
  },

  retryLine: () => {
    const { activeLine } = get()
    if (!activeLine) return
    get().startLine(activeLine.id, get().mode)
  },

  nextLine: () => {
    const { drillQueue } = get()
    if (drillQueue.length > 0) {
      get().startLine(drillQueue[0], 'drill')
      set((s) => ({ drillQueue: s.drillQueue.slice(1) }))
    } else {
      set({ activeLine: null })
    }
  },

  setMode: (mode: TrainingMode) => set({ mode }),

  tickTimer: () => {
    const { timeRemaining } = get()
    if (timeRemaining <= 1) {
      set({ timerRunning: false, timeRemaining: 0 })
    } else {
      set({ timeRemaining: timeRemaining - 1 })
    }
  },

  resetTrainer: () =>
    set({
      activeLine: null,
      currentPly: 0,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moveHistory: [],
      chess: new Chess(),
      showExplanation: true,
      highlightSquares: {},
      hintUsed: false,
      hintPenalty: 0,
      lastMoveCorrect: null,
    }),
}))
