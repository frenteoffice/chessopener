import type { OpeningNode, OpeningData, DefenseNode } from '@/types'

export type { OpeningData }

export class OpeningTree {
  private data: OpeningData
  private root: OpeningNode[]
  private fenIndex: Record<string, OpeningNode> = {}
  private defenseIndex: Map<string, DefenseNode> = new Map()
  private rootFen?: string
  private rootResponses: string[] = []
  private rootWeights: number[] = []

  constructor(openingData: OpeningData) {
    this.data = openingData
    this.root = openingData.moves
    this.rootFen = openingData.rootFen
    this.rootResponses = openingData.rootResponses ?? []
    this.rootWeights = openingData.rootWeights ?? []
    this.buildFenIndex(this.root)
  }

  private buildFenIndex(nodes: OpeningNode[]): void {
    for (const node of nodes) {
      this.fenIndex[node.fen] = node
      if (node.children?.length) {
        this.buildFenIndex(node.children)
      }
    }
  }

  getNode(fen: string): OpeningNode | null {
    const node = this.fenIndex[fen]
    if (node) return node
    if (this.rootFen && fen === this.rootFen) {
      return {
        san: '',
        fen: this.rootFen,
        engineResponses: this.rootResponses,
        responseWeights: this.rootWeights,
        children: this.root,
      }
    }
    return null
  }

  sampleResponse(node: OpeningNode): string {
    if (!node.engineResponses?.length) return ''
    const weights = node.responseWeights ?? node.engineResponses.map(() => 1 / node.engineResponses!.length)
    const r = Math.random()
    let cumulative = 0
    for (let i = 0; i < node.engineResponses.length; i++) {
      cumulative += weights[i] ?? 0
      if (r <= cumulative) return node.engineResponses[i]
    }
    return node.engineResponses[0]
  }

  getChild(node: OpeningNode, san: string): OpeningNode | null {
    if (node.children) return node.children.find((c) => c.san === san) ?? null
    if (this.rootFen && node.fen === this.rootFen) {
      return this.root.find((m) => m.san === san) ?? null
    }
    return null
  }

  /** Returns the root node with children for the player's first move (White openings). */
  getRootNode(): OpeningNode | null {
    if (!this.rootFen) return null
    return {
      san: '',
      fen: this.rootFen,
      engineResponses: this.rootResponses,
      responseWeights: this.rootWeights,
      children: this.root,
    }
  }

  /**
   * Loads a defense sub-tree into a separate internal FEN index.
   * Call once before game start when mode === 'specific-defense'.
   */
  loadDefense(defenseId: string): void {
    this.defenseIndex.clear()
    const defenses = (this.data.defenses ?? [])
    const defense = defenses.find((d) => d.id === defenseId)
    if (!defense) {
      console.warn(`[OpeningTree] Unknown defenseId: ${defenseId}`)
      return
    }
    for (const node of defense.tree) {
      this.indexDefenseNode(node)
    }
  }

  private indexDefenseNode(node: DefenseNode): void {
    this.defenseIndex.set(node.fen, node)
    for (const child of node.children ?? []) {
      this.indexDefenseNode(child)
    }
  }

  /**
   * Looks up the current position in the loaded defense tree.
   * Returns null if no defense is loaded or position is off-defense.
   */
  getDefenseNode(fen: string): DefenseNode | null {
    return this.defenseIndex.get(fen) ?? null
  }

  /**
   * Searches all provided opening data objects for a FEN match.
   * Returns the first Opening whose tree contains the given FEN, or null.
   */
  findTransposition(fen: string, allOpenings: OpeningData[]): OpeningData | null {
    if (allOpenings.length === 0) return null
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    if (fen === startFen) return null
    for (const opening of allOpenings) {
      const tempTree = new OpeningTree(opening)
      if (tempTree.getNode(fen)) return opening
    }
    return null
  }
}
