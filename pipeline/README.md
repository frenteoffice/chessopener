# Chess Opening Knowledge Base Pipeline

Standalone data pipeline for the Chess Opening Knowledge Base per the [TDD](docs/Chess_Opening_Knowledge_Base_TDD.md).

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d db

# 2. Create schema (if not auto-initialized)
psql $DATABASE_URL -f pipeline/schema.sql

# 3. Fetch ECO taxonomy
cd pipeline && bash scripts/fetch_eco.sh

# 4. Run Phase 1 — ECO ingestion
python eco_ingest.py --source data/eco

# 5. Run Phase 2 — Lichess expansion (optional; requires LICHESS_TOKEN for rate limit)
python lichess_crawler.py --min-games 50 --depth 5 --max-seeds 5

# 6. Run remaining phases
python stockfish_annotator.py --max-nodes 100
python structure_tagger.py
python transposition_resolver.py

# 7. Export for OpeningIQ
python export.py --format json --output ../src/data/openings/ --eco C50
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://localhost:5432/chess_openings?user=postgres&password=postgres` | PostgreSQL connection |
| `LICHESS_TOKEN` | — | Lichess OAuth token for 8 req/sec (optional) |
| `STOCKFISH_PATH` | `stockfish` | Path to Stockfish binary |

## Phases

1. **eco_ingest.py** — Ingest ECO taxonomy from lichess-org/chess-openings TSV
2. **lichess_crawler.py** — Expand tree via Lichess Opening Explorer API
3. **pgn_validator.py** — Validate against TWIC PGN corpus
4. **stockfish_annotator.py** — Annotate with Stockfish evaluations
5. **structure_tagger.py** — Tag terminal nodes with pawn structures
6. **transposition_resolver.py** — Link transposed positions

## API

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
# or: docker compose up api
```

- `GET /node/fen/{fen}` — Lookup by FEN
- `GET /opening/eco/{eco}` — Tree by ECO code
- `GET /opening/search?q=ruy` — Fuzzy name search
- `POST /node/pgn` — Walk tree by PGN moves

## Tests

```bash
cd pipeline && pip install -r requirements.txt && pytest tests/ -v
```
