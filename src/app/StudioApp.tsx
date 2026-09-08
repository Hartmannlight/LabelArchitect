import type { PrintJobResponse, TemplateDetailResponse, TemplateListItem } from '@printhub/sdk'
import { useCallback, useEffect, useState } from 'react'
import { backendBase, buildApiUrl, labelSizePresets } from '../api/config'
import { getBackendSdk } from '../api/sdk'
import { errorText } from '../api/errorText'
import { useTemplateEditorStore } from '../state/store'
import CanvasEditor from '../ui/CanvasEditor'
import JsonDialog from '../ui/JsonDialog'
import LabelPreviewPanel from '../ui/LabelPreviewPanel'
import LabelSizeControls from '../ui/LabelSizeControls'
import PropertiesPanel from '../ui/PropertiesPanel'
import TemplateStoreDialog from '../ui/TemplateStoreDialog'
import TreePanel from '../ui/TreePanel'
import ValidationPanel from '../ui/ValidationPanel'
import ToolbarPopover from '../ui/ToolbarPopover'

type View = 'templates' | 'print' | 'designer' | 'printers' | 'jobs'
type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null
type PrintJob = PrintJobResponse
type RenderTarget = { width_mm: number; height_mm: number; dpi: number; origin_x_mm: number; origin_y_mm: number }
type OutputSizeMode = 'template' | 'printer' | 'custom'

const currentView = (): View => {
  if (new URLSearchParams(window.location.search).get('draft_id')) return 'print'
  const value = window.location.hash.replace('#/', '')
  return value === 'print' || value === 'designer' || value === 'printers' || value === 'jobs' ? value : 'templates'
}

