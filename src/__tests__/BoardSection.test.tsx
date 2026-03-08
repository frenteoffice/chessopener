import { describe, it, expect } from 'vitest'
import { getDeviationMoveStyles } from '@/components/BoardSection'

// ---------------------------------------------------------------------------
// Section 6 — CO-1: getDeviationMoveStyles (board highlighting for deviation move)
// ---------------------------------------------------------------------------

describe('getDeviationMoveStyles', () => {
  const historyWithNf6 = [
    { san: 'e4', fen: '...', color: 'w' as const, from: 'e2', to: 'e4' },
    { san: 'e5', fen: '...', color: 'b' as const, from: 'e7', to: 'e5' },
    { san: 'Nf3', fen: '...', color: 'w' as const, from: 'g1', to: 'f3' },
    { san: 'Nf6', fen: '...', color: 'b' as const, from: 'g8', to: 'f6' },
  ]

  it('CO1-1: returns empty object when deviationDetected is false', () => {
    const result = getDeviationMoveStyles(historyWithNf6, false, 'Nf6')
    expect(result).toEqual({})
  })

  it('CO1-2: returns empty object when deviationMove is null', () => {
    const result = getDeviationMoveStyles(historyWithNf6, true, null)
    expect(result).toEqual({})
  })

  it('CO1-3: returns empty object when no history entry matches deviationMove', () => {
    const result = getDeviationMoveStyles(historyWithNf6, true, 'Bg4')
    expect(result).toEqual({})
  })

  it('CO1-4: returns styles for the correct squares when a matching entry exists', () => {
    const result = getDeviationMoveStyles(historyWithNf6, true, 'Nf6')
    expect(result).toEqual({
      g8: { backgroundColor: 'rgba(168, 85, 247, 0.4)' },
      f6: { backgroundColor: 'rgba(168, 85, 247, 0.55)' },
    })
  })
})
