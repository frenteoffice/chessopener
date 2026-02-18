import { useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useGameStore } from '@/store/gameStore'

interface BoardSectionProps {
  onMove?: (sourceSquare: string, targetSquare: string) => void
}

export function BoardSection({ onMove }: BoardSectionProps) {
  const { fen, engineThinking, playerColor } = useGameStore()

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (engineThinking) return false
      const chess = new Chess(fen)
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })
      if (move) {
        onMove?.(sourceSquare, targetSquare)
        return true
      }
      return false
    },
    [fen, engineThinking, onMove]
  )

  const boardOrientation = playerColor === 'white' ? 'white' : 'black'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Chessboard
          position={fen}
          onPieceDrop={handlePieceDrop}
          boardOrientation={boardOrientation}
          arePiecesDraggable={!engineThinking}
          boardWidth={400}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
          }}
          customDarkSquareStyle={{ backgroundColor: '#1e293b' }}
          customLightSquareStyle={{ backgroundColor: '#334155' }}
          customSquareStyles={{
            ...(getLastMoveStyles(fen) || {}),
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

function getLastMoveStyles(fen: string): Record<string, object> | null {
  const chess = new Chess(fen)
  const moves = chess.history({ verbose: true })
  if (moves.length === 0) return null
  const lastMove = moves[moves.length - 1]
  return {
    [lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.3)' },
    [lastMove.to]: { backgroundColor: 'rgba(255, 255, 0, 0.3)' },
  }
}
