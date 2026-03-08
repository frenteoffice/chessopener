import { Chess } from 'chess.js'
import type { Course } from '@/types/course'

export interface TreeNode {
  id: string
  san: string
  fen: string
  depth: number
  children: TreeNode[]
  lineIds: string[]
  isBranchPoint: boolean
  categoryId?: string
  variationName?: string
}

let nodeIdCounter = 0

function generateNodeId(): string {
  return `node-${++nodeIdCounter}`
}

function resetNodeIdCounter(): void {
  nodeIdCounter = 0
}

/**
 * Build a variation tree from a course by inserting all lines into a trie.
 * Nodes with >1 child are branch points.
 */
export function buildVariationTree(course: Course): TreeNode {
  resetNodeIdCounter()
  const root: TreeNode = {
    id: generateNodeId(),
    san: '',
    fen: course.trunkMoves.length === 0 ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : '',
    depth: 0,
    children: [],
    lineIds: [],
    isBranchPoint: false,
  }

  // Build trunk first - all lines share this prefix
  let currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  let trunkNode = root

  for (const san of course.trunkMoves) {
    const chess = new Chess(currentFen)
    const move = chess.move(san)
    if (!move) break
    currentFen = chess.fen()
    const existing = trunkNode.children.find((c) => c.san === san)
    if (existing) {
      trunkNode = existing
    } else {
      const child: TreeNode = {
        id: generateNodeId(),
        san,
        fen: currentFen,
        depth: trunkNode.depth + 1,
        children: [],
        lineIds: [],
        isBranchPoint: false,
      }
      trunkNode.children.push(child)
      trunkNode = child
    }
  }

  // Insert each line's moves from trunk end
  for (const category of course.categories) {
    for (const line of category.lines) {
      let node = trunkNode
      let fen = currentFen
      for (const lm of line.moves) {
        const chess = new Chess(fen)
        const move = chess.move(lm.san)
        if (!move) break
        fen = chess.fen()
        let child = node.children.find((c) => c.san === lm.san)
        if (!child) {
          child = {
            id: generateNodeId(),
            san: lm.san,
            fen,
            depth: node.depth + 1,
            children: [],
            lineIds: [],
            isBranchPoint: false,
            categoryId: category.id,
            variationName: lm.ply === 1 ? category.name : undefined,
          }
          node.children.push(child)
        }
        if (!child.lineIds.includes(line.id)) {
          child.lineIds.push(line.id)
        }
        node = child
      }
    }
  }

  // Mark branch points and compute from root
  function markBranchPoints(n: TreeNode): void {
    n.isBranchPoint = n.children.length > 1
    for (const c of n.children) {
      markBranchPoints(c)
    }
  }
  markBranchPoints(root)

  return root
}

/**
 * Get all nodes that belong to a specific line (path from root to leaf).
 */
export function getNodesForLine(tree: TreeNode, lineId: string): TreeNode[] {
  const path: TreeNode[] = []
  function collectPath(n: TreeNode, acc: TreeNode[]): boolean {
    if (n.lineIds.includes(lineId)) {
      acc.push(n)
      return true
    }
    for (const c of n.children) {
      if (collectPath(c, acc)) {
        acc.unshift(n)
        return true
      }
    }
    return false
  }
  collectPath(tree, path)
  return path.filter((n) => n.san) // exclude root
}

/**
 * Get mastery color based on confidence (0-100).
 */
export function getMasteryColor(confidence: number): string {
  if (confidence === 0) return 'bg-slate-600'
  if (confidence <= 25) return 'bg-red-500'
  if (confidence <= 50) return 'bg-orange-500'
  if (confidence <= 75) return 'bg-yellow-500'
  return 'bg-green-500'
}
