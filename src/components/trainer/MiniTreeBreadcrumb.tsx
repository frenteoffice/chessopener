import { useTrainerStore } from '@/store/trainerStore'
import { useCourseStore } from '@/store/courseStore'

export function MiniTreeBreadcrumb() {
  const { activeLine } = useTrainerStore()
  const course = useCourseStore((s) => s.course)

  if (!activeLine || !course) return null

  const category = course.categories.find((c) =>
    c.lines.some((l) => l.id === activeLine.id)
  )

  const parts: string[] = []
  if (course.trunkMoves.length > 0) {
    parts.push(course.trunkMoves.length <= 4 ? course.trunkMoves.join(' ') : 'Trunk')
  }
  if (category) parts.push(category.name)
  parts.push(activeLine.name)

  return (
    <div className="flex items-center gap-2 text-slate-500 text-xs overflow-x-auto">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-2 flex-shrink-0">
          <span className="text-slate-400">{p}</span>
          {i < parts.length - 1 && <span className="text-slate-600">›</span>}
        </span>
      ))}
    </div>
  )
}
