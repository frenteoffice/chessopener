# PRD: Opening Strategy Briefing — ChessOpener

**Version:** 1.0  
**Status:** Draft  
**Repo:** frenteoffice/chessopener  

---

## 1. Problem Statement

The current tool teaches opening move sequences but provides no strategic context. Once the final book move is played and the phase transitions from `opening` to `free`, the learner is left with a generic "Opening Complete" card that shows the moves they played, a stock eval, and nothing else.

The result is that a user can memorize the Italian Game in 3 moves and have no idea why they played them, what position type they're in, or what to do next. The tool has low retention utility because it doesn't bridge moves → understanding.

---

## 2. Goal

When the opening phase ends, surface a **Strategy Briefing** that teaches:

1. What kind of position this is (open/closed, tactical/positional)
2. The core idea behind why these moves were played
3. What the player should be trying to accomplish in the middlegame
4. The most common mistake to avoid
5. A quick comprehension check to reinforce the idea

The briefing replaces and significantly expands the current `OpeningSummary` component.

---

## 3. Scope

**In scope:**
- New `strategy` field on all 10 opening JSON data files
- New `Strategy` TypeScript interface in `src/types/index.ts`
- Overhauled `OpeningSummary.tsx` component rendered as a Strategy Briefing card
- A 3-option comprehension quiz embedded in the briefing

**Out of scope (future):**
- Thematic example moves played on the board post-opening
- AI-generated strategy text (all content is static/authored)
- Per-defense strategy variations (defense `profile` field already handles this)
- User progress tracking or quiz scoring

---

## 4. Data Layer Changes

### 4.1 New `Strategy` interface

Add to `src/types/index.ts`:

```typescript
export type PositionType =
  | 'open'
  | 'semi-open'
  | 'closed'
  | 'semi-closed'

export type PlayStyle =
  | 'tactical'
  | 'positional'
  | 'attacking'
  | 'defensive'
  | 'dynamic'

export interface QuizOption {
  id: string          // 'a' | 'b' | 'c'
  text: string
  correct: boolean
  explanation: string // shown after answer is selected
}

export interface Quiz {
  question: string
  options: QuizOption[]  // always exactly 3
}

export interface Strategy {
  positionTypes: PositionType[]   // e.g. ['closed', 'positional'] — 1-2 tags
  keyIdea: string                 // 1 sentence: the "why" of the opening
  middleGamePlan: string          // 2-3 sentences: what to do next
  watchOut: string                // 1 sentence: the most common mistake
  typicalGoals: string[]          // 3-4 short goal strings for bullet display
  quiz: Quiz
}
```

### 4.2 Update `OpeningData` interface

Add optional `strategy` field:

```typescript
export interface OpeningData {
  // ... existing fields unchanged ...
  strategy?: Strategy
}
```

The field is optional so existing tests and any opening without strategy data continue to work without modification.

---

## 5. Opening JSON Data

Add a `strategy` object to each of the 10 opening JSON files. The complete authored content for each opening is specified below.

### 5.1 Italian Game (`italian-game.json`)

```json
"strategy": {
  "positionTypes": ["semi-closed", "positional"],
  "keyIdea": "Develop pieces toward the center and target the vulnerable f7 pawn before the opponent can fully consolidate.",
  "middleGamePlan": "After castling kingside, aim to build a strong pawn center with c3 and d4. Coordinate your bishop on c4 with your knights to create pressure on the kingside. The position rewards patient maneuvering over early fireworks.",
  "watchOut": "Rushing an attack before completing development — the Italian rewards preparation, and premature aggression often backfires.",
  "typicalGoals": [
    "Castle kingside early to connect rooks",
    "Play c3 followed by d4 to challenge the center",
    "Keep your bishop on c4 active and pointed at f7",
    "Coordinate knights toward outpost squares on d5 or f5"
  ],
  "quiz": {
    "question": "You've just finished the Italian Game opening. What's your primary middlegame goal?",
    "options": [
      {
        "id": "a",
        "text": "Launch an immediate kingside pawn storm with f4-f5",
        "correct": false,
        "explanation": "The Italian is a positional opening — you need to finish development and castle before attacking."
      },
      {
        "id": "b",
        "text": "Play c3 and d4 to establish a strong pawn center",
        "correct": true,
        "explanation": "Correct. The c3-d4 break is the Italian's main strategic threat, seizing central space and activating your pieces."
      },
      {
        "id": "c",
        "text": "Trade your bishop for the opponent's knight to simplify",
        "correct": false,
        "explanation": "Your bishop on c4 is one of your best pieces in the Italian — keep it active and pointed at f7."
      }
    ]
  }
}
```

