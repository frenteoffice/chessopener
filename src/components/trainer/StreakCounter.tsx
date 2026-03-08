import { useTrainerStore } from '@/store/trainerStore'

export function StreakCounter() {
  const { mode, streak } = useTrainerStore()

  if (mode !== 'drill') return null

  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <span>Streak:</span>
      <span className="font-semibold text-amber-400">{streak}</span>
    </div>
  )
}
