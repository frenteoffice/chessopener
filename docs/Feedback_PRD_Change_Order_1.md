# Change Order 1 — Feedback PRD Post-Implementation Fixes

**Status:** Draft
**Parent TDD:** `docs/Feedback_PRD_TDD.md`
**Date:** 2026-02-21

---

## Background

The Feedback PRD TDD implementation is complete with 82 passing tests. Three gaps remain from the audit:

1. **Board move highlighting for the deviation move** — `deviationMove` exists in the store but nothing marks it on the board.
2. **Move-specific abandonment reasons** — All 10 opening JSONs have only a generic `'default'` key. No SAN-keyed reasons exist for common opponent deviations, which is where the PRD's coaching value actually lives.
3. **Untracked docs/files** — `chessopener-feedback-prd.md`, `Feedback_PRD_TDD.md`, `Feedback_PRD_Change_Order_1.md`, and the new source files are untracked in git.

---

## CO-1 — Board Highlighting for the Deviation Move

### Problem

When the opponent deviates from theory, `deviationMove` is set in the store as a SAN string (e.g. `"Bg4"`). The `BookAbandonmentPanel` surfaces this in prose, but the board gives no visual anchor. The PRD (FR-2.6) requires the deviating move to be highlighted on the board or in the move list when the panel is displayed.

`BoardSection.tsx` already has a `customSquareStyles` pipeline that layers `getLastMoveStyles` (yellow) and `selectedSquareStyles` (blue). The deviation highlight should slot into the same pipeline.

### Constraint

`deviationMove` in the store is a **SAN string**, not a from/to square pair. To highlight it on the board we need the from/to squares of the move that caused the deviation. These are available in `history` — the last entry where `inTheory` was still `true` before the deviation was marked is the book exit move. Actually, because `setDeviationEvent` is called with the deviating move's SAN at the moment it is played, the corresponding `history` entry (`inTheory: false`, or the last entry at the time of deviation) contains the `from`/`to` we need.

### Approach

The simplest correct approach: when `deviationDetected` is true, find the last history entry that matches `deviationMove` by SAN and use its `from`/`to` for the highlight. The `history` array stores `{ san, from, to, ... }` on every entry (populated by `applyMove`).

### Changes

**`src/components/BoardSection.tsx`**

- Read `deviationDetected` and `deviationMove` from the store (already in the store, not yet read in this component).
- Add `getDeviationMoveStyles(history, deviationDetected, deviationMove)` alongside `getLastMoveStyles`.
- The deviation highlight color should be visually distinct from the yellow last-move highlight — use a purple/violet tint (e.g. `rgba(168, 85, 247, 0.45)`) to match the `BookAbandonmentPanel`'s purple border.
- Layer order: last-move (yellow) → deviation (purple) → selected (blue). Deviation overlays last-move when they coincide (which they always will immediately after the deviation move is played).

```ts
function getDeviationMoveStyles(
  history: { san: string; from?: string; to?: string }[],
  deviationDetected: boolean,
  deviationMove: string | null
): Record<string, object> {
  if (!deviationDetected || !deviationMove) return {}
  const entry = [...history].reverse().find((h) => h.san === deviationMove)
  if (!entry?.from || !entry?.to) return {}
  return {
    [entry.from]: { backgroundColor: 'rgba(168, 85, 247, 0.4)' },
    [entry.to]: { backgroundColor: 'rgba(168, 85, 247, 0.55)' },
  }
}
```

- The deviation highlight should persist as long as `deviationDetected` is true (i.e. for the remainder of the session, since the panel can be replayed). It does not need to clear when the panel is dismissed — the dismissal is local state in the panel component.

### Acceptance Criteria

- When the opponent deviates, the two squares of the deviation move are highlighted in purple on the board.
- The highlight persists after the panel is dismissed and after subsequent player moves.
- The highlight does not appear when `deviationDetected` is false.
- Last-move yellow still shows for moves played after the deviation.

### Tests

Add to `src/__tests__/BookAbandonmentPanel.test.tsx` — a new Section 6 (or a dedicated `BoardSection.test.tsx` if preferred):

