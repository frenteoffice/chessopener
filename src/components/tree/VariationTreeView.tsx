import { TreeGraph } from './TreeGraph'
import { LineListSidebar } from './LineListSidebar'
import { useCourseStore } from '@/store/courseStore'

export function VariationTreeView() {
  const course = useCourseStore((s) => s.course)

  if (!course) {
    return (
      <div className="p-8 text-slate-500">No course loaded. Select a course first.</div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)]">
      <div className="flex-1 p-4 overflow-auto">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">{course.name}</h2>
        <TreeGraph />
      </div>
      <LineListSidebar />
    </div>
  )
}
