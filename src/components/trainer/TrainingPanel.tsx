import { LineHeader } from './LineHeader'
import { MoveExplanation } from './MoveExplanation'
import { TrainerMoveList } from './TrainerMoveList'
import { FeedbackBanner } from './FeedbackBanner'
import { HintButton } from './HintButton'
import { StreakCounter } from './StreakCounter'
import { TimerBar } from './TimerBar'
import { LineControls } from './LineControls'
import { useTrainerStore } from '@/store/trainerStore'

export function TrainingPanel() {
  const { activeLine, currentPly } = useTrainerStore()

  const isLineComplete =
    activeLine && currentPly >= activeLine.moves.length

  return (
    <div className="flex flex-col gap-6 w-80">
      <LineHeader />
      <MoveExplanation />
      <TrainerMoveList />
      <FeedbackBanner />
      <div className="flex items-center gap-2">
        <HintButton />
        <StreakCounter />
      </div>
      <TimerBar />
      {isLineComplete && (
        <div className="bg-emerald-900/30 rounded-lg p-4 border border-emerald-600/50">
          <p className="text-emerald-200 text-sm font-medium mb-2">Line Complete!</p>
          <p className="text-slate-400 text-xs mb-3">
            Great job. Retry to reinforce or move to the next line.
          </p>
          <LineControls />
        </div>
      )}
      {!isLineComplete && <LineControls />}
    </div>
  )
}
