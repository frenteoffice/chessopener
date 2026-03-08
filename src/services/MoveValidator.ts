import { Chess } from 'chess.js'
import type { LineMove } from '@/types/course'

export interface MoveValidationResult {
  correct: boolean
  expectedSan: string
  playedSan: string
  explanation: string
  alternatives?: Array<{ san: string; evaluation: string; explanation: string }>
}

/**
 * Validate a user's move against the expected LineMove.
 * Returns validation result with expected move and explanation.
 */
export function validateMove(
  from: string,
  to: string,
  promotion: string | undefined,
  expectedMove: LineMove,
  fen: string
): MoveValidationResult {
  const chess = new Chess(fen)
  const played = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined })

  if (!played) {
    return {
      correct: false,
      expectedSan: expectedMove.san,
      playedSan: '(illegal)',
      explanation: expectedMove.explanation,
      alternatives: expectedMove.alternatives,
    }
  }

  const correct = played.san === expectedMove.san
  return {
    correct,
    expectedSan: expectedMove.san,
    playedSan: played.san,
    explanation: expectedMove.explanation,
    alternatives: correct ? undefined : expectedMove.alternatives,
  }
}
