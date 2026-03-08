import { useState, useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { QuizOption } from '@/types'

const TAG_CLASSES: Record<string, string> = {
  closed: 'bg-slate-600/50 text-slate-200',
  open: 'bg-green-600/50 text-green-200',
  'semi-open': 'bg-blue-600/50 text-blue-200',
  'semi-closed': 'bg-purple-600/50 text-purple-200',
  dynamic: 'bg-amber-600/50 text-amber-200',
  tactical: 'bg-red-600/50 text-red-200',
  positional: 'bg-indigo-600/50 text-indigo-200',
  attacking: 'bg-orange-600/50 text-orange-200',
  defensive: 'bg-teal-600/50 text-teal-200',
}

function getTagClass(tag: string): string {
  return TAG_CLASSES[tag] ?? 'bg-slate-600/50 text-slate-200'
}

export function OpeningSummary() {
  const { phase, openingId, history, openings } = useGameStore()
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedOptionId(null)
  }, [openingId])

  if (phase !== 'free' || !openingId || history.length === 0) return null

  const opening = openings.find((o) => o.id === openingId)
  if (!opening) return null

  const { strategy } = opening

  // Fallback when strategy is absent
  if (!strategy) {
    return (
      <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50">
        <h3 className="text-amber-200 text-sm font-medium mb-3">Opening Complete</h3>
        <div className="space-y-2">
          <div>
            <span className="text-slate-400 text-xs uppercase tracking-wider">Opening</span>
            <p className="text-slate-200 text-sm font-medium">{opening.name}</p>
          </div>
          <p className="text-slate-400 text-xs pt-1">
            Continue playing against the engine to apply what you've learned.
          </p>
        </div>
      </div>
    )
  }

  const isQuizLocked = selectedOptionId !== null
  const selectedOption = strategy.quiz.options.find((o) => o.id === selectedOptionId)

  return (
    <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50 space-y-4">
      <div>
        <h3 className="text-amber-200 text-sm font-medium mb-1">
          Opening Complete — {opening.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">ECO: {opening.eco}</span>
          <span className="text-slate-500">·</span>
          {strategy.positionTypes.map((tag) => (
            <span
              key={tag}
              className={`px-2 py-0.5 rounded ${getTagClass(tag)}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <section>
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">KEY IDEA</h4>
        <p className="text-slate-200 text-sm">{strategy.keyIdea}</p>
      </section>

      <section>
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">
          MIDDLEGAME PLAN
        </h4>
        <p className="text-slate-200 text-sm">{strategy.middleGamePlan}</p>
      </section>

      <section>
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">WATCH OUT</h4>
        <p className="text-slate-200 text-sm">{strategy.watchOut}</p>
      </section>

      <section>
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">
          TYPICAL GOALS
        </h4>
        <ul className="list-disc list-inside text-slate-200 text-sm space-y-1">
          {strategy.typicalGoals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">QUICK CHECK</h4>
        <p className="text-slate-200 text-sm mb-3">{strategy.quiz.question}</p>
        <div className="space-y-2">
          {strategy.quiz.options.map((option) => (
            <QuizOptionButton
              key={option.id}
              option={option}
              selected={selectedOptionId === option.id}
              locked={isQuizLocked}
              onSelect={() => {
                if (!isQuizLocked) setSelectedOptionId(option.id)
              }}
            />
          ))}
        </div>
        {selectedOption && (
          <p
            className="mt-3 text-sm text-slate-300"
            data-testid="quiz-explanation"
          >
            {selectedOption.explanation}
          </p>
        )}
      </section>
    </div>
  )
}

interface QuizOptionButtonProps {
  option: QuizOption
  selected: boolean
  locked: boolean
  onSelect: () => void
}

function QuizOptionButton({ option, selected, locked, onSelect }: QuizOptionButtonProps) {
  const isCorrect = option.correct
  const showResult = selected && locked

  const buttonClasses = [
    'w-full text-left px-3 py-2 rounded border text-sm transition-colors',
    'border-slate-600 bg-slate-800/50 text-slate-200',
    'hover:border-slate-500 hover:bg-slate-700/50',
    'disabled:cursor-not-allowed disabled:opacity-80',
  ]

  if (showResult) {
    if (isCorrect) {
      buttonClasses.push('border-green-600 bg-green-900/30 text-green-200')
    } else {
      buttonClasses.push('border-red-600 bg-red-900/30 text-red-200')
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={locked}
      className={buttonClasses.join(' ')}
      data-correct={showResult ? String(isCorrect) : undefined}
      aria-selected={showResult ? isCorrect : undefined}
    >
      {option.text}
    </button>
  )
}
