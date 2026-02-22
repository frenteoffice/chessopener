# TDD: Enhanced Feedback & Book Abandonment Reasoning

**Status:** Draft
**PRD:** `chessopener-feedback-prd.md`
**Builds on:** Strategy Briefing implementation (CO-3/CO-4)

---

## Overview

This TDD covers two features from the feedback PRD:

1. **Feature 1 — Opening/White Feature Parity:** The strategy commentary (keyIdea, middleGamePlan, watchOut, typicalGoals, quiz, position tags) that already renders for Black defenses must render equivalently when the player is White.

2. **Feature 2 — Book Abandonment Panel:** A dedicated UI panel that fires when the opponent (or book line) deviates from theory, explaining: what happened, why it breaks the book, the opponent's strategy, and what the player should focus on next.

---

## Current State

### What already works
- `OpeningSummary.tsx` renders full strategy commentary (key idea, middlegame plan, watch out, typical goals, quiz) when `phase === 'free'` and an `openingId` is set.
- All 10 opening JSONs have a `strategy` field.
- `OpeningData.color` field is `'white' | 'black'`, but it is **not currently used** to gate any commentary.
- `deviationDetected: boolean` and `deviationMove: string | null` already exist in the game store and are set via `setDeviationEvent()`.

### What does NOT yet exist
- Any rendering difference between White and Black openings — the parity issue is essentially a verification/audit problem, not a code change problem (commentary already renders for both; the PRD flags a perceived gap).
- A `BookAbandonmentPanel` component.
- `AbandonmentExplanation` type / data shape on `OpeningData`.
- Any UI anchored to `deviationDetected` that shows a full four-part panel.
- A "Why did the book end?" replay button.
- Inline move highlighting tied to `deviationMove`.

---

## Architecture Decisions

### Feature 1: Feature Parity Audit

The existing `OpeningSummary` component renders identically regardless of `playerColor`. The PRD's concern appears to stem from game flow: when playing White, the player makes moves first and the phase transitions to `'free'` at a different point than when playing Black. The strategy panel appearance is already color-agnostic in the component.

**Decision:** Rather than a large code change, this feature resolves to:
1. A test that explicitly exercises both `playerColor: 'white'` and `playerColor: 'black'` and asserts equivalent rendering.
2. A data validation test that confirms every opening JSON (regardless of `color` field) has a `strategy` field.

If the test passes, parity exists. If it doesn't, the failing test points to where the gap is.

### Feature 2: Book Abandonment Panel

**New type: `AbandonmentExplanation`** on `OpeningData`, keyed by the deviating move in SAN or a `'default'` fallback:

```ts
interface AbandonmentReason {
  opponentMoveSummary: string        // plain-language "what happened"
  whyBookBreaks: string              // the assumption violated
  opponentStrategy: string           // named strategic idea + description
  forwardGuidance: string[]          // 2+ concrete priorities (min length enforced)
}

interface AbandonmentExplanation {
  reasons: Record<string, AbandonmentReason>  // keyed by SAN (e.g. "Nf6") or "default"
}
```

`OpeningData` gains an optional `abandonmentExplanation?: AbandonmentExplanation` field.

**New component: `BookAbandonmentPanel`**

- Reads from `useGameStore()`: `deviationDetected`, `deviationMove`, `openingId`, `openings`.
- Visible when `deviationDetected === true` and the panel has not been dismissed.
- Contains exactly four sections under readable headings.
- Has a dismiss button; on dismiss, sets internal `dismissed` state (does not clear store state).
- After dismiss, a "Why did the book end?" button appears and re-opens the panel.
- Panel is not auto-dismissed.

**Store changes:** None required for the panel itself — `deviationDetected` and `deviationMove` already exist. A `clearDeviation()` action may be added for `resetGame` cleanup but is not required by this feature.

**Inline highlighting:** `deviationMove` in the store is a SAN string. The board component should visually mark the move. This is a board-level concern and is out of scope for the component tests here — covered by a separate integration note.

---

## New Types

```ts
// Add to src/types/index.ts

export interface AbandonmentReason {
  opponentMoveSummary: string
  whyBookBreaks: string
  opponentStrategy: string
  forwardGuidance: string[]  // must have >= 2 items
}

export interface AbandonmentExplanation {
  reasons: Record<string, AbandonmentReason>  // SAN key or "default"
}

// Update OpeningData:
// abandonmentExplanation?: AbandonmentExplanation
```

