import { Chess } from 'chess.js'
import type { Chess as ChessType } from 'chess.js'
import type { StructureLabel } from '@/types'

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

export function classifyStructure(chess: ChessType): StructureLabel {
  const board = chess.board()

  // Check pawn positions
  const pawns = { white: [] as { rank: number; file: number }[], black: [] as { rank: number; file: number }[] }
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r]?.[f]
      if (piece?.type === 'p') {
        if (piece.color === 'w') pawns.white.push({ rank: r, file: f })
        else pawns.black.push({ rank: r, file: f })
      }
    }
  }

  const hasPawn = (color: 'white' | 'black', file: number) =>
    (color === 'white' ? pawns.white : pawns.black).some((p) => p.file === file)
  const pawnFiles = (color: 'white' | 'black') =>
    (color === 'white' ? pawns.white : pawns.black).map((p) => p.file)

  // Isolated d-pawn
  const dPawnWhite = pawns.white.find((p) => p.file === 3)
  const dPawnBlack = pawns.black.find((p) => p.file === 3)
  if (dPawnWhite && !hasPawn('white', 2) && !hasPawn('white', 4)) return 'isolated-queens-pawn'
  if (dPawnBlack && !hasPawn('black', 2) && !hasPawn('black', 4)) return 'isolated-queens-pawn'

  // Hanging pawns (c+d or d+e with no support)
  const hasHanging = (f1: number, f2: number) => {
    const w = pawnFiles('white')
    const b = pawnFiles('black')
    return (
      (w.includes(f1) && w.includes(f2) && !w.includes(f1 - 1) && !w.includes(f2 + 1)) ||
      (b.includes(f1) && b.includes(f2) && !b.includes(f1 - 1) && !b.includes(f2 + 1))
    )
  }
  if (hasHanging(2, 3) || hasHanging(3, 4)) return 'hanging-pawns'

  // Caro-Kann: Black c6, d5, e6
  if (hasPawn('black', 2) && hasPawn('black', 3) && hasPawn('black', 4))
    return 'caro-kann-structure'

  // Slav: Black c6, d5 (no e6)
  if (hasPawn('black', 2) && hasPawn('black', 3)) return 'slav-structure'

  // French: Black e6, d5 (no c6)
  if (hasPawn('black', 4) && hasPawn('black', 3) && !hasPawn('black', 2))
    return 'french-structure'

  // King's Indian: Black g6, d6, Nf6
  if (hasPawn('black', 6) && hasPawn('black', 5)) return 'kings-indian-structure'

  // London: White d4, Bf4
  const hasBf4 =
    board[4]?.[5]?.type === 'b' && board[4]?.[5]?.color === 'w' && hasPawn('white', 3)
  if (hasBf4) return 'london-structure'

  // Sicilian: Black c5 vs White d4
  if (hasPawn('black', 2) && hasPawn('white', 3)) return 'sicilian-structure'

  // Closed center: d4+d5 or e4+e5
  if (hasPawn('white', 3) && hasPawn('black', 3)) return 'closed-center'
  if (hasPawn('white', 4) && hasPawn('black', 4)) return 'closed-center'

  // Open center
  if (!hasPawn('white', 3) && !hasPawn('black', 3) && !hasPawn('white', 4) && !hasPawn('black', 4))
    return 'open-center'

  return 'unknown'
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
