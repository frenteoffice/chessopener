import { MetricCard } from './MetricCard'

export function MetricsDashboard() {
  return (
    <div>
      <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
        Position Metrics
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard metric="pieceActivity" label="Piece Activity" />
        <MetricCard metric="centerControl" label="Center Control" />
        <MetricCard metric="pawnStructure" label="Pawn Structure" />
        <MetricCard metric="kingSafety" label="King Safety" />
      </div>
    </div>
  )
}
