import { useTrainerStore } from '@/store/trainerStore'

export function TimerBar() {
  const { mode, timeRemaining, timerRunning } = useTrainerStore()

  if (mode !== 'time-trial') return null

  const maxTime = 60
  const pct = maxTime > 0 ? (timeRemaining / maxTime) * 100 : 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm text-slate-400">
        <span>{timerRunning ? 'Time remaining' : 'Paused'}</span>
        <span className="font-mono font-medium">{timeRemaining}s</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            pct < 20 ? 'bg-red-500' : pct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
