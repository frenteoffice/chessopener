// Course types for the Chess Opening Repertoire Trainer

export type Square = string // e.g., "e4", "d7"

export interface Alternative {
  san: string
  evaluation: string // "slightly worse" | "loses material" | etc.
  explanation: string
}

export interface LineMove {
  ply: number // 1-indexed ply within the line
  san: string
  fen: string
  color: 'w' | 'b'
  isUserMove: boolean // true if the user plays this move
  explanation: string
  from: Square
  to: Square
  alternatives?: Alternative[]
}

export interface Line {
  id: string
  name: string
  lineNumber: number // 1–39 (for display/reference)
  description: string
  moves: LineMove[]
}

export interface Category {
  id: string
  name: string
  description: string
  branchMove: string // the move that defines this branch ("Bc5")
  lines: Line[]
}

export interface Course {
  id: string
  name: string
  eco: string
  color: 'white' | 'black'
  description: string
  trunkMoves: string[] // shared prefix e.g. ["e4", "e5", "Nf3", "Nc6", "Bc4"]
  categories: Category[]
}
