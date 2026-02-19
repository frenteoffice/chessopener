import { useGameStore } from '@/store/gameStore'

const COMMENTARY_ENABLED = import.meta.env.VITE_COMMENTARY_ENABLED === 'true'

export function Commentary() {
  const { commentary, commentaryLoading } = useGameStore()

  if (!COMMENTARY_ENABLED && !commentary && !commentaryLoading) return null
  if (!commentary && !commentaryLoading) return null

  return (
    <div>
      <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
        Commentary
      </h3>
      {commentaryLoading ? (
        <p className="text-slate-400 text-sm italic">Generating commentary...</p>
      ) : (
        <p className="text-slate-200 text-sm leading-relaxed">{commentary}</p>
      )}
    </div>
  )
}
