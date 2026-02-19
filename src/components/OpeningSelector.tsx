import { openings } from '@/data/openings'
import { useGameStore } from '@/store/gameStore'
import type { OpeningData } from '@/types'

const whiteOpenings = openings.filter((o) => o.color === 'white')
const blackOpenings = openings.filter((o) => o.color === 'black')

function OpeningCard({
  opening,
  onSelect,
}: {
  opening: OpeningData
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="text-left w-full p-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-slate-200">{opening.name}</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-600 text-slate-300">
          {opening.difficulty}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-1">ECO {opening.eco} • {opening.color}</p>
      <p className="text-sm text-slate-300 line-clamp-2">{opening.description}</p>
    </button>
  )
}

export function OpeningSelector() {
  const { setOpeningId, resetGame, setPlayerColor } = useGameStore()

  const handleSelect = (opening: OpeningData) => {
    setOpeningId(opening.id)
    setPlayerColor(opening.color as 'white' | 'black')
    resetGame(opening.color as 'white' | 'black', opening.id)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-slate-100 mb-2">OpeningIQ</h1>
      <p className="text-slate-400 mb-8">
        Choose an opening to practice. You'll play as the opening's color against the engine.
      </p>

      <div className="mb-8">
        <h2 className="text-lg font-medium text-slate-300 mb-4">Playing as White</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {whiteOpenings.map((opening) => (
            <OpeningCard
              key={opening.id}
              opening={opening}
              onSelect={() => handleSelect(opening)}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-slate-300 mb-4">Playing as Black</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {blackOpenings.map((opening) => (
            <OpeningCard
              key={opening.id}
              opening={opening}
              onSelect={() => handleSelect(opening)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