### 5.2 Ruy Lopez (`ruy-lopez.json`)

```json
"strategy": {
  "positionTypes": ["semi-closed", "positional"],
  "keyIdea": "Pressure the knight on c6 that defends e5, indirectly threatening to win the central pawn.",
  "middleGamePlan": "Castle kingside and play d3 or d4 to control the center. The Ruy Lopez is a long-term game — White builds pressure slowly through piece activity and pawn tension rather than immediate tactics. Rook lifts and piece transfers to the kingside are common plans.",
  "watchOut": "Chasing the bishop retreat too eagerly — the bishop on b5/a4 is doing positional work and shouldn't be traded lightly.",
  "typicalGoals": [
    "Maintain tension with the bishop on a4 as long as useful",
    "Castle and prepare d4 to fight for the center",
    "Use the c3-d4 pawn chain to gain central space",
    "Look for piece transfers to the kingside in the later middlegame"
  ],
  "quiz": {
    "question": "Your bishop is on a4 putting pressure on the c6 knight. Your opponent plays ...b5 to chase it. What's the right idea?",
    "options": [
      {
        "id": "a",
        "text": "Trade the bishop for the c6 knight immediately",
        "correct": false,
        "explanation": "Trading too early gives Black an easy game — the bishop has long-term value pressuring the position."
      },
      {
        "id": "b",
        "text": "Retreat the bishop to b3 to maintain the diagonal",
        "correct": true,
        "explanation": "Correct. Bb3 keeps the bishop active on the a2-g8 diagonal while maintaining pressure. This is the standard Ruy Lopez response."
      },
      {
        "id": "c",
        "text": "Ignore it and launch a kingside attack immediately",
        "correct": false,
        "explanation": "You haven't castled yet — attacking before completing development is premature in the Ruy Lopez."
      }
    ]
  }
}
```

### 5.3 Sicilian Najdorf (`sicilian-najdorf.json`)

```json
"strategy": {
  "positionTypes": ["semi-open", "dynamic"],
  "keyIdea": "Create queenside counterplay with ...b5 and ...Bb7 while White attacks on the kingside — an intentional imbalance where both sides race.",
  "middleGamePlan": "Push ...b5-b4 to undermine White's center and expand on the queenside. Meanwhile, be prepared for White's kingside pawn storm with f4-f5. The Najdorf is not passive — you need to generate active counterplay or White's attack will overwhelm you.",
  "watchOut": "Reacting to White's kingside threats defensively — the Najdorf is a counterattacking opening and passive defense usually loses.",
  "typicalGoals": [
    "Expand on the queenside with ...b5-b4",
    "Develop the bishop to b7 for long-range queenside pressure",
    "Castle queenside to keep your king safe from kingside storms",
    "Counter White's f4-f5 push with ...e5 or ...d5 when timed correctly"
  ],
  "quiz": {
    "question": "White has just played f4-f5 in a Najdorf. You haven't castled yet. What's your priority?",
    "options": [
      {
        "id": "a",
        "text": "Castle kingside immediately to get your king safe",
        "correct": false,
        "explanation": "Castling kingside walks into White's pawn storm — in the Najdorf, queenside castling is usually correct when White attacks on the kingside."
      },
      {
        "id": "b",
        "text": "Push ...b4 to generate queenside counterplay",
        "correct": true,
        "explanation": "Correct. The Najdorf demands counterplay. Pushing ...b4 attacks White's queenside while White attacks your kingside — whoever gets there first wins."
      },
      {
        "id": "c",
        "text": "Bring the knight back to defend f6",
        "correct": false,
        "explanation": "Retreating pieces to defend passively plays into White's hands. The Najdorf is a counterattacking opening — you must create threats, not just block them."
      }
    ]
  }
}
```

