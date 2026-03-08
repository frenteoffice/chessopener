import { useTrainerStore } from '@/store/trainerStore'

export function MoveExplanation() {
  const { activeLine, currentPly, mode, showExplanation } = useTrainerStore()

  if (mode !== 'learn' || !showExplanation || !activeLine) return null
  if (currentPly >= activeLine.moves.length) return null

  const moveData = activeLine.moves[currentPly]
  if (!moveData) return null

  return (
    <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
      <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
        Explanation
      </h3>
      <p className="text-slate-200 text-sm leading-relaxed">{moveData.explanation}</p>
    </div>
  )
}
