#!/bin/bash
# Fetch ECO taxonomy from lichess-org/chess-openings
set -e
mkdir -p data/eco
BASE="https://raw.githubusercontent.com/lichess-org/chess-openings/master"
for f in a b c d e; do
  echo "Fetching ${f}.tsv..."
  curl -sL -o "data/eco/${f}.tsv" "${BASE}/${f}.tsv"
done
echo "Done. Files in data/eco/"
