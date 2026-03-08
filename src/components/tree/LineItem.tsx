import type { Line } from '@/types/course'
import { useProgressStore } from '@/store/progressStore'
import { useCourseStore } from '@/store/courseStore'
import { useTrainerStore } from '@/store/trainerStore'
import { useUIStore } from '@/store/uiStore'

interface LineItemProps {
  line: Line
}

export function LineItem({ line }: LineItemProps) {
  const confidence = useProgressStore((s) => s.getConfidence(line.id))
  const selectLine = useCourseStore((s) => s.selectLine)
  const startLine = useTrainerStore((s) => s.startLine)
  const setView = useUIStore((s) => s.setView)

  const handleClick = () => {
    selectLine(line.id)
    startLine(line.id, 'learn')
    setView('trainer')
  }

  return (
    <button
      onClick={handleClick}
      className="w-full px-3 py-2 rounded-lg hover:bg-slate-700/50 text-left transition-colors flex items-center gap-2"
    >
      <span className="text-slate-400 text-xs w-6">#{line.lineNumber}</span>
      <span className="text-slate-200 text-sm flex-1 truncate">{line.name}</span>
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
        <div
          className={`h-full ${
            confidence >= 80
              ? 'bg-emerald-500'
              : confidence >= 50
                ? 'bg-amber-500'
                : confidence > 0
                  ? 'bg-orange-500'
                  : 'bg-slate-600'
          }`}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </button>
  )
}
