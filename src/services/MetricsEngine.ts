import { Chess } from 'chess.js'
import type { Chess as ChessType } from 'chess.js'

const CENTER_SQUARES = ['d4', 'd5', 'e4', 'e5']

export function pieceActivity(chess: ChessType, color: 'white' | 'black'): number {
  const turn = chess.turn()
  const colorCode = color === 'white' ? 'w' : 'b'
  if (turn === colorCode) {
    return chess.moves({ verbose: true }).length
  }
  const fen = chess.fen()
  const parts = fen.split(' ')
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  const flipped = new Chess(parts.join(' '))
  return flipped.moves({ verbose: true }).length
}

function getMovesForColor(chess: ChessType, color: 'w' | 'b'): { to: string }[] {
  const fen = chess.fen()
  const parts = fen.split(' ')
  if (parts[1] !== color) {
    parts[1] = color
    const c = new Chess(parts.join(' '))
    return c.moves({ verbose: true }) as { to: string }[]
  }
  return chess.moves({ verbose: true }) as { to: string }[]
}

export function centerControl(chess: ChessType): { white: number; black: number } {
  const score = { white: 0, black: 0 }
  for (const move of getMovesForColor(chess, 'w')) {
    if (CENTER_SQUARES.includes(move.to)) score.white++
  }
  for (const move of getMovesForColor(chess, 'b')) {
    if (CENTER_SQUARES.includes(move.to)) score.black++
  }
  return score
}

export function pawnStructure(chess: ChessType, color: 'white' | 'black'): string {
  const board = chess.board()
  const colorCode = color === 'white' ? 'w' : 'b'
  const files: number[] = []
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank]?.[file]
      if (piece?.type === 'p' && piece.color === colorCode) {
        files.push(file)
      }
    }
  }

  const doubled = files.some((f, i) => files.indexOf(f) !== i)
  const isolated = files.some(
    (f) => !files.includes(f - 1) && !files.includes(f + 1)
  )
  const fileSet = new Set(files)

  if (doubled && isolated) return 'doubled + isolated'
  if (doubled) return 'doubled pawns'
  if (isolated) return 'isolated pawn'
  if (fileSet.size >= 4) return 'solid pawn chain'
  return 'normal'
}

export function kingSafety(chess: ChessType, color: 'white' | 'black'): number {
  const colorCode = color === 'white' ? 'w' : 'b'
  const board = chess.board()

  let kingSquare: { rank: number; file: number } | null = null
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c]
      if (piece?.type === 'k' && piece.color === colorCode) {
        kingSquare = { rank: r, file: c }
        break
      }
    }
    if (kingSquare) break
  }
  if (!kingSquare) return 10

  const kf = kingSquare.file
  const nearbyFiles = [kf - 1, kf, kf + 1].filter((f) => f >= 0 && f < 8)
  let openFilePenalty = 0
  for (const file of nearbyFiles) {
    const hasOwnPawn = board.some(
      (_, ri) =>
        board[ri]?.[file]?.type === 'p' && board[ri]?.[file]?.color === colorCode
    )
    if (!hasOwnPawn) openFilePenalty += 2
  }
  return Math.max(0, 10 - openFilePenalty)
}

export function computeAllMetrics(chess: ChessType) {
  return {
    pieceActivity: {
      white: pieceActivity(chess, 'white'),
      black: pieceActivity(chess, 'black'),
    },
    centerControl: centerControl(chess),
    pawnStructure: {
      white: pawnStructure(chess, 'white'),
      black: pawnStructure(chess, 'black'),
    },
    kingSafety: {
      white: kingSafety(chess, 'white'),
      black: kingSafety(chess, 'black'),
    },
  }
}
