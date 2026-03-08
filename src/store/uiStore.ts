import { create } from 'zustand'

export type AppView = 'course-selector' | 'variation-tree' | 'trainer' | 'progress'

interface UIState {
  view: AppView
  treeZoom: number
  treePan: { x: number; y: number }
  treeExpandedNodes: Set<string>
  sidePanel: 'explanation' | 'progress' | 'line-list' | null
  bothSidesMode: boolean

  setView: (view: AppView) => void
  setTreeZoom: (zoom: number) => void
  setTreePan: (pan: { x: number; y: number }) => void
  toggleTreeNode: (nodeId: string) => void
  setSidePanel: (panel: UIState['sidePanel']) => void
  toggleBothSidesMode: () => void
}

export const useUIStore = create<UIState>((set) => ({
  view: 'course-selector',
  treeZoom: 1,
  treePan: { x: 0, y: 0 },
  treeExpandedNodes: new Set(),
  sidePanel: null,
  bothSidesMode: false,

  setView: (view) => set({ view }),

  setTreeZoom: (treeZoom) => set({ treeZoom }),

  setTreePan: (treePan) => set({ treePan }),

  toggleTreeNode: (nodeId: string) =>
    set((s) => {
      const next = new Set(s.treeExpandedNodes)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return { treeExpandedNodes: next }
    }),

  setSidePanel: (sidePanel) => set({ sidePanel }),

  toggleBothSidesMode: () => set((s) => ({ bothSidesMode: !s.bothSidesMode })),
}))
