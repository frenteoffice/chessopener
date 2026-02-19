import { useGameStore } from '@/store/gameStore'

interface MetricCardProps {
  metric: 'pieceActivity' | 'centerControl' | 'pawnStructure' | 'kingSafety'
  label: string
  description: string
}

function getPieceActivityLabel(n: number): string {
  if (n >= 30) return 'Excellent'
  if (n >= 22) return 'Good'
  if (n >= 14) return 'Moderate'
  return 'Low'
}

function getCenterControlLabel(n: number): string {
  if (n >= 8) return 'Dominant'
  if (n >= 5) return 'Good'
  if (n >= 2) return 'Moderate'
  return 'Low'
}

function getKingSafetyLabel(n: number): string {
  if (n >= 8) return 'Safe'
  if (n >= 6) return 'Moderate'
  if (n >= 4) return 'Exposed'
  return 'Danger'
}

function getKingSafetyColor(n: number): string {
  if (n >= 8) return 'text-emerald-400'
  if (n >= 6) return 'text-slate-300'
  if (n >= 4) return 'text-amber-400'
  return 'text-red-400'
}

export function MetricCard({ metric, label, description }: MetricCardProps) {
  const { metrics, playerColor } = useGameStore()

  const numericValue =
    metric !== 'pawnStructure'
      ? (metrics[metric] as { white: number; black: number })[
          playerColor === 'white' ? 'white' : 'black'
        ]
      : null

  const pawnLabel =
    metric === 'pawnStructure'
      ? (metrics.pawnStructure as { white: string; black: string })[
          playerColor === 'white' ? 'white' : 'black'
        ]
      : null

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
    deltaValue > 0 ? 'text-emerald-400' : deltaValue < 0 ? 'text-red-400' : 'text-slate-500'

  const qualitativeLabel =
    metric === 'pieceActivity' && numericValue !== null
      ? getPieceActivityLabel(numericValue)
      : metric === 'centerControl' && numericValue !== null
        ? getCenterControlLabel(numericValue)
        : metric === 'kingSafety' && numericValue !== null
          ? getKingSafetyLabel(numericValue)
          : null

  const kingSafetyColor =
    metric === 'kingSafety' && numericValue !== null
      ? getKingSafetyColor(numericValue)
      : 'text-slate-200'

  const pawnStructureColor =
    pawnLabel === 'doubled + isolated' || pawnLabel === 'isolated pawn' || pawnLabel === 'doubled pawns'
      ? 'text-amber-300'
      : pawnLabel === 'solid pawn chain'
        ? 'text-emerald-300'
        : 'text-slate-200'

  return (
    <div className="bg-slate-700/50 rounded p-3 border border-slate-600">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs text-slate-500 mb-2 leading-tight">{description}</div>
      <div className="flex items-baseline gap-2">
        {metric === 'pawnStructure' ? (
          <span className={`text-sm font-medium ${pawnStructureColor}`}>{pawnLabel}</span>
        ) : (
          <>
            <span className={`text-lg font-medium ${kingSafetyColor}`}>{numericValue}</span>
            {qualitativeLabel && (
              <span className="text-xs text-slate-400">({qualitativeLabel})</span>
            )}
            <span className={`text-sm ml-auto ${deltaColor}`}>
              {deltaValue > 0 ? '+' : ''}{deltaValue !== 0 ? deltaValue : ''}
            </span>
          </>
        )}
        {metric === 'pawnStructure' && delta.pawnStructureChanged && (
          <span className="text-xs text-amber-400 ml-1">changed</span>
        )}
      </div>
    </div>
  )
}
