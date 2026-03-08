import { useTrainerStore } from '@/store/trainerStore'
import { useCourseStore } from '@/store/courseStore'

const MODE_LABELS: Record<string, string> = {
  learn: 'Learn',
  practice: 'Practice',
  drill: 'Drill',
  'time-trial': 'Time Trial',
}

export function LineHeader() {
  const { activeLine, mode } = useTrainerStore()
  const course = useCourseStore((s) => s.course)

  if (!activeLine || !course) return null

  const category = course.categories.find((c) =>
    c.lines.some((l) => l.id === activeLine.id)
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-300 text-sm font-medium">{activeLine.name}</span>
        <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-slate-400">
          {MODE_LABELS[mode] ?? mode}
        </span>
      </div>
      {category && (
        <span className="text-slate-500 text-xs">
          {category.name} · Line #{activeLine.lineNumber}
        </span>
      )}
    </div>
  )
}
