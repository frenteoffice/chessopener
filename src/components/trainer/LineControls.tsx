import { useTrainerStore } from '@/store/trainerStore'
import { useUIStore } from '@/store/uiStore'

export function LineControls() {
  const { activeLine, retryLine, nextLine, mode } = useTrainerStore()
  const setView = useUIStore((s) => s.setView)

  if (!activeLine) return null

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={retryLine}
        className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm font-medium transition-colors"
      >
        Retry
      </button>
      {mode === 'drill' && (
        <button
          onClick={nextLine}
          className="px-4 py-2 rounded-lg bg-amber-700/60 hover:bg-amber-600/70 text-amber-200 text-sm font-medium transition-colors"
        >
          Next Line
        </button>
      )}
      <button
        onClick={() => setView('variation-tree')}
        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
      >
        Back to Tree
      </button>
    </div>
  )
}
