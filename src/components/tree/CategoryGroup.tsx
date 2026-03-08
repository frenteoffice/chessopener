import { useState } from 'react'
import type { Category } from '@/types/course'
import { LineItem } from './LineItem'

interface CategoryGroupProps {
  category: Category
}

export function CategoryGroup({ category }: CategoryGroupProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border-b border-slate-700 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <span className="text-slate-200 font-medium text-sm">{category.name}</span>
        <span className="text-slate-500 text-xs">{category.lines.length} lines</span>
      </button>
      {expanded && (
        <div className="pb-2">
          {category.lines.map((line) => (
            <LineItem key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}
