import { useEffect, useMemo, useRef, useState } from 'react'
import { backendBase, buildApiUrl, normalizeBase, operatorBase } from '../api/config'
import { extractTemplateVariables } from '../model/variables'
import { useTemplateEditorStore } from '../state/store'
import CanvasEditor from '../ui/CanvasEditor'
import JsonDialog from '../ui/JsonDialog'
import LabelPreviewPanel from '../ui/LabelPreviewPanel'
import PropertiesPanel from '../ui/PropertiesPanel'
import TemplateStoreDialog from '../ui/TemplateStoreDialog'
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
  const doc = useTemplateEditorStore((s) => s.history.present)
  const preview = useTemplateEditorStore((s) => s.preview)
  const variableValues = useTemplateEditorStore((s) => s.variableValues)
  const syncVariableKeys = useTemplateEditorStore((s) => s.syncVariableKeys)
  const [jsonDialog, setJsonDialog] = useState<{ mode: 'export' | 'import' } | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [printStatus, setPrintStatus] = useState<{ state: 'idle' | 'loading' | 'error'; message?: string }>({
    state: 'idle'
  })
  const [printError, setPrintError] = useState<string | null>(null)
  const [rightPanelWidth, setRightPanelWidth] = useState(440)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)
  const { variables: requiredVariables } = useMemo(() => extractTemplateVariables(doc), [doc])

  useEffect(() => {
    syncVariableKeys(requiredVariables)
  }, [requiredVariables, syncVariableKeys])

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

  const readErrorBody = async (res: Response) => {
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        const payload = await res.json()
        if (typeof payload?.message === 'string') return payload.message
        if (typeof payload?.error === 'string') return payload.error
        if (typeof payload?.detail === 'string') return payload.detail
        return JSON.stringify(payload)
      } catch {
        // Fall through to text.
      }
    }
    return (await res.text()) || res.statusText
  }

  const handlePrint = async () => {
    setPrintStatus({ state: 'loading' })
    try {
      const variables: Record<string, string> = {}
      requiredVariables.forEach((key) => {
        variables[key] = variableValues[key] ?? ''
      })
      const res = await fetch(buildApiUrl(backendBase, '/v1/drafts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: doc,
          variables,
          target: {
            width_mm: preview.width_mm,
            height_mm: preview.height_mm,
            dpi: preview.dpi,
            origin_x_mm: 0,
            origin_y_mm: 0
          },
          debug: false
        })
      })
      if (!res.ok) {
        const body = await readErrorBody(res)
        throw new Error(body || `Print draft failed (${res.status})`)
      }
      const payload = await res.json()
      const draftId = payload?.draft_id
      if (!draftId) throw new Error('Print draft API did not return a draft_id')
      const operator = normalizeBase(operatorBase || '')
      const target = `${operator || ''}/print?draft_id=${encodeURIComponent(draftId)}`
      window.location.href = target
    } catch (e: any) {
      const message = String(e?.message ?? e)
      setPrintStatus({ state: 'error', message })
      setPrintError(message)
    }
  }

  return (
    <div className={'h-full flex flex-col app-root theme-' + theme}>
      <TopBar
        onOpenExport={() => setJsonDialog({ mode: 'export' })}
        onOpenImport={() => setJsonDialog({ mode: 'import' })}
        onOpenTemplates={() => setTemplateDialogOpen(true)}
        onPrint={handlePrint}
        printStatus={printStatus}
      />
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
      {templateDialogOpen && <TemplateStoreDialog onClose={() => setTemplateDialogOpen(false)} />}
      {printError && (
        <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-6'>
          <div className='w-full max-w-2xl rounded border panel overflow-hidden'>
            <div className='px-3 py-2 border-b app-bar flex items-center justify-between'>
              <div className='text-sm font-semibold'>Print draft failed</div>
              <button className='px-2 py-1 text-sm rounded border btn' onClick={() => setPrintError(null)} type='button'>
                Close
              </button>
            </div>
            <div className='p-3 text-sm whitespace-pre-wrap'>{printError}</div>
          </div>
        </div>
      )}
    </div>
  )
}