const navigate = (view: View) => {
  const url = new URL(window.location.href)
  if (view !== 'print') url.searchParams.delete('draft_id')
  url.hash = `/${view}`
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function Brand() {
  return <div className='studio-brand'><div className='studio-mark' aria-hidden='true'>P</div><div><strong>PrintHub Studio</strong><span>Design, fill and print labels</span></div></div>
}

function AppNav({ view }: { view: View }) {
  const entries: Array<[View, string, string]> = [
    ['templates', 'Templates', 'Ready to fill and print'],
    ['print', 'Quick print', 'Fill and send a label'],
    ['designer', 'Designer', 'Desktop label editor'],
    ['printers', 'Printers', 'Connections, media and status'],
    ['jobs', 'Print jobs', 'Held, failed and recent jobs']
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
  const [defaultPrinterId, setDefaultPrinterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = async () => {
    setLoading(true); setError(null)
    try { const response = await getBackendSdk().printers.list(); setPrinters((response.printers ?? []) as Array<Record<string, any>>); setDefaultPrinterId((response as { default_printer_id?: string | null }).default_printer_id ?? null) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }
  useEffect(() => void refresh(), [])
  return { printers, defaultPrinterId, loading, error, refresh }
}

function printerRenderTarget(printer: Record<string, any> | undefined): RenderTarget | null {
  const widthMm = Number(printer?.media?.loaded?.width_mm)
  const heightMm = Number(printer?.media?.loaded?.height_mm)
  const dpi = Number(printer?.alignment?.dpi)
  if (!(widthMm > 0) || !(heightMm > 0) || !(dpi > 0)) return null
  return {
    width_mm: widthMm,
    height_mm: heightMm,
    dpi,
    origin_x_mm: Number(printer?.alignment?.offset_x_mm ?? 0),
    origin_y_mm: Number(printer?.alignment?.offset_y_mm ?? 0),
  }
}

function TemplatePreview({ templateId, available }: { templateId: string; available?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [sampleText, setSampleText] = useState<string | null>(null)
  useEffect(() => {
    let objectUrl: string | null = null; let active = true
    setUrl(null); setSampleText(null)
    if (available === false) {
      getBackendSdk().templates.get(templateId).then((detail) => {
        if (!active) return
        const text = Object.values(detail.sample_data ?? {}).filter((value) => typeof value === 'string' || typeof value === 'number').map(String).join('\n').trim()
        setSampleText(text || detail.name)
      }).catch(() => setSampleText(null))
      return () => { active = false }
    }
    getBackendSdk().templates.getPreview(templateId).then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }).catch(() => setUrl(null))
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [available, templateId])
  return url ? <img src={url} alt='' /> : sampleText ? <div className='template-text-preview' aria-label='Template sample preview'>{sampleText}</div> : <div className='preview-placeholder'>Preview</div>
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
  return <main className='page-shell'>
    <header className='page-heading'><div><span className='eyebrow'>Template library</span><h1>Choose a template and print</h1><p>Every template shown here is ready to fill and print directly.</p></div><button className='primary-action' type='button' onClick={() => navigate('designer')}>New template</button></header>
    <div className='library-toolbar'><label><span className='sr-only'>Search templates</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search saved templates and tags' /></label><button type='button' onClick={refresh}>Refresh</button></div>
    {loading && <div className='empty-state'>Loading templates…</div>}{error && <div className='empty-state error-state'>{error}</div>}
    {!loading && !error && !filtered.length && <div className='empty-state'>No matching templates. Create the first one in Designer.</div>}
    <div className='template-grid'>{filtered.map((template) => <article className='template-card' key={template.id}><div className='template-preview'><TemplatePreview templateId={template.id} available={template.preview_available} /></div><div className='template-card-body'><div className='template-meta'><span>{String(template.preview_target.width_mm)} × {String(template.preview_target.height_mm)} mm</span><span>{template.variables?.length ?? 0} fields</span></div><h2>{template.name}</h2><p>{template.tags?.length ? template.tags.join(' · ') : 'General purpose'}</p><div className='card-actions'><button type='button' className='primary-action' onClick={() => { sessionStorage.setItem('printhub:selectedTemplate', template.id); navigate('print') }}>Use template</button><button type='button' onClick={() => void edit(template.id)}>Edit</button></div></div></article>)}</div>
  </main>
}

function FieldInput({ definition, value, onChange }: { definition: Record<string, any>; value: string; onChange: (value: string) => void }) {
  const name = String(definition.name ?? ''); const type = String(definition.type ?? 'text'); const label = String(definition.label ?? name.replace(/[_.-]/g, ' ')); const required = definition.mode === 'required' || definition.required === true
  if (Array.isArray(definition.options)) return <label className='field'><span>{label}{required ? ' *' : ''}</span><select value={value} required={required} onChange={(event) => onChange(event.target.value)}><option value=''>Choose…</option>{definition.options.map((option: unknown) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></label>
  if (type === 'textarea' || type === 'multiline') return <label className='field'><span>{label}{required ? ' *' : ''}</span><textarea rows={Math.max(2, Number(definition.rows) || 4)} value={value} required={required} placeholder={String(definition.placeholder ?? '')} onChange={(event) => onChange(event.target.value)} /></label>
  return <label className='field'><span>{label}{required ? ' *' : ''}</span><input type={['number', 'date', 'url'].includes(type) ? type : 'text'} value={value} required={required} placeholder={String(definition.placeholder ?? '')} onChange={(event) => onChange(event.target.value)} /></label>
}

function templateRenderTarget(value: Record<string, any>): RenderTarget {
  return {
    width_mm: Number(value.width_mm),
    height_mm: Number(value.height_mm),
    dpi: Number(value.dpi || 203),
    origin_x_mm: Number(value.origin_x_mm ?? 0),
    origin_y_mm: Number(value.origin_y_mm ?? 0),
  }
}

function sameLabelSize(first: RenderTarget | null, second: RenderTarget | null) {
  return Boolean(first && second && Math.abs(first.width_mm - second.width_mm) < .01 && Math.abs(first.height_mm - second.height_mm) < .01 && first.dpi === second.dpi)
}

function formatSize(target: RenderTarget | null) {
  return target ? `${target.width_mm} × ${target.height_mm} mm · ${target.dpi} dpi` : 'Size unavailable'
}

function printerOptionLabel(printer: Record<string, any>) {
  const target = printerRenderTarget(printer)
  const virtual = printer.media?.loaded?.type === 'virtual' || String(printer.id) === 'virtual-zebra'
  return `${printer.display_name ?? printer.name ?? printer.id}${virtual ? ' · Virtual' : ''}${target ? ` · ${target.width_mm} × ${target.height_mm} mm` : ''}`
}

function CompactNumberInput({ label, value, integer = false, onChange }: { label: string; value: number; integer?: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const number = Number(draft)
  const valid = draft.trim() !== '' && Number.isFinite(number) && number > 0 && (!integer || Number.isInteger(number))
  return <label><span>{label}</span><input
    type='number'
    inputMode={integer ? 'numeric' : 'decimal'}
    min='1'
    step={integer ? '1' : '0.1'}
    value={draft}
    aria-invalid={!valid}
    onChange={(event) => {
      setDraft(event.target.value)
      const next = event.target.valueAsNumber
      if (Number.isFinite(next) && next > 0 && (!integer || Number.isInteger(next))) onChange(next)
    }}
    onBlur={() => setDraft(String(value))}
  /></label>
}

function OutputSizePicker({ mode, onMode, templateTarget, printerTarget, printerName, customTarget, onCustomTarget }: {
  mode: OutputSizeMode
  onMode: (mode: OutputSizeMode) => void
  templateTarget: RenderTarget
  printerTarget: RenderTarget | null
  printerName: string
  customTarget: RenderTarget
  onCustomTarget: (target: RenderTarget) => void
}) {
  const matches = sameLabelSize(templateTarget, printerTarget)
  const selectedTarget = mode === 'template' ? templateTarget : mode === 'printer' ? printerTarget : customTarget
  const description = mode === 'template'
    ? 'Original template layout.'
    : mode === 'printer'
      ? matches ? 'Matches the template and loaded label.' : `Matches the label loaded in ${printerName}; layout may reflow.`
      : 'Your own dimensions for preview and printing.'
  const customPreset = labelSizePresets.find((preset) => Math.abs(preset.width_mm - customTarget.width_mm) < .01 && Math.abs(preset.height_mm - customTarget.height_mm) < .01)
  return <fieldset className='output-size-picker'>
    <legend>Output label size</legend>
    <label className='output-size-select'><span>Use for preview and print</span><select value={mode} onChange={(event) => onMode(event.target.value as OutputSizeMode)}>
      <option value='printer' disabled={!printerTarget}>Loaded in printer{printerTarget ? ` — ${printerTarget.width_mm} × ${printerTarget.height_mm} mm` : ' — unavailable'}</option>
      <option value='template'>Template original — {templateTarget.width_mm} × {templateTarget.height_mm} mm</option>
      <option value='custom'>Custom size</option>
    </select></label>
    <div className='output-size-summary'><strong>{formatSize(selectedTarget)}</strong><span>{description}</span></div>
    {mode === 'custom' && <div className='custom-size-editor'>
      <label className='custom-size-preset'><span>Preset</span><select value={customPreset?.id ?? ''} onChange={(event) => {
        const preset = labelSizePresets.find((entry) => entry.id === event.target.value)
        if (preset) onCustomTarget({ ...customTarget, width_mm: preset.width_mm, height_mm: preset.height_mm })
      }}><option value=''>Custom dimensions</option>{labelSizePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.width_mm} × {preset.height_mm} mm</option>)}</select></label>
      <div className='custom-size-numbers'>
        <CompactNumberInput label='Width mm' value={customTarget.width_mm} onChange={(width_mm) => onCustomTarget({ ...customTarget, width_mm })} />
        <CompactNumberInput label='Height mm' value={customTarget.height_mm} onChange={(height_mm) => onCustomTarget({ ...customTarget, height_mm })} />
        <CompactNumberInput label='DPI' value={customTarget.dpi} integer onChange={(dpi) => onCustomTarget({ ...customTarget, dpi })} />
      </div>
    </div>}
    {!matches && printerTarget && mode === 'template' && <div className='size-warning' role='status'><strong>The loaded label is a different size.</strong><span>The template remains {templateTarget.width_mm} × {templateTarget.height_mm} mm and may be clipped on {printerName}. Choose “Loaded in printer” to adapt it.</span></div>}
  </fieldset>
}

function QuickPrint({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const templates = useTemplates(); const printerData = usePrinters()
  const [templateId, setTemplateId] = useState(() => sessionStorage.getItem('printhub:selectedTemplate') ?? '')
  const [template, setTemplate] = useState<TemplateDetailResponse | null>(null)
  const [printerId, setPrinterId] = useState(() => localStorage.getItem('printhub:printer') ?? '')
  const [sizeMode, setSizeMode] = useState<OutputSizeMode>('printer')
  const [outputMode, setOutputMode] = useState<'auto' | 'native' | 'raster'>('auto')
  const firstPreset = labelSizePresets[0] ?? { width_mm: 50, height_mm: 25 }
  const [customTarget, setCustomTarget] = useState<RenderTarget>({ width_mm: firstPreset.width_mm, height_mm: firstPreset.height_mm, dpi: 203, origin_x_mm: 0, origin_y_mm: 0 })
  const [values, setValues] = useState<Record<string, string>>({}); const [previewUrl, setPreviewUrl] = useState<string | null>(null); const [busy, setBusy] = useState<'preview' | 'print' | null>(null); const [printWarnings, setPrintWarnings] = useState<string[]>([])
  const draftId = new URLSearchParams(window.location.search).get('draft_id')
  useEffect(() => {
    if (printerData.loading || printerData.error) return
    const enabled = printerData.printers.filter((printer) => printer.enabled !== false)
    if (!enabled.some((printer) => String(printer.id) === printerId)) setPrinterId(printerData.defaultPrinterId ?? String(enabled[0]?.id ?? ''))
  }, [printerData.printers, printerData.defaultPrinterId, printerData.loading, printerData.error, printerId])
  useEffect(() => {
    if (!templateId) { if (!draftId) setTemplate(null); return }
    getBackendSdk().templates.get(templateId).then((detail) => { setTemplate(detail); const sample = detail.sample_data ?? {}; const next: Record<string, string> = {}; (detail.variables ?? []).forEach((variable: any) => { const name = String(variable.name ?? ''); if (name) next[name] = String((sample as any)[name] ?? variable.default ?? '') }); setValues(next) }).catch((reason) => onNotice({ tone: 'error', text: errorText(reason) }))
  }, [draftId, onNotice, templateId])
  useEffect(() => {
    if (!draftId) return
    getBackendSdk().drafts.get(draftId).then((draft) => { setTemplate({ id: `draft:${draftId}`, name: 'Print draft', template: draft.template, variables: Object.keys(draft.variables ?? {}).map((name) => ({ name, mode: 'required' })), sample_data: draft.variables, preview_target: draft.target, preview_available: false, tags: [] } as any); setValues(Object.fromEntries(Object.entries(draft.variables ?? {}).map(([key, value]) => [key, String(value ?? '')]))) }).catch((reason) => onNotice({ tone: 'error', text: errorText(reason) }))
  }, [draftId, onNotice])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  useEffect(() => { setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return null }); setPrintWarnings([]) }, [customTarget.height_mm, customTarget.width_mm, outputMode, printerId, sizeMode, templateId])
  const selectedPrinter = printerData.printers.find((printer) => String(printer.id) === printerId)
  const acceptedFormats = new Set(((selectedPrinter as any)?.accepted_mime_types ?? []).map(String))
  const supportsNative = acceptedFormats.has('application/zpl')
  const supportsRaster = acceptedFormats.has('application/vnd.printhub.raster-page+json')
  const intendedTarget = template ? templateRenderTarget(template.preview_target as Record<string, any>) : null
  const loadedTarget = printerRenderTarget(selectedPrinter)
  useEffect(() => {
    if (!printerData.loading && template && sizeMode === 'printer' && selectedPrinter && !loadedTarget) setSizeMode('template')
  }, [loadedTarget, printerData.loading, selectedPrinter, sizeMode, template])
  useEffect(() => {
    if ((outputMode === 'native' && !supportsNative) || (outputMode === 'raster' && !supportsRaster)) setOutputMode('auto')
  }, [outputMode, supportsNative, supportsRaster])
  const renderTarget = intendedTarget ? sizeMode === 'template' ? intendedTarget : sizeMode === 'printer' ? loadedTarget : customTarget : null
  const renderBody = () => template && renderTarget ? { template: template.template, variables: values, target: renderTarget as any, debug: false } : null
  const preview = async () => { const body = renderBody(); if (!body) return; setBusy('preview'); try { const rendered = await getBackendSdk().renders.renderPngDetailed(body); const next = URL.createObjectURL(rendered.blob); setPrintWarnings(rendered.diagnostics.map((item) => item.message)); setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return next }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(null) } }
  const print = async () => { if (!template || !printerId) return; setBusy('print'); try { const body = renderBody(); if (!body) return; const preflight = await getBackendSdk().renders.renderZpl(body); const warnings = (preflight.diagnostics ?? []).map((item) => item.message); setPrintWarnings(warnings); if (warnings.length && !window.confirm(`This label has ${warnings.length} text layout warning(s):\n\n${warnings.join('\n')}\n\nPrint anyway?`)) return; const source = !draftId && templateId ? { template_id: templateId } : { template: template.template }; const result = await getBackendSdk().printJobs.create({ printer_id: printerId, ...source, variables: values, target: renderTarget as any, output_mode: outputMode, origin: 'printhub-studio' }); localStorage.setItem('printhub:printer', printerId); onNotice(result.status === 'failed' ? { tone: 'error', text: result.error ?? 'Print failed.' } : { tone: 'success', text: `Print job ${result.id} ${result.status}.` }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(null) } }
  return <main className='page-shell quick-print-page'><header className='page-heading compact'><div><span className='eyebrow'>Quick print</span><h1>Choose, fill, print</h1><p>This view is designed for phones, scanners and quick repeat jobs.</p></div></header><div className='quick-print-layout'><section className='form-panel'>
    {!draftId && <label className='field'><span>Template</span><select value={templateId} onChange={(event) => { setTemplateId(event.target.value); sessionStorage.setItem('printhub:selectedTemplate', event.target.value) }}><option value=''>Choose a template…</option>{templates.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {template && intendedTarget && <div className='selected-template'><strong>{template.name}</strong><span>Designed for {formatSize(intendedTarget)}</span></div>}
    <div className='variable-form'>{(template?.variables ?? []).filter((entry: any) => !String(entry.name ?? '').startsWith('_')).map((entry: any) => <FieldInput key={String(entry.name)} definition={entry} value={values[String(entry.name)] ?? ''} onChange={(value) => setValues((current) => ({ ...current, [String(entry.name)]: value }))} />)}</div>
    <label className='field'><span>Printer</span><select value={printerId} onChange={(event) => { const nextId = event.target.value; const nextPrinter = printerData.printers.find((printer) => String(printer.id) === nextId); setPrinterId(nextId); setSizeMode(printerRenderTarget(nextPrinter) ? 'printer' : 'template') }}><option value=''>Choose a printer…</option>{printerData.printers.filter((printer) => printer.enabled !== false).map((printer) => <option key={printer.id} value={printer.id}>{printerOptionLabel(printer)}</option>)}</select><small className='field-help'>{selectedPrinter ? `Printer ID: ${selectedPrinter.id}` : 'Select where the finished label should be sent.'}</small></label>
    {selectedPrinter && <label className='field'><span>Print format</span><select value={outputMode} onChange={(event) => setOutputMode(event.target.value as 'auto' | 'native' | 'raster')}><option value='auto'>Automatic — prefer native ZPL</option><option value='native' disabled={!supportsNative}>Native ZPL</option><option value='raster' disabled={!supportsRaster}>Rendered image</option></select><small className='field-help'>{outputMode === 'raster' ? 'The complete label is rendered through Labelary and sent as pixels.' : outputMode === 'native' ? 'The printer receives the compiled ZPL directly.' : supportsNative ? 'This printer will receive native ZPL.' : 'This printer will receive a rendered raster image.'}</small></label>}
    {template && intendedTarget && <OutputSizePicker mode={sizeMode} onMode={setSizeMode} templateTarget={intendedTarget} printerTarget={loadedTarget} printerName={String(selectedPrinter?.name ?? selectedPrinter?.id ?? 'the selected printer')} customTarget={customTarget} onCustomTarget={setCustomTarget} />}
    {printWarnings.length > 0 && <div className='builder-warning' role='status'><strong>Text layout warnings</strong><ul className='list-disc pl-5'>{printWarnings.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul></div>}
    <div className='quick-actions'><button type='button' onClick={() => void preview()} disabled={!template || !renderTarget || busy !== null}>{busy === 'preview' ? 'Rendering…' : 'Preview'}</button><button className='primary-action' type='button' onClick={() => void print()} disabled={!template || !renderTarget || !printerId || busy !== null}>{busy === 'print' ? 'Checking and sending…' : 'Print label'}</button></div>
  </section><section className='print-preview' aria-label='Label preview'>{previewUrl ? <><div className='preview-size-badge'>{formatSize(renderTarget)}</div><img src={previewUrl} alt='Rendered label preview' /></> : <div className='preview-placeholder'>{template && renderTarget ? `Preview will use ${formatSize(renderTarget)}` : 'Select a template'}</div>}</section></div></main>
}

function Designer() {
  const doc = useTemplateEditorStore((state) => state.history.present); const tool = useTemplateEditorStore((state) => state.tool); const setTool = useTemplateEditorStore((state) => state.setTool); const undo = useTemplateEditorStore((state) => state.undo); const redo = useTemplateEditorStore((state) => state.redo); const newTemplate = useTemplateEditorStore((state) => state.newTemplate); const issues = useTemplateEditorStore((state) => state.validationIssues)
  const [storeOpen, setStoreOpen] = useState(false); const [jsonMode, setJsonMode] = useState<'export' | 'import' | null>(null)
  const [canvasSplit, setCanvasSplit] = useState(0.5); const [resizingCanvas, setResizingCanvas] = useState(false)
  const canUndo = useTemplateEditorStore((state) => state.history.past.length > 0)
  const canRedo = useTemplateEditorStore((state) => state.history.future.length > 0)
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
    <header className='designer-header'>
      <input className='designer-name' aria-label='Template name' title={doc.name || 'Template name'} value={doc.name ?? ''} onChange={(event) => useTemplateEditorStore.getState().setTemplateName(event.target.value)} />
      <LabelSizeControls />
      <div className='designer-toolbar' role='group' aria-label='Designer tools'>{tools.map(([key, label, shortcut]) => <button type='button' key={key} className={tool === key ? 'active' : ''} aria-pressed={tool === key} title={`${label} (${shortcut})`} onClick={() => setTool(key)}>{label}</button>)}</div>
      <div className='designer-actions'>
        <button type='button' className='designer-icon-button' aria-label='Undo' title='Undo (Ctrl+Z)' disabled={!canUndo} onClick={undo}>↶</button>
        <button type='button' className='designer-icon-button' aria-label='Redo' title='Redo (Ctrl+Shift+Z)' disabled={!canRedo} onClick={redo}>↷</button>
        <ToolbarPopover label='Template actions' trigger={<span aria-hidden='true'>⋯</span>} align='right'>{(close) => <div className='designer-file-actions'>
          <button type='button' onClick={() => { close(); newTemplate() }}>New template</button>
          <button type='button' onClick={() => { close(); setJsonMode('import') }}>Import JSON</button>
          <button type='button' onClick={() => { close(); setJsonMode('export') }}>Export JSON</button>
        </div>}</ToolbarPopover>
        <button type='button' className='primary-action' title='Save template (Ctrl+S)' onClick={() => setStoreOpen(true)}>Save template</button>
      </div>
    </header>
    <div className='designer-workspace'><aside><TreePanel /></aside><section className={`canvas-stack${resizingCanvas ? ' resizing' : ''}`} style={{ gridTemplateRows: `minmax(160px, ${canvasSplit}fr) 12px minmax(160px, ${1 - canvasSplit}fr)` }}><div className='canvas-surface'><CanvasEditor /></div><div className='canvas-resizer' role='separator' aria-label='Resize label editor and preview' aria-orientation='horizontal' aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(canvasSplit * 100)} tabIndex={0} onDoubleClick={() => setCanvasSplit(0.5)} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setResizingCanvas(true) }} onPointerMove={(event) => { if (!resizingCanvas) return; const bounds = event.currentTarget.parentElement?.getBoundingClientRect(); if (!bounds) return; setCanvasSplit(Math.min(0.75, Math.max(0.25, (event.clientY - bounds.top) / bounds.height))) }} onPointerUp={(event) => { setResizingCanvas(false); event.currentTarget.releasePointerCapture(event.pointerId) }} onLostPointerCapture={() => setResizingCanvas(false)} onKeyDown={(event) => { if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home') return; event.preventDefault(); setCanvasSplit((current) => event.key === 'Home' ? 0.5 : Math.min(0.75, Math.max(0.25, current + (event.key === 'ArrowDown' ? 0.05 : -0.05)))) }} title='Drag to resize. Double-click to reset.'><span /></div><div className='render-surface'><LabelPreviewPanel /></div></section><aside className='properties-surface'><PropertiesPanel /></aside></div><footer className='designer-status'><ValidationPanel issues={issues} /></footer>{storeOpen && <TemplateStoreDialog onClose={() => setStoreOpen(false)} />}{jsonMode && <JsonDialog mode={jsonMode} onClose={() => setJsonMode(null)} />}</main>
}

function PrintJobRow({ job, onRetry, onRelease, onReprint, onCancel }: {
  job: PrintJob
  onRetry: (jobId: string) => void
  onRelease: (jobId: string, scaling: 'fit' | 'fill', overrideLabelLimit: boolean) => void
  onReprint?: (jobId: string) => void
  onCancel?: (jobId: string) => void
}) {
  const title = job.template_id ?? (job.source_kind === 'raster' ? 'IPP document' : 'Print job')
  const preview = job.preview_png_base64 ? `data:image/png;base64,${job.preview_png_base64}` : null
  return <article className={`job-row${job.status === 'held' ? ' job-row-held' : ''}`}>
    {job.status === 'held' && preview && <img className='job-preview' src={preview} alt='Monochrome fit preview' />}
    <div className='job-details'><strong>{title}</strong><span>{job.printer_id} · {job.page_count ?? 1} page{job.page_count === 1 ? '' : 's'} · attempt {job.attempts}</span>{job.warning && <small className='job-warning'>{job.warning}</small>}{job.error && <small>{job.error}</small>}</div>
    <div className='job-actions'><span className={`job-state state-${job.status}`}>{job.status.replace('_', ' ')}</span>
      {job.status === 'held' && job.hold_reason === 'label_limit_exceeded' && <button type='button' className='primary-action' onClick={() => onRelease(job.id, 'fit', true)}>Print {job.requested_labels} labels anyway</button>}
      {job.status === 'held' && job.hold_reason !== 'label_limit_exceeded' && <><button type='button' className='primary-action' onClick={() => onRelease(job.id, 'fit', false)}>Fit & print</button><button type='button' onClick={() => onRelease(job.id, 'fill', false)}>Fill & crop</button></>}
      {job.status === 'failed' && <button type='button' onClick={() => onRetry(job.id)}>Retry</button>}
      {['queued', 'waiting_for_service', 'held'].includes(job.status) && <button type='button' onClick={() => onCancel?.(job.id)}>Cancel</button>}
      {job.status === 'outcome_unknown' && <><small>Check the printer first.</small><button type='button' onClick={() => onReprint?.(job.id)}>Deliberate reprint…</button></>}
    </div>
  </article>
}

type PrintService = { connection_id: string; display_name: string; base_url: string; enabled: boolean }
type IppShare = { queue_id: string; printer_id: string; display_name: string; enabled: boolean; port: number; resource: string }
type UsbPrinter = { vendor_id: number; product_id: number; bus_number: number; address: number; manufacturer?: string | null; product?: string | null; serial_number?: string | null; stable_identity: boolean }

async function adminRequest(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(buildApiUrl(backendBase, path), {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(String(payload?.detail ?? `Request failed (${response.status})`))
  return payload
}

function PrinterManagement({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const printerData = usePrinters()
  const [token, setToken] = useState(() => sessionStorage.getItem('printhub:adminToken') ?? '')
  const [services, setServices] = useState<PrintService[]>([])
  const [ippShares, setIppShares] = useState<IppShare[]>([])
  const [serviceId, setServiceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [transport, setTransport] = useState<'tcp' | 'char_device' | 'usb_bulk'>('tcp')
  const [usbPrinters, setUsbPrinters] = useState<UsbPrinter[]>([])
  const loadServices = useCallback(async () => {
    if (!token) return
    const [payload, shares] = await Promise.all([adminRequest('/v1/printer-services', token), adminRequest('/v1/ipp-shares', token)])
    const items = (payload.items ?? []) as PrintService[]
    setServices(items)
    setIppShares((shares.items ?? []) as IppShare[])
    setServiceId((current) => items.some((item) => item.connection_id === current) ? current : (items[0]?.connection_id ?? ''))
  }, [token])
  useEffect(() => { void loadServices().catch((reason) => onNotice({ tone: 'error', text: errorText(reason) })) }, [loadServices, onNotice])
  const unlock = () => { sessionStorage.setItem('printhub:adminToken', token); void loadServices() }
  const addService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true)
    try {
      await adminRequest('/v1/printer-services', token, { method: 'POST', body: JSON.stringify({ display_name: form.get('name'), base_url: form.get('url'), token: form.get('service_token') }) })
      formElement.reset(); await loadServices(); await printerData.refresh(); onNotice({ tone: 'success', text: 'Print service connected and identity verified.' })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const addPrinter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const id = String(form.get('id') ?? ''); setBusy(true)
    const numberOrNull = (name: string) => { const value = String(form.get(name) ?? '').trim(); return value ? Number(value) : null }
    try {
      await adminRequest(`/v1/printer-services/${encodeURIComponent(serviceId)}/printers/${encodeURIComponent(id)}`, token, { method: 'POST', body: JSON.stringify({ display_name: form.get('display_name'), enabled: true, transport, tcp_host: transport === 'tcp' ? form.get('tcp_host') : null, tcp_port: numberOrNull('tcp_port') ?? 9100, device: transport === 'char_device' ? form.get('device') : '', usb_vendor_id: transport === 'usb_bulk' ? numberOrNull('usb_vendor_id') : null, usb_product_id: transport === 'usb_bulk' ? numberOrNull('usb_product_id') : null, usb_serial: transport === 'usb_bulk' ? form.get('usb_serial') || null : null }) })
      const width = Number(form.get('width_mm')); const height = Number(form.get('height_mm'))
      await adminRequest(`/v1/printer-services/${encodeURIComponent(serviceId)}/printers/${encodeURIComponent(id)}/media`, token, { method: 'PUT', body: JSON.stringify({ display_name: form.get('media_name') || `${width} × ${height} mm`, product_number: null, manufacturer: null, description: null, width_mm: width, height_mm: height, gap_mm: null, corner_radius_mm: null, black_mark_width_mm: null, black_mark_height_mm: null, core_diameter_mm: null, outer_diameter_mm: null, shape: 'rectangle', tracking: form.get('tracking'), print_technology: form.get('technology'), color: { name: form.get('color_name') || 'White', hex: form.get('color_hex') || '#ffffff', description: null }, material: null, surface: null, transparent: null, thermal_coating: null, thickness_micrometers: null, adhesive: null, liner: null, ribbon: null, preferred_settings: {}, labels_available_at_load: Number(form.get('quantity') || 0), nominal_full_roll_labels: null, low_warning_threshold: Number(form.get('warning') || 10), custom: {} }) })
      formElement.reset(); setTransport('tcp'); await printerData.refresh(); onNotice({ tone: 'success', text: 'Printer and loaded media saved.' })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const addIppShare = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const queueId = String(form.get('queue_id') ?? ''); setBusy(true)
    try {
      await adminRequest(`/v1/ipp-shares/${encodeURIComponent(queueId)}`, token, { method: 'PUT', body: JSON.stringify({ printer_id: form.get('printer_id'), display_name: form.get('display_name'), enabled: true }) })
      formElement.reset(); await loadServices(); onNotice({ tone: 'success', text: 'IPP share enabled.' })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const printerAction = async (printer: Record<string, any>, kind: 'queue' | 'maintenance', action: string) => {
    const connection = String(printer.service_connection_id ?? '')
    const localId = String(printer.service_printer_id ?? printer.id ?? '')
    if (!connection || !localId) return
    if (kind === 'maintenance' && !window.confirm(`Run ${action} on ${printer.display_name ?? printer.id}?`)) return
    setBusy(true)
    try {
      await adminRequest(`/v1/printer-services/${encodeURIComponent(connection)}/printers/${encodeURIComponent(localId)}/${kind}/${encodeURIComponent(action)}`, token, { method: 'POST' })
      await printerData.refresh()
      onNotice({ tone: 'success', text: `${printer.display_name ?? printer.id}: ${action} accepted.` })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const updateService = async (service: PrintService, change: Record<string, unknown>) => {
    setBusy(true)
    try {
      await adminRequest(`/v1/printer-services/${encodeURIComponent(service.connection_id)}`, token, { method: 'PATCH', body: JSON.stringify(change) })
      await loadServices(); await printerData.refresh(); onNotice({ tone: 'success', text: `${service.display_name} updated.` })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const moveService = (service: PrintService) => {
    const baseUrl = window.prompt('New print-service URL', service.base_url)
    if (baseUrl && baseUrl !== service.base_url) void updateService(service, { base_url: baseUrl })
  }
  const renameService = (service: PrintService) => {
    const displayName = window.prompt('Print-service display name', service.display_name)
    if (displayName && displayName !== service.display_name) void updateService(service, { display_name: displayName })
  }
  const updateCatalog = async (printer: Record<string, any>, change: Record<string, unknown>) => {
    setBusy(true)
    try {
      await adminRequest(`/v1/printers/${encodeURIComponent(String(printer.id))}/catalog`, token, { method: 'PATCH', body: JSON.stringify(change) })
      await printerData.refresh(); onNotice({ tone: 'success', text: `${printer.display_name ?? printer.id} updated.` })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const renamePrinter = (printer: Record<string, any>) => {
    const displayName = window.prompt('Printer display name', String(printer.display_name ?? printer.id))
    if (displayName && displayName !== printer.display_name) void updateCatalog(printer, { display_name: displayName })
  }
  const toggleIppShare = async (share: IppShare) => {
    setBusy(true)
    try {
      await adminRequest(`/v1/ipp-shares/${encodeURIComponent(share.queue_id)}`, token, { method: 'PATCH', body: JSON.stringify({ enabled: !share.enabled }) })
      await loadServices(); onNotice({ tone: 'success', text: `${share.display_name} ${share.enabled ? 'disabled' : 'enabled'}.` })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const discoverUsb = async () => {
    if (!serviceId) return
    setBusy(true)
    try {
      const payload = await adminRequest(`/v1/printer-services/${encodeURIComponent(serviceId)}/usb-devices`, token)
      const items = (payload.items ?? []) as UsbPrinter[]; setUsbPrinters(items)
      onNotice({ tone: 'success', text: items.length ? `Found ${items.length} USB printer device(s).` : 'No USB printer-class device is visible to this service.' })
    } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } finally { setBusy(false) }
  }
  const chooseUsb = (device: UsbPrinter) => {
    setTransport('usb_bulk')
    const form = document.getElementById('zebra-printer-form') as HTMLFormElement | null
    const set = (name: string, value: string) => { const input = form?.elements.namedItem(name) as HTMLInputElement | null; if (input) input.value = value }
    set('usb_vendor_id', String(device.vendor_id)); set('usb_product_id', String(device.product_id)); set('usb_serial', device.serial_number ?? '')
  }
  return <main className='page-shell'><header className='page-heading'><div><span className='eyebrow'>Printer setup</span><h1>Connect printers and print services</h1><p>PrintHub keeps the public catalog; each print service remains responsible for its hardware.</p></div><button type='button' onClick={() => void printerData.refresh()}>Refresh</button></header>
    <section className='management-grid'><article className='management-card'><h2>Administration access</h2><p>The token stays in this browser tab.</p><div className='inline-form'><input type='password' value={token} onChange={(event) => setToken(event.target.value)} placeholder='PrintHub admin token' /><button type='button' onClick={unlock}>Unlock</button></div></article>
      <article className='management-card'><h2>Known printers</h2>{printerData.loading ? <p>Loading…</p> : printerData.printers.length ? <div className='printer-list'>{printerData.printers.map((printer) => <div key={printer.id}><strong>{printer.display_name ?? printer.id}{printerData.defaultPrinterId === printer.id ? ' · Default' : ''}</strong><span>{printer.identity_conflict ? 'Blocked · same physical serial is active through another service' : printer.visible === false ? 'Hidden' : printer.offline ? 'Offline · cached data' : printer.status?.ready?.value === true ? 'Ready' : 'Status unknown'} · {printer.accepted_mime_types?.includes('application/zpl') ? 'ZPL + raster' : 'Raster'}</span><span><button type='button' disabled={busy || !token} onClick={() => renamePrinter(printer)}>Rename</button> <button type='button' disabled={busy || !token} onClick={() => void updateCatalog(printer, { visible: printer.visible === false })}>{printer.visible === false ? 'Show' : 'Hide'}</button> {printer.visible !== false && !printer.identity_conflict && printerData.defaultPrinterId !== printer.id && <button type='button' disabled={busy || !token} onClick={() => void updateCatalog(printer, { default: true })}>Make default</button>}</span>{printer.capabilities?.queue_control && <span><button type='button' disabled={busy || !token} onClick={() => void printerAction(printer, 'queue', printer.jobs?.queue_paused ? 'resume' : 'pause')}>{printer.jobs?.queue_paused ? 'Resume queue' : 'Pause queue'}</button> <button type='button' disabled={busy || !token} onClick={() => void printerAction(printer, 'maintenance', 'print-configuration')}>Configuration label</button> <button type='button' disabled={busy || !token} onClick={() => void printerAction(printer, 'maintenance', 'print-network-configuration')}>Network label</button> <button type='button' disabled={busy || !token} onClick={() => void printerAction(printer, 'maintenance', 'calibrate-media')}>Calibrate media</button></span>}</div>)}</div> : <p>No printers yet. Add the first Zebra below.</p>}</article>
      <article className='management-card'><h2>Connect another service</h2><form className='form-stack' onSubmit={(event) => void addService(event)}><input name='name' required placeholder='Display name' /><input name='url' type='url' required placeholder='http://print-service:8080' /><input name='service_token' type='password' required minLength={24} placeholder='Service token' /><button className='primary-action' disabled={busy || !token}>Connect and verify identity</button></form>{services.map((service) => <p key={service.connection_id}><strong>{service.display_name}</strong><br /><code>{service.base_url}</code><br /><button type='button' disabled={busy || !token} onClick={() => renameService(service)}>Rename</button> <button type='button' disabled={busy || !token} onClick={() => moveService(service)}>Change URL</button> <button type='button' disabled={busy || !token} onClick={() => void updateService(service, { enabled: !service.enabled })}>{service.enabled ? 'Disable' : 'Enable'}</button></p>)}</article>
      <article className='management-card'><h2>IPP shares</h2><form className='form-stack' onSubmit={(event) => void addIppShare(event)}><input name='queue_id' required pattern='[A-Za-z0-9_-]+' placeholder='shipping-labels' /><input name='display_name' required placeholder='Shipping labels' /><select name='printer_id' required><option value=''>Choose printer…</option>{printerData.printers.filter((printer) => printer.visible !== false).map((printer) => <option key={printer.id} value={printer.id}>{printer.display_name ?? printer.id}</option>)}</select><button className='primary-action' disabled={busy || !token}>Publish via IPP</button></form>{ippShares.map((share) => <p key={share.queue_id}>{share.display_name}: <code>ipp://localhost:{share.port}{share.resource}</code> <button type='button' disabled={busy || !token} onClick={() => void toggleIppShare(share)}>{share.enabled ? 'Disable' : 'Enable'}</button></p>)}</article>
      <article className='management-card span-two'><h2>Add a Zebra printer</h2><form id='zebra-printer-form' className='form-grid' onSubmit={(event) => void addPrinter(event)}><label><span>Print service</span><select value={serviceId} required onChange={(event) => { setServiceId(event.target.value); setUsbPrinters([]) }}><option value=''>Choose…</option>{services.filter((service) => service.enabled).map((service) => <option key={service.connection_id} value={service.connection_id}>{service.display_name}</option>)}</select></label><label><span>Printer ID</span><input name='id' required pattern='[A-Za-z0-9_-]+' placeholder='shipping-zebra' /></label><label><span>Name</span><input name='display_name' required placeholder='Zebra in shipping' /></label><label><span>Connection</span><select value={transport} onChange={(event) => setTransport(event.target.value as typeof transport)}><option value='tcp'>Ethernet / Wi-Fi</option><option value='char_device'>USB device file</option><option value='usb_bulk'>USB direct</option></select></label>
        {transport === 'tcp' && <><label><span>Host or IP</span><input name='tcp_host' required placeholder='192.0.2.10' /></label><label><span>Port</span><input name='tcp_port' type='number' min='1' max='65535' defaultValue='9100' /></label></>}{transport === 'char_device' && <label><span>Device path</span><input name='device' required placeholder='/dev/usb/lp0' /></label>}{transport === 'usb_bulk' && <><label><span>USB vendor ID</span><input name='usb_vendor_id' type='number' required min='0' max='65535' /></label><label><span>USB product ID</span><input name='usb_product_id' type='number' required min='0' max='65535' /></label><label><span>USB serial</span><input name='usb_serial' /></label><button type='button' disabled={busy || !token || !serviceId} onClick={() => void discoverUsb()}>Discover USB printers</button>{usbPrinters.map((device) => <button type='button' key={`${device.bus_number}:${device.address}`} onClick={() => chooseUsb(device)}>{device.manufacturer ?? 'USB'} {device.product ?? 'printer'} · {device.vendor_id.toString(16).padStart(4, '0')}:{device.product_id.toString(16).padStart(4, '0')}{device.serial_number ? ` · ${device.serial_number}` : ' · no readable serial'}</button>)}</>}
        <label><span>Media name</span><input name='media_name' required placeholder='Shipping labels' /></label><label><span>Width mm</span><input name='width_mm' type='number' required min='.1' step='.1' defaultValue='50' /></label><label><span>Height mm</span><input name='height_mm' type='number' required min='.1' step='.1' defaultValue='25' /></label><label><span>Tracking</span><select name='tracking' defaultValue='gap'><option value='gap'>Gap</option><option value='black_mark'>Black mark</option><option value='continuous'>Continuous</option></select></label><label><span>Technology</span><select name='technology' defaultValue='direct_thermal'><option value='direct_thermal'>Direct thermal</option><option value='thermal_transfer'>Thermal transfer</option></select></label><label><span>Color</span><input name='color_name' defaultValue='White' /></label><label><span>Preview color</span><input name='color_hex' type='color' defaultValue='#ffffff' /></label><label><span>Labels on roll</span><input name='quantity' type='number' min='0' defaultValue='0' /></label><label><span>Low warning</span><input name='warning' type='number' min='0' defaultValue='10' /></label><button className='primary-action' disabled={busy || !token || !serviceId}>Save printer and media</button></form></article>
    </section></main>
}

function PrintJobs({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const refreshJobs = useCallback(async () => { try { setJobs(await getBackendSdk().printJobs.list(20)) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }, [onNotice])
  useEffect(() => { void refreshJobs() }, [refreshJobs])
  const retry = async (jobId: string) => { try { await getBackendSdk().printJobs.retry(jobId); await refreshJobs(); onNotice({ tone: 'success', text: `Print job ${jobId} retried.` }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }
  const reprint = async (jobId: string) => { if (!window.confirm('The previous physical outcome is unknown. Create a new, deliberate print job anyway?')) return; const token = sessionStorage.getItem('printhub:adminToken') ?? ''; try { await adminRequest(`/v1/print-jobs/${encodeURIComponent(jobId)}/reprint`, token, { method: 'POST', body: JSON.stringify({ idempotency_key: `manual-reprint:${jobId}:${crypto.randomUUID()}` }) }); await refreshJobs(); onNotice({ tone: 'success', text: 'A separate reprint job was created.' }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }
  const cancel = async (jobId: string) => { if (!window.confirm('Cancel this job before any further output?')) return; try { await getBackendSdk().printJobs.cancel(jobId); await refreshJobs(); onNotice({ tone: 'success', text: `Print job ${jobId} cancelled.` }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }
  const release = async (jobId: string, scaling: 'fit' | 'fill', overrideLabelLimit: boolean) => { if (overrideLabelLimit && !window.confirm('This job exceeds the configured label limit. Print it anyway?')) return; try { await getBackendSdk().printJobs.release(jobId, { scaling, override_label_limit: overrideLabelLimit }); await refreshJobs(); onNotice({ tone: 'success', text: `Print job ${jobId} released with ${scaling} scaling.` }) } catch (reason) { onNotice({ tone: 'error', text: errorText(reason) }) } }
  return <main className='page-shell'><header className='page-heading'><div><span className='eyebrow'>PrintHub jobs</span><h1>Review recent print jobs</h1><p>Holds, service delivery and ambiguous physical outcomes remain visible here without claiming more than the printer reported.</p></div><button type='button' onClick={() => void refreshJobs()}>Refresh</button></header>
    <section className='jobs-panel'>{jobs.length === 0 ? <div className='empty-state'>No print jobs yet.</div> : <div className='job-list'>{jobs.map((job) => <PrintJobRow key={job.id} job={job} onRetry={(id) => void retry(id)} onReprint={(id) => void reprint(id)} onCancel={(id) => void cancel(id)} onRelease={(id, scaling, override) => void release(id, scaling, override)} />)}</div>}</section></main>
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
  return <div className={`studio-app theme-${theme}${view === 'designer' ? ' designer-mode' : ''}`}><aside className='studio-sidebar'><Brand /><AppNav view={view} /><div className='sidebar-footer'><span>PrintHub works without Thingdex.</span><button type='button' onClick={toggleTheme}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button></div></aside><div className='studio-main'><div className='mobile-topbar'><Brand /><button type='button' onClick={() => navigate('print')}>Quick print</button></div><NoticeBar notice={notice} onClose={() => setNotice(null)} />{view === 'templates' && <TemplateLibrary onNotice={setNotice} />}{view === 'print' && <QuickPrint onNotice={setNotice} />}{view === 'designer' && <Designer />}{view === 'printers' && <PrinterManagement onNotice={setNotice} />}{view === 'jobs' && <PrintJobs onNotice={setNotice} />}</div></div>
}
