import { useCourseStore } from '@/store/courseStore'
import { CategoryGroup } from './CategoryGroup'

export function LineListSidebar() {
  const course = useCourseStore((s) => s.course)

  if (!course) return null

  return (
    <div className="w-64 flex-shrink-0 border-l border-slate-700 overflow-y-auto">
      <div className="p-3">
        <h3 className="text-slate-300 text-sm font-medium mb-3">Lines</h3>
        <div className="space-y-0">
          {course.categories.map((cat) => (
            <CategoryGroup key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </div>
  )
}
