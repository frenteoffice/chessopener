import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { BoardSection } from './BoardSection'
import { CoachPanel } from './CoachPanel'
import { GameControls } from './GameControls'
import { useGameStore } from '@/store/gameStore'
import { StockfishBridge } from '@/services/StockfishBridge'
import { OpeningTree } from '@/services/OpeningTree'
import { CommentaryService } from '@/services/CommentaryService'
import { openings } from '@/data/openings'

const commentaryService = new CommentaryService()

let stockfishBridge: StockfishBridge | null = null

function getStockfish(): StockfishBridge {
  if (!stockfishBridge) {
    stockfishBridge = new StockfishBridge()
  }
  return stockfishBridge
}

export function GameView() {
  const {
    fen,
    playerColor,
    phase,
    applyMove,
    setCommentary,
    setCommentaryLoading,
    setEngineThinking,
    setPhase,
    setOpeningNode,
    engineElo,
  } = useGameStore()
  const [engineReady, setEngineReady] = useState(false)
  const engineFirstMoveRequested = useRef(false)
  const openingTreeRef = useRef<OpeningTree | null>(null)

  const openingId = useGameStore((s) => s.openingId)
  useEffect(() => {
    if (openingId) {
      const data = openings.find((o) => o.id === openingId)
      if (data) openingTreeRef.current = new OpeningTree(data)
    }
  }, [openingId])

  useEffect(() => {
    getStockfish()
      .init()
      .then(() => {
        getStockfish().setElo(engineElo)
        setEngineReady(true)
      })
      .catch(console.error)
  }, [engineElo])

  // When player is black, engine (white) moves first
  const history = useGameStore((s) => s.history)
  useEffect(() => {
    if (history.length === 0) {
      engineFirstMoveRequested.current = false
    }
  }, [history.length])

  useEffect(() => {
    if (!engineReady) return
    if (engineFirstMoveRequested.current) return
    const chess = new Chess(fen)
    const turn = chess.turn()
    const isEngineTurn =
      (playerColor === 'white' && turn === 'b') ||
      (playerColor === 'black' && turn === 'w')
    const currentHistory = useGameStore.getState().history
    if (isEngineTurn && currentHistory.length === 0) {
      engineFirstMoveRequested.current = true
      setEngineThinking(true)
      const tree = openingTreeRef.current
      const node = tree?.getNode(fen)
      if (tree && node && phase === 'opening') {
        const moveSan = tree.sampleResponse(node)
        const gameChess = new Chess(fen)
        const engineMove = gameChess.move(moveSan)
        if (engineMove) {
          applyMove(
            {
              from: engineMove.from as `${string}${number}`,
              to: engineMove.to as `${string}${number}`,
              promotion: 'q',
            },
            true
          )
          const child = tree.getChild(node, moveSan)
          setOpeningNode(child)
          setCommentary(child?.commentary ?? '')
        }
      } else {
        getStockfish()
          .getMove(fen, 12)
          .then((uciMove) => {
            const from = uciMove.slice(0, 2) as `${string}${number}`
            const to = uciMove.slice(2, 4) as `${string}${number}`
            applyMove({ from, to, promotion: 'q' }, false)
          })
          .catch(console.error)
      }
      setEngineThinking(false)
    }
  }, [engineReady, fen, playerColor, applyMove, setEngineThinking, setOpeningNode, setCommentary, phase])

  const handleMove = useCallback(
    async (sourceSquare: string, targetSquare: string) => {
      const tree = openingTreeRef.current
      const fenBeforeMove = useGameStore.getState().fen
      const chessBefore = new Chess(fenBeforeMove)
      const moveResult = chessBefore.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })
      if (!moveResult) return

      let inTheory = false
      if (tree && phase === 'opening') {
        const node = tree.getNode(fenBeforeMove)
        const child = node ? tree.getChild(node, moveResult.san) : null
        inTheory = !!child
        if (!child) {
          setPhase('free')
          setOpeningNode(null)
        } else {
          setOpeningNode(child)
          setCommentary(child.commentary ?? '')
        }
      }

      const success = applyMove(
        { from: sourceSquare, to: targetSquare, promotion: 'q' },
        inTheory
      )
      if (!success) return
      if (!inTheory) {
        setCommentaryLoading(true)
        const { metrics: m } = useGameStore.getState()
        commentaryService
          .generateCommentary(moveResult.san, m.delta, useGameStore.getState().fen)
          .then(setCommentary)
          .catch(() => setCommentary('Commentary unavailable.'))
          .finally(() => setCommentaryLoading(false))
      }

      const fenAfter = useGameStore.getState().fen
      const chessAfter = new Chess(fenAfter)
      const turn = chessAfter.turn()
      const isEngineTurn =
        (playerColor === 'white' && turn === 'b') ||
        (playerColor === 'black' && turn === 'w')

      if (isEngineTurn && engineReady) {
        setEngineThinking(true)
        try {
          const currentPhase = useGameStore.getState().phase
          const currentNode = tree?.getNode(fenAfter)

          if (currentPhase === 'opening' && currentNode && tree) {
            const moveSan = tree.sampleResponse(currentNode)
            const chess = new Chess(fenAfter)
            const engineMove = chess.move(moveSan)
            if (engineMove) {
              applyMove(
                {
                  from: engineMove.from as `${string}${number}`,
                  to: engineMove.to as `${string}${number}`,
                  promotion: 'q',
                },
                true
              )
              const child = tree!.getChild(currentNode, moveSan)
              setOpeningNode(child)
              setCommentary(child?.commentary ?? '')
            }
          } else {
            setPhase('free')
            setOpeningNode(null)
            const sf = getStockfish()
            await sf.setElo(engineElo)
            const uciMove = await sf.getMove(fenAfter, 12)
            const from = uciMove.slice(0, 2) as `${string}${number}`
            const to = uciMove.slice(2, 4) as `${string}${number}`
            applyMove({ from, to, promotion: 'q' }, false)
            setCommentaryLoading(true)
            const { metrics: m, history: h } = useGameStore.getState()
            const lastMoveSan = h[h.length - 1]?.san ?? uciMove
            commentaryService
              .generateCommentary(lastMoveSan, m.delta, useGameStore.getState().fen)
              .then(setCommentary)
              .catch(() => setCommentary('Commentary unavailable.'))
              .finally(() => setCommentaryLoading(false))
          }
        } catch (err) {
          console.error('Engine error:', err)
        } finally {
          setEngineThinking(false)
        }
      }
    },
    [
      applyMove,
      setCommentary,
      setEngineThinking,
      setPhase,
      setOpeningNode,
      playerColor,
      engineElo,
      engineReady,
      phase,
    ]
  )

  return (
    <div className="flex gap-8 p-6 min-h-screen">
      <CoachPanel />
      <div className="flex flex-col gap-4">
        <BoardSection onMove={handleMove} />
        <GameControls />
      </div>
    </div>
  )
}
