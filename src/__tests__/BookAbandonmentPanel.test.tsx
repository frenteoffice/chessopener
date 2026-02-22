import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BookAbandonmentPanel } from '@/components/BookAbandonmentPanel'
import type { OpeningData, AbandonmentReason } from '@/types'

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

const defaultReason: AbandonmentReason = {
  opponentMoveSummary: 'Your opponent stepped off the main theory line with an unusual move.',
  whyBookBreaks: 'The standard line assumes a particular pawn or piece configuration that this move bypasses.',
  opponentStrategy: 'Your opponent is trying to reach a less-charted position.',
  forwardGuidance: [
    'Prioritize completing your development.',
    'Control the center with pawns or piece pressure.',
  ],
}

const nf6Reason: AbandonmentReason = {
  opponentMoveSummary: 'Black played Nf6, developing the knight to a flexible square.',
  whyBookBreaks: 'The main line assumed a different knight development.',
  opponentStrategy: 'Black is opting for the Indian Defense setup.',
  forwardGuidance: [
    'Consider d4 to challenge the center.',
    'Develop your remaining pieces before committing.',
  ],
}

const openingWithExplanation: OpeningData = {
  id: 'italian-game',
  name: 'Italian Game',
  eco: 'C50',
  color: 'white',
  difficulty: 'beginner',
  description: 'Classical opening.',
  moves: [],
  abandonmentExplanation: {
    reasons: {
      default: defaultReason,
      Nf6: nf6Reason,
    },
  },
}

const openingWithoutExplanation: OpeningData = {
  id: 'italian-game',
  name: 'Italian Game',
  eco: 'C50',
  color: 'white',
  difficulty: 'beginner',
  description: 'Classical opening.',
  moves: [],
}

function makeActiveState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    deviationDetected: true,
    deviationMove: 'Nf6',
    openingId: 'italian-game',
    openings: [openingWithExplanation],
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
// Section 1 — Conditional rendering
// ---------------------------------------------------------------------------

