import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'

function GenericAbandonmentFallback({
  deviationMove,
  onDismiss,
}: {
  deviationMove: string | null
  onDismiss: () => void
}) {
  return (
    <div className="bg-purple-900/30 rounded-lg p-4 border-2 border-purple-500/50">
      <p className="text-slate-300 text-sm mb-3">
        {deviationMove
          ? `Your opponent left the book with ${deviationMove}. The opening theory has ended — you're now in uncharted territory. Focus on sound development and central control.`
          : 'Your opponent left the book. The opening theory has ended — focus on sound development and central control.'}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm text-slate-200"
        aria-label="Dismiss book abandonment explanation"
      >
        Got it
      </button>
    </div>
  )
}

export function BookAbandonmentPanel() {
  const { deviationDetected, deviationMove, openingId, openings } = useGameStore()
  const [dismissed, setDismissed] = useState(false)

  if (!deviationDetected) return null
  if (!openingId) return null

  const opening = openings.find((o) => o.id === openingId)
  const explanation = opening?.abandonmentExplanation

  if (!explanation) {
    if (dismissed) {
      return (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="text-purple-300 hover:text-purple-200 text-sm underline"
          data-testid="replay-abandonment"
        >
          Why did the book end?
        </button>
      )
    }
    return (
      <GenericAbandonmentFallback
        deviationMove={deviationMove}
        onDismiss={() => setDismissed(true)}
      />
    )
  }

  const reason =
    explanation.reasons[deviationMove ?? 'default'] ?? explanation.reasons['default']

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="text-purple-300 hover:text-purple-200 text-sm underline"
        data-testid="replay-abandonment"
      >
        Why did the book end?
      </button>
    )
  }

  if (!reason) {
    return (
      <GenericAbandonmentFallback
        deviationMove={deviationMove}
        onDismiss={() => setDismissed(true)}
      />
    )
  }

  return (
    <div className="bg-purple-900/30 rounded-lg p-4 border-2 border-purple-500/50 space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="text-purple-200 text-sm font-medium">Book Abandonment</h3>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
          aria-label="Dismiss book abandonment explanation"
        >
          Got it
        </button>
      </div>

      <section data-testid="section-what-happened">
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">What happened</h4>
        <p className="text-slate-200 text-sm">{reason.opponentMoveSummary}</p>
      </section>

      <section data-testid="section-why-breaks">
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">
          Why this breaks the book
        </h4>
        <p className="text-slate-200 text-sm">{reason.whyBookBreaks}</p>
      </section>

      <section data-testid="section-opponent-strategy">
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">
          Your opponent&apos;s approach
        </h4>
        <p className="text-slate-200 text-sm">{reason.opponentStrategy}</p>
      </section>

      <section data-testid="section-forward-guidance">
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">
          What to focus on now
        </h4>
        <ul className="list-disc list-inside text-slate-200 text-sm space-y-1">
          {reason.forwardGuidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
