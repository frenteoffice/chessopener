import { useUIStore } from '@/store/uiStore'
import { useCourseStore } from '@/store/courseStore'

export function Header() {
  const view = useUIStore((s) => s.view)
  const setView = useUIStore((s) => s.setView)
  const course = useCourseStore((s) => s.course)

  return (
    <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Chess Opening Trainer</h1>
        <p className="text-sm text-slate-400">
          {course ? course.name : 'Select a course to begin'}
        </p>
      </div>
      <nav className="flex items-center gap-2">
        <button
          onClick={() => setView('course-selector')}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            view === 'course-selector'
              ? 'bg-slate-600 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Courses
        </button>
        {course && (
          <>
            <button
              onClick={() => setView('variation-tree')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'variation-tree'
                  ? 'bg-slate-600 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setView('trainer')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'trainer'
                  ? 'bg-slate-600 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Train
            </button>
            <button
              onClick={() => setView('progress')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'progress'
                  ? 'bg-slate-600 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Progress
            </button>
          </>
        )}
      </nav>
    </header>
  )
}
