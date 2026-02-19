import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import {
  pieceActivity,
  centerControl,
  pawnStructure,
  kingSafety,
} from '@/services/MetricsEngine'

describe('pieceActivity', () => {
  it('returns 20 for white at start position', () => {
    const chess = new Chess()
    expect(pieceActivity(chess, 'white')).toBe(20)
  })

  it('returns 20 for black at start position', () => {
    const chess = new Chess()
    expect(pieceActivity(chess, 'black')).toBe(20)
  })

  it('increases after e4 for white', () => {
    const chess = new Chess()
    chess.move('e4')
    const activity = pieceActivity(chess, 'white')
    expect(activity).toBeGreaterThan(20)
  })
})

describe('centerControl', () => {
  it('returns non-zero scores at start position', () => {
    const chess = new Chess()
    const { white, black } = centerControl(chess)
    expect(white).toBeGreaterThan(0)
    expect(black).toBeGreaterThan(0)
  })

  it('white gains center control after e4', () => {
    const before = new Chess()
    const beforeScore = centerControl(before).white

    const after = new Chess()
    after.move('e4')
    const afterScore = centerControl(after).white

    expect(afterScore).toBeGreaterThanOrEqual(beforeScore)
  })
})

describe('pawnStructure', () => {
  it('returns "solid pawn chain" at start position (many files)', () => {
    const chess = new Chess()
    expect(pawnStructure(chess, 'white')).toBe('solid pawn chain')
    expect(pawnStructure(chess, 'black')).toBe('solid pawn chain')
  })

  it('detects doubled pawns', () => {
    const chess = new Chess('4k3/8/8/8/4P3/4P3/3P4/4K3 w - - 0 1')
    expect(pawnStructure(chess, 'white')).toBe('doubled pawns')
  })

  it('detects isolated pawn', () => {
    const chess = new Chess('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1')
    expect(pawnStructure(chess, 'white')).toBe('isolated pawn')
  })

  it('detects doubled + isolated pawn (not just doubled)', () => {
    const chess = new Chess('4k3/8/8/8/4P3/4P3/8/4K3 w - - 0 1')
    expect(pawnStructure(chess, 'white')).toBe('doubled + isolated')
  })
})

describe('kingSafety', () => {
  it('returns a value <= 10 at start position', () => {
    const chess = new Chess()
    expect(kingSafety(chess, 'white')).toBeLessThanOrEqual(10)
    expect(kingSafety(chess, 'white')).toBeGreaterThanOrEqual(0)
  })

  it('maintains or improves after kingside castling', () => {
    const chess = new Chess(
      'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7'
    )
    const beforeCastle = kingSafety(chess, 'white')
    chess.move('O-O')
    const afterCastle = kingSafety(chess, 'white')
    expect(afterCastle).toBeGreaterThanOrEqual(beforeCastle)
  })
})
