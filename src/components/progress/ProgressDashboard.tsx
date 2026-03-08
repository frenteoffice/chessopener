import { OverallStats } from './OverallStats'
import { CategoryBreakdown } from './CategoryBreakdown'
import { DueForReview } from './DueForReview'
import { HeatMapTree } from './HeatMapTree'

export function ProgressDashboard() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-2xl font-semibold text-slate-100">Progress Dashboard</h2>
      <OverallStats />
      <div className="grid md:grid-cols-2 gap-6">
        <CategoryBreakdown />
        <DueForReview />
      </div>
      <HeatMapTree />
    </div>
  )
}