---

## Test Plan

### Test File: `src/__tests__/BookAbandonmentPanel.test.tsx`

New file. Tests the `BookAbandonmentPanel` component in isolation.

#### Section 1 — Conditional rendering

| # | Test | Store state | Expected |
|---|------|-------------|----------|
| 1 | Does not render when `deviationDetected` is false | `deviationDetected: false` | `container.firstChild` is null |
| 2 | Does not render when `deviationDetected` is true but `openingId` is null | `deviationDetected: true, openingId: null` | null |
| 3 | Does not render when `deviationDetected` is true but opening has no `abandonmentExplanation` | opening without the field | null (or graceful fallback — see decision below) |
| 4 | Renders when `deviationDetected` is true and opening has explanation | full state | panel is in the document |

> **Decision for test 3:** Render a generic fallback rather than null, so the player is never left with nothing. The fallback should not contain the four-part structure. This makes the fallback testable independently.

#### Section 2 — Four-part content rendering

| # | Test | Expected |
|---|------|----------|
| 5 | Renders a heading for "what happened" section | heading text present |
| 6 | Renders `opponentMoveSummary` text | matched text in document |
| 7 | Renders a heading for "why book breaks" section | heading text present |
| 8 | Renders `whyBookBreaks` text | matched text in document |
| 9 | Renders a heading for "opponent's strategy" section | heading text present |
| 10 | Renders `opponentStrategy` text | matched text in document |
| 11 | Renders a heading for "what to focus on next" section | heading text present |
| 12 | Renders all `forwardGuidance` items | each item text in document |
| 13 | Renders at least 2 forward guidance items | guidance list length >= 2 |

#### Section 3 — Move resolution (keyed vs. default)

| # | Test | Store state | Expected |
|---|------|-------------|----------|
| 14 | Uses the keyed reason when `deviationMove` matches a key in `reasons` | `deviationMove: 'Nf6'`, reasons has `'Nf6'` key | `'Nf6'`-specific text renders |
| 15 | Falls back to `'default'` reason when `deviationMove` has no match | `deviationMove: 'h5'`, only `'default'` key | default text renders |
| 16 | Falls back to `'default'` when `deviationMove` is null | `deviationMove: null` | default text renders |

#### Section 4 — Dismiss and replay

| # | Test | Action | Expected |
|---|------|--------|----------|
| 17 | Panel is visible initially (not dismissed) | none | panel content in document |
| 18 | Dismiss button is present | none | button with accessible dismiss label present |
| 19 | Clicking dismiss hides the panel content | click dismiss | four-part content removed from document |
| 20 | After dismiss, "Why did the book end?" button appears | click dismiss | replay button in document |
| 21 | Clicking replay button re-opens the panel | click dismiss, then click replay | four-part content back in document |
| 22 | After replay, replay button is gone | click dismiss, click replay | replay button no longer in document |

#### Section 5 — Generic fallback (no explanation data)

| # | Test | Expected |
|---|------|----------|
| 23 | Fallback renders the opponent's move in SAN if available | `deviationMove: 'Bg4'` shown in fallback text |
| 24 | Fallback does not render the four-part structure headings | none of the section headings present |
| 25 | Fallback still has a dismiss button | dismiss button present |

---

### Test File: `src/__tests__/OpeningSummary.parity.test.tsx`

New file. Verifies that the `OpeningSummary` strategy panel renders identically for White and Black openings.

#### Section 1 — Color parity

| # | Test | Expected |
|---|------|----------|
| 26 | All strategy sections render when `playerColor: 'white'` | keyIdea, middleGamePlan, watchOut, typicalGoals, quiz all present |
| 27 | All strategy sections render when `playerColor: 'black'` | same assertion |
| 28 | Section headings are identical between White and Black renders | no color-conditional text in headings |

#### Section 2 — Data parity

| # | Test | Expected |
|---|------|----------|
| 29 | Every opening JSON (color = 'white') has a `strategy` field | `expect(opening.strategy).toBeDefined()` for all white openings |
| 30 | Every opening JSON (color = 'black') has a `strategy` field | same for black openings |
| 31 | All openings regardless of `color` field have non-empty `keyIdea` | loop over all openings |

---

### Additions to `src/__tests__/OpeningSummary.test.tsx`

The existing 27 tests remain unchanged. One new test is appended to Section 7 (data validation):

