import type { Move } from 'chess.js'

export type Phase = 'opening' | 'free'
export type PlayerColor = 'white' | 'black'

export interface MetricsDelta {
  pieceActivity: number
  centerControl: number
  kingSafety: number
  pawnStructureChanged: boolean
}

export interface Metrics {
  pieceActivity: { white: number; black: number }
  centerControl: { white: number; black: number }
  pawnStructure: { white: string; black: string }
  kingSafety: { white: number; black: number }
  delta: MetricsDelta
}

export interface GameState {
  phase: Phase
  fen: string
  history: Move[]
  openingId: string | null
  openingNode: OpeningNode | null
  metrics: Metrics
  commentary: string
  engineThinking: boolean
  playerColor: PlayerColor
  engineElo: number
}

export interface OpeningNode {
  san: string
  fen: string
  commentary?: string
  engineResponses: string[]
  responseWeights: number[]
  children?: OpeningNode[]
}
