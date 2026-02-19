import { useGameStore } from '@/store/gameStore'

function formatEval(cp: number | null, playerColor: 'white' | 'black'): string {
  if (cp === null) return 'Evaluating...'
  const adjusted = playerColor === 'white' ? cp : -cp
  if (Math.abs(adjusted) < 30) return 'Equal position'
  const pawns = (Math.abs(adjusted) / 100).toFixed(1)
  return adjusted > 0 ? `+${pawns} (slight advantage)` : `-${pawns} (slight disadvantage)`
}

function buildVariationName(
  history: { san: string; inTheory?: boolean }[]
): string {
  const theoryMoves = history.filter((m) => m.inTheory !== false)
  if (theoryMoves.length === 0) return 'No theory played'
  return theoryMoves.map((m) => m.san).join(' ')
}

export function OpeningSummary() {
  const { phase, openingId, history, evaluation, playerColor } = useGameStore()
  if (phase !== 'free' || !openingId || history.length === 0) return null

  const openingName = openingId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  const variationLine = buildVariationName(history)
  const evalText = formatEval(evaluation, playerColor)

  return (
    <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50">
      <h3 className="text-amber-200 text-sm font-medium mb-3">Opening Complete</h3>
      <div className="space-y-2">
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wider">Opening</span>
          <p className="text-slate-200 text-sm font-medium">{openingName}</p>
        </div>
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wider">Theory Played</span>
          <p className="text-slate-300 text-sm font-mono">{variationLine}</p>
        </div>
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wider">Position Evaluation</span>
          <p className="text-slate-200 text-sm">{evalText}</p>
        </div>
        <p className="text-slate-400 text-xs pt-1">
          Continue playing against the engine to apply what you've learned.
        </p>
      </div>
    </div>
  )
}
