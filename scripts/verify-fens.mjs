#!/usr/bin/env node
/**
 * Verifies that all FENs in opening JSON files match chess.js output.
 * Run: node scripts/verify-fens.mjs
 */
import { Chess } from 'chess.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '../src/data/openings')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))

let hasErrors = false

function verifyNode(node, chess, path = '') {
  const move = chess.move(node.san)
  if (!move) {
    console.error(`  ❌ Invalid move ${node.san} at ${path}`)
    hasErrors = true
    return
  }
  const expectedFen = chess.fen()
  if (node.fen !== expectedFen) {
    console.error(`  ❌ FEN mismatch at ${path}${node.san}:`)
    console.error(`     Expected: ${expectedFen}`)
    console.error(`     Got:      ${node.fen}`)
    hasErrors = true
  }
  if (node.children?.length) {
    for (const child of node.children) {
      const childChess = new Chess(chess.fen())
      verifyNode(child, childChess, path + node.san + ' ')
    }
  }
  chess.undo()
}

for (const file of files) {
  const filePath = path.join(dir, file)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const rootFen = new Chess(data.rootFen).fen()
  if (data.rootFen !== rootFen) {
    console.error(`❌ ${file}: rootFen mismatch`)
    console.error(`   Expected: ${rootFen}`)
    console.error(`   Got:      ${data.rootFen}`)
    hasErrors = true
  }
  for (const node of data.moves) {
    const chess = new Chess(data.rootFen)
    verifyNode(node, chess, '')
  }
  if (!hasErrors) {
    console.log(`✓ ${file}`)
  }
}

if (hasErrors) {
  process.exit(1)
}
console.log('\nAll FENs verified successfully.')
