import type { OpeningNode } from '@/types'

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
}

export class OpeningTree {
  private root: OpeningNode[]
  private fenIndex: Record<string, OpeningNode> = {}
  private rootFen?: string
  private rootResponses: string[] = []
  private rootWeights: number[] = []

  constructor(openingData: OpeningData) {
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
}
