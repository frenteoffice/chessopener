import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getMasteryColor } from '@/services/VariationTreeBuilder'

export interface TreeNodeData {
  san: string
  variationName?: string
  confidence: number
  lineCount: number
  lineIds?: string[]
}

function TreeNodeComponent(props: NodeProps) {
  const data = props.data as unknown as TreeNodeData
  const san = data?.san ?? ''
  const variationName = data?.variationName
  const confidence = data?.confidence ?? 0
  const lineCount = data?.lineCount ?? 0
  const colorClass = getMasteryColor(confidence)

  return (
    <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 min-w-[120px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className="font-semibold text-slate-100 text-sm">{san || 'Start'}</div>
      {variationName && (
        <div className="text-xs text-slate-400 mt-0.5">{variationName}</div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorClass} transition-all`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className="text-xs text-slate-500">{lineCount} lines</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  )
}

export default memo(TreeNodeComponent)
