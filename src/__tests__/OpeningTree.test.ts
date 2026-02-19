import { describe, it, expect } from 'vitest'
import { OpeningTree } from '@/services/OpeningTree'
import italianGame from '@/data/openings/italian-game.json'
import type { OpeningData } from '@/services/OpeningTree'

const tree = new OpeningTree(italianGame as OpeningData)

describe('OpeningTree.getNode', () => {
  it('returns node for the root FEN', () => {
    const node = tree.getNode(italianGame.rootFen!)
    expect(node).not.toBeNull()
    expect(node?.engineResponses).toContain('e4')
  })

  it('returns null for an unknown FEN', () => {
    const node = tree.getNode('8/8/8/8/8/8/8/8 w - - 0 1')
    expect(node).toBeNull()
  })

  it('returns a node for a known position in the tree', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const node = tree.getNode(fen)
    expect(node).not.toBeNull()
    expect(node?.san).toBe('e4')
  })
})

describe('OpeningTree.getChild', () => {
  it('returns correct child from root node', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const child = tree.getChild(root!, 'e4')
    expect(child).not.toBeNull()
    expect(child?.san).toBe('e4')
  })

  it('returns null for a move not in the tree', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const child = tree.getChild(root!, 'h4')
    expect(child).toBeNull()
  })
})

describe('OpeningTree.sampleResponse', () => {
  it('always returns a non-empty string from a node with responses', () => {
    const root = tree.getNode(italianGame.rootFen!)
    for (let i = 0; i < 20; i++) {
      const move = tree.sampleResponse(root!)
      expect(move).toBeTruthy()
    }
  })

  it('returns only moves listed in engineResponses', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const validMoves = new Set(root!.engineResponses)
    for (let i = 0; i < 50; i++) {
      const move = tree.sampleResponse(root!)
      expect(validMoves.has(move)).toBe(true)
    }
  })

  it('respects weight distribution roughly', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const counts: Record<string, number> = {}
    const iterations = 1000
    for (let i = 0; i < iterations; i++) {
      const move = tree.sampleResponse(root!)
      counts[move] = (counts[move] ?? 0) + 1
    }
    expect(counts['e4']).toBe(iterations)
  })
})

describe('Phase transition', () => {
  it('getNode returns null when position is off-tree', () => {
    const offTreeFen =
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'
    const node = tree.getNode(offTreeFen)
    expect(node).toBeNull()
  })
})
