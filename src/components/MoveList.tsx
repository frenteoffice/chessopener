import { useGameStore } from '@/store/gameStore'
import { openings } from '@/data/openings'

export function MoveList() {
  const {
    phase,
    openingNode,
    history,
    setPendingMove,
    engineThinking,
    opponentIntelligence,
    selectedDefenseId,
    openingId,
  } = useGameStore()

  const currentOpening = openingId ? openings.find((o) => o.id === openingId) : null
  const selectedDefense =
    opponentIntelligence === 'specific-defense' && selectedDefenseId
      ? currentOpening?.defenses?.find((d) => d.id === selectedDefenseId)
      : null

  const isPlayerTurn = !engineThinking

  const theoryMoves: string[] = []
  if (phase === 'opening' && openingNode) {
    if (openingNode.children && openingNode.children.length > 0) {
      openingNode.children.forEach((child) => {
        theoryMoves.push(child.san)
      })
    }
  }

  return (
    <div className="space-y-3">
      {phase === 'opening' && (
        <div>
          <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
            Book Moves
          </h3>
          {selectedDefense && (
            <div className="text-sm text-gray-400 mb-2">{selectedDefense.name}</div>
          )}
          {theoryMoves.length > 0 && isPlayerTurn ? (
            <div className="flex flex-wrap gap-2">
              {theoryMoves.map((san) => (
                <button
                  key={san}
                  onClick={() => setPendingMove(san)}
                  disabled={engineThinking}
                  className="px-3 py-1 rounded bg-emerald-800/60 hover:bg-emerald-700/70 border border-emerald-600/50 text-emerald-200 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {san}
                </button>
              ))}
            </div>
          ) : engineThinking ? (
            <p className="text-slate-500 text-sm">Engine is thinking...</p>
          ) : theoryMoves.length === 0 ? (
            <p className="text-slate-500 text-sm">End of book — engine now plays freely.</p>
          ) : null}
        </div>
      )}

      {phase === 'free' && (
        <div>
          <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
            Book Moves
          </h3>
          <p className="text-amber-400/80 text-sm">
            You've left the book. The engine is now playing at your selected ELO.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 mt-2">
            Moves Played
          </h3>
          <div className="flex flex-wrap gap-x-2 gap-y-1 max-h-28 overflow-y-auto">
            {history.map((move, index) => (
              <span
                key={`${index}-${move.san}`}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  move.inTheory === false
                    ? 'bg-amber-900/40 text-amber-300'
                    : 'bg-slate-700/40 text-slate-400'
                }`}
              >
                {index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}
                {move.san}
              </span>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && phase === 'opening' && theoryMoves.length === 0 && (
        <p className="text-slate-500 text-sm py-2">Make your first move to begin.</p>
      )}
    </div>
  )
}
