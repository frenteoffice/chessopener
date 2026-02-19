import { MetricCard } from './MetricCard'

export function MetricsDashboard() {
  return (
    <div>
      <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-3">
        Position Metrics
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          metric="pieceActivity"
          label="Piece Activity"
          description="Squares your pieces can reach. More = better development."
        />
        <MetricCard
          metric="centerControl"
          label="Center Control"
          description="Attacks on d4/d5/e4/e5. Control the center to control the game."
        />
        <MetricCard
          metric="pawnStructure"
          label="Pawn Structure"
          description="Shape of your pawns. Doubled or isolated pawns are weaknesses."
        />
        <MetricCard
          metric="kingSafety"
          label="King Safety"
          description="Open files near your king are dangerous. Castle to improve this."
        />
      </div>
    </div>
  )
}
