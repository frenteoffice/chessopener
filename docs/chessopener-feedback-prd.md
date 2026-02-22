# PRD: Chess Opening Practice — Enhanced Feedback & Book Abandonment Reasoning

**Status:** Draft  
**Builds on:** chessopener-strategy-prd.md  

---

## Problem Statement

Two related feedback gaps are degrading the learning value of the chess opening practice experience:

1. **Feature parity gap** — The rich commentary and coaching features introduced in the strategy PRD only surface for defenses, not for openings (i.e. when the player is White). This creates an inconsistent and confusing experience.

2. **Book abandonment is opaque** — When the opponent plays a move that takes the game out of book, the player receives little to no explanation. They don't know *what* the opponent did, *why* it breaks the book line, what strategic idea it represents, or what they should now be looking for. This is the highest-value moment in the entire practice session — the moment the player must adapt — and currently it's handled the worst.

---

## Goals

- Surface all strategy-level commentary equally for both openings and defenses.
- When the book is abandoned, deliver a rich, structured explanation that teaches the player what happened and what to do next.
- Make the abandonment moment feel like a coaching intervention, not a dead end.

---

## Non-Goals

- Changing the move suggestion engine or book data source.
- Real-time engine evaluation overlays (separate initiative).
- Multiplayer or ranked features.

---

## Feature 1: Feature Parity for Openings (White)

### Background
The strategy PRD introduced several commentary systems — opening theme identification, pawn structure notes, piece development targets, strategic intent summaries, etc. These currently only trigger when the player is playing Black (defenses). When playing White, none of this context appears.

### Requirements

**FR-1.1 — Opening Theme Label**  
When the player is White, display the same opening theme label that defenses receive (e.g. "London System — Space Control & Solid Structure"). This should appear at the start of the practice session and persist in a visible header or sidebar throughout.

**FR-1.2 — Move Commentary for White**  
Every book move played by White should receive the same move-level annotation system currently applied to Black's moves. This includes: what the move accomplishes, what square or piece it targets, and how it fits the opening's macro strategy.

**FR-1.3 — Pawn Structure & Development Notes for White**  
The pawn structure context and piece development guidance panels should appear identically whether the player is White or Black.

**FR-1.4 — Strategic Intent Summary for White**  
The "what this opening is trying to achieve" summary panel should display at session start regardless of color.

### Acceptance Criteria
- A QA pass playing five White openings and five Black defenses should produce equivalent coaching richness, validated by a side-by-side feature checklist.
- No commentary feature from the strategy PRD may be exclusive to one color.

---

## Feature 2: Book Abandonment — Verbose Reasoning

### Background
The current behavior when a player's opponent (or the book line itself) deviates from theory is to silently note that the book has ended. Players are left without context. The abandonment moment is the most pedagogically important moment in opening practice — it is exactly when a player needs to understand *why theory ends* in order to develop genuine understanding rather than rote memorization.

### The Abandonment Moment Should Answer Four Questions

Every book abandonment explanation must address all four of the following:

1. **What did the opponent do?** — Describe the specific move in plain language. Not just algebraic notation, but what piece moved, where it went, and what it is now threatening or controlling.

2. **Why does this break the book?** — Explain what assumption the book line was making that this move violates. Was it a tempo assumption? Did it contest a key square the opening relied on? Did it decline a gambit the line expected to be accepted? Did it sidestep a pin or avoid a piece trade the line was built around?

3. **What is the opponent's strategy?** — Name and briefly describe the strategic idea the opponent's move is pursuing. For example: "This is a common Anti-Sicilian approach — by avoiding the Open Sicilian, White keeps the position closed and hopes to outplay Black in slow maneuvering." Give the player a mental model for what they are now facing.

4. **What should the player look for next?** — Given that the intended opening strategy has been thwarted, what is the player's adjusted priority? What piece is now more important to develop? What square should they now contest? What danger should they be alert to?

### Requirements

**FR-2.1 — Abandonment Trigger Detection**  
The system must detect the specific move (by either side) that caused the book line to end and surface that move explicitly in the explanation, not just note that "the book is over."

**FR-2.2 — Abandonment Explanation Panel**  
When the book ends, display a dedicated full-width panel (or modal on mobile) with the four-part explanation structured under readable headings. This panel should not auto-dismiss — the player must explicitly acknowledge it before continuing.

**FR-2.3 — Opponent Move Narration**  
The move that broke theory should be described in natural language at a beginner-to-intermediate reading level. Avoid jargon without brief explanation (e.g. "a fianchetto — developing the bishop to the long diagonal behind a pawn").

**FR-2.4 — Strategic Conflict Summary**  
The explanation must name both strategies in conflict: the opening the player was pursuing and the counter-approach the opponent adopted. Example: "You were playing the Ruy López, aiming for long-term central control and pressure on e5. Your opponent played the Berlin Defense, a line known for exchanging knights and reaching a solid endgame that defuses your attacking chances."

**FR-2.5 — Forward-Looking Guidance**  
The explanation must close with at least two concrete, specific things the player should now prioritize. These should be positional or tactical in nature, not generic advice like "develop your pieces." Example: "With the standard Berlin endgame knight trade, focus on: (1) activating your rooks toward the open e-file, and (2) avoiding premature pawn advances that give Black a passed pawn."

**FR-2.6 — Inline Move Highlighting**  
The move that caused book abandonment should be highlighted on the board or in the move list when the panel is displayed, so the player has a clear visual anchor.

**FR-2.7 — Explanation Replay**  
After the panel is dismissed, the player should be able to re-open it via a clearly visible "Why did the book end?" button that persists for the remainder of the session.

### Acceptance Criteria
- On a test suite of 20 simulated book abandonments across varied openings, every explanation must contain all four components.
- The explanation panel must appear within 300ms of the abandonment move being played.
- Testers with beginner chess knowledge (Elo < 800) should be able to read the explanation and correctly identify the opponent's strategy in a follow-up question at a rate ≥ 70%.

---

## UX Notes

- The abandonment panel should visually distinguish the "what happened" (past) from the "what to do" (future) sections — consider a subtle visual divider or icon system.
- Tone should be that of a patient coach, not a warning or error state. Avoid language like "the book has been exhausted" or "deviation detected." Prefer "Your opponent stepped off the main path — here's what that means."
- On mobile, the four-part explanation may be collapsed into an accordion to avoid overwhelming the screen, but all four sections must be present.

---

## Open Questions

- Should book abandonment explanations be pre-generated for common deviations (faster, more consistent) or dynamically generated per session (more flexible but requires LLM latency budget)?
- For less common deviations where theory commentary is thin, what is the graceful degradation experience — a shorter explanation, or a "we don't have deep notes on this line yet" message?
- Should the player be able to rate the helpfulness of abandonment explanations to improve quality over time?

---

## Success Metrics

| Metric | Target |
|---|---|
| Feature parity: coaching elements appearing for White vs Black | 100% parity |
| Book abandonment explanations containing all 4 components | ≥ 95% of sessions |
| Player comprehension of opponent strategy (beginner cohort) | ≥ 70% correct |
| Player session completion rate after book abandonment | +20% vs baseline |
| "Why did the book end?" button re-open rate | Tracked as engagement signal |

