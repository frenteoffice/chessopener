import { useGameStore } from '@/store/gameStore'

const ELO_OPTIONS = [800, 1000, 1200, 1400, 1600, 1800, 2000]

export function GameControls() {
  const { engineElo, setEngineElo, playerColor, resetGame } = useGameStore()

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <label htmlFor="elo" className="text-sm text-slate-400">
          Engine ELO:
        </label>
        <select
          id="elo"
          value={engineElo}
          onChange={(e) => setEngineElo(Number(e.target.value))}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm"
        >
          {ELO_OPTIONS.map((elo) => (
            <option key={elo} value={elo}>
              {elo}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => resetGame(playerColor)}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
      >
        New Game
      </button>
      <button
        onClick={() => useGameStore.getState().setView('selector')}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
      >
        Change Opening
      </button>
    </div>
  )
}