### 5.4 Queen's Gambit (`queens-gambit.json`)

```json
"strategy": {
  "positionTypes": ["closed", "positional"],
  "keyIdea": "Offer a pawn on c4 to gain central control with d4, then use space advantage to restrain Black's piece activity.",
  "middleGamePlan": "After the opening, focus on piece activity through the c-file and the b1-h7 diagonal. The minority attack (...a4-a5-b4-b5 for White with pawns on c4/d4) is a common long-term plan. In the Exchange Variation, look to dominate the open c-file with rooks.",
  "watchOut": "Accepting the gambit pawn and trying to hold it — it's usually better to return the pawn for development than to defend it under pressure.",
  "typicalGoals": [
    "Control the center with d4 and c4",
    "Develop the bishop to f4 or g5 before closing the center",
    "Use the c-file for rook activity in the middlegame",
    "Restrain Black's queenside counterplay with ...c5 or ...e5"
  ],
  "quiz": {
    "question": "Black accepts the Queen's Gambit and plays ...dxc4. What's your best approach?",
    "options": [
      {
        "id": "a",
        "text": "Immediately win the pawn back with e3 and Bxc4",
        "correct": false,
        "explanation": "While this works, fixating on recapturing immediately can allow Black to equalize easily. Development and center control are the priority."
      },
      {
        "id": "b",
        "text": "Play e3 and Bxc4 after developing — reclaim the pawn with a tempo",
        "correct": true,
        "explanation": "Correct. Developing first and then recapturing with the bishop gains a tempo by threatening Black's position while completing development."
      },
      {
        "id": "c",
        "text": "Ignore the pawn and develop pieces as quickly as possible",
        "correct": false,
        "explanation": "In the QGD accepted, recapturing the c4 pawn after development is correct — you want both development AND central control."
      }
    ]
  }
}
```

### 5.5 King's Indian (`kings-indian.json`)

```json
"strategy": {
  "positionTypes": ["closed", "dynamic"],
  "keyIdea": "Let White build a large pawn center, then undermine and attack it from the flanks — particularly with ...e5 and a kingside pawn storm.",
  "middleGamePlan": "After ...e5, the classic plan is ...Ne8-d6 or ...Ne8-c7 to regroup, followed by ...f5 and a kingside attack. White will push on the queenside (c5, b5). This is a race — your kingside attack must come before White's queenside breakthrough.",
  "watchOut": "Playing passively and letting White consolidate — the King's Indian only works if you actively create a kingside attack.",
  "typicalGoals": [
    "Play ...e5 to stake a claim in the center",
    "Reroute the knight toward the kingside (Ne8-d6 or Ne8-f6-g4)",
    "Launch a kingside pawn storm with ...f5-f4",
    "Keep the d6 pawn solid to avoid weaknesses in your structure"
  ],
  "quiz": {
    "question": "You're playing the King's Indian. White has a strong pawn center on d4 and e4. What's your plan?",
    "options": [
      {
        "id": "a",
        "text": "Exchange pawns in the center to simplify the position",
        "correct": false,
        "explanation": "Trading pawns relieves White's tension and leads to a simpler position that favors White's space advantage. The King's Indian requires active counterplay."
      },
      {
        "id": "b",
        "text": "Attack the center with ...e5, then launch a kingside storm",
        "correct": true,
        "explanation": "Correct. ...e5 is the key King's Indian move — it challenges White's center and prepares the knight reroute and f5-f4 kingside push."
      },
      {
        "id": "c",
        "text": "Expand on the queenside with ...a5-a4 to counter White's plans",
        "correct": false,
        "explanation": "Queenside expansion is White's plan in the King's Indian. Black's counterplay belongs on the kingside — ...e5 followed by f5-f4."
      }
    ]
  }
}
```