| # | Test | Expected |
|---|------|----------|
| 32 | Each opening that has `abandonmentExplanation` has a `'default'` key in `reasons` | ensures fallback is always available |
| 33 | Each `AbandonmentReason` in all openings has `forwardGuidance` with >= 2 items | data integrity |

---

## Component Specification

### `BookAbandonmentPanel`

**Location:** `src/components/BookAbandonmentPanel.tsx`

**Store reads:** `deviationDetected`, `deviationMove`, `openingId`, `openings`

**Local state:** `dismissed: boolean` (useState, defaults false)

**Render logic:**

```
if (!deviationDetected) → return null
const opening = openings.find(o => o.id === openingId)
const explanation = opening?.abandonmentExplanation
if (!explanation) → render <GenericAbandonmentFallback deviationMove={deviationMove} />

const reason = explanation.reasons[deviationMove ?? 'default'] ?? explanation.reasons['default']

if (dismissed) → render <ReplayButton onClick={() => setDismissed(false)} />
else → render full panel with dismiss button
```

**Section headings (exact text, for test matching):**
- `"What happened"` (or similar — decide before writing tests, must be consistent)
- `"Why this breaks the book"`
- `"Your opponent's approach"`
- `"What to focus on now"`

> Decide on exact heading text before writing tests so test strings match production strings.

**Recommended heading text (for test fixtures):**
- `"What happened"` → `data-testid="section-what-happened"`
- `"Why this breaks the book"` → `data-testid="section-why-breaks"`
- `"Your opponent's approach"` → `data-testid="section-opponent-strategy"`
- `"What to focus on now"` → `data-testid="section-forward-guidance"`

**Dismiss button:** `aria-label="Dismiss book abandonment explanation"` or visible text "Got it"

**Replay button:** visible text "Why did the book end?" with `data-testid="replay-abandonment"`

---

## Data Shape Example (for one opening JSON)

```json
"abandonmentExplanation": {
  "reasons": {
    "default": {
      "opponentMoveSummary": "Your opponent stepped off the main theory line with an unusual move, choosing their own path rather than the expected response.",
      "whyBookBreaks": "The standard line assumes a particular pawn or piece configuration that this move bypasses.",
      "opponentStrategy": "Your opponent is trying to reach a less-charted position where their preparation or intuition gives them an edge.",
      "forwardGuidance": [
        "Prioritize completing your development — get all minor pieces off the back rank.",
        "Control the center with pawns or piece pressure before launching any flank operations."
      ]
    },
    "Bg4": {
      "opponentMoveSummary": "Your opponent pinned your knight on f3 with their bishop, threatening to double your pawns if you don't respond.",
      "whyBookBreaks": "The main line assumed your f3 knight would be free to support a d4 advance. The pin changes the calculation.",
      "opponentStrategy": "This is a classical pin — your opponent is trading a bishop for a knight to damage your pawn structure and slow your central play.",
      "forwardGuidance": [
        "Consider h3 to ask the bishop whether to trade or retreat — either answer gives you information.",
        "If the bishop trades, recapture toward the center with your queen pawn to maintain central tension."
      ]
    }
  }
}
```

---

## What is NOT in scope for this TDD

- Board-level move highlighting (depends on the board component's highlight API — separate ticket).
- LLM-generated abandonment explanations (open question in PRD — pre-authored JSON is the first implementation).
- Mobile accordion layout for the panel (UX polish pass after core functionality).
- Player helpfulness rating on explanations (PRD open question, deferred).
- Timing requirement (panel within 300ms) — this is a runtime concern, not a unit test concern. Cover via manual QA.

---

## Implementation Order

1. Add `AbandonmentReason` and `AbandonmentExplanation` types to `src/types/index.ts`.
2. Add `abandonmentExplanation?: AbandonmentExplanation` to `OpeningData` in `src/types/index.ts`.
3. Write all tests in `BookAbandonmentPanel.test.tsx` — they will all fail.
4. Write all tests in `OpeningSummary.parity.test.tsx` — parity tests will likely pass immediately; data tests will fail until JSONs are populated.
5. Implement `BookAbandonmentPanel.tsx`.
6. Add `abandonmentExplanation` data to all 10 opening JSONs (at minimum a `'default'` key per opening).
7. Run tests; iterate until all pass.
8. Wire `BookAbandonmentPanel` into the game UI (e.g. in `CoachPanel.tsx` or as an overlay).
9. Add tests 32–33 to `OpeningSummary.test.tsx`.
