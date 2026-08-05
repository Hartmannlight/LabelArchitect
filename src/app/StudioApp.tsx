import type { TemplateDetailResponse, TemplateListItem } from '@printhub/sdk'
import { useCallback, useEffect, useState } from 'react'
import { backendBase, buildApiUrl } from '../api/config'
import { getBackendSdk } from '../api/sdk'
import { useTemplateEditorStore } from '../state/store'
import { starterTemplates } from '../model/starterTemplates'
import CanvasEditor from '../ui/CanvasEditor'
import JsonDialog from '../ui/JsonDialog'
import LabelPreviewPanel from '../ui/LabelPreviewPanel'
import PropertiesPanel from '../ui/PropertiesPanel'
import TemplateStoreDialog from '../ui/TemplateStoreDialog'
import TreePanel from '../ui/TreePanel'
import ValidationPanel from '../ui/ValidationPanel'

type View = 'templates' | 'print' | 'designer' | 'printers'
type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null
type PrintJob = { id: string; status: string; printer_id: string; template_id: string; attempts: number; error?: string | null; created_at: string }

const currentView = (): View => {
  if (new URLSearchParams(window.location.search).get('draft_id')) return 'print'
  const value = window.location.hash.replace('#/', '')
  return value === 'print' || value === 'designer' || value === 'printers' ? value : 'templates'
}

