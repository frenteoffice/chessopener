import { useGameStore } from '@/store/gameStore'

interface MetricCardProps {
  metric: 'pieceActivity' | 'centerControl' | 'pawnStructure' | 'kingSafety'
  label: string
}

export function MetricCard({ metric, label }: MetricCardProps) {
  const { metrics, playerColor } = useGameStore()
  const value =
    metrics[metric] &&
    typeof metrics[metric] === 'object' &&
    'white' in (metrics[metric] as object)
      ? (metrics[metric] as { white: number; black: number })[
          playerColor === 'white' ? 'white' : 'black'
        ]
      : (metrics[metric] as { white: string; black: string })?.[
          playerColor === 'white' ? 'white' : 'black'
        ]
  const delta = metrics.delta
  const deltaValue =
    metric === 'pieceActivity'
      ? delta.pieceActivity
      : metric === 'centerControl'
        ? delta.centerControl
        : metric === 'kingSafety'
          ? delta.kingSafety
          : 0
  const deltaColor =
    deltaValue > 0 ? 'text-green-400' : deltaValue < 0 ? 'text-red-400' : 'text-slate-400'

  return (
    <div className="bg-slate-700/50 rounded p-3 border border-slate-600">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-medium text-slate-200">{String(value)}</span>
        {metric !== 'pawnStructure' && (
          <span className={`text-sm ${deltaColor}`}>
            {deltaValue > 0 ? '+' : ''}
            {deltaValue}
          </span>
        )}
        {metric === 'pawnStructure' && delta.pawnStructureChanged && (
          <span className="text-sm text-amber-400">changed</span>
        )}
      </div>
    </div>
  )
}
