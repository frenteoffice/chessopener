import { useTrainerStore } from '@/store/trainerStore'

export function FeedbackBanner() {
  const lastMoveCorrect = useTrainerStore((s) => s.lastMoveCorrect)

  if (lastMoveCorrect === null) return null

  return (
    <div
      className={`px-4 py-2 rounded-lg text-sm font-medium ${
        lastMoveCorrect
          ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-600/50'
          : 'bg-red-900/60 text-red-200 border border-red-600/50'
      }`}
    >
      {lastMoveCorrect ? 'Correct!' : 'Incorrect — try again.'}
    </div>
  )
}
