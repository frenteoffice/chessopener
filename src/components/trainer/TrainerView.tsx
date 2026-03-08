import { useCallback, useEffect, useRef } from 'react'
import { BoardSection } from '@/components/board/BoardSection'
import { TrainingPanel } from './TrainingPanel'
import { MiniTreeBreadcrumb } from './MiniTreeBreadcrumb'
import { useTrainerStore } from '@/store/trainerStore'
import { useUIStore } from '@/store/uiStore'

export function TrainerView() {
  const {
    activeLine,
    currentPly,
    fen,
    attemptMove,
    highlightSquares,
    playerColor,
    moveHistory,
  } = useTrainerStore()
  const boardFlipped = useUIStore((s) => s.bothSidesMode)
  const opponentAdvanceScheduled = useRef(false)

  const handleMove = useCallback(
    (sourceSquare: string, targetSquare: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
      if (!activeLine || currentPly >= activeLine.moves.length) return
      const moveData = activeLine.moves[currentPly]
      if (!moveData.isUserMove) return

      attemptMove(sourceSquare, targetSquare, promotion ?? 'q')
    },
    [activeLine, currentPly, attemptMove]
  )

  // Auto-advance opponent moves (500ms delay)
  useEffect(() => {
    if (!activeLine || currentPly >= activeLine.moves.length) return
    const moveData = activeLine.moves[currentPly]
    if (moveData.isUserMove) return
    if (opponentAdvanceScheduled.current) return

    opponentAdvanceScheduled.current = true
    const t = setTimeout(() => {
      useTrainerStore.getState().advanceOpponentMove()
      opponentAdvanceScheduled.current = false
    }, 500)
    return () => clearTimeout(t)
  }, [activeLine, currentPly])

  if (!activeLine) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500">
        <p>Select a line from the tree to start training.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-8 p-6 min-h-screen">
      <TrainingPanel />
      <div className="flex flex-col gap-4">
        <MiniTreeBreadcrumb />
        <BoardSection
          fen={fen}
          onMove={handleMove}
          boardFlipped={boardFlipped}
          highlightSquares={highlightSquares}
          playerColor={playerColor}
          moveHistory={moveHistory}
          disabled={false}
        />
      </div>
    </div>
  )
}
