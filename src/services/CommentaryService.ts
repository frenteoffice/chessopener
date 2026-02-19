import type { MetricsDelta } from '@/types'

const COMMENTARY_API_URL =
  import.meta.env.VITE_COMMENTARY_API_URL || '/.netlify/functions/commentary'

const COMMENTARY_ENABLED = import.meta.env.VITE_COMMENTARY_ENABLED === 'true'

export class CommentaryService {
  async getCommentary(
    openingCommentary: string | undefined,
    moveSan: string,
    metricsDelta: MetricsDelta,
    fen: string
  ): Promise<string> {
    if (openingCommentary) {
      return openingCommentary
    }
    return this.generateCommentary(moveSan, metricsDelta, fen)
  }

  async generateCommentary(
    moveSan: string,
    delta: MetricsDelta,
    fen: string,
    options?: { structureLabel?: string; isEngineDeviation?: boolean }
  ): Promise<string> {
    if (!COMMENTARY_ENABLED) {
      return ''
    }

    let context = `
A chess player just played ${moveSan}.
Piece activity changed by ${delta.pieceActivity}.
Center control changed by ${delta.centerControl}.
King safety changed by ${delta.kingSafety}.
Current FEN: ${fen}
`
    if (options?.isEngineDeviation && options?.structureLabel && options.structureLabel !== 'unknown') {
      context += `\n\nThe engine deviated from the opening book with this move. The resulting pawn structure is: ${options.structureLabel}.`
    }

    const prompt = `${context}

Write 2-3 sentences explaining the positional idea behind this move,
referencing the metric changes. Use simple language suitable for a
1000-1200 ELO player. Be specific, not generic.
    `.trim()

    try {
      const res = await fetch(COMMENTARY_API_URL, {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        if (res.status === 429) return 'Commentary limit reached. Try again in a minute.'
        throw new Error(`Commentary API error: ${res.status}`)
      }
      const { text } = (await res.json()) as { text: string }
      return text
    } catch {
      return 'Commentary unavailable.'
    }
  }
}
