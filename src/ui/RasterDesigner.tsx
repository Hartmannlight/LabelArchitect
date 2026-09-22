import { useEffect, useRef, useState } from 'react'
import type { RasterPrintJobCreateRequest } from '@printhub/sdk'
import { getBackendSdk } from '../api/sdk'
import { errorText } from '../api/errorText'
import { emptyRasterDesign, loadRasterImage, MAX_RASTER_DESIGN_BYTES, newRasterId, parseRasterDesign, parseRasterDesignFile, renderRasterDesign, serializeRasterDesign } from '../model/rasterDesign'
import type { RasterDesign, RasterElement } from '../model/rasterDesign'

const STORAGE = 'printhub:raster-design:v1'
const PENDING = 'printhub:raster-pending:v1'
type Printer = { id: string; display_name?: string; alignment?: { dpi?: number }; media?: { loaded?: { width_mm?: number; height_mm?: number } } }

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a')
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function RasterDesigner() {
  const [doc, setDoc] = useState<RasterDesign>(() => {
    try { const saved = localStorage.getItem(STORAGE); return saved ? parseRasterDesign(JSON.parse(saved)) : emptyRasterDesign() } catch { return emptyRasterDesign() }
  })
  const [past, setPast] = useState<RasterDesign[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [printerId, setPrinterId] = useState('')
  const [copies, setCopies] = useState(1)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<RasterPrintJobCreateRequest | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const drag = useRef<{ id: string; x: number; y: number; doc: RasterDesign } | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const designInput = useRef<HTMLInputElement>(null)
  const printer = printers.find((p) => p.id === printerId)
  const dpi = printer?.alignment?.dpi ?? 203
  const element = doc.elements.find((item) => item.id === selected)
  const locked = busy || uncertain

  function refreshPrinters() {
    getBackendSdk().printers.list().then((response) => { setPrinters((response.printers ?? []) as Printer[]); setError('') }).catch((e) => setError(`Printer list unavailable: ${errorText(e)}. You can still edit and export labels.`))
  }
  useEffect(() => {
    refreshPrinters()
    try {
      const saved = sessionStorage.getItem(PENDING)
      if (saved) { pending.current = JSON.parse(saved); setUncertain(true) }
    } catch { setError('Could not recover the pending print request. Check Print jobs before printing again.') }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(doc)) } catch { setError('Browser storage is full. Export the design to save it.') }
    let active = true
    setPreview('')
    renderRasterDesign(doc, dpi).then((canvas) => { if (active) setPreview(canvas.toDataURL('image/png')) }).catch((e) => { if (active) setError(errorText(e)) })
    return () => { active = false }
  }, [doc, dpi])

  function change(next: RasterDesign) {
    if (locked) return
    try { parseRasterDesign(next) } catch (e) { setError(errorText(e)); return }
    setPast((items) => [...items.slice(-29), doc]); setDoc(next); setMessage('')
  }
  function update(values: Partial<RasterElement>) {
    change({ ...doc, elements: doc.elements.map((item) => item.id === selected ? { ...item, ...values } : item) })
  }
  function add(kind: 'text' | 'rectangle') {
    const item: RasterElement = { id: newRasterId(), kind, x: 2, y: 2, width: Math.max(1, doc.widthMm - 4), height: 10, text: 'Label text', fontSize: 4 }
    change({ ...doc, elements: [...doc.elements, item] }); setSelected(item.id)
  }
  async function importImage(file?: File) {
    if (!file) return
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5_000_000) throw new Error('Choose a PNG/JPEG up to 5 MB')
      const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      const image = await loadRasterImage(source)
      const width = Math.max(1, doc.widthMm - 4); const height = Math.min(Math.max(1, doc.heightMm - 4), width * image.naturalHeight / image.naturalWidth)
      const item: RasterElement = { id: newRasterId(), kind: 'image', x: 2, y: 2, width, height, source }
      change({ ...doc, elements: [...doc.elements, item] }); setSelected(item.id)
    } catch (e) { setError(errorText(e)) }
  }
  async function send() {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    let submitted = false
    try {
      if (!pending.current) {
        if (!printerId) throw new Error('Select a printer')
        const canvas = await renderRasterDesign(doc, dpi)
        pending.current = { printer_id: printerId, copies, scaling: 'hold', dither: 'none', content_optimize: 'graphics',
          mismatch_tolerance_mm: 0.5, override_label_limit: false,
          idempotency_key: newRasterId(), origin: 'studio-image-designer', pages: [{ mime_type: 'image/png',
            data_base64: canvas.toDataURL('image/png').split(',')[1], width_mm: doc.widthMm, height_mm: doc.heightMm }] }
        // Save before submitting, so navigation or a lost response cannot create a duplicate.
        sessionStorage.setItem(PENDING, JSON.stringify(pending.current))
      }
      submitted = true
      const job = await getBackendSdk().printJobs.createRaster(pending.current!)
      sessionStorage.removeItem(PENDING); pending.current = null; setUncertain(false)
      setMessage(`Job ${job.id}: ${job.status}. See Print jobs for the delivery result.`)
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? Number(e.status) : 0
      if (!submitted || [400, 401, 403, 404, 413, 422].includes(status)) {
        pending.current = null
        try { sessionStorage.removeItem(PENDING) } catch { /* No request sent or explicitly rejected. */ }
      }
      setError(errorText(e)); setUncertain(pending.current !== null)
    }
    finally { setBusy(false) }
  }
  function point(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * doc.widthMm, y: (event.clientY - rect.top) / rect.height * doc.heightMm }
  }

  return <main className='raster-designer'>
    <header className='page-heading'><div><span className='eyebrow'>Image designer</span><h1>Design a bitmap label</h1><p>Text, images and shapes · local preview · drag elements to position them</p></div></header>
    {error && <div role='alert' className='notice notice-error'>{error}</div>}
    {message && <div role='status' className='notice notice-success'>{message} <a href='#/jobs'>Print jobs</a></div>}
    {uncertain && <div role='alert' className='notice notice-info'>A print request has no confirmed API response. <button disabled={busy} onClick={() => void send()}>Resolve same request</button> <a href='#/jobs'>Check Print jobs</a></div>}
    <fieldset disabled={locked} className='raster-controls'>
      <label>Name<input value={doc.name} maxLength={200} onChange={(e) => change({ ...doc, name: e.target.value })} /></label>
      <label>Width (mm)<input type='number' min='1' max='300' step='.1' value={doc.widthMm} onChange={(e) => { const n = Number(e.target.value); if (n > 0 && n <= 300) change({ ...doc, widthMm: n }) }} /></label>
      <label>Height (mm)<input type='number' min='1' max='300' step='.1' value={doc.heightMm} onChange={(e) => { const n = Number(e.target.value); if (n > 0 && n <= 300) change({ ...doc, heightMm: n }) }} /></label>
      <button onClick={() => add('text')}>Add text</button><button onClick={() => imageInput.current?.click()}>Add image</button><button onClick={() => add('rectangle')}>Add rectangle</button>
      <button disabled={!past.length || locked} onClick={() => { setDoc(past[past.length - 1]); setPast(past.slice(0, -1)) }}>Undo</button>
      <button onClick={() => download(`${doc.name || 'label'}.json`, new Blob([serializeRasterDesign(doc)], { type: 'application/json' }))}>Save design</button>
      <button onClick={() => designInput.current?.click()}>Load design</button>
      <button onClick={() => { void renderRasterDesign(doc, dpi).then((canvas) => canvas.toBlob((blob) => { if (blob) download(`${doc.name || 'label'}.png`, blob) })).catch((e) => setError(errorText(e))) }}>Export PNG</button>
      <input hidden type='file' ref={imageInput} accept='image/png,image/jpeg' onChange={(e) => { void importImage(e.target.files?.[0]); e.target.value = '' }} />
      <input hidden type='file' ref={designInput} accept='.json' onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; try { if (file.size > MAX_RASTER_DESIGN_BYTES) throw new Error('Design exceeds 20 MB including embedded images'); change(parseRasterDesignFile(await file.text())); setSelected(null) } catch (reason) { setError(errorText(reason)) } }} />
    </fieldset>
    <section className='raster-workspace'>
      <div className='raster-paper-area'><div className='raster-paper' style={{ aspectRatio: `${doc.widthMm} / ${doc.heightMm}` }}
        onPointerDown={(e) => { if (locked) return; const p = point(e); const hit = [...doc.elements].reverse().find((item) => p.x >= item.x && p.y >= item.y && p.x <= item.x + item.width && p.y <= item.y + item.height); setSelected(hit?.id ?? null); if (hit) { drag.current = { id: hit.id, ...p, doc }; e.currentTarget.setPointerCapture(e.pointerId) } }}
        onPointerMove={(e) => { const moving = drag.current; if (!moving || locked) return; const p = point(e); try { setDoc(parseRasterDesign({ ...moving.doc, elements: moving.doc.elements.map((item) => item.id === moving.id ? { ...item, x: Math.max(0, Math.min(doc.widthMm - .1, item.x + p.x - moving.x)), y: Math.max(0, Math.min(doc.heightMm - .1, item.y + p.y - moving.y)) } : item) })) } catch (reason) { setError(errorText(reason)) } }}
        onPointerUp={(e) => { if (drag.current) { const before = drag.current.doc; setPast((items) => [...items.slice(-29), before]); drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId) } }} onLostPointerCapture={() => { drag.current = null }}>
        {preview && <img src={preview} alt='Monochrome label preview' draggable={false} />}
        {element && <div className='raster-selection' style={{ left: `${element.x / doc.widthMm * 100}%`, top: `${element.y / doc.heightMm * 100}%`, width: `${element.width / doc.widthMm * 100}%`, height: `${element.height / doc.heightMm * 100}%` }} />}
      </div><p>{Math.round(doc.widthMm * dpi / 25.4)} × {Math.round(doc.heightMm * dpi / 25.4)} pixels · {dpi} dpi</p></div>
      <fieldset disabled={locked} className='raster-properties'><legend>Elements</legend>
        <select aria-label='Selected element' value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}><option value=''>Select an element</option>{doc.elements.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.kind} {item.text?.slice(0, 24)}</option>)}</select>
        {element && <>
          {(['x', 'y', 'width', 'height'] as const).map((key) => <label key={key}>{key} (mm)<input type='number' min={key === 'x' || key === 'y' ? 0 : .1} max={300} step='.1' value={Number(element[key].toFixed(2))} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0 && n <= 300 && (!(key === 'width' || key === 'height') || n > 0)) update({ [key]: n }) }} /></label>)}
          {element.kind === 'text' && <><label>Text<textarea value={element.text} maxLength={10000} onChange={(e) => update({ text: e.target.value })} /></label><label>Font size (mm)<input type='number' min='.5' max='100' step='.5' value={element.fontSize} onChange={(e) => { const n = Number(e.target.value); if (n > 0 && n <= 100) update({ fontSize: n }) }} /></label><label><input type='checkbox' checked={!!element.bold} onChange={(e) => update({ bold: e.target.checked })} />Bold</label></>}
          {element.kind === 'rectangle' && <label><input type='checkbox' checked={!!element.filled} onChange={(e) => update({ filled: e.target.checked })} />Filled</label>}
          <button onClick={() => change({ ...doc, elements: [...doc.elements.filter((item) => item.id !== selected), element] })}>Bring to front</button>
          <button onClick={() => { change({ ...doc, elements: doc.elements.filter((item) => item.id !== selected) }); setSelected(null) }}>Delete element</button>
        </>}
      </fieldset>
    </section>
    <fieldset disabled={locked} className='raster-controls'><legend>Print image</legend>
      <label>Printer<select value={printerId} onChange={(e) => setPrinterId(e.target.value)}><option value=''>Select a printer</option>{printers.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.id}</option>)}</select></label>
      <button onClick={refreshPrinters}>Refresh printers</button>
      <button disabled={!printer?.media?.loaded?.width_mm || locked} onClick={() => { const media = printer!.media!.loaded!; if (media.width_mm && media.height_mm) change({ ...doc, widthMm: media.width_mm, heightMm: media.height_mm }) }}>Use loaded label size</button>
      <label>Copies<input type='number' min='1' max='999' value={copies} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 999) setCopies(n) }} /></label>
      <button className='primary-action' disabled={!printerId || !preview || locked} onClick={() => void send()}>{busy ? 'Submitting…' : 'Print'}</button>
      <span>Different media sizes hold the job for review.</span>
    </fieldset>
  </main>
}