describe('BookAbandonmentPanel — conditional rendering', () => {
  it('does not render when deviationDetected is false', () => {
    setStore(makeActiveState({ deviationDetected: false }))
    const { container } = render(<BookAbandonmentPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when deviationDetected is true but openingId is null', () => {
    setStore(makeActiveState({ deviationDetected: true, openingId: null }))
    const { container } = render(<BookAbandonmentPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders generic fallback when deviationDetected is true but opening has no abandonmentExplanation', () => {
    setStore(makeActiveState({ openings: [openingWithoutExplanation] }))
    render(<BookAbandonmentPanel />)
    // Fallback should render — not null. It should not have the four-part structure.
    expect(screen.queryByTestId('section-what-happened')).toBeNull()
    expect(screen.queryByTestId('section-why-breaks')).toBeNull()
    // Fallback should be present (some content)
    expect(document.body.textContent).toBeTruthy()
  })

  it('renders when deviationDetected is true and opening has explanation', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByTestId('section-what-happened')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Section 2 — Four-part content rendering
// ---------------------------------------------------------------------------

describe('BookAbandonmentPanel — four-part content', () => {
  it('renders a heading for "what happened" section', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByTestId('section-what-happened')).toBeInTheDocument()
  })

  it('renders opponentMoveSummary text', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(nf6Reason.opponentMoveSummary)).toBeInTheDocument()
  })

  it('renders a heading for "why book breaks" section', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByTestId('section-why-breaks')).toBeInTheDocument()
  })

  it('renders whyBookBreaks text', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(nf6Reason.whyBookBreaks)).toBeInTheDocument()
  })

  it('renders a heading for "opponent\'s strategy" section', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByTestId('section-opponent-strategy')).toBeInTheDocument()
  })

  it('renders opponentStrategy text', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(nf6Reason.opponentStrategy)).toBeInTheDocument()
  })

  it('renders a heading for "what to focus on next" section', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByTestId('section-forward-guidance')).toBeInTheDocument()
  })

  it('renders all forwardGuidance items', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    for (const item of nf6Reason.forwardGuidance) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })

  it('renders at least 2 forward guidance items', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    const guidanceItems = nf6Reason.forwardGuidance
    expect(guidanceItems.length).toBeGreaterThanOrEqual(2)
    for (const item of guidanceItems) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// Section 3 — Move resolution (keyed vs. default)
// ---------------------------------------------------------------------------

describe('BookAbandonmentPanel — move resolution', () => {
  it('uses the keyed reason when deviationMove matches a key in reasons', () => {
    setStore(makeActiveState({ deviationMove: 'Nf6' }))
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(nf6Reason.opponentMoveSummary)).toBeInTheDocument()
    expect(screen.queryByText(defaultReason.opponentMoveSummary)).toBeNull()
  })

  it('falls back to default reason when deviationMove has no match', () => {
    setStore(makeActiveState({ deviationMove: 'h5' }))
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(defaultReason.opponentMoveSummary)).toBeInTheDocument()
  })

  it('falls back to default when deviationMove is null', () => {
    setStore(makeActiveState({ deviationMove: null }))
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(defaultReason.opponentMoveSummary)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Section 4 — Dismiss and replay
// ---------------------------------------------------------------------------

describe('BookAbandonmentPanel — dismiss and replay', () => {
  it('panel is visible initially (not dismissed)', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(nf6Reason.opponentMoveSummary)).toBeInTheDocument()
  })

  it('dismiss button is present', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    const dismissButton = screen.getByRole('button', {
      name: /dismiss book abandonment|got it/i,
    })
    expect(dismissButton).toBeInTheDocument()
  })

  it('clicking dismiss hides the panel content', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    const dismissButton = screen.getByRole('button', {
      name: /dismiss book abandonment|got it/i,
    })
    fireEvent.click(dismissButton)
    expect(screen.queryByText(nf6Reason.opponentMoveSummary)).toBeNull()
  })

  it('after dismiss, "Why did the book end?" button appears', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    const dismissButton = screen.getByRole('button', {
      name: /dismiss book abandonment|got it/i,
    })
    fireEvent.click(dismissButton)
    expect(screen.getByText('Why did the book end?')).toBeInTheDocument()
  })

  it('clicking replay button re-opens the panel', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    const dismissButton = screen.getByRole('button', {
      name: /dismiss book abandonment|got it/i,
    })
    fireEvent.click(dismissButton)
    const replayButton = screen.getByTestId('replay-abandonment')
    fireEvent.click(replayButton)
    expect(screen.getByText(nf6Reason.opponentMoveSummary)).toBeInTheDocument()
  })

  it('after replay, replay button is gone', () => {
    setStore(makeActiveState())
    render(<BookAbandonmentPanel />)
    const dismissButton = screen.getByRole('button', {
      name: /dismiss book abandonment|got it/i,
    })
    fireEvent.click(dismissButton)
    const replayButton = screen.getByTestId('replay-abandonment')
    fireEvent.click(replayButton)
    expect(screen.queryByTestId('replay-abandonment')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Section 5 — Generic fallback (no explanation data)
// ---------------------------------------------------------------------------

describe('BookAbandonmentPanel — generic fallback', () => {
  it('fallback renders the opponent\'s move in SAN if available', () => {
    setStore(makeActiveState({ openings: [openingWithoutExplanation], deviationMove: 'Bg4' }))
    render(<BookAbandonmentPanel />)
    expect(screen.getByText(/Bg4/)).toBeInTheDocument()
  })

  it('fallback does not render the four-part structure headings', () => {
    setStore(makeActiveState({ openings: [openingWithoutExplanation] }))
    render(<BookAbandonmentPanel />)
    expect(screen.queryByTestId('section-what-happened')).toBeNull()
    expect(screen.queryByTestId('section-why-breaks')).toBeNull()
    expect(screen.queryByTestId('section-opponent-strategy')).toBeNull()
    expect(screen.queryByTestId('section-forward-guidance')).toBeNull()
  })

  it('fallback still has a dismiss button', () => {
    setStore(makeActiveState({ openings: [openingWithoutExplanation] }))
    render(<BookAbandonmentPanel />)
    const dismissButton = screen.getByRole('button', {
      name: /dismiss book abandonment|got it/i,
    })
    expect(dismissButton).toBeInTheDocument()
  })
})