### 5.6 London System (`london-system.json`)

```json
"strategy": {
  "positionTypes": ["closed", "positional"],
  "keyIdea": "Build a solid, flexible pawn structure with d4, Nf3, and Bf4 that is difficult to attack and works against almost any Black setup.",
  "middleGamePlan": "After completing development, look for e4 if the center allows it, or maneuver pieces to optimal squares slowly. The bishop on f4 is key — keep it active. Rooks belong on e1 and d1 to support potential central breaks. The London is about accumulating small advantages rather than launching direct attacks.",
  "watchOut": "Playing too passively and allowing Black to seize the initiative — the London is solid but you still need a plan, not just waiting moves.",
  "typicalGoals": [
    "Establish d4 and Bf4 as the backbone of the position",
    "Castle kingside and connect rooks",
    "Look for an e4 break when the center allows it",
    "Use the h2-b8 diagonal if you trade the light-squared bishop"
  ],
  "quiz": {
    "question": "You're playing the London System and your opponent plays ...c5 to challenge your d4 pawn. What's the right reaction?",
    "options": [
      {
        "id": "a",
        "text": "Capture ...cxd4 to simplify the center",
        "correct": false,
        "explanation": "Exchanging on d4 relieves Black's tension and opens the c-file for Black's rooks. In the London, maintaining d4 is usually preferred."
      },
      {
        "id": "b",
        "text": "Advance e3 and hold d4 firmly",
        "correct": true,
        "explanation": "Correct. Holding d4 with e3 keeps your structure intact. The London's strength is its solidity — avoid unnecessary pawn trades that open the position."
      },
      {
        "id": "c",
        "text": "Play c4 immediately to fight for the center",
        "correct": false,
        "explanation": "While c4 is sometimes played in the London, jumping to it immediately can undermine your solid setup. e3 first to consolidate is more consistent."
      }
    ]
  }
}
```

### 5.7 Caro-Kann (`caro-kann.json`)

```json
"strategy": {
  "positionTypes": ["semi-open", "positional"],
  "keyIdea": "Support the d5 pawn challenge with ...c6 before playing it, achieving a solid central presence without the bad bishop problem of the French.",
  "middleGamePlan": "After the opening, Black's light-squared bishop is free to develop outside the pawn chain — a key advantage over the French Defense. Look to exchange the light-squared bishops if possible. Black's plans often involve queenside play with ...c5 or centralizing the knight on d5.",
  "watchOut": "Falling into passive, cramped positions — the Caro-Kann should be solid but not inert, and Black needs to create active counterplay.",
  "typicalGoals": [
    "Solve the light-squared bishop before it becomes trapped",
    "Aim for ...c5 to challenge White's center",
    "Centralize the knight on d5 if the opportunity arises",
    "Keep the pawn structure intact and avoid unnecessary weaknesses"
  ],
  "quiz": {
    "question": "You're playing the Caro-Kann. What's the main structural advantage over the French Defense?",
    "options": [
      {
        "id": "a",
        "text": "You have more space on the queenside",
        "correct": false,
        "explanation": "Space distribution is similar between the Caro-Kann and French — the key difference is about bishop activity, not space."
      },
      {
        "id": "b",
        "text": "Your light-squared bishop isn't locked behind your pawns",
        "correct": true,
        "explanation": "Correct. In the French, the light-squared bishop is often permanently bad. In the Caro-Kann, ...c6 before ...d5 means the bishop can come out to f5 or g4."
      },
      {
        "id": "c",
        "text": "You can attack on the kingside more easily",
        "correct": false,
        "explanation": "The Caro-Kann is a positional, solid opening — Black typically looks for queenside counterplay, not kingside attacks."
      }
    ]
  }
}
```

