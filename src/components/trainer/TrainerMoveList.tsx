import { useTrainerStore } from '@/store/trainerStore'

export function TrainerMoveList() {
  const moveHistory = useTrainerStore((s) => s.moveHistory)

  if (moveHistory.length === 0) return null

  return (
    <div>
      <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
        Moves Played
      </h3>
      <div className="flex flex-wrap gap-x-2 gap-y-1 max-h-28 overflow-y-auto">
        {moveHistory.map((move, index) => (
          <span
            key={`${index}-${move.san}`}
            className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
              move.correct
                ? 'bg-emerald-900/40 text-emerald-300'
                : 'bg-red-900/40 text-red-300'
            }`}
          >
            {move.correct ? (
              <span className="text-emerald-400">✓</span>
            ) : (
              <span className="text-red-400">✗</span>
            )}
            {index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}
            {move.san}
            {move.hintUsed && (
              <span className="text-amber-400 text-[10px]" title="Hint used">
                (h)
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
