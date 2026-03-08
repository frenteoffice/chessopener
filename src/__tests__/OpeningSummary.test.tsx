import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OpeningSummary } from '@/components/OpeningSummary'
import type { Strategy, Quiz, QuizOption, OpeningData } from '@/types'

// ---------------------------------------------------------------------------
// Mock the game store — individual tests override what they need
// ---------------------------------------------------------------------------

const mockStoreState: Record<string, unknown> = {}

vi.mock('@/store/gameStore', () => ({
  useGameStore: () => mockStoreState,
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const quizOptions: [QuizOption, QuizOption, QuizOption] = [
  {
    id: 'a',
    text: 'Launch an immediate kingside pawn storm with f4-f5',
    correct: false,
    explanation: 'The Italian is a positional opening — finish development before attacking.',
  },
  {
    id: 'b',
    text: 'Play c3 and d4 to establish a strong pawn center',
    correct: true,
    explanation: 'Correct. The c3-d4 break seizes central space and activates your pieces.',
  },
  {
    id: 'c',
    text: 'Trade your bishop for the opponent\'s knight to simplify',
    correct: false,
    explanation: 'Your bishop on c4 is one of your best pieces — keep it active.',
  },
]

const quiz: Quiz = {
  question: "You've just finished the Italian Game opening. What's your primary middlegame goal?",
  options: quizOptions,
}

const strategy: Strategy = {
  positionTypes: ['semi-closed', 'positional'],
  keyIdea: 'Develop pieces toward the center and target the vulnerable f7 pawn.',
  middleGamePlan: 'After castling kingside, aim to build a strong pawn center with c3 and d4.',
  watchOut: 'Rushing an attack before completing development.',
  typicalGoals: [
    'Castle kingside early to connect rooks',
    'Play c3 followed by d4 to challenge the center',
    'Keep your bishop on c4 active and pointed at f7',
    'Coordinate knights toward outpost squares on d5 or f5',
  ],
  quiz,
}

const italianGameOpening: OpeningData = {
  id: 'italian-game',
  name: 'Italian Game',
  eco: 'C50',
  color: 'white',
  difficulty: 'beginner',
  description: 'One of the oldest and most classical openings.',
  moves: [],
  strategy,
}

const italianGameNoStrategy: OpeningData = {
  id: 'italian-game',
  name: 'Italian Game',
  eco: 'C50',
  color: 'white',
  difficulty: 'beginner',
  description: 'One of the oldest and most classical openings.',
  moves: [],
}

// Second opening for CO-1 test (quiz state reset on opening change)
const ruyLopezQuizOptions: [QuizOption, QuizOption, QuizOption] = [
  { id: 'a', text: 'Trade the bishop', correct: false, explanation: 'Wrong.' },
  { id: 'b', text: 'Retreat to b3', correct: true, explanation: 'Correct.' },
  { id: 'c', text: 'Ignore it', correct: false, explanation: 'Wrong.' },
]
const ruyLopezOpening: OpeningData = {
  id: 'ruy-lopez',
  name: 'Ruy Lopez',
  eco: 'C60',
  color: 'white',
  difficulty: 'intermediate',
  description: 'Classical opening.',
  moves: [],
  strategy: {
    ...strategy,
    quiz: { question: 'Ruy Lopez question?', options: ruyLopezQuizOptions },
  },
}

// Base store state that puts the component into "should render" mode
function makeActiveState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    phase: 'free',
    openingId: 'italian-game',
    openings: [italianGameOpening],
    history: [{ san: 'e4', fen: 'fen1', color: 'w', inTheory: true }],
    playerColor: 'white',
    evaluation: null,
    ...overrides,
  }
}

beforeEach(() => {
  // Reset mock state before each test
  Object.keys(mockStoreState).forEach((k) => delete mockStoreState[k])
})

function setStore(state: Record<string, unknown>) {
  Object.assign(mockStoreState, state)
}

// ---------------------------------------------------------------------------
// Section 1 — Conditional rendering
// ---------------------------------------------------------------------------

describe('OpeningSummary — conditional rendering', () => {
  it('does not render when phase is "opening"', () => {
    setStore(makeActiveState({ phase: 'opening' }))
    const { container } = render(<OpeningSummary />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when phase is "free" but openingId is null', () => {
    setStore(makeActiveState({ openingId: null }))
    const { container } = render(<OpeningSummary />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when phase is "free" and openingId is set but history is empty', () => {
    setStore(makeActiveState({ history: [] }))
    const { container } = render(<OpeningSummary />)
    expect(container.firstChild).toBeNull()
  })

  it('renders when phase is "free" and openingId is set', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    expect(screen.getByText(/Opening Complete/i)).toBeDefined()
  })

  it('renders the formatted opening name', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    expect(screen.getByRole('heading', { name: /Opening Complete.*Italian Game/ })).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Section 2 — Strategy content rendering
// ---------------------------------------------------------------------------

describe('OpeningSummary — strategy content', () => {
  it('renders keyIdea text when strategy is present', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    expect(screen.getByText(strategy.keyIdea)).toBeDefined()
  })

  it('renders middleGamePlan text when strategy is present', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    expect(screen.getByText(strategy.middleGamePlan)).toBeDefined()
  })

  it('renders watchOut text when strategy is present', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    expect(screen.getByText(strategy.watchOut)).toBeDefined()
  })

  it('renders all typicalGoals as list items when strategy is present', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    for (const goal of strategy.typicalGoals) {
      expect(screen.getByText(goal)).toBeDefined()
    }
  })

  it('renders all position type tags', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    expect(screen.getByText('semi-closed')).toBeDefined()
    expect(screen.getByText('positional')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Section 3 — Fallback when strategy is absent
// ---------------------------------------------------------------------------

describe('OpeningSummary — fallback without strategy', () => {
  it('renders without crashing when strategy is absent', () => {
    setStore(makeActiveState({ openings: [italianGameNoStrategy] }))
    expect(() => render(<OpeningSummary />)).not.toThrow()
  })

  it('still renders the opening name when strategy is absent', () => {
    setStore(makeActiveState({ openings: [italianGameNoStrategy] }))
    render(<OpeningSummary />)
    expect(screen.getByText(/Italian Game/)).toBeDefined()
  })

  it('does not render strategy sections when strategy is absent', () => {
    setStore(makeActiveState({ openings: [italianGameNoStrategy] }))
    render(<OpeningSummary />)
    expect(screen.queryByText(/KEY IDEA/i)).toBeNull()
    expect(screen.queryByText(/MIDDLEGAME PLAN/i)).toBeNull()
    expect(screen.queryByText(/WATCH OUT/i)).toBeNull()
    expect(screen.queryByText(/TYPICAL GOALS/i)).toBeNull()
    expect(screen.queryByText(/QUICK CHECK/i)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Section 4 — Quiz rendering
// ---------------------------------------------------------------------------

describe('OpeningSummary — quiz rendering', () => {
  it('renders the quiz question when strategy is present', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    expect(screen.getByText(quiz.question)).toBeDefined()
  })

  it('renders exactly 3 quiz options', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    const optionTexts = quizOptions.map((o) => o.text)
    const rendered = optionTexts.filter((t) => screen.queryByText(t) !== null)
    expect(rendered).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Section 5 — Quiz interactivity
// ---------------------------------------------------------------------------

describe('OpeningSummary — quiz interaction', () => {
  it('quiz options are interactive before any selection', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    // All three option buttons should be present and not disabled
    for (const option of quizOptions) {
      const el = screen.getByText(option.text).closest('button')
      expect(el).not.toBeNull()
      expect((el as HTMLButtonElement).disabled).toBe(false)
    }
  })

  it('selecting an option displays the explanation for that option', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    const optionA = screen.getByText(quizOptions[0].text)
    fireEvent.click(optionA)
    expect(screen.getByText(quizOptions[0].explanation)).toBeDefined()
  })

  it('selecting the correct option applies a correct visual state', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    const correctOption = screen.getByText(quizOptions[1].text)
    fireEvent.click(correctOption)
    const button = correctOption.closest('button')
    // The correct button should have a "correct" indicator — check for green class or aria attribute
    expect(
      button?.classList.toString().includes('green') ||
        button?.getAttribute('data-correct') === 'true' ||
        button?.getAttribute('aria-selected') === 'true'
    ).toBe(true)
  })

  it('selecting an incorrect option applies an incorrect visual state', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    const incorrectOption = screen.getByText(quizOptions[0].text)
    fireEvent.click(incorrectOption)
    const button = incorrectOption.closest('button')
    // The incorrect button should have a "wrong" indicator — check for red class or aria attribute
    expect(
      button?.classList.toString().includes('red') ||
        button?.getAttribute('data-correct') === 'false' ||
        button?.getAttribute('aria-selected') === 'false'
    ).toBe(true)
  })

  it('after selection, all options become non-interactive', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    const optionA = screen.getByText(quizOptions[0].text)
    fireEvent.click(optionA)
    for (const option of quizOptions) {
      const el = screen.getByText(option.text).closest('button')
      expect(el).not.toBeNull()
      expect((el as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('shows explanation only for the selected option, not others', () => {
    setStore(makeActiveState())
    render(<OpeningSummary />)
    // Select option A (incorrect)
    fireEvent.click(screen.getByText(quizOptions[0].text))
    expect(screen.getByText(quizOptions[0].explanation)).toBeDefined()
    expect(screen.queryByText(quizOptions[1].explanation)).toBeNull()
    expect(screen.queryByText(quizOptions[2].explanation)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Section 6 — Quiz state reset on remount
// ---------------------------------------------------------------------------

describe('OpeningSummary — quiz state reset', () => {
  it('quiz state resets when the component unmounts and remounts', () => {
    setStore(makeActiveState())

    const { unmount } = render(<OpeningSummary />)
    // Select an option
    fireEvent.click(screen.getByText(quizOptions[0].text))
    // Confirm explanation is visible
    expect(screen.getByText(quizOptions[0].explanation)).toBeDefined()

    unmount()

    // Remount — should be a fresh quiz with no explanation visible
    render(<OpeningSummary />)
    expect(screen.queryByText(quizOptions[0].explanation)).toBeNull()
    // Options should be interactive again
    const button = screen.getByText(quizOptions[0].text).closest('button')
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('quiz state resets when openingId changes without unmounting', () => {
    setStore(makeActiveState({ openings: [italianGameOpening, ruyLopezOpening] }))
    const { rerender } = render(<OpeningSummary />)

    // Select an option (Italian Game quiz)
    fireEvent.click(screen.getByText(quizOptions[0].text))
    expect(screen.getByText(quizOptions[0].explanation)).toBeDefined()

    // Switch to different opening without unmounting
    setStore(makeActiveState({ openingId: 'ruy-lopez', openings: [italianGameOpening, ruyLopezOpening] }))
    rerender(<OpeningSummary />)

    // Italian explanation should be gone; Ruy Lopez quiz should be fresh and interactive
    expect(screen.queryByText(quizOptions[0].explanation)).toBeNull()
    const button = screen.getByText(ruyLopezQuizOptions[0].text).closest('button')
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Section 7 — Data validation (opening JSON files)
// ---------------------------------------------------------------------------

describe('Opening JSON strategy data validation', () => {
  // Dynamically import all openings to validate their strategy fields
  it('each opening with a strategy field has exactly 3 quiz options', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.strategy) continue
      expect(
        opening.strategy.quiz.options,
        `${opening.id} quiz should have exactly 3 options`
      ).toHaveLength(3)
    }
  })

  it('each opening with a strategy field has exactly one correct quiz option', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.strategy) continue
      const correctCount = opening.strategy.quiz.options.filter(
        (o: QuizOption) => o.correct
      ).length
      expect(
        correctCount,
        `${opening.id} quiz should have exactly 1 correct option, found ${correctCount}`
      ).toBe(1)
    }
  })

  it('each opening with a strategy field has at least 1 positionType tag', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.strategy) continue
      expect(
        opening.strategy.positionTypes.length,
        `${opening.id} should have at least 1 positionType`
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('each opening with a strategy field has between 3 and 4 typicalGoals', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.strategy) continue
      const goalCount = opening.strategy.typicalGoals.length
      expect(
        goalCount >= 3 && goalCount <= 4,
        `${opening.id} should have 3-4 typicalGoals, found ${goalCount}`
      ).toBe(true)
    }
  })

  it('each opening with a strategy field has non-empty required text fields', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.strategy) continue
      expect(opening.strategy.keyIdea.trim(), `${opening.id} keyIdea should not be empty`).not.toBe('')
      expect(opening.strategy.middleGamePlan.trim(), `${opening.id} middleGamePlan should not be empty`).not.toBe('')
      expect(opening.strategy.watchOut.trim(), `${opening.id} watchOut should not be empty`).not.toBe('')
      expect(opening.strategy.quiz.question.trim(), `${opening.id} quiz question should not be empty`).not.toBe('')
    }
  })

  it('each quiz option has non-empty id, text, and explanation', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.strategy) continue
      for (const option of opening.strategy.quiz.options) {
        expect(option.id.trim(), `${opening.id} option id should not be empty`).not.toBe('')
        expect(option.text.trim(), `${opening.id} option text should not be empty`).not.toBe('')
        expect(option.explanation.trim(), `${opening.id} option explanation should not be empty`).not.toBe('')
      }
    }
  })

  it('each opening that has abandonmentExplanation has a default key in reasons', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.abandonmentExplanation) continue
      expect(
        opening.abandonmentExplanation.reasons['default'],
        `${opening.id} abandonmentExplanation should have a 'default' key in reasons`
      ).toBeDefined()
    }
  })

  it('each AbandonmentReason in all openings has forwardGuidance with >= 2 items', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.abandonmentExplanation) continue
      for (const [key, reason] of Object.entries(opening.abandonmentExplanation.reasons)) {
        expect(
          reason.forwardGuidance.length,
          `${opening.id} abandonment reason "${key}" should have >= 2 forwardGuidance items`
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
