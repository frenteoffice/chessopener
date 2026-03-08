import { useEffect } from 'react'
import { Header } from './components/Header'
import { CourseSelector } from './components/course/CourseSelector'
import { VariationTreeView } from './components/tree/VariationTreeView'
import { TrainerView } from './components/trainer/TrainerView'
import { ProgressDashboard } from './components/progress/ProgressDashboard'
import { useUIStore } from './store/uiStore'
import { useCourseStore } from './store/courseStore'
import { useProgressStore } from './store/progressStore'

function AppV2() {
  const view = useUIStore((s) => s.view)
  const course = useCourseStore((s) => s.course)
  const loadCourse = useCourseStore((s) => s.loadCourse)
  const loadProgress = useProgressStore((s) => s.loadProgress)

  useEffect(() => {
    loadCourse('italian-game')
  }, [loadCourse])

  useEffect(() => {
    if (course?.id) {
      loadProgress(course.id)
    }
  }, [course?.id, loadProgress])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Header />
      <main>
        {view === 'course-selector' && <CourseSelector />}
        {view === 'variation-tree' && <VariationTreeView />}
        {view === 'trainer' && <TrainerView />}
        {view === 'progress' && <ProgressDashboard />}
      </main>
    </div>
  )
}

export default AppV2
