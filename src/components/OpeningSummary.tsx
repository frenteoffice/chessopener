import { useGameStore } from '@/store/gameStore'

export function OpeningSummary() {
  const { phase, openingId, history } = useGameStore()
  if (phase !== 'free' || !openingId || history.length === 0) return null

  const openingName = openingId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50">
      <h3 className="text-amber-200 text-sm font-medium mb-2">Opening Complete</h3>
      <p className="text-slate-300 text-sm">
        You've completed the <strong>{openingName}</strong>. Continue playing against the
        engine to apply what you've learned.
      </p>
    </div>
  )
}