### 5.8 French Defense (`french-defense.json`)

```json
"strategy": {
  "positionTypes": ["closed", "positional"],
  "keyIdea": "Build a solid pawn chain with ...e6 and ...d5, then attack White's chain at its base while accepting a temporarily cramped position.",
  "middleGamePlan": "The French's main battle is the pawn chain — attack White's chain at e4 with ...c5 and ...f6, or expand on the queenside. The bad light-squared bishop is the French's main weakness and must be activated by exchanging it or finding an outpost. In the Winawer and Nimzowitsch, dynamic piece play compensates for the structural concession.",
  "watchOut": "Neglecting the light-squared bishop — in the French it can become permanently bad, so you must have a concrete plan to deal with it every game.",
  "typicalGoals": [
    "Attack White's pawn chain with ...c5 to undermine d4",
    "Create queenside counterplay with ...a6 and ...b5",
    "Find a role for the light-squared bishop (exchange it or find an outpost)",
    "Use the half-open c-file with rooks after ...cxd4"
  ],
  "quiz": {
    "question": "In a typical French Defense middlegame, White has pawns on d4 and e5. What's Black's best strategic plan?",
    "options": [
      {
        "id": "a",
        "text": "Attack the e5 pawn directly with ...f6",
        "correct": false,
        "explanation": "While ...f6 is sometimes played, it weakens Black's kingside. The proper attack is at the base of the chain — d4 — not the tip."
      },
      {
        "id": "b",
        "text": "Attack the base of the chain with ...c5 targeting d4",
        "correct": true,
        "explanation": "Correct. Pawn chains are attacked at the base. White's chain rests on d4, so ...c5 is Black's main counterattacking weapon in the French."
      },
      {
        "id": "c",
        "text": "Exchange the bad bishop via ...Be7-d6",
        "correct": false,
        "explanation": "Dealing with the bad bishop matters, but it isn't the primary plan. ...c5 attacking d4 is the French's central strategic idea."
      }
    ]
  }
}
```

### 5.9 Scandinavian (`scandinavian.json`)

```json
"strategy": {
  "positionTypes": ["semi-open", "dynamic"],
  "keyIdea": "Immediately challenge White's e4 pawn with ...d5, accepting a slight development deficit in exchange for early piece activity.",
  "middleGamePlan": "After recapturing the pawn with the queen (usually to d6 or d5), develop quickly and look to use the open d-file. The queen on d6 or d5 can be a target, so piece activity must compensate. Queenside development with ...Bg4, ...Nc6, and then castling queenside or kingside depending on the position is the typical plan.",
  "watchOut": "Leaving the queen exposed in the center — after ...Qxd5, White gains time with Nc3 attacking it, so you must develop fast enough to keep up.",
  "typicalGoals": [
    "Develop pieces quickly to justify the early queen sortie",
    "Use the semi-open d-file for rook pressure",
    "Activate the dark-squared bishop to g4 or f5",
    "Castle quickly before White can exploit the development lead"
  ],
  "quiz": {
    "question": "You played the Scandinavian and recaptured with ...Qxd5. White plays Nc3 attacking your queen. What's the priority?",
    "options": [
      {
        "id": "a",
        "text": "Retreat the queen to d8 to safety",
        "correct": false,
        "explanation": "Retreating to d8 loses a full tempo and undoes the reason for playing ...d5 in the first place. Move the queen to an active square instead."
      },
      {
        "id": "b",
        "text": "Move the queen to d6 or a5 and develop another piece",
        "correct": true,
        "explanation": "Correct. Moving the queen to an active square (d6 or a5) and immediately developing another piece keeps the position dynamic and compensates for the tempo lost."
      },
      {
        "id": "c",
        "text": "Play ...c6 to support the queen on d5",
        "correct": false,
        "explanation": "...c6 is sometimes played but blocks natural piece development to c6. The Scandinavian works best with quick piece activity, not pawn consolidation."
      }
    ]
  }
}
```

