import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OpeningSummary } from '@/components/OpeningSummary'
import type { Strategy, QuizOption, OpeningData } from '@/types'

// ---------------------------------------------------------------------------
// Mock the game store
// ---------------------------------------------------------------------------

const mockStoreState: Record<string, unknown> = {}

vi.mock('@/store/gameStore', () => ({
  useGameStore: () => mockStoreState,
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const quizOptions: [QuizOption, QuizOption, QuizOption] = [
  { id: 'a', text: 'Option A', correct: false, explanation: 'Wrong.' },
  { id: 'b', text: 'Option B', correct: true, explanation: 'Correct.' },
  { id: 'c', text: 'Option C', correct: false, explanation: 'Wrong.' },
]

const strategy: Strategy = {
  positionTypes: ['semi-closed', 'positional'],
  keyIdea: 'Develop pieces toward the center.',
  middleGamePlan: 'Build a strong pawn center.',
  watchOut: 'Rushing an attack before completing development.',
  typicalGoals: ['Castle kingside', 'Play c3 and d4'],
  quiz: { question: 'What is your primary goal?', options: quizOptions },
}

const whiteOpening: OpeningData = {
  id: 'italian-game',
  name: 'Italian Game',
  eco: 'C50',
  color: 'white',
  difficulty: 'beginner',
  description: 'Classical opening.',
  moves: [],
  strategy,
}

const blackOpening: OpeningData = {
  id: 'sicilian-najdorf',
  name: 'Sicilian Najdorf',
  eco: 'B90',
  color: 'black',
  difficulty: 'intermediate',
  description: 'Sharp defense.',
  moves: [],
  strategy,
}

function makeActiveState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    phase: 'free',
    openingId: 'italian-game',
    openings: [whiteOpening],
    history: [{ san: 'e4', fen: 'fen1', color: 'w', inTheory: true }],
    playerColor: 'white',
    ...overrides,
  }
}

beforeEach(() => {
  Object.keys(mockStoreState).forEach((k) => delete mockStoreState[k])
})

function setStore(state: Record<string, unknown>) {
  Object.assign(mockStoreState, state)
}

// ---------------------------------------------------------------------------
// Section 1 — Color parity
// ---------------------------------------------------------------------------

describe('OpeningSummary — color parity', () => {
  it('all strategy sections render when playerColor is white', () => {
    setStore(makeActiveState({ playerColor: 'white' }))
    render(<OpeningSummary />)
    expect(screen.getByText(strategy.keyIdea)).toBeInTheDocument()
    expect(screen.getByText(strategy.middleGamePlan)).toBeInTheDocument()
    expect(screen.getByText(strategy.watchOut)).toBeInTheDocument()
    for (const goal of strategy.typicalGoals) {
      expect(screen.getByText(goal)).toBeInTheDocument()
    }
    expect(screen.getByText(strategy.quiz.question)).toBeInTheDocument()
  })

  it('all strategy sections render when playerColor is black', () => {
    setStore(makeActiveState({
      playerColor: 'black',
      openingId: 'sicilian-najdorf',
      openings: [blackOpening],
    }))
    render(<OpeningSummary />)
    expect(screen.getByText(strategy.keyIdea)).toBeInTheDocument()
    expect(screen.getByText(strategy.middleGamePlan)).toBeInTheDocument()
    expect(screen.getByText(strategy.watchOut)).toBeInTheDocument()
    for (const goal of strategy.typicalGoals) {
      expect(screen.getByText(goal)).toBeInTheDocument()
    }
    expect(screen.getByText(strategy.quiz.question)).toBeInTheDocument()
  })

  it('section headings are identical between White and Black renders', () => {
    setStore(makeActiveState({ playerColor: 'white' }))
    const { unmount } = render(<OpeningSummary />)
    const whiteHeadings = ['KEY IDEA', 'MIDDLEGAME PLAN', 'WATCH OUT', 'TYPICAL GOALS', 'QUICK CHECK']

    unmount()
    setStore(makeActiveState({
      playerColor: 'black',
      openingId: 'sicilian-najdorf',
      openings: [blackOpening],
    }))
    render(<OpeningSummary />)

    for (const heading of whiteHeadings) {
      expect(screen.getByText(heading)).toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// Section 2 — Data parity
// ---------------------------------------------------------------------------

describe('OpeningSummary — data parity', () => {
  it('every opening JSON (color = white) has a strategy field', async () => {
    const { openings } = await import('@/data/openings')
    const whiteOpenings = openings.filter((o) => o.color === 'white')
    for (const opening of whiteOpenings) {
      expect(opening.strategy, `${opening.id} (white) should have strategy`).toBeDefined()
    }
  })

  it('every opening JSON (color = black) has a strategy field', async () => {
    const { openings } = await import('@/data/openings')
    const blackOpenings = openings.filter((o) => o.color === 'black')
    for (const opening of blackOpenings) {
      expect(opening.strategy, `${opening.id} (black) should have strategy`).toBeDefined()
    }
  })

  it('all openings regardless of color field have non-empty keyIdea', async () => {
    const { openings } = await import('@/data/openings')
    for (const opening of openings) {
      if (!opening.strategy) continue
      expect(
        opening.strategy.keyIdea.trim(),
        `${opening.id} keyIdea should not be empty`
      ).not.toBe('')
    }
  })
})
