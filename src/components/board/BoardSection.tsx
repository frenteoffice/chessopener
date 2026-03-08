import { useCallback, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import type { CSSProperties } from 'react'

interface HistoryEntry {
  san: string
  fen: string
  color: 'w' | 'b'
  correct?: boolean
  from?: string
  to?: string
}

interface BoardSectionProps {
  fen: string
  onMove?: (sourceSquare: string, targetSquare: string, promotion?: 'q' | 'r' | 'b' | 'n') => void
  boardFlipped?: boolean
  highlightSquares?: Record<string, CSSProperties>
  playerColor?: 'white' | 'black'
  moveHistory?: HistoryEntry[]
  disabled?: boolean
}

export function BoardSection({
  fen,
  onMove,
  boardFlipped = false,
  highlightSquares = {},
  playerColor = 'white',
  moveHistory = [],
  disabled = false,
}: BoardSectionProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (disabled) return false
      const chess = new Chess(fen)
      const move = chess.move({ from: sourceSquare, to: targetSquare })
      if (move) {
        setSelectedSquare(null)
        const promo = move.promotion as 'q' | 'r' | 'b' | 'n' | undefined
        onMove?.(sourceSquare, targetSquare, promo ?? 'q')
        return true
      }
      return false
    },
    [fen, disabled, onMove]
  )

  const handleSquareClick = useCallback(
    (square: string) => {
      if (disabled) return
      const chess = new Chess(fen)
      const playerColorCode = playerColor === 'white' ? 'w' : 'b'

      if (!selectedSquare) {
        const piece = chess.get(square as 'a1')
        if (piece && piece.color === playerColorCode) {
          setSelectedSquare(square)
        }
        return
      }

      if (selectedSquare === square) {
        setSelectedSquare(null)
        return
      }

      const move = chess.move({ from: selectedSquare, to: square })
      if (move) {
        setSelectedSquare(null)
        const promo = move.promotion as 'q' | 'r' | 'b' | 'n' | undefined
        onMove?.(selectedSquare, square, promo ?? 'q')
      } else {
        const piece = chess.get(square as 'a1')
        if (piece && piece.color === playerColorCode) {
          setSelectedSquare(square)
        } else {
          setSelectedSquare(null)
        }
      }
    },
    [fen, disabled, selectedSquare, playerColor, onMove]
  )

  const boardOrientation =
    (playerColor === 'white') !== boardFlipped ? 'white' : 'black'

  const selectedSquareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(100, 200, 255, 0.4)' } }
    : {}

  const lastMoveStyles = getLastMoveStyles(moveHistory)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Chessboard
          position={fen}
          onPieceDrop={handlePieceDrop}
          onSquareClick={handleSquareClick}
          boardOrientation={boardOrientation}
          arePiecesDraggable={!disabled}
          boardWidth={400}
          promotionDialogVariant="modal"
          onPromotionPieceSelect={(piece, promoteFromSquare, promoteToSquare) => {
            if (!piece || !promoteFromSquare || !promoteToSquare) return false
            const promoChar = piece[1]?.toLowerCase() as 'q' | 'r' | 'b' | 'n'
            onMove?.(promoteFromSquare, promoteToSquare, promoChar)
            return true
          }}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
          }}
          customDarkSquareStyle={{ backgroundColor: '#1e293b' }}
          customLightSquareStyle={{ backgroundColor: '#334155' }}
          customSquareStyles={{
            ...(lastMoveStyles || {}),
            ...highlightSquares,
            ...selectedSquareStyles,
          }}
          showBoardNotation
        />
      </div>
    </div>
  )
}

function getLastMoveStyles(
  history: { from?: string; to?: string }[]
): Record<string, object> | null {
  const last = history[history.length - 1]
  if (!last?.from || !last?.to) return null
  return {
    [last.from]: { backgroundColor: 'rgba(255, 255, 0, 0.3)' },
    [last.to]: { backgroundColor: 'rgba(255, 255, 0, 0.3)' },
  }
}