### 5.10 Pirc Defense (`pirc-defense.json`)

```json
"strategy": {
  "positionTypes": ["semi-closed", "dynamic"],
  "keyIdea": "Let White build a large center and then undermine it with piece pressure and well-timed pawn breaks — a hypermodern approach.",
  "middleGamePlan": "After fianchettoing the bishop on g7, use it as your main weapon against White's center. ...c5 and ...d6-d5 are the typical breaks depending on the setup. The g7 bishop is the cornerstone of Black's position — protect it and keep it active. Look for ...Bg4 to pin the knight and relieve pressure, and castle kingside to connect the rook with the g7 bishop.",
  "watchOut": "Allowing White to close the position and attack on the kingside before you've undermined the center — in the Pirc, timing of the counterattack is everything.",
  "typicalGoals": [
    "Fianchetto the bishop on g7 as the main attacking piece",
    "Play ...c5 to undermine White's d4 pawn",
    "Use ...d5 as a pawn break when White's center overextends",
    "Castle kingside and use the bishop-rook battery along the g-file"
  ],
  "quiz": {
    "question": "You're playing the Pirc. White has built a strong center with e4 and d4. What's your main weapon?",
    "options": [
      {
        "id": "a",
        "text": "Exchange your fianchettoed bishop to remove a piece and simplify",
        "correct": false,
        "explanation": "The g7 bishop is the core of the Pirc — trading it voluntarily gives up your best piece and leaves you without compensation for allowing White's center."
      },
      {
        "id": "b",
        "text": "Use the g7 bishop to exert long-range pressure and break with ...c5",
        "correct": true,
        "explanation": "Correct. The g7 bishop pressures White's center from the flank, and ...c5 is the typical undermining break that challenges d4 and creates counterplay."
      },
      {
        "id": "c",
        "text": "Push ...e5 immediately to fight for the center directly",
        "correct": false,
        "explanation": "...e5 without preparation is premature in the Pirc and can leave you with a weakened d6 pawn. Proper preparation with ...c5 or piece development comes first."
      }
    ]
  }
}
```

---

## 6. Component Changes

### 6.1 Overhaul `OpeningSummary.tsx`

The component fires when `phase === 'free'`. The current implementation should be replaced entirely with a **Strategy Briefing** card.

**Visual structure (top to bottom):**

```
┌─────────────────────────────────────────────┐
│  ✓ Opening Complete — [Opening Name]        │
│  ECO: C50  ·  [tag: closed] [tag: positional]│
├─────────────────────────────────────────────┤
│  KEY IDEA                                    │
│  [keyIdea text]                              │
├─────────────────────────────────────────────┤
│  MIDDLEGAME PLAN                             │
│  [middleGamePlan text]                       │
├─────────────────────────────────────────────┤
│  ⚠ WATCH OUT                                │
│  [watchOut text]                             │
├─────────────────────────────────────────────┤
│  TYPICAL GOALS                               │
│  • [goal 1]                                  │
│  • [goal 2]                                  │
│  • [goal 3]                                  │
│  • [goal 4]                                  │
├─────────────────────────────────────────────┤
│  QUICK CHECK                                 │
│  [question]                                  │
│                                              │
│  ○ [option a]                                │
│  ○ [option b]                                │
│  ○ [option c]                                │
│                                              │
│  [explanation appears after selection]       │
└─────────────────────────────────────────────┘
```

**Behavioral requirements:**

