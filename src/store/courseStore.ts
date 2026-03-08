import { create } from 'zustand'
import type { Category, Line } from '@/types/course'
import type { TreeNode } from '@/services/VariationTreeBuilder'
import { buildVariationTree } from '@/services/VariationTreeBuilder'

import italianGame from '@/data/courses/italian-game.json'
import type { Course } from '@/types/course'

const COURSES: Record<string, Course> = {
  'italian-game': italianGame as Course,
}

async function loadCourseData(courseId: string): Promise<Course | null> {
  const course = COURSES[courseId] ?? null
  return course
}

interface CourseState {
  course: Course | null
  variationTree: TreeNode | null
  selectedCategoryId: string | null
  selectedLineId: string | null

  loadCourse: (courseId: string) => Promise<void>
  selectCategory: (categoryId: string) => void
  selectLine: (lineId: string) => void
  getLine: (lineId: string) => Line | undefined
  getCategory: (categoryId: string) => Category | undefined
  getLinesForCategory: (categoryId: string) => Line[]
}

export const useCourseStore = create<CourseState>((set, get) => ({
  course: null,
  variationTree: null,
  selectedCategoryId: null,
  selectedLineId: null,

  loadCourse: async (courseId: string) => {
    const course = await loadCourseData(courseId)
    if (!course) {
      set({ course: null, variationTree: null, selectedCategoryId: null, selectedLineId: null })
      return
    }
    const variationTree = buildVariationTree(course)
    set({
      course,
      variationTree,
      selectedCategoryId: course.categories[0]?.id ?? null,
      selectedLineId: course.categories[0]?.lines[0]?.id ?? null,
    })
  },

  selectCategory: (categoryId: string) => set({ selectedCategoryId: categoryId }),

  selectLine: (lineId: string) => set({ selectedLineId: lineId }),

  getLine: (lineId: string) => {
    const { course } = get()
    if (!course) return undefined
    for (const cat of course.categories) {
      const line = cat.lines.find((l) => l.id === lineId)
      if (line) return line
    }
    return undefined
  },

  getCategory: (categoryId: string) => {
    const { course } = get()
    return course?.categories.find((c) => c.id === categoryId)
  },

  getLinesForCategory: (categoryId: string) => {
    const cat = get().getCategory(categoryId)
    return cat?.lines ?? []
  },
}))