const navigate = (view: View) => {
  const url = new URL(window.location.href)
  if (view !== 'print') url.searchParams.delete('draft_id')
  url.hash = `/${view}`
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

function Brand() {
  return <div className='studio-brand'><div className='studio-mark' aria-hidden='true'>P</div><div><strong>PrintHub Studio</strong><span>Design, fill and print labels</span></div></div>
}

function AppNav({ view }: { view: View }) {
  const entries: Array<[View, string, string]> = [
    ['templates', 'Templates', 'Library and starter designs'],
    ['print', 'Quick print', 'Fill and send a label'],
    ['designer', 'Designer', 'Desktop label editor'],
    ['printers', 'Printers', 'ZebraTamer and direct printers']
  ]
  return <nav className='studio-nav' aria-label='PrintHub Studio'>{entries.map(([key, title, subtitle]) => <button key={key} type='button' className={view === key ? 'active' : ''} onClick={() => navigate(key)}><span>{title}</span><small>{subtitle}</small></button>)}</nav>
}

function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null
  return <div className={`notice notice-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><button type='button' onClick={onClose} aria-label='Dismiss message'>×</button></div>
}

function useTemplates() {
  const [items, setItems] = useState<TemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = async () => {
    setLoading(true); setError(null)
    try { setItems(await getBackendSdk().templates.list()) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }
  useEffect(() => void refresh(), [])
  return { items, loading, error, refresh }
}

function usePrinters() {
  const [printers, setPrinters] = useState<Array<Record<string, any>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = async () => {
    setLoading(true); setError(null)
    try { const response = await getBackendSdk().printers.list(); setPrinters((response.printers ?? []) as Array<Record<string, any>>) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }
  useEffect(() => void refresh(), [])
  return { printers, loading, error, refresh }
}

function TemplatePreview({ templateId, available }: { templateId: string; available?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let objectUrl: string | null = null; let active = true
    if (available === false) return
    getBackendSdk().templates.getPreview(templateId).then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }).catch(() => setUrl(null))
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [available, templateId])
  return url ? <img src={url} alt='' /> : <div className='preview-placeholder'>Preview</div>
}

function TemplateLibrary({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const { items, loading, error, refresh } = useTemplates()
  const [query, setQuery] = useState('')
  const loadTemplate = useTemplateEditorStore((state) => state.loadTemplate)
  const setBackendTemplateId = useTemplateEditorStore((state) => state.setBackendTemplateId)
  const setPreviewTarget = useTemplateEditorStore((state) => state.setPreviewTarget)
  const filtered = items.filter((item) => `${item.name} ${item.id} ${(item.tags ?? []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  const edit = async (id: string) => {
    try {
      const detail = await getBackendSdk().templates.get(id)
      loadTemplate(detail.template as any); setBackendTemplateId(detail.id)
      setPreviewTarget({ width_mm: Number(detail.preview_target.width_mm), height_mm: Number(detail.preview_target.height_mm), dpi: Number(detail.preview_target.dpi) })
      navigate('designer')
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) }
  }
  const startWith = (presetId: string) => {
    const preset = starterTemplates.find((entry) => entry.id === presetId)
    if (!preset) return
    const template = structuredClone(preset.template)
    template.extensions = {
      ...(template.extensions ?? {}),
      printhub: {
        variables: preset.variables,
        sample_data: preset.sampleData,
        tags: preset.tags
      }
    }
    loadTemplate(template)
    setBackendTemplateId(null)
    setPreviewTarget(preset.target)
    navigate('designer')
  }
  return <main className='page-shell'>
    <header className='page-heading'><div><span className='eyebrow'>Template library</span><h1>Start from a label that already works</h1><p>Templates are reusable outside Thingdex. Fill them here, from another app, or through the PrintHub API.</p></div><button className='primary-action' type='button' onClick={() => navigate('designer')}>New template</button></header>
    <section className='starter-section'><div className='section-heading'><div><h2>Starter designs</h2><p>Typed fields make these templates easy to fill manually or bind from Thingdex.</p></div></div><div className='starter-grid'>{starterTemplates.map((preset) => <button type='button' key={preset.id} onClick={() => startWith(preset.id)}><strong>{preset.name}</strong><span>{preset.description}</span><small>{preset.target.width_mm} × {preset.target.height_mm} mm · {preset.variables.length} fields</small></button>)}</div></section>
    <div className='library-toolbar'><label><span className='sr-only'>Search templates</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search saved templates and tags' /></label><button type='button' onClick={refresh}>Refresh</button></div>
    {loading && <div className='empty-state'>Loading templates…</div>}{error && <div className='empty-state error-state'>{error}</div>}
    {!loading && !error && !filtered.length && <div className='empty-state'>No matching templates. Create the first one in Designer.</div>}
    <div className='template-grid'>{filtered.map((template) => <article className='template-card' key={template.id}><div className='template-preview'><TemplatePreview templateId={template.id} available={template.preview_available} /></div><div className='template-card-body'><div className='template-meta'><span>{String(template.preview_target.width_mm)} × {String(template.preview_target.height_mm)} mm</span><span>{template.variables?.length ?? 0} fields</span></div><h2>{template.name}</h2><p>{template.tags?.length ? template.tags.join(' · ') : 'General purpose'}</p><div className='card-actions'><button type='button' className='primary-action' onClick={() => { sessionStorage.setItem('printhub:selectedTemplate', template.id); navigate('print') }}>Use template</button><button type='button' onClick={() => void edit(template.id)}>Edit</button></div></div></article>)}</div>
  </main>
}

function FieldInput({ definition, value, onChange }: { definition: Record<string, any>; value: string; onChange: (value: string) => void }) {
  const name = String(definition.name ?? ''); const type = String(definition.type ?? 'text'); const label = String(definition.label ?? name.replace(/[_.-]/g, ' ')); const required = definition.mode === 'required' || definition.required === true
  if (Array.isArray(definition.options)) return <label className='field'><span>{label}{required ? ' *' : ''}</span><select value={value} required={required} onChange={(event) => onChange(event.target.value)}><option value=''>Choose…</option>{definition.options.map((option: unknown) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></label>
  return <label className='field'><span>{label}{required ? ' *' : ''}</span><input type={['number', 'date', 'url'].includes(type) ? type : 'text'} value={value} required={required} placeholder={String(definition.placeholder ?? '')} onChange={(event) => onChange(event.target.value)} /></label>
}

function QuickPrint({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const templates = useTemplates(); const printerData = usePrinters()
  const [templateId, setTemplateId] = useState(() => sessionStorage.getItem('printhub:selectedTemplate') ?? '')
  const [template, setTemplate] = useState<TemplateDetailResponse | null>(null)
  const [printerId, setPrinterId] = useState(() => localStorage.getItem('printhub:printer') ?? '')
  const [values, setValues] = useState<Record<string, string>>({}); const [previewUrl, setPreviewUrl] = useState<string | null>(null); const [busy, setBusy] = useState<'preview' | 'print' | null>(null); const [printWarnings, setPrintWarnings] = useState<string[]>([])
  const draftId = new URLSearchParams(window.location.search).get('draft_id')
  useEffect(() => { if (!printerId && printerData.printers.length) setPrinterId(String(printerData.printers[0].id)) }, [printerData.printers, printerId])
  useEffect(() => {
    if (!templateId) { if (!draftId) setTemplate(null); return }
    getBackendSdk().templates.get(templateId).then((detail) => { setTemplate(detail); const sample = detail.sample_data ?? {}; const next: Record<string, string> = {}; (detail.variables ?? []).forEach((variable: any) => { const name = String(variable.name ?? ''); if (name) next[name] = String((sample as any)[name] ?? variable.default ?? '') }); setValues(next) }).catch((reason) => onNotice({ tone: 'error', text: errorText(reason) }))
  }, [draftId, onNotice, templateId])
  useEffect(() => {
    if (!draftId) return
    getBackendSdk().drafts.get(draftId).then((draft) => { setTemplate({ id: `draft:${draftId}`, name: 'Print draft', template: draft.template, variables: Object.keys(draft.variables ?? {}).map((name) => ({ name, mode: 'required' })), sample_data: draft.variables, preview_target: draft.target, preview_available: false, tags: [] } as any); setValues(Object.fromEntries(Object.entries(draft.variables ?? {}).map(([key, value]) => [key, String(value ?? '')]))) }).catch((reason) => onNotice({ tone: 'error', text: errorText(reason) }))
  }, [draftId, onNotice])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  const renderBody = () => template ? { template: template.template, variables: values, target: template.preview_target as any, debug: false } : null
  const preview = async () => { const body = renderBody(); if (!body) return; setBusy('preview'); try { const rendered = await getBackendSdk().renders.renderPngDetailed(body); const next = URL.createObjectURL(rendered.blob); setPrintWarnings(rendered.diagnostics.map((item) => item.message)); setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return next }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(null) } }
  const print = async () => { if (!template || !printerId) return; setBusy('print'); try { const body = renderBody(); if (!body) return; const preflight = await getBackendSdk().renders.renderZpl(body) as any; const warnings = (preflight.diagnostics ?? []).map((item: any) => String(item.message)); setPrintWarnings(warnings); if (warnings.length && !window.confirm(`This label has ${warnings.length} text layout warning(s):\n\n${warnings.join('\n')}\n\nPrint anyway?`)) return; let result: any; if (!draftId && templateId) { result = await getBackendSdk().printJobs.create({ printer_id: printerId, template_id: templateId, variables: values, target: template.preview_target as any, origin: 'printhub-studio' }) } else { result = await getBackendSdk().printers.printTemplate(printerId, { template: template.template, variables: values, target: template.preview_target as any, debug: false, return_preview: false }) } localStorage.setItem('printhub:printer', printerId); onNotice(result.status === 'failed' ? { tone: 'error', text: result.error ?? 'Print failed.' } : { tone: 'success', text: result.id ? `Print job ${result.id} ${result.status}.` : result.job_id ? `Print job ${result.job_id} queued.` : `Label sent to ${printerId}.` }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(null) } }
  return <main className='page-shell quick-print-page'><header className='page-heading compact'><div><span className='eyebrow'>Quick print</span><h1>Choose, fill, print</h1><p>This view is designed for phones, scanners and quick repeat jobs.</p></div></header><div className='quick-print-layout'><section className='form-panel'>
    {!draftId && <label className='field'><span>Template</span><select value={templateId} onChange={(event) => { setTemplateId(event.target.value); sessionStorage.setItem('printhub:selectedTemplate', event.target.value) }}><option value=''>Choose a template…</option>{templates.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {template && <div className='selected-template'><strong>{template.name}</strong><span>{String(template.preview_target.width_mm)} × {String(template.preview_target.height_mm)} mm</span></div>}
    <div className='variable-form'>{(template?.variables ?? []).filter((entry: any) => !String(entry.name ?? '').startsWith('_')).map((entry: any) => <FieldInput key={String(entry.name)} definition={entry} value={values[String(entry.name)] ?? ''} onChange={(value) => setValues((current) => ({ ...current, [String(entry.name)]: value }))} />)}</div>
    <label className='field'><span>Printer</span><select value={printerId} onChange={(event) => setPrinterId(event.target.value)}><option value=''>Choose a printer…</option>{printerData.printers.filter((printer) => printer.enabled !== false).map((printer) => <option key={printer.id} value={printer.id}>{printer.name ?? printer.id}</option>)}</select></label>
    {printWarnings.length > 0 && <div className='builder-warning' role='status'><strong>Text layout warnings</strong><ul className='list-disc pl-5'>{printWarnings.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul></div>}
    <div className='quick-actions'><button type='button' onClick={() => void preview()} disabled={!template || busy !== null}>{busy === 'preview' ? 'Rendering…' : 'Preview'}</button><button className='primary-action' type='button' onClick={() => void print()} disabled={!template || !printerId || busy !== null}>{busy === 'print' ? 'Checking and sending…' : 'Print label'}</button></div>
  </section><section className='print-preview' aria-label='Label preview'>{previewUrl ? <img src={previewUrl} alt='Rendered label preview' /> : template && !draftId ? <TemplatePreview templateId={template.id} available={template.preview_available} /> : <div className='preview-placeholder'>{template ? 'Tap Preview to render' : 'Select a template'}</div>}</section></div></main>
}

function Designer() {
  const doc = useTemplateEditorStore((state) => state.history.present); const tool = useTemplateEditorStore((state) => state.tool); const setTool = useTemplateEditorStore((state) => state.setTool); const undo = useTemplateEditorStore((state) => state.undo); const redo = useTemplateEditorStore((state) => state.redo); const newTemplate = useTemplateEditorStore((state) => state.newTemplate); const issues = useTemplateEditorStore((state) => state.validationIssues)
  const [storeOpen, setStoreOpen] = useState(false); const [jsonMode, setJsonMode] = useState<'export' | 'import' | null>(null)
  const [canvasSplit, setCanvasSplit] = useState(0.5); const [resizingCanvas, setResizingCanvas] = useState(false)
  const tools = [['select', 'Select', 'Esc'], ['split_v', 'Split ↔', 'V'], ['split_h', 'Split ↕', 'H'], ['place_text', 'Text', 'T'], ['place_qr', 'QR', 'Q'], ['place_dm', 'DataMatrix', 'D'], ['place_image', 'Image', 'I'], ['place_line', 'Line', 'L']] as const
  useEffect(() => { const handler = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const editing = target?.matches('input, textarea, select, [contenteditable="true"]')
    const key = event.key.toLowerCase()
    if (event.ctrlKey || event.metaKey) {
      if (key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if (key === 'y') { event.preventDefault(); redo() }
      if (key === 's') { event.preventDefault(); setStoreOpen(true) }
      return
    }
    if (editing || event.altKey) return
    const shortcuts = { v: 'split_v', h: 'split_h', t: 'place_text', q: 'place_qr', d: 'place_dm', i: 'place_image', l: 'place_line' } as const
    if (key === 'escape') { event.preventDefault(); setTool('select'); return }
    const nextTool = shortcuts[key as keyof typeof shortcuts]
    if (nextTool) { event.preventDefault(); setTool(nextTool) }
  }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [redo, setTool, undo])
  return <main className='designer-page'><div className='mobile-designer-warning'><strong>Designer is made for desktop.</strong><span>Use Quick print on this device to fill and print existing templates.</span><button type='button' className='primary-action' onClick={() => navigate('print')}>Open Quick print</button></div>
    <header className='designer-header'><div><span className='eyebrow'>Desktop designer</span><input aria-label='Template name' value={doc.name ?? ''} onChange={(event) => useTemplateEditorStore.getState().setTemplateName(event.target.value)} /></div><div className='designer-actions'><button type='button' onClick={newTemplate}>New</button><button type='button' onClick={() => setJsonMode('import')}>Import</button><button type='button' onClick={() => setJsonMode('export')}>Export</button><button type='button' className='primary-action' onClick={() => setStoreOpen(true)}>Save template</button></div></header>
    <div className='designer-toolbar' aria-label='Designer tools'>{tools.map(([key, label, shortcut]) => <button type='button' key={key} className={tool === key ? 'active' : ''} onClick={() => setTool(key)}><span>{label}</span><kbd>{shortcut}</kbd></button>)}<span className='toolbar-spacer' /><button type='button' onClick={undo}>Undo</button><button type='button' onClick={redo}>Redo</button></div>
    <div className='designer-workspace'><aside><TreePanel /></aside><section className={`canvas-stack${resizingCanvas ? ' resizing' : ''}`} style={{ gridTemplateRows: `minmax(160px, ${canvasSplit}fr) 12px minmax(160px, ${1 - canvasSplit}fr)` }}><div className='canvas-surface'><CanvasEditor /></div><div className='canvas-resizer' role='separator' aria-label='Resize label editor and preview' aria-orientation='horizontal' aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(canvasSplit * 100)} tabIndex={0} onDoubleClick={() => setCanvasSplit(0.5)} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setResizingCanvas(true) }} onPointerMove={(event) => { if (!resizingCanvas) return; const bounds = event.currentTarget.parentElement?.getBoundingClientRect(); if (!bounds) return; setCanvasSplit(Math.min(0.75, Math.max(0.25, (event.clientY - bounds.top) / bounds.height))) }} onPointerUp={(event) => { setResizingCanvas(false); event.currentTarget.releasePointerCapture(event.pointerId) }} onLostPointerCapture={() => setResizingCanvas(false)} onKeyDown={(event) => { if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home') return; event.preventDefault(); setCanvasSplit((current) => event.key === 'Home' ? 0.5 : Math.min(0.75, Math.max(0.25, current + (event.key === 'ArrowDown' ? 0.05 : -0.05)))) }} title='Drag to resize. Double-click to reset.'><span /></div><div className='render-surface'><LabelPreviewPanel /></div></section><aside className='properties-surface'><PropertiesPanel /></aside></div><footer className='designer-status'><ValidationPanel issues={issues} /></footer>{storeOpen && <TemplateStoreDialog onClose={() => setStoreOpen(false)} />}{jsonMode && <JsonDialog mode={jsonMode} onClose={() => setJsonMode(null)} />}</main>
}

function Printers({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const printerData = usePrinters(); const [agents, setAgents] = useState<Array<Record<string, any>>>([]); const [discovering, setDiscovering] = useState(false); const [status, setStatus] = useState<Record<string, any>>({}); const [jobs, setJobs] = useState<PrintJob[]>([])
  const refreshJobs = useCallback(async () => { try { setJobs(await getBackendSdk().printJobs.list(20)) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }, [onNotice])
  useEffect(() => { void refreshJobs() }, [refreshJobs])
  const discover = async () => { setDiscovering(true); try { const response = await fetch(buildApiUrl(backendBase, '/v1/zebra-tamer/agents')); if (!response.ok) throw new Error(await response.text()); const body = await response.json(); setAgents(body.agents ?? []) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setDiscovering(false) } }
  const register = async (baseUrl: string, agentPrinter: Record<string, any>) => { const id = String(agentPrinter.id); try { await getBackendSdk().printers.upsert(id, { id, name: agentPrinter.display_name ?? id, model: 'Zebra via ZebraTamer', vendor: 'Zebra', driver: 'zpl', connection: { protocol: 'zebra_tamer', base_url: baseUrl, printer_id: id, timeout_ms: 10000 }, media: { loaded: { width_mm: 50, height_mm: 25, color: 'white', type: 'thermal' } }, alignment: { dpi: 203, offset_x_mm: 0, offset_y_mm: 0 }, zpl: { darkness: 10, print_speed: 3, print_mode: 'tear_off' }, defaults: { copies: 1, rotation: 0 }, capabilities: { supports_status: true, supports_graphics: true, supports_cut: false }, enabled: true }); await printerData.refresh(); onNotice({ tone: 'success', text: `${agentPrinter.display_name ?? id} added to PrintHub.` }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }
  const refreshStatus = async (printerId: string) => { try { const result = await getBackendSdk().printers.getStatus(printerId); setStatus((current) => ({ ...current, [printerId]: result })) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }
  const retry = async (jobId: string) => { try { await getBackendSdk().printJobs.retry(jobId); await refreshJobs(); onNotice({ tone: 'success', text: `Print job ${jobId} retried.` }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }
  return <main className='page-shell'><header className='page-heading'><div><span className='eyebrow'>Printer fleet</span><h1>One place for every label printer</h1><p>ZebraTamer owns device I/O and status. PrintHub owns templates, rendering and print workflows.</p></div><button type='button' className='primary-action' onClick={() => void discover()}>{discovering ? 'Discovering…' : 'Discover ZebraTamer'}</button></header>
    {agents.length > 0 && <section className='discovery-panel'><h2>Discovered agents</h2>{agents.map((agent) => <div className='agent-row' key={agent.base_url}><div><strong>{agent.base_url}</strong><span>{agent.available ? `${agent.printers.length} printer(s)` : agent.error}</span></div><div>{(agent.printers ?? []).map((printer: any) => <button type='button' key={printer.id} onClick={() => void register(agent.base_url, printer)}>Add {printer.display_name ?? printer.id}</button>)}</div></div>)}</section>}
    {printerData.loading && <div className='empty-state'>Loading printers…</div>}{printerData.error && <div className='empty-state error-state'>{printerData.error}</div>}
    <div className='printer-grid'>{printerData.printers.map((printer) => { const summary = status[printer.id]?.normalized?.summary; return <article className='printer-card' key={printer.id}><div className='printer-state'><span className={summary?.ready === false ? 'state-dot warning' : 'state-dot'} />{summary?.ready === false ? 'Attention' : 'Configured'}</div><h2>{printer.name ?? printer.id}</h2><p>{printer.connection?.protocol === 'zebra_tamer' ? `ZebraTamer · ${printer.connection.base_url}` : `${printer.connection?.host}:${printer.connection?.port}`}</p><dl><div><dt>Media</dt><dd>{printer.media?.loaded?.width_mm} × {printer.media?.loaded?.height_mm} mm</dd></div><div><dt>Resolution</dt><dd>{printer.alignment?.dpi} dpi</dd></div>{summary?.model && <div><dt>Model</dt><dd>{summary.model}</dd></div>}</dl><button type='button' onClick={() => void refreshStatus(String(printer.id))}>Refresh status</button></article> })}</div>
    <section className='jobs-panel'><div className='section-heading'><div><h2>Recent print jobs</h2><p>Failed jobs remain visible and can be retried safely.</p></div><button type='button' onClick={() => void refreshJobs()}>Refresh</button></div>{jobs.length === 0 ? <div className='empty-state'>No print jobs yet.</div> : <div className='job-list'>{jobs.map((job) => <article className='job-row' key={job.id}><div><strong>{job.template_id}</strong><span>{job.printer_id} · attempt {job.attempts}</span>{job.error && <small>{job.error}</small>}</div><div><span className={`job-state state-${job.status}`}>{job.status.replace('_', ' ')}</span>{(job.status === 'failed' || job.status === 'outcome_unknown') && <button type='button' onClick={() => void retry(job.id)}>Retry</button>}</div></article>)}</div>}</section></main>
}

export default function StudioApp() {
  const [view, setView] = useState<View>(currentView); const [notice, setNotice] = useState<Notice>(null); const theme = useTemplateEditorStore((state) => state.theme); const toggleTheme = useTemplateEditorStore((state) => state.toggleTheme)
  useEffect(() => { const handler = () => setView(currentView()); window.addEventListener('popstate', handler); return () => window.removeEventListener('popstate', handler) }, [])
  useEffect(() => {
    const designerOpen = view === 'designer'
    document.documentElement.classList.toggle('designer-viewport', designerOpen)
    document.body.classList.toggle('designer-viewport', designerOpen)
    if (designerOpen) window.scrollTo(0, 0)
    return () => {
      document.documentElement.classList.remove('designer-viewport')
      document.body.classList.remove('designer-viewport')
    }
  }, [view])
  return <div className={`studio-app theme-${theme}${view === 'designer' ? ' designer-mode' : ''}`}><aside className='studio-sidebar'><Brand /><AppNav view={view} /><div className='sidebar-footer'><span>PrintHub works without Thingdex.</span><button type='button' onClick={toggleTheme}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button></div></aside><div className='studio-main'><div className='mobile-topbar'><Brand /><button type='button' onClick={() => navigate('print')}>Quick print</button></div><NoticeBar notice={notice} onClose={() => setNotice(null)} />{view === 'templates' && <TemplateLibrary onNotice={setNotice} />}{view === 'print' && <QuickPrint onNotice={setNotice} />}{view === 'designer' && <Designer />}{view === 'printers' && <Printers onNotice={setNotice} />}</div></div>
}
