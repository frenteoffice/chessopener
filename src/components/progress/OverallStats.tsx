import { useCourseStore } from '@/store/courseStore'
import { useProgressStore } from '@/store/progressStore'
import { getOverallStats } from '@/services/ProgressCalculator'

export function OverallStats() {
  const course = useCourseStore((s) => s.course)
  const progress = useProgressStore((s) => s.progress)
  const totalLines = course
    ? course.categories.reduce((sum, c) => sum + c.lines.length, 0)
    : 0
  const stats = progress?.courseId === course?.id
    ? getOverallStats(progress, totalLines)
    : { mastered: 0, averageConfidence: 0, totalPracticeTime: 0 }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-600">
        <div className="text-2xl font-bold text-emerald-400">{stats.mastered}</div>
        <div className="text-slate-400 text-sm">Lines Mastered (≥80%)</div>
      </div>
      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-600">
        <div className="text-2xl font-bold text-slate-200">{stats.averageConfidence}%</div>
        <div className="text-slate-400 text-sm">Average Confidence</div>
      </div>
      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-600">
        <div className="text-2xl font-bold text-slate-200">{totalLines}</div>
        <div className="text-slate-400 text-sm">Total Lines</div>
      </div>
    </div>
  )
}
