import { useCourseStore } from '@/store/courseStore'
import { useProgressStore } from '@/store/progressStore'
import { decayConfidence } from '@/services/ProgressCalculator'

export function CategoryBreakdown() {
  const course = useCourseStore((s) => s.course)
  const progress = useProgressStore((s) => s.progress)

  if (!course) return null

  const categories = course.categories.map((cat) => {
    const lines = cat.lines
    const confidences = lines.map((l) => {
      const lp = progress?.lines[l.id]
      if (!lp) return 0
      const days = Math.floor(
        (Date.now() - new Date(lp.lastPracticed).getTime()) / (24 * 60 * 60 * 1000)
      )
      return decayConfidence(lp.confidence, days)
    })
    const avg =
      confidences.length > 0
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : 0
    return { ...cat, avgConfidence: avg }
  })

  return (
    <div className="space-y-3">
      <h3 className="text-slate-300 font-medium">By Category</h3>
      {categories.map((cat) => (
        <div key={cat.id}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-200">{cat.name}</span>
            <span className="text-slate-400">{cat.avgConfidence}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${cat.avgConfidence}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
