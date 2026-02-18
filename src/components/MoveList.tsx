import { useGameStore } from '@/store/gameStore'

export function MoveList() {
  const { history } = useGameStore()

  if (history.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-4">
        Moves will appear here as you play.
      </div>
    )
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
        Move List
      </h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {history.map((move, index) => (
          <span
            key={`${index}-${move.san}`}
            className={`px-2 py-0.5 rounded text-sm ${
              move.inTheory === false
                ? 'bg-amber-900/50 text-amber-200'
                : 'bg-slate-700/50 text-slate-200'
            }`}
          >
            {Math.floor(index / 2) + 1}.
            {index % 2 === 0 ? ' ' : '... '}
            {move.san}
          </span>
        ))}
      </div>
    </div>
  )
}
