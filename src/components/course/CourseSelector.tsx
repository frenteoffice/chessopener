import { useEffect } from 'react'
import { CourseCard } from './CourseCard'
import { useCourseStore } from '@/store/courseStore'
import { useUIStore } from '@/store/uiStore'

const COURSE_IDS = ['italian-game']

export function CourseSelector() {
  const { course, loadCourse } = useCourseStore()
  const setView = useUIStore((s) => s.setView)

  useEffect(() => {
    loadCourse('italian-game')
  }, [loadCourse])

  const handleSelect = (courseId: string) => {
    loadCourse(courseId).then(() => {
      setView('variation-tree')
    })
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold text-slate-100 mb-2">
        Select a Course
      </h2>
      <p className="text-slate-400 mb-8">
        Choose an opening repertoire to study. Each course contains multiple lines
        you can learn and practice.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COURSE_IDS.map((id) => {
          const c = course?.id === id ? course : null
          return c ? (
            <CourseCard
              key={c.id}
              course={c}
              onSelect={() => handleSelect(c.id)}
            />
          ) : (
            <div
              key={id}
              className="p-6 rounded-xl bg-slate-800/40 border border-slate-700 animate-pulse"
            >
              <div className="h-5 bg-slate-600 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-600 rounded w-full mb-2" />
              <div className="h-4 bg-slate-600 rounded w-1/2" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
