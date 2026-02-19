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

export type OpponentIntelligenceMode = 'never-deviate' | 'hybrid' | 'specific-defense'

export type StructureLabel =
  | 'open-center'
  | 'closed-center'
  | 'isolated-queens-pawn'
  | 'hanging-pawns'
  | 'caro-kann-structure'
  | 'slav-structure'
  | 'french-structure'
  | 'kings-indian-structure'
  | 'london-structure'
  | 'sicilian-structure'
  | 'unknown'

export interface DefenseNode {
  san: string
  fen: string
  commentary: string
  playerResponseHint?: string
  engineResponses?: string[]
  responseWeights?: number[]
  children?: DefenseNode[]
}

export interface Defense {
  id: string
  name: string
  moves: string
  profile: string
  tree: DefenseNode[]
}

export interface OpeningData {
  id: string
  name: string
  eco: string
  color: 'white' | 'black'
  difficulty: string
  description: string
  rootFen?: string
  rootResponses?: string[]
  rootWeights?: number[]
  moves: OpeningNode[]
  defenses?: Defense[]
}

export interface DeviationEvent {
  move: string
  fen: string
  structureLabel: StructureLabel
  transpositionOpening: OpeningData | null
}
