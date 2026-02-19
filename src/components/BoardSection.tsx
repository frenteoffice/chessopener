import { useCallback, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useGameStore } from '@/store/gameStore'

interface BoardSectionProps {
  onMove?: (sourceSquare: string, targetSquare: string, promotion?: 'q' | 'r' | 'b' | 'n') => void
  boardFlipped?: boolean
}

export function BoardSection({ onMove, boardFlipped }: BoardSectionProps) {
  const { fen, engineThinking, playerColor, history } = useGameStore()
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (engineThinking) return false
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
    [fen, engineThinking, onMove]
  )

  const handleSquareClick = useCallback(
    (square: string) => {
      if (engineThinking) return
      const chess = new Chess(fen)

      if (!selectedSquare) {
        const piece = chess.get(square as 'a1')
        const playerColorCode = playerColor === 'white' ? 'w' : 'b'
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
        const playerColorCode = playerColor === 'white' ? 'w' : 'b'
        if (piece && piece.color === playerColorCode) {
          setSelectedSquare(square)
        } else {
          setSelectedSquare(null)
        }
      }
    },
    [fen, engineThinking, selectedSquare, playerColor, onMove]
  )

  const boardOrientation =
    (playerColor === 'white') !== (boardFlipped ?? false) ? 'white' : 'black'

  const selectedSquareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(100, 200, 255, 0.4)' } }
    : {}

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Chessboard
          position={fen}
          onPieceDrop={handlePieceDrop}
          onSquareClick={handleSquareClick}
          boardOrientation={boardOrientation}
          arePiecesDraggable={!engineThinking}
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
            ...(getLastMoveStyles(history) || {}),
            ...selectedSquareStyles,
          }}
          showBoardNotation
        />
        {engineThinking && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-lg">
            <span className="text-slate-300 text-sm">Engine thinking...</span>
          </div>
        )}
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
