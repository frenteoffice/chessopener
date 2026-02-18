import { create } from 'zustand'
import { Chess } from 'chess.js'
import type { Phase, PlayerColor, Metrics } from '@/types'
import { computeAllMetrics } from '@/services/MetricsEngine'

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function getInitialMetrics(): Metrics {
  const chess = new Chess(INITIAL_FEN)
  const raw = computeAllMetrics(chess)
  return {
    ...raw,
    delta: { pieceActivity: 0, centerControl: 0, kingSafety: 0, pawnStructureChanged: false },
  }
}

type View = 'selector' | 'game'

interface GameStore {
  view: View
  phase: Phase
  fen: string
  history: { san: string; fen: string; color: 'w' | 'b'; inTheory?: boolean }[]
  openingId: string | null
  openingNode: unknown | null
  metrics: Metrics
  commentary: string
  commentaryLoading: boolean
  engineThinking: boolean
  playerColor: PlayerColor
  engineElo: number
  chess: Chess
  setFen: (fen: string) => void
  setPhase: (phase: Phase) => void
  setHistory: (history: GameStore['history']) => void
  addMove: (san: string, fen: string, color: 'w' | 'b', inTheory?: boolean) => void
  setOpeningId: (id: string | null) => void
  setOpeningNode: (node: unknown | null) => void
  setMetrics: (metrics: Metrics) => void
  setCommentary: (commentary: string) => void
  setCommentaryLoading: (loading: boolean) => void
  setEngineThinking: (thinking: boolean) => void
  setPlayerColor: (color: PlayerColor) => void
  setEngineElo: (elo: number) => void
  setView: (view: View) => void
  resetGame: (playerColor?: PlayerColor, openingId?: string | null) => void
  updateMetrics: (metricsUpdater: (prev: Metrics) => Metrics) => void
  applyMove: (move: { from: string; to: string; promotion?: string }, inTheory?: boolean) => boolean
}

export const useGameStore = create<GameStore>((set) => ({
  view: 'selector',
  phase: 'opening',
  fen: INITIAL_FEN,
  history: [],
  openingId: null,
  openingNode: null,
  metrics: getInitialMetrics(),
  commentary: '',
  commentaryLoading: false,
  engineThinking: false,
  playerColor: 'white',
  engineElo: 1200,
  chess: new Chess(),

  setFen: (fen) => set({ fen }),
  setPhase: (phase) => set({ phase }),
  setHistory: (history) => set({ history }),
  addMove: (san, fen, color, inTheory) =>
    set((state) => ({
      history: [...state.history, { san, fen, color, inTheory }],
    })),
  setOpeningId: (openingId) => set({ openingId }),
  setOpeningNode: (openingNode) => set({ openingNode }),
  setMetrics: (metrics) => set({ metrics }),
  setCommentary: (commentary) => set({ commentary }),
  setCommentaryLoading: (commentaryLoading) => set({ commentaryLoading }),
  setEngineThinking: (engineThinking) => set({ engineThinking }),
  setPlayerColor: (playerColor) => set({ playerColor }),
  setEngineElo: (engineElo) => set({ engineElo }),
  setView: (view) => set({ view }),

  resetGame: (playerColor = 'white', openingId = null) => {
    const chess = new Chess()
    set({
      view: 'game',
      phase: 'opening',
      fen: chess.fen(),
      history: [],
      openingId,
      openingNode: null,
      metrics: getInitialMetrics(),
      commentary: '',
      commentaryLoading: false,
      engineThinking: false,
      playerColor,
      chess,
    })
  },

  updateMetrics: (metricsUpdater) =>
    set((state) => ({ metrics: metricsUpdater(state.metrics) })),

  applyMove: (move: { from: string; to: string; promotion?: string }, inTheory = true) => {
    const { fen, metrics: prevMetrics } = useGameStore.getState()
    const chess = new Chess(fen)
    const result = chess.move(move)
    if (result) {
      const color = result.color === 'w' ? 'w' : 'b'
      const newMetricsRaw = computeAllMetrics(chess)
      const playerColor = useGameStore.getState().playerColor
      const delta = {
        pieceActivity:
          (playerColor === 'white' ? newMetricsRaw.pieceActivity.white : newMetricsRaw.pieceActivity.black) -
          (playerColor === 'white' ? prevMetrics.pieceActivity.white : prevMetrics.pieceActivity.black),
        centerControl:
          (playerColor === 'white' ? newMetricsRaw.centerControl.white : newMetricsRaw.centerControl.black) -
          (playerColor === 'white' ? prevMetrics.centerControl.white : prevMetrics.centerControl.black),
        kingSafety:
          (playerColor === 'white' ? newMetricsRaw.kingSafety.white : newMetricsRaw.kingSafety.black) -
          (playerColor === 'white' ? prevMetrics.kingSafety.white : prevMetrics.kingSafety.black),
        pawnStructureChanged:
          (playerColor === 'white'
            ? newMetricsRaw.pawnStructure.white !== prevMetrics.pawnStructure.white
            : newMetricsRaw.pawnStructure.black !== prevMetrics.pawnStructure.black),
      }
      const metrics: Metrics = {
        ...newMetricsRaw,
        delta,
      }
      set((state) => ({
        fen: chess.fen(),
        history: [...state.history, { san: result.san, fen: chess.fen(), color, inTheory }],
        chess,
        metrics,
      }))
      return true
    }
    return false
  },
}))
