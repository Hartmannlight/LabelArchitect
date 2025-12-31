import { useMemo, useState } from 'react'
import { listNodes } from '../model/ids'
import { useTemplateEditorStore } from '../state/store'

export default function TreePanel() {
  const root = useTemplateEditorStore((s) => s.history.present.layout)
  const selection = useTemplateEditorStore((s) => s.selection)
  const selectNode = useTemplateEditorStore((s) => s.selectNode)
  const setAlias = useTemplateEditorStore((s) => s.setAlias)

  const nodes = useMemo(() => listNodes(root), [root])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const hasCollapsedAncestor = (nodeId: string) => {
    if (nodeId === 'r') return false
    const parts = nodeId.split('/').slice(1)
    let cur = 'r'
    for (let i = 0; i < parts.length - 1; i += 1) {
      cur += '/' + parts[i]
      if (collapsed.has(cur)) return true
    }
    return false
  }

  return (
    <div className='h-full flex flex-col'>
      <div className='px-3 py-2 border-b app-bar text-sm font-semibold'>Structure</div>
      <div className='flex-1 overflow-auto'>
        {nodes.map((n) => {
          if (hasCollapsedAncestor(n.nodeId)) return null
          const selected = selection?.nodeId === n.nodeId
          const isEditing = editingId === n.nodeId
          return (
            <button
              key={n.nodeId}
              className={
                'w-full text-left px-3 py-2 text-sm border-b flex items-center gap-2 border-[var(--border)] ' +
                (selected ? 'bg-[var(--panel-muted)]' : 'bg-[var(--panel-bg)] hover:bg-[var(--panel-muted)]')
              }
              onClick={() => selectNode(n.nodeId)}
              onDoubleClick={() => {
                setEditingId(n.nodeId)
                setEditingValue(n.alias ?? '')
              }}
              type='button'
              style={{ paddingLeft: 12 + n.depth * 14 }}
            >
              {n.kind === 'split' ? (
                <span
                  className='text-subtle'
                  onClick={(e) => {
                    e.stopPropagation()
                    setCollapsed((prev) => {
                      const next = new Set(prev)
                      if (next.has(n.nodeId)) next.delete(n.nodeId)
                      else next.add(n.nodeId)
                      return next
                    })
                  }}
                >
                  {collapsed.has(n.nodeId) ? '▸' : '▾'}
                </span>
              ) : (
                <span className='text-subtle'>•</span>
              )}
              <span className='text-muted'>{n.kind === 'split' ? 'S' : 'L'}</span>
              <span className='font-mono text-xs text-subtle'>{n.nodeId}</span>
              {isEditing ? (
                <input
                  className='flex-1 min-w-0 border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)]'
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setAlias(n.nodeId, editingValue)
                      setEditingId(null)
                    } else if (e.key === 'Escape') {
                      setEditingId(null)
                    }
                  }}
                  onBlur={() => {
                    setAlias(n.nodeId, editingValue)
                    setEditingId(null)
                  }}
                  placeholder='Alias'
                  autoFocus
                />
              ) : (
                <span className='text-strong'>{n.alias ? n.alias : ''}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
