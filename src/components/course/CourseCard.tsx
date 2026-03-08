import type { Course } from '@/types/course'
import { useProgressStore } from '@/store/progressStore'
import { getOverallStats } from '@/services/ProgressCalculator'

interface CourseCardProps {
  course: Course
  onSelect: () => void
}

export function CourseCard({ course, onSelect }: CourseCardProps) {
  const progress = useProgressStore((s) => s.progress)
  const totalLines = course.categories.reduce((sum, c) => sum + c.lines.length, 0)
  const stats = progress?.courseId === course.id
    ? getOverallStats(progress, totalLines)
    : { mastered: 0, averageConfidence: 0, totalPracticeTime: 0 }

  return (
    <button
      onClick={onSelect}
      className="w-full max-w-sm p-6 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600 hover:border-slate-500 transition-all text-left"
    >
      <h3 className="text-lg font-semibold text-slate-100 mb-1">{course.name}</h3>
      <p className="text-slate-400 text-sm mb-3">{course.description}</p>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{course.eco}</span>
        <span>{totalLines} lines</span>
        {stats.mastered > 0 && (
          <span className="text-emerald-400">{stats.mastered} mastered</span>
        )}
      </div>
      {totalLines > 0 && (
        <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${stats.averageConfidence}%` }}
          />
        </div>
      )}
    </button>
  )
}
