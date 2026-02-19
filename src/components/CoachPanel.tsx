import { useState } from 'react'
import { MoveList } from './MoveList'
import { Commentary } from './Commentary'
import { MetricsDashboard } from './MetricsDashboard'
import { OpeningSummary } from './OpeningSummary'
import { useGameStore } from '@/store/gameStore'
import { openings } from '@/data/openings'

const BADGE_CONFIG = {
  'never-deviate': { color: 'bg-green-600', label: 'Never Deviate' },
  hybrid: { color: 'bg-purple-600', label: 'Hybrid' },
  'specific-defense': { color: 'bg-amber-500', label: 'Specific Defense' },
} as const

const STRUCTURE_LABELS: Record<string, string> = {
  'open-center': 'Open center',
  'closed-center': 'Closed center',
  'isolated-queens-pawn': 'Isolated queen\'s pawn',
  'hanging-pawns': 'Hanging pawns',
  'caro-kann-structure': 'Caro-Kann structure',
  'slav-structure': 'Slav structure',
  'french-structure': 'French structure',
  'kings-indian-structure': 'King\'s Indian structure',
  'london-structure': 'London structure',
  'sicilian-structure': 'Sicilian structure',
}

export function CoachPanel() {
  const {
    commentary,
    commentaryLoading,
    opponentIntelligence,
    selectedDefenseId,
    openingId,
    history,
    deviationDetected,
    deviationMove,
    detectedStructure,
    transpositionPending,
    transpositionOpening,
    acceptTransposition,
    declineTransposition,
  } = useGameStore()

  const [defenseProfileDismissed, setDefenseProfileDismissed] = useState(false)

  const currentOpening = openingId ? openings.find((o) => o.id === openingId) : null
  const selectedDefense = currentOpening?.defenses?.find((d) => d.id === selectedDefenseId)
  const badge = BADGE_CONFIG[opponentIntelligence]
  const badgeLabel =
    opponentIntelligence === 'specific-defense' && selectedDefense
      ? selectedDefense.name
      : badge.label

  const showDefenseProfile =
    opponentIntelligence === 'specific-defense' &&
    selectedDefense &&
    history.length === 0 &&
    !defenseProfileDismissed

  return (
    <div className="flex flex-col gap-6 w-80">
      <div className="flex justify-end">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium text-white ${badge.color}`}
          title={`Opponent mode: ${badgeLabel}`}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <MoveList />
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <MetricsDashboard />
      </div>

      {showDefenseProfile && selectedDefense && (
        <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-amber-200 text-sm font-medium">Defense Profile</h3>
            <button
              onClick={() => setDefenseProfileDismissed(true)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Dismiss
            </button>
          </div>
          <p className="text-slate-300 text-sm">{selectedDefense.profile}</p>
        </div>
      )}

      {transpositionPending && transpositionOpening && (
        <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600/50">
          <h3 className="text-purple-200 text-sm font-medium mb-2">Transposition Detected</h3>
          <p className="text-slate-300 text-sm mb-3">
            This position also arises in the <strong>{transpositionOpening.name}</strong>. Switch
            context?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                useGameStore.getState().setOpeningId(transpositionOpening.id)
                acceptTransposition()
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm text-white"
            >
              Yes, switch context
            </button>
            <button
              onClick={declineTransposition}
              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm text-slate-200"
            >
              No, keep current framing
            </button>
          </div>
        </div>
      )}

      {deviationDetected && (
        <div className="bg-purple-900/30 rounded-lg p-4 border-2 border-purple-500/50">
          <h3 className="text-purple-200 text-sm font-medium mb-2">Opponent Deviated</h3>
          <p className="text-slate-300 text-sm mb-2">
            The engine played <strong>{deviationMove}</strong>, leaving the opening book.
          </p>
          {detectedStructure && detectedStructure !== 'unknown' && (
            <p className="text-slate-400 text-xs mb-2">
              Structure: {STRUCTURE_LABELS[detectedStructure] ?? detectedStructure}
            </p>
          )}
          <p className="text-slate-400 text-xs">
            Consider how to adapt your plan to this new structure.
          </p>
        </div>
      )}

      <OpeningSummary />
      {(commentary || commentaryLoading) && !deviationDetected && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <Commentary />
        </div>
      )}
    </div>
  )
}
