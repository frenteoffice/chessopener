import { useTrainerStore } from '@/store/trainerStore'

export function HintButton() {
  const { mode, activeLine, currentPly, requestHint } = useTrainerStore()

  if (mode !== 'practice' || !activeLine) return null
  if (currentPly >= activeLine.moves.length) return null
  const moveData = activeLine.moves[currentPly]
  if (!moveData?.isUserMove) return null

  return (
    <button
      onClick={() => requestHint()}
      className="px-4 py-2 rounded-lg bg-amber-800/60 hover:bg-amber-700/70 border border-amber-600/50 text-amber-200 text-sm font-medium transition-colors"
    >
      Hint
    </button>
  )
}
