import { useMemo, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react'
import dagre from 'dagre'
import TreeNodeComponent from './TreeNodeComponent'
import type { TreeNode } from '@/services/VariationTreeBuilder'
import { useCourseStore } from '@/store/courseStore'
import { useProgressStore } from '@/store/progressStore'
import { useTrainerStore } from '@/store/trainerStore'
import { useUIStore } from '@/store/uiStore'
import { decayConfidence } from '@/services/ProgressCalculator'

import '@xyflow/react/dist/style.css'

const nodeTypes: NodeTypes = {
  treeNode: TreeNodeComponent,
}

function layoutTree(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 })

  nodes.forEach((n) => g.setNode(n.id, { width: 140, height: 80 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - 70, y: pos.y - 40 } }
  })
}

function treeToFlow(
  tree: TreeNode,
  getConfidence: (lineIds: string[]) => number
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  function walk(n: TreeNode, parentId: string | null) {
    const confidence =
      n.lineIds.length > 0
        ? Math.round(
            n.lineIds.reduce((s, id) => s + getConfidence([id]), 0) / n.lineIds.length
          )
        : 0
    const node: Node = {
      id: n.id,
      type: 'treeNode',
      position: { x: 0, y: 0 },
      data: {
        san: n.san || 'Start',
        variationName: n.variationName,
        confidence,
        lineCount: n.lineIds.length,
        lineIds: n.lineIds,
      },
    }
    nodes.push(node)
    if (parentId) edges.push({ id: `${parentId}-${n.id}`, source: parentId, target: n.id })
    n.children.forEach((c) => walk(c, n.id))
  }

  walk(tree, null)
  const laidOut = layoutTree(nodes, edges)
  return { nodes: laidOut, edges }
}

export function TreeGraph() {
  const variationTree = useCourseStore((s) => s.variationTree)
  const selectLine = useCourseStore((s) => s.selectLine)
  const setView = useUIStore((s) => s.setView)
  const startLine = useTrainerStore((s) => s.startLine)
  const progress = useProgressStore((s) => s.progress)

  const getConfidence = useCallback(
    (lineIds: string[]) => {
      if (!progress?.lines) return 0
      const vals = lineIds.map((id) => {
        const lp = progress.lines[id]
        if (!lp) return 0
        const days = Math.floor(
          (Date.now() - new Date(lp.lastPracticed).getTime()) / (24 * 60 * 60 * 1000)
        )
        return decayConfidence(lp.confidence, days)
      })
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    },
    [progress]
  )

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!variationTree) return { nodes: [], edges: [] }
    return treeToFlow(variationTree, getConfidence)
  }, [variationTree, getConfidence])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const lineIds = (node.data as { lineIds?: string[] })?.lineIds
      if (lineIds?.length) {
        selectLine(lineIds[0])
        startLine(lineIds[0], 'learn')
        setView('trainer')
      }
    },
    [selectLine, startLine, setView]
  )

  if (!variationTree) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-slate-500">
        No tree data. Select a course.
      </div>
    )
  }

  return (
    <div className="w-full h-[500px] rounded-lg border border-slate-600 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