- The entire briefing renders when `phase === 'free'` and `openingId` is set
- If `strategy` is absent from the opening data, fall back to the current minimal display (opening name + moves played) — do not error
- Position type tags render as small colored pills: `closed` → slate, `open` → green, `semi-open` → blue, `semi-closed` → purple, `dynamic` → amber, `tactical` → red, `positional` → indigo, `attacking` → orange, `defensive` → teal
- The quiz is interactive: selecting an option locks the choice, reveals the explanation text below the selected option, and colors the option green (correct) or red (incorrect)
- Once an answer is selected, all options become non-interactive
- The quiz state is local component state — no persistence, resets on new game
- The existing eval display (`formatEval`) is removed from this component
- The "Theory Played" move list from the old summary is also removed — moves are already shown in `MoveList`

### 6.2 No changes to `CoachPanel.tsx`

`OpeningSummary` is already rendered inside `CoachPanel` — its position in the layout does not change.

---

## 7. TypeScript Requirements

- All new fields in `Strategy` are required (not optional) when the `strategy` key is present on an opening
- `QuizOption.correct` must be `boolean`, not nullable
- `Quiz.options` should be typed as a tuple of exactly 3: `[QuizOption, QuizOption, QuizOption]` to enforce the 3-option constraint at the type level
- `PositionType` and `PlayStyle` should be string union types (not enums) for JSON compatibility

---

## 8. Test Cases (for TDD)

These are the behaviors that must be covered by tests.

### Data validation
- Every opening JSON with a `strategy` field passes TypeScript type checking against the `Strategy` interface
- Each opening's quiz has exactly one option with `correct: true`
- Each opening's quiz has exactly 3 options

### `OpeningSummary` component
- Does not render when `phase === 'opening'`
- Does not render when `phase === 'free'` but `openingId` is null
- Renders the opening name when `phase === 'free'` and `openingId` is set
- Renders the `keyIdea` text when `strategy` is present
- Renders the `middleGamePlan` text when `strategy` is present
- Renders the `watchOut` text when `strategy` is present
- Renders all `typicalGoals` as list items when `strategy` is present
- Renders fallback (no crash) when `strategy` is absent
- Renders the quiz question when `strategy` is present
- Renders exactly 3 quiz options
- Quiz options are interactive before selection
- Selecting an option displays the `explanation` for that option
- Selecting the correct option applies a "correct" visual state
- Selecting an incorrect option applies an "incorrect" visual state
- After selection, all options become non-interactive
- Quiz state resets when the component unmounts and remounts (i.e. new game)

---

## 9. Acceptance Criteria

- [ ] All 10 opening JSON files contain a `strategy` field matching the `Strategy` interface
- [ ] `src/types/index.ts` exports `Strategy`, `PositionType`, `PlayStyle`, `Quiz`, and `QuizOption`
- [ ] `OpeningData` includes `strategy?: Strategy`
- [ ] `OpeningSummary.tsx` renders the full briefing card in `phase === 'free'` with strategy data
- [ ] `OpeningSummary.tsx` renders a fallback without crashing when `strategy` is absent
- [ ] The quiz allows exactly one selection, locks after selection, and shows the explanation
- [ ] All TDD test cases listed in Section 8 pass
- [ ] No existing tests broken by these changes
- [ ] TypeScript build passes with no new errors (`tsc --noEmit`)

---

## 10. Out of Scope / Future Considerations

- **Per-defense strategy**: Each defense already has a `profile` field for its own character — extending strategy to the defense level (e.g. different plans for Giuoco Piano vs Two Knights) is a future enhancement
- **Quiz scoring / progress tracking**: Tracking whether the user got the quiz right over time is a future feature
- **AI-generated explanations**: Using a language model to generate commentary dynamically is a future consideration — all content in this PRD is static and authored
- **Board highlighting**: Showing arrow overlays or highlighted squares illustrating the strategic plan on the board is a future visual enhancement
- **Thematic example games**: Linking to or auto-playing famous games in this opening is a future feature
