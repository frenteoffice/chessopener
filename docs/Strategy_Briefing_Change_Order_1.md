# Strategy Briefing
## Change Order 1 — Post-Implementation Follow-up

**Document Type:** Change Order
**Against PRD:** `chessopener-strategy-prd.md` v1.0
**Against Audit:** Audit findings from 2026-02-21 post-implementation review
**Change Order Version:** 1.0
**Status:** Pending Approval
**Date:** February 2026

---

## Summary

This change order addresses four gaps and one documentation fix identified in the post-implementation audit of the Strategy Briefing feature. The core implementation is complete and all 27 tests pass. These items cover a behavioral edge case, test coverage gaps, an untracked document, and a logging error. No existing passing tests are modified.

---

## Table of Contents

1. [CO-1 — Fix quiz state not resetting on opening change](#co-1--fix-quiz-state-not-resetting-on-opening-change)
2. [CO-2 — Add test for `history.length === 0` render guard](#co-2--add-test-for-historylength--0-render-guard)
3. [CO-3 — Commit `chessopener-strategy-prd.md` to version control](#co-3--commit-chessopener-strategy-prdmd-to-version-control)
4. [CO-4 — Fix UPDATE_LOG.md date typo](#co-4--fix-update_logmd-date-typo)

---

## CO-1 — Fix quiz state not resetting on opening change

**Priority:** Medium
**Type:** Bug
**Files:** `src/components/OpeningSummary.tsx`, `src/__tests__/OpeningSummary.test.tsx`

### Problem

`selectedOptionId` is local `useState`. It resets correctly on unmount/remount (tested in Section 6). However, if the user completes a quiz, then starts a new game with a different opening without the component unmounting — e.g., navigating back to the selector and choosing a new opening — the quiz state from the previous opening persists when `OpeningSummary` re-renders with the new `openingId`.

### Remediation

Add a `useEffect` that resets `selectedOptionId` to `null` whenever `openingId` changes:

```ts
useEffect(() => {
  setSelectedOptionId(null)
}, [openingId])
```

Add a test in Section 6 ("quiz state reset") that simulates this scenario: render with opening A, select an answer, update the store to opening B, and assert the explanation is gone and buttons are re-enabled.

### Acceptance Criteria

- `selectedOptionId` resets to `null` whenever `openingId` changes
- New test passes: `quiz state resets when openingId changes without unmounting`
- All 27 existing tests continue to pass

---

## CO-2 — Add test for `history.length === 0` render guard

**Priority:** Low
**Type:** Test coverage
**Files:** `src/__tests__/OpeningSummary.test.tsx`

### Problem

`OpeningSummary` has three conditions for early return:

```ts
if (phase !== 'free' || !openingId || history.length === 0) return null
```

The first two conditions (`phase !== 'free'` and `openingId === null`) are covered by Section 1 tests. The third condition (`history.length === 0`) has no corresponding test. This is a gap in conditional rendering coverage.

### Remediation

Add a test to the "conditional rendering" describe block:

```ts
it('does not render when phase is "free" and openingId is set but history is empty', () => {
  setStore(makeActiveState({ history: [] }))
  const { container } = render(<OpeningSummary />)
  expect(container.firstChild).toBeNull()
})
```

### Acceptance Criteria

- New test passes: component returns null when `history` is empty even with `phase === 'free'` and a valid `openingId`
- Total test count increases from 27 to 28 (plus 1 from CO-1 = 29 total)

---

## CO-3 — Commit `chessopener-strategy-prd.md` to version control

**Priority:** Low
**Type:** Documentation / repository hygiene
**Files:** `docs/chessopener-strategy-prd.md`

### Problem

`docs/chessopener-strategy-prd.md` is currently untracked (`??` in `git status`). The PRD defines the acceptance criteria for the implemented feature. Leaving it untracked means the design rationale is not preserved in history alongside the code changes.

### Remediation

Stage and commit `docs/chessopener-strategy-prd.md` with the other implementation files. The commit message should reference the Strategy Briefing feature so the document is co-located in history with the implementation commit.

### Acceptance Criteria

- `git status` no longer shows `docs/chessopener-strategy-prd.md` as untracked
- File is present in the repository history

---

## CO-4 — Fix UPDATE_LOG.md date typo

**Priority:** Low
**Type:** Documentation correction
**Files:** `docs/UPDATE_LOG.md`

### Problem

The Strategy Briefing entry in `UPDATE_LOG.md` is dated `2025-02-21`. The correct date is `2026-02-21`. This is a one-digit transposition that will cause confusion when reading the log chronologically.

### Remediation

Change line 7 of `docs/UPDATE_LOG.md`:

```
## 2025-02-21 — Strategy Briefing Implementation
```

to:

```
## 2026-02-21 — Strategy Briefing Implementation
```

### Acceptance Criteria

- `UPDATE_LOG.md` entry reads `2026-02-21`
- No other content in the log is modified

---

## Implementation Order

| # | Item | Priority | Effort |
|---|------|----------|--------|
| CO-4 | Fix UPDATE_LOG date typo | Low | Trivial |
| CO-3 | Commit PRD to version control | Low | Trivial |
| CO-2 | Add `history.length === 0` test | Low | Small |
| CO-1 | Fix quiz state on opening change | Medium | Small |

CO-4 and CO-3 can be done in a single commit. CO-2 and CO-1 should be done together since CO-1 requires a new test anyway.
