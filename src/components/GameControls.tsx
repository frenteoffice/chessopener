import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { openings } from '@/data/openings'
import type { OpponentIntelligenceMode } from '@/types'

const ELO_OPTIONS = [800, 1000, 1200, 1400, 1600, 1800, 2000]

const MODE_TOOLTIP = `Never Deviate: Engine strictly follows the opening tree.
Hybrid: Engine deviates ~25% of the time to teach recovery.
Specific Defense: Engine plays one chosen defense variation.`

export function GameControls() {
  const {
    engineElo,
    setEngineElo,
    playerColor,
    resetGame,
    boardFlipped,
    setBoardFlipped,
    opponentIntelligence,
    setOpponentIntelligence,
    selectedDefenseId,
    setSelectedDefense,
    history,
    openingId,
  } = useGameStore()

  const [showModeTooltip, setShowModeTooltip] = useState(false)
  const gameHasStarted = history.length > 0

  const currentOpening = openingId ? openings.find((o) => o.id === openingId) : null
  const currentOpeningDefenses = currentOpening?.defenses ?? []

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <label htmlFor="opponent-intelligence" className="text-sm text-slate-400">
          Opponent Intelligence:
        </label>
        <div className="relative flex items-center gap-1">
          <select
            id="opponent-intelligence"
            value={opponentIntelligence}
            onChange={(e) => setOpponentIntelligence(e.target.value as OpponentIntelligenceMode)}
            disabled={gameHasStarted}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="never-deviate">Never Deviate</option>
            <option value="hybrid">Hybrid</option>
            <option value="specific-defense">Specific Defense</option>
          </select>
          <button
            type="button"
            onClick={() => setShowModeTooltip(!showModeTooltip)}
            className="text-slate-400 hover:text-slate-200 text-sm"
            title="Info"
            aria-label="Opponent Intelligence info"
          >
            ℹ️
          </button>
          {showModeTooltip && (
            <div className="absolute left-0 top-full mt-1 z-10 p-3 bg-slate-800 border border-slate-600 rounded shadow-lg text-xs text-slate-300 max-w-xs whitespace-pre-line">
              {MODE_TOOLTIP}
            </div>
          )}
        </div>
      </div>
      {opponentIntelligence === 'specific-defense' && (
        <div className="flex items-center gap-2">
          <label htmlFor="defense" className="text-sm text-slate-400">
            Defense:
          </label>
          <select
            id="defense"
            value={selectedDefenseId ?? ''}
            onChange={(e) => setSelectedDefense(e.target.value || null)}
            disabled={gameHasStarted}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select defense...</option>
            {currentOpeningDefenses.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
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
        onClick={() => setBoardFlipped(!boardFlipped)}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
      >
        Flip Board
      </button>
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
