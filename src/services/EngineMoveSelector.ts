import type { OpponentIntelligenceMode } from '@/types'
import type { OpeningNode } from '@/types'
import type { DefenseNode } from '@/types'
import type { OpeningTree } from '@/services/OpeningTree'
import type { StockfishBridge } from '@/services/StockfishBridge'
import { HYBRID_DEVIATION_PROBABILITY } from '@/store/gameStore'

export interface EngineMoveContext {
  mode: OpponentIntelligenceMode
  openingNode: OpeningNode | null
  defenseNode: DefenseNode | null
  fen: string
  tree: OpeningTree | null
  stockfish: StockfishBridge
  engineElo: number
}

export interface EngineMoveResult {
  san: string | null
  uciMove: string | null
  source: 'tree' | 'defense' | 'stockfish' | 'fallback'
  isDeviation: boolean
}

/** Converts DefenseNode to OpeningNode shape for sampleResponse (children -> engineResponses) */
function defenseNodeToSamplable(node: DefenseNode): OpeningNode {
  const children = (node.children ?? []) as OpeningNode[]
  const engineResponses = children.map((c) => c.san)
  const responseWeights = engineResponses.map(() => 1 / Math.max(1, engineResponses.length))
  return {
    san: node.san,
    fen: node.fen,
    commentary: node.commentary,
    engineResponses,
    responseWeights,
    children,
  }
}

export async function getEngineMove(ctx: EngineMoveContext): Promise<EngineMoveResult> {
  const { mode, openingNode, defenseNode, fen, tree, stockfish } = ctx

  // NEVER DEVIATE
  if (mode === 'never-deviate') {
    if (tree && openingNode) {
      const san = tree.sampleResponse(openingNode)
      return { san, uciMove: null, source: 'tree', isDeviation: false }
    }
    // Leaf node or off-tree — fallback to full-strength Stockfish
    await stockfish.disableEloLimit()
    const uciMove = await stockfish.getMove(fen, 15)
    await stockfish.setElo(ctx.engineElo)
    return { uciMove, san: null, source: 'fallback', isDeviation: false }
  }

  // HYBRID
  if (mode === 'hybrid') {
    if (tree && openingNode) {
      const roll = Math.random()
      if (roll >= HYBRID_DEVIATION_PROBABILITY) {
        const san = tree.sampleResponse(openingNode)
        return { san, uciMove: null, source: 'tree', isDeviation: false }
      }
      const uciMove = await stockfish.getMove(fen, 12)
      return { uciMove, san: null, source: 'stockfish', isDeviation: true }
    }
    const uciMove = await stockfish.getMove(fen, 12)
    return { uciMove, san: null, source: 'stockfish', isDeviation: false }
  }

  // SPECIFIC DEFENSE
  if (mode === 'specific-defense') {
    if (tree && defenseNode) {
      const samplable = defenseNodeToSamplable(defenseNode)
      const san = tree.sampleResponse(samplable)
      return { san, uciMove: null, source: 'defense', isDeviation: false }
    }
    const uciMove = await stockfish.getMove(fen, 12)
    return { uciMove, san: null, source: 'stockfish', isDeviation: false }
  }

  // Fallback (should not reach)
  const uciMove = await stockfish.getMove(fen, 12)
  return { uciMove, san: null, source: 'stockfish', isDeviation: false }
}
