# OpeningIQ

A web-based chess opening trainer that teaches *why* moves work, not just *what* to play. Practice openings against Stockfish with intelligent commentary and position metrics.

## Features

- **10 Openings**: Italian Game, Ruy Lopez, London System, Queen's Gambit (White); King's Indian, Sicilian Najdorf, Caro-Kann, French, Pirc, Scandinavian (Black)
- **Theory-weighted engine**: During the opening phase, the engine responds from the opening tree with weighted randomness
- **Position metrics**: Piece activity, center control, pawn structure, and king safety with live updates
- **Commentary**: Pre-generated for mainline moves; LLM-generated for deviations (requires API key)
- **ELO selector**: Play against Stockfish at 800–2000 ELO in free play

## Tech Stack

- React 18 + Vite + TypeScript
- chess.js, react-chessboard
- Stockfish.js (WASM)
- Zustand, Tailwind CSS

## Development

### Basic (no commentary)

```bash
npm install
npm run dev
```

This starts the board, engine, and opening tree. Commentary for off-book moves requires a Netlify function (see below) and will be silently skipped.

### With LLM commentary (requires Netlify CLI)

Install the Netlify CLI if you don't have it:

```bash
npm install -g netlify-cli
```

Create a `.env` file in the project root:

```
OPENAI_API_KEY=sk-...your-key-here...
VITE_COMMENTARY_ENABLED=true
```

Then run:

```bash
netlify dev
```

This starts both the Vite dev server and the Netlify functions server locally. Commentary will be generated for off-book moves.

## Build

```bash
npm run build
```

## Deployment (Netlify)

1. Connect your repo to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variable: `OPENAI_API_KEY` (for LLM commentary)

The Stockfish WASM files require these headers (included in `netlify.toml`):

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Project Structure

```
src/
├── components/     # React components
├── data/openings/  # Opening JSON files
├── services/       # StockfishBridge, OpeningTree, MetricsEngine, CommentaryService
├── store/          # Zustand game store
└── types/          # TypeScript types

netlify/functions/  # Commentary API (OpenAI)
```
