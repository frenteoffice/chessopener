import type { MetricsDelta } from '@/types'

const COMMENTARY_API_URL =
  import.meta.env.VITE_COMMENTARY_API_URL || '/.netlify/functions/commentary'

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
    fen: string
  ): Promise<string> {
    const prompt = `
A chess player just played ${moveSan}.
Piece activity changed by ${delta.pieceActivity}.
Center control changed by ${delta.centerControl}.
King safety changed by ${delta.kingSafety}.
Current FEN: ${fen}

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
      if (!res.ok) throw new Error('Commentary API error')
      const { text } = (await res.json()) as { text: string }
      return text
    } catch {
      return 'Commentary unavailable. Continue playing to build your understanding.'
    }
  }
}
