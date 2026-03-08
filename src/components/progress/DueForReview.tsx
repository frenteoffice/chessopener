import { useCourseStore } from '@/store/courseStore'
import { useProgressStore } from '@/store/progressStore'
import { useTrainerStore } from '@/store/trainerStore'
import { useUIStore } from '@/store/uiStore'

export function DueForReview() {
  const course = useCourseStore((s) => s.course)
  const getDueLines = useProgressStore((s) => s.getDueLines)
  const getLine = useCourseStore((s) => s.getLine)
  const startLine = useTrainerStore((s) => s.startLine)
  const setView = useUIStore((s) => s.setView)

  if (!course) return null

  const allLineIds = course.categories.flatMap((c) => c.lines.map((l) => l.id))
  const dueIds = getDueLines(allLineIds)
  const dueLines = dueIds.map((id) => getLine(id)).filter(Boolean)

  if (dueLines.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-600">
        <h3 className="text-slate-300 font-medium mb-2">Due for Review</h3>
        <p className="text-slate-500 text-sm">No lines due today. Great job!</p>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-600">
      <h3 className="text-slate-300 font-medium mb-2">Due for Review</h3>
      <div className="space-y-1">
        {dueLines.slice(0, 10).map((line) =>
          line ? (
            <button
              key={line.id}
              onClick={() => {
                startLine(line.id, 'practice')
                setView('trainer')
              }}
              className="block w-full text-left px-2 py-1 rounded hover:bg-slate-700/50 text-slate-200 text-sm"
            >
              {line.name}
            </button>
          ) : null
        )}
      </div>
    </div>
  )
}