| # | Test | Expected |
|---|------|----------|
| CO1-1 | `getDeviationMoveStyles` returns empty object when `deviationDetected` is false | `{}` |
| CO1-2 | Returns empty object when `deviationMove` is null | `{}` |
| CO1-3 | Returns empty object when no history entry matches `deviationMove` | `{}` |
| CO1-4 | Returns styles for the correct squares when a matching entry exists | from/to squares have backgroundColor set |

These can be unit-tested as a pure function import — no React render needed.

---

## CO-2 — Move-Specific Abandonment Reasons (Content Authoring)

### Problem

Every opening JSON has only a `'default'` key in `abandonmentExplanation.reasons`. The default text is intentionally generic:

> "Your opponent stepped off the main theory line with an unusual move, choosing their own path rather than the expected response."

This is accurate but educationally thin. The PRD's entire value proposition for the abandonment panel is coaching the player through *specific* deviations — naming the opponent's actual strategic idea, explaining exactly what assumption the deviation violates, and giving targeted forward guidance.

The infrastructure (type system, component, store, data validation tests) already supports SAN-keyed reasons. This CO is purely content authoring.

### Scope

For each opening, identify the **3 most common opponent deviations** using Lichess opening explorer data (masters + lichess databases). Write a full `AbandonmentReason` for each.

For White openings (player plays first): the relevant deviations are responses the *opponent (Black)* plays that take the game off the expected book line.

For Black openings (player plays second): the relevant deviations are moves *White* plays that sidestep the expected lines.

### Opening-by-Opening Deviation Targets

#### Italian Game (C50) — White opening
Player expects: `...Bc5` (Giuoco Piano) or `...Nf6` (Two Knights)

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `d6` | Hungarian Defense | Solid but passive — Black avoids sharp lines entirely |
| `Be7` | Paris Defense | Similar to Hungarian; Black develops solidly to e7 |
| `Bc5` | Normal (Giuoco Piano) — should NOT be a deviation; skip | — |

Revisit with Lichess data to find actual off-tree deviations from the current Italian tree depth.

#### Ruy Lopez (C60) — White opening
Player expects: `...a6` (Morphy Defense) after `3.Bb5`

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `Nf6` | Berlin Defense | Forces knight trade, reaches solid Berlin endgame that defuses attack |
| `Bc5` | Classical Defense | Immediate counter-attack on the bishop |
| `d6` | Steinitz Defense | Solid but cramped; prepares slow development |

#### London System (A45/D02) — White opening
Player expects: `...d5 Nf6 e6` setup from Black

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `f5` | Dutch-London hybrid | Aggressive kingside setup, avoids the symmetrical structure |
| `c5` | Benoni-London setup | Counter-attacks in the center immediately |
| `g6` | King's Indian setup vs London | Fianchetto, aims for dynamic counterplay on kingside |

#### Queen's Gambit (D06) — White opening
Player expects: `...e6` (QGD) or `...dxc4` (QGA) after `2.c4`

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `c6` | Slav Defense | Defends d5 without blocking the c8 bishop |
| `Nf6` | Then `g6` — Grünfeld | Allows White center then attacks it with pieces |
| `e5` | Albin Counter-Gambit | Aggressive gambit to unbalance immediately |

#### King's Indian Defense (E60) — Black opening
Player (Black) expects White to play `d4 c4 Nc3`; deviations are White sidesteps

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `f3` | Sämisch Variation intent | Prepares e4 then f3, aims for space and kingside attack |
| `Bg5` | Averbakh Variation | Pins the king's knight, takes away `...Nf6-e4` resource |
| `g3` | Fianchetto System | Counters the King's Indian with a symmetrical fianchetto |

#### Sicilian Najdorf (B90) — Black opening
Player (Black) expects White to play `2.Nf3 3.d4`; deviations are Anti-Sicilian systems

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `c3` | Alapin Variation (after 1.e4 c5 2.c3) | Controls d4 without allowing `...d4` trades; solid positional approach |
| `Nc3` | Grand Prix Attack setup | Rapid f4-f5 kingside attack before development |
| `f4` | McDonnell Attack | Immediate kingside aggression, gives up central control for initiative |

#### Caro-Kann (B10) — Black opening
Player (Black) expects White to play `d4 Nc3` or `d4 Nd2`

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `c3` | Advance Variation setup via `e5` | Gains space, closes the center, attacks with f4-f5 |
| `Nc3` | Classical or Fantasy Variation | Nc3 leads to sharp lines where White may sacrifice a pawn |
| `exd5` | Exchange Variation | Simplifies to a symmetrical pawn structure; aims for endgame advantage |

