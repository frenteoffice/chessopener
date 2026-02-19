import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { BoardSection } from './BoardSection'
import { CoachPanel } from './CoachPanel'
import { GameControls } from './GameControls'
import { useGameStore } from '@/store/gameStore'
import { StockfishBridge } from '@/services/StockfishBridge'
import { OpeningTree } from '@/services/OpeningTree'
import { CommentaryService } from '@/services/CommentaryService'
import { getEngineMove } from '@/services/EngineMoveSelector'
import { classifyStructure } from '@/services/MetricsEngine'
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
    setPendingMove,
    setEvaluation,
    setDeviationEvent,
    engineElo,
    opponentIntelligence,
    selectedDefenseId,
  } = useGameStore()
  const pendingMove = useGameStore((s) => s.pendingMove)
  const history = useGameStore((s) => s.history)
  const [engineReady, setEngineReady] = useState(false)
  const engineFirstMoveRequested = useRef(false)
  const openingTreeRef = useRef<OpeningTree | null>(null)
  const loadedOpeningIdRef = useRef<string | null>(null)
  const defenseNodeRef = useRef<ReturnType<OpeningTree['getDefenseNode']>>(null)

  const openingId = useGameStore((s) => s.openingId)
  // Build the tree synchronously during render so it's available on the first move
  if (openingId && loadedOpeningIdRef.current !== openingId) {
    const data = openings.find((o) => o.id === openingId)
    if (data) {
      openingTreeRef.current = new OpeningTree(data)
      loadedOpeningIdRef.current = openingId
    }
  }

  useEffect(() => {
    getStockfish()
      .init()
      .then(() => {
        getStockfish().setElo(engineElo)
        setEngineReady(true)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (engineReady) getStockfish().setElo(engineElo)
  }, [engineElo, engineReady])

  // Set openingNode at game start; load defense when in specific-defense mode
  useEffect(() => {
    if (!openingId || !openingTreeRef.current) return
    const tree = openingTreeRef.current
    const opening = openings.find((o) => o.id === openingId)
    if (
      opening?.rootFen &&
      fen === opening.rootFen &&
      history.length === 0 &&
      phase === 'opening'
    ) {
      const rootNode = tree.getRootNode()
      if (rootNode) setOpeningNode(rootNode)
      if (opponentIntelligence === 'specific-defense' && selectedDefenseId) {
        tree.loadDefense(selectedDefenseId)
        defenseNodeRef.current = tree.getDefenseNode(fen)
      } else {
        defenseNodeRef.current = null
      }
    }
  }, [openingId, fen, history.length, phase, setOpeningNode, opponentIntelligence, selectedDefenseId])

  // When switching opening via transposition accept, sync openingNode from new tree
  const prevOpeningIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!openingId || !openingTreeRef.current) return
    if (prevOpeningIdRef.current !== openingId && history.length > 0) {
      prevOpeningIdRef.current = openingId
      const currentFen = useGameStore.getState().fen
      const node = openingTreeRef.current.getNode(currentFen)
      setOpeningNode(node)
    }
  }, [openingId, history.length, setOpeningNode])

  // When player is black, engine (white) moves first
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
      const openingNode = tree?.getNode(fen) ?? null
      const defenseNode = tree?.getDefenseNode(fen) ?? null
      getEngineMove({
        mode: opponentIntelligence,
        openingNode,
        defenseNode,
        fen,
        tree,
        stockfish: getStockfish(),
        engineElo,
      })
        .then((result) => {
          if (result.san) {
            const gameChess = new Chess(fen)
            const engineMove = gameChess.move(result.san)
            if (engineMove) {
              applyMove(
                {
                  from: engineMove.from as `${string}${number}`,
                  to: engineMove.to as `${string}${number}`,
                  promotion: 'q',
                },
                true
              )
              const newFen = useGameStore.getState().fen
              if (openingNode && tree) {
                const child = tree.getChild(openingNode, result.san)
                setOpeningNode(child ?? null)
                setCommentary(child?.commentary ?? '')
              } else if (defenseNode && tree) {
                const child = defenseNode.children?.find((c) => c.san === result.san)
                defenseNodeRef.current = tree.getDefenseNode(newFen)
                setCommentary(child?.commentary ?? defenseNode.commentary ?? '')
              }
            }
          } else if (result.uciMove) {
            const from = result.uciMove.slice(0, 2) as `${string}${number}`
            const to = result.uciMove.slice(2, 4) as `${string}${number}`
            applyMove({ from, to, promotion: 'q' }, false)
            setPhase('free')
            setOpeningNode(null)
            defenseNodeRef.current = tree?.getDefenseNode(useGameStore.getState().fen) ?? null
          }
        })
        .catch(console.error)
        .finally(() => setEngineThinking(false))
    }
  }, [
    engineReady,
    fen,
    playerColor,
    applyMove,
    setEngineThinking,
    setOpeningNode,
    setCommentary,
    phase,
    opponentIntelligence,
    engineElo,
  ])

  const handleMove = useCallback(
    async (
      sourceSquare: string,
      targetSquare: string,
      promotion: 'q' | 'r' | 'b' | 'n' = 'q'
    ) => {
      const tree = openingTreeRef.current
      const fenBeforeMove = useGameStore.getState().fen
      const chessBefore = new Chess(fenBeforeMove)
      const moveResult = chessBefore.move({
        from: sourceSquare,
        to: targetSquare,
        promotion,
      })
      if (!moveResult) return

      let inTheory = false
      const currentPhaseBefore = useGameStore.getState().phase
      if (tree && currentPhaseBefore === 'opening') {
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
        { from: sourceSquare, to: targetSquare, promotion },
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
        defenseNodeRef.current = tree?.getDefenseNode(fenAfter) ?? null
        try {
          const openingNode = tree?.getNode(fenAfter) ?? null
          const defenseNode = defenseNodeRef.current
          const result = await getEngineMove({
            mode: opponentIntelligence,
            openingNode,
            defenseNode,
            fen: fenAfter,
            tree: tree ?? null,
            stockfish: getStockfish(),
            engineElo,
          })

          if (result.san) {
            const chess = new Chess(fenAfter)
            const engineMove = chess.move(result.san)
            if (engineMove) {
              applyMove(
                {
                  from: engineMove.from as `${string}${number}`,
                  to: engineMove.to as `${string}${number}`,
                  promotion: (engineMove.promotion as 'q' | 'r' | 'b' | 'n') ?? 'q',
                },
                true
              )
              const newFen = useGameStore.getState().fen
              if (openingNode && tree) {
                const child = tree.getChild(openingNode, result.san)
                setOpeningNode(child ?? null)
                setCommentary(child?.commentary ?? '')
              } else if (defenseNode && tree) {
                const child = defenseNode.children?.find((c) => c.san === result.san)
                defenseNodeRef.current = tree.getDefenseNode(newFen)
                setCommentary(child?.commentary ?? defenseNode.commentary ?? '')
              }
            }
          } else if (result.uciMove) {
            const from = result.uciMove.slice(0, 2) as `${string}${number}`
            const to = result.uciMove.slice(2, 4) as `${string}${number}`
            const promo = result.uciMove.length === 5 ? (result.uciMove[4] as 'q' | 'r' | 'b' | 'n') : 'q'
            const chessForMove = new Chess(fenAfter)
            const engineMoveObj = chessForMove.move({ from, to, promotion: promo })
            const moveSan = engineMoveObj?.san ?? result.uciMove
            applyMove({ from, to, promotion: promo }, false)
            setPhase('free')
            setOpeningNode(null)
            const newFen = useGameStore.getState().fen
            if (result.isDeviation && tree) {
              const transposition = tree.findTransposition(newFen, openings)
              const chessForStruct = new Chess(newFen)
              const structureLabel = classifyStructure(chessForStruct)
              setDeviationEvent({
                move: moveSan,
                fen: newFen,
                structureLabel,
                transpositionOpening: transposition,
              })
            }
            setCommentaryLoading(true)
            const { metrics: m, history: h, detectedStructure } = useGameStore.getState()
            const lastMoveSan = h[h.length - 1]?.san ?? moveSan
            commentaryService
              .generateCommentary(lastMoveSan, m.delta, useGameStore.getState().fen, {
                structureLabel: detectedStructure ?? undefined,
                isEngineDeviation: result.isDeviation,
              })
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
      setDeviationEvent,
      playerColor,
      engineElo,
      engineReady,
      opponentIntelligence,
    ]
  )

  // Execute pending move when user clicks a theory suggestion
  useEffect(() => {
    if (!pendingMove || !engineReady) return
    const fenNow = useGameStore.getState().fen
    const chess = new Chess(fenNow)
    const result = chess.move(pendingMove)
    if (result) {
      setPendingMove(null)
      handleMove(result.from, result.to)
    } else {
      setPendingMove(null)
    }
  }, [pendingMove, engineReady, setPendingMove, handleMove])

  // Evaluate position when leaving theory (Fix 6)
  useEffect(() => {
    if (phase === 'free' && engineReady) {
      const fenNow = useGameStore.getState().fen
      getStockfish()
        .evaluate(fenNow, 12)
        .then((cp) => setEvaluation(cp))
        .catch(() => setEvaluation(null))
    }
  }, [phase, engineReady, setEvaluation])

  return (
    <div className="flex gap-8 p-6 min-h-screen">
      <CoachPanel />
      <div className="flex flex-col gap-4">
        <BoardSection onMove={handleMove} boardFlipped={useGameStore((s) => s.boardFlipped)} />
        <GameControls />
      </div>
    </div>
  )
}
