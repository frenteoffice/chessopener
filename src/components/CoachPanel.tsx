import { MoveList } from './MoveList'
import { Commentary } from './Commentary'
import { MetricsDashboard } from './MetricsDashboard'
import { OpeningSummary } from './OpeningSummary'
import { useGameStore } from '@/store/gameStore'

export function CoachPanel() {
  const { commentary, commentaryLoading } = useGameStore()
  return (
    <div className="flex flex-col gap-6 w-80">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <MoveList />
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <MetricsDashboard />
      </div>
      <OpeningSummary />
      {(commentary || commentaryLoading) && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <Commentary />
        </div>
      )}
    </div>
  )
}
