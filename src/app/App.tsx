import { useEffect, useMemo, useRef, useState } from 'react'
import { useTemplateEditorStore } from '../state/store'
import CanvasEditor from '../ui/CanvasEditor'
import JsonDialog from '../ui/JsonDialog'
import LabelPreviewPanel from '../ui/LabelPreviewPanel'
import PropertiesPanel from '../ui/PropertiesPanel'
import TopBar from '../ui/TopBar'
import TreePanel from '../ui/TreePanel'
import ValidationPanel from '../ui/ValidationPanel'

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return EDITABLE_TAGS.has(target.tagName)
}

export default function App() {
  const issues = useTemplateEditorStore((s) => s.validationIssues)
  const theme = useTemplateEditorStore((s) => s.theme)
  const [jsonDialog, setJsonDialog] = useState<{ mode: 'export' | 'import' } | null>(null)
  const [rightPanelWidth, setRightPanelWidth] = useState(440)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragState.current
      if (!drag) return
      const next = drag.startWidth + (drag.startX - event.clientX)
      setRightPanelWidth(Math.max(320, Math.min(720, Math.round(next))))
    }
    const onUp = () => {
      dragState.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      const editing = isEditableTarget(event.target)
      const store = useTemplateEditorStore.getState()

      if (isMod) {
        if (key === 'z') {
          event.preventDefault()
          if (event.shiftKey) store.redo()
          else if (!editing) store.undo()
          return
        }
        if (key === 'y') {
          event.preventDefault()
          if (!editing) store.redo()
          return
        }
        if (key === 'n') {
          event.preventDefault()
          store.newTemplate()
          return
        }
        if (key === 'i') {
          event.preventDefault()
          setJsonDialog({ mode: 'import' })
          return
        }
        if (key === 'e') {
          event.preventDefault()
          setJsonDialog({ mode: 'export' })
          return
        }
      }

      if (editing) return
      if (jsonDialog) return

      switch (key) {
        case 's':
          store.setTool('select')
          break
        case 'v':
          store.setTool('split_v')
          break
        case 'h':
          store.setTool('split_h')
          break
        case 't':
          store.setTool('place_text')
          break
        case 'q':
          store.setTool('place_qr')
          break
        case 'd':
          store.setTool('place_dm')
          break
        case 'i':
          store.setTool('place_image')
          break
        case 'l':
          store.setTool('place_line')
          break
        default:
          return
      }
      event.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [jsonDialog])

  return (
    <div className={'h-full flex flex-col app-root theme-' + theme}>
      <TopBar onOpenExport={() => setJsonDialog({ mode: 'export' })} onOpenImport={() => setJsonDialog({ mode: 'import' })} />
      <div
        className='flex-1 min-h-0 min-w-0 grid gap-2 p-2'
        style={{ gridTemplateColumns: `320px minmax(0, 1fr) ${rightPanelWidth}px` }}
      >
        <div className='min-h-0 rounded border panel overflow-hidden'>
          <TreePanel />
        </div>
        <div className='min-h-0 min-w-0 flex flex-col gap-2'>
          <div className='flex-1 min-h-0 rounded border panel overflow-hidden'>
            <CanvasEditor />
          </div>
          <div className='flex-1 min-h-0 rounded border panel overflow-hidden'>
            <LabelPreviewPanel />
          </div>
        </div>
        <div className='min-h-0 rounded border panel overflow-hidden relative'>
          <div
            className='absolute left-0 top-0 h-full w-2 cursor-col-resize hover:bg-[var(--panel-muted)]'
            onMouseDown={(event) => {
              dragState.current = { startX: event.clientX, startWidth: rightPanelWidth }
              event.preventDefault()
            }}
          />
          <PropertiesPanel />
        </div>
      </div>
      <div className='border-t app-bar'>
        <ValidationPanel issues={issues} />
      </div>

      {jsonDialog && <JsonDialog mode={jsonDialog.mode} onClose={() => setJsonDialog(null)} />}
    </div>
  )
}