#### French Defense (C00) — Black opening
Player (Black) expects White to play `d4 Nc3` (Winawer/Classical)

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `e5` | Advance Variation | Gains space, closes center; attacks on kingside before Black can free position |
| `exd5` | Exchange Variation | Removes central tension immediately; symmetrical structure |
| `Nd2` | Tarrasch Variation | Avoids pin on Nc3, prepares Ngf3 and flexible center |

#### Pirc Defense (B07) — Black opening
Player (Black) expects White to play `d4 Nc3 Nf3`

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `f4` | Austrian Attack | Most aggressive — immediate kingside expansion, f5 threat |
| `Bg5` | Classical with pin | Pressures Black's kingside development |
| `Be3` | Byrne Variation | Solid development, delays committing the center |

#### Scandinavian (B01) — Black opening
Player (Black) expects White to play `Nc3` after `2.exd5 Qxd5 3.Nc3 Qa5`

| SAN key | Deviation | Opponent's idea |
|---------|-----------|-----------------|
| `Nf3` | Delays Nc3 | Develops naturally, may transpose but keeps options |
| `d4` | Immediately plays d4 | Stakes central claim before Black completes development |
| `c4` | Portuguese Variation setup | Gains queenside space, challenges Black's queen |

### Format for Each Reason

Each SAN-keyed entry must follow the same `AbandonmentReason` shape:

```json
"Nf6": {
  "opponentMoveSummary": "<Plain language: what piece moved, where, what it threatens or controls>",
  "whyBookBreaks": "<The specific assumption the book line made that this move violates>",
  "opponentStrategy": "<Name the approach and describe the strategic idea in 1-2 sentences>",
  "forwardGuidance": [
    "<Concrete priority 1 — specific square, piece, or pawn to focus on>",
    "<Concrete priority 2 — specific danger to avoid or resource to activate>"
  ]
}
```

Quality bar: a player rated 600–900 ELO reading the explanation should be able to correctly identify the opponent's strategy in a follow-up question at ≥ 70% (per the PRD acceptance criterion).

### Validation

No new test infrastructure needed — the existing data validation tests in `OpeningSummary.test.tsx` already enforce:
- `'default'` key must exist (test 32)
- All `forwardGuidance` arrays must have ≥ 2 items (test 33)

After authoring, manually verify that `deviationMove` values emitted by the engine during hybrid mode match the SAN keys added. The SAN format must match exactly what chess.js produces (e.g. `"Nf6"` not `"N-f6"`).

---

## CO-3 — Commit Untracked Files

### Problem

The following files are untracked and not in version control:

- `docs/chessopener-feedback-prd.md`
- `docs/Feedback_PRD_TDD.md`
- `docs/Feedback_PRD_Change_Order_1.md` (this file)
- `src/__tests__/BookAbandonmentPanel.test.tsx`
- `src/__tests__/OpeningSummary.parity.test.tsx`
- `src/components/BookAbandonmentPanel.tsx`
- `src/test/setup.ts`

Design documents and TDDs should be committed alongside the implementation they describe, consistent with the pattern established when `chessopener-strategy-prd.md` was committed with CO-3 of the Strategy Briefing.

### Changes

Stage and commit all seven files in a single commit with the message:

```
Feedback PRD: book abandonment panel, parity tests, change order docs
```

No source code changes required for this CO.

---

## Implementation Order

1. **CO-3** — Commit untracked files first. No code risk; establishes a clean baseline.
2. **CO-1** — Board highlighting. Small, isolated change to `BoardSection.tsx`. Write the four unit tests first (pure function), then implement.
3. **CO-2** — Abandonment reason authoring. Data-only; no code changes. Author 3 reasons per opening (30 total entries), validate against existing tests, commit per opening or as a batch.

---

## Out of Scope

- Mobile accordion layout for the panel (UX polish pass, separate initiative).
- LLM-generated abandonment explanations (PRD open question, deferred).
- Player helpfulness rating (PRD open question, deferred).
- Highlighting in the move list (the move list shows SAN text; the board highlight covers FR-2.6 sufficiently for now).
