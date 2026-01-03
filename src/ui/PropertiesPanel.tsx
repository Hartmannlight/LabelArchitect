import { useEffect, useMemo, useState } from 'react'
import InfoHint from './InfoHint'
import VariablesPanel from './VariablesPanel'
import { getNodeById } from '../model/ids'
import type { Element, LeafNode, SplitNode, TemplateDefaults } from '../model/types'
import { useTemplateEditorStore } from '../state/store'

const fitOptions = [
  { value: 'overflow', label: 'overflow' },
  { value: 'wrap', label: 'wrap' },
  { value: 'shrink_to_fit', label: 'shrink_to_fit' },
  { value: 'truncate', label: 'truncate' }
]

const wrapOptions = [
  { value: 'none', label: 'none' },
  { value: 'word', label: 'word' },
  { value: 'char', label: 'char' }
]

const sizeModeOptions = [
  { value: 'fixed', label: 'fixed' },
  { value: 'max', label: 'max' }
]

const alignHOptions = [
  { value: 'left', label: 'left' },
  { value: 'center', label: 'center' },
  { value: 'right', label: 'right' }
]

const alignVOptions = [
  { value: 'top', label: 'top' },
  { value: 'center', label: 'center' },
  { value: 'bottom', label: 'bottom' }
]

const renderModeOptions = [
  { value: 'zpl', label: 'zpl' },
  { value: 'image', label: 'image' }
]

const renderModeElementOptions = [{ value: '', label: 'default' }, ...renderModeOptions]

const imageFitOptions = [
  { value: 'none', label: 'none' },
  { value: 'contain', label: 'contain' },
  { value: 'cover', label: 'cover' },
  { value: 'stretch', label: 'stretch' }
]

const imageDitherOptions = [
  { value: 'none', label: 'none' },
  { value: 'floyd_steinberg', label: 'floyd_steinberg' },
  { value: 'bayer', label: 'bayer' }
]

const qrErrorCorrectionOptions = [
  { value: 'L', label: 'L' },
  { value: 'M', label: 'M' },
  { value: 'Q', label: 'Q' },
  { value: 'H', label: 'H' }
]

const qrInputModeOptions = [
  { value: 'A', label: 'A' },
  { value: 'M', label: 'M' }
]

const qrCharacterModeOptions = [
  { value: 'N', label: 'N' },
  { value: 'A', label: 'A' }
]

const qrThemePresetOptions = [
  { value: 'classic', label: 'classic' },
  { value: 'dots', label: 'dots' },
  { value: 'rounded', label: 'rounded' }
]

const qrThemeShapeOptions = [
  { value: 'square', label: 'square' },
  { value: 'circle', label: 'circle' },
  { value: 'rounded', label: 'rounded' }
]

const dataMatrixQualityOptions = [{ value: '200', label: '200' }]

const fontHeightOptions = [2, 2.5, 3, 3.5, 4, 5, 6, 7, 8]

function getFitOptions(wrap: string | undefined) {
  return fitOptions
}

function getWrapOptions(fit: string | undefined) {
  return wrapOptions
}

function NumInput(props: { value: number; onChange: (v: number) => void; min?: number; step?: number; className?: string }) {
  const [draft, setDraft] = useState<string>('')

  useEffect(() => {
    setDraft(Number.isFinite(props.value) ? String(props.value) : '')
  }, [props.value])

  return (
    <input
      className={'w-full border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)] ' + (props.className ?? '')}
      type='number'
      value={draft}
      min={props.min}
      step={props.step ?? 0.1}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        if (next === '' || next === '-' || next === '.' || next === '-.') return
        const parsed = Number(next)
        if (Number.isFinite(parsed)) props.onChange(parsed)
      }}
      onBlur={() => {
        if (draft === '' || !Number.isFinite(Number(draft))) {
          setDraft(Number.isFinite(props.value) ? String(props.value) : '')
          return
        }
        const parsed = Number(draft)
        if (props.min !== undefined && parsed < props.min) {
          props.onChange(props.min)
        }
      }}
    />
  )
}

function TextInput(props: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <input
      className={'w-full border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)] ' + (props.className ?? '')}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
    />
  )
}

function Select(props: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select
      className={'w-full border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)] ' + (props.className ?? '')}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function stripDataUrlPrefix(value: string) {
  const idx = value.indexOf('base64,')
  if (idx === -1) return value
  return value.slice(idx + 'base64,'.length)
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function parseSvgLength(value: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^([0-9.+-eE]+)([a-z%]*)$/)
  if (!match) return null
  const num = Number(match[1])
  if (!Number.isFinite(num)) return null
  const unit = match[2] || 'px'
  if (unit === 'px' || unit === '') return num
  if (unit === 'in') return num * 96
  if (unit === 'cm') return (num * 96) / 2.54
  if (unit === 'mm') return (num * 96) / 25.4
  if (unit === 'pt') return (num * 96) / 72
  if (unit === 'pc') return num * 16
  return null
}

function getSvgDimensions(svgText: string): { widthPx: number; heightPx: number } | null {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return null
    const widthPx = parseSvgLength(svg.getAttribute('width'))
    const heightPx = parseSvgLength(svg.getAttribute('height'))
    if (widthPx && heightPx) return { widthPx, heightPx }
    const viewBox = svg.getAttribute('viewBox')
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map((p) => Number(p))
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const vbWidth = Math.max(1, parts[2])
        const vbHeight = Math.max(1, parts[3])
        return { widthPx: vbWidth, heightPx: vbHeight }
      }
    }
    return null
  } catch {
    return null
  }
}

async function rasterizeSvgToPngBase64(svgText: string, dpi: number): Promise<string> {
  const dims = getSvgDimensions(svgText) ?? { widthPx: 256, heightPx: 256 }
  const scale = Math.max(0.01, dpi / 96)
  const targetW = Math.max(1, Math.round(dims.widthPx * scale))
  const targetH = Math.max(1, Math.round(dims.heightPx * scale))

  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Missing canvas context')
    ctx.drawImage(img, 0, 0, targetW, targetH)
    const dataUrl = canvas.toDataURL('image/png')
    return stripDataUrlPrefix(dataUrl)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function PropertiesPanel() {
  const doc = useTemplateEditorStore((s) => s.history.present)
  const selection = useTemplateEditorStore((s) => s.selection)

  const setAlias = useTemplateEditorStore((s) => s.setAlias)
  const clearAlias = useTemplateEditorStore((s) => s.clearAlias)

  const splitLeafAt = useTemplateEditorStore((s) => s.splitLeafAt)
  const unsplitAt = useTemplateEditorStore((s) => s.unsplitAt)

  const setSplitRatio = useTemplateEditorStore((s) => s.setSplitRatio)
  const setSplitGutter = useTemplateEditorStore((s) => s.setSplitGutter)
  const setSplitDividerVisible = useTemplateEditorStore((s) => s.setSplitDividerVisible)
  const setSplitDividerThickness = useTemplateEditorStore((s) => s.setSplitDividerThickness)

  const setLeafPadding = useTemplateEditorStore((s) => s.setLeafPadding)
  const setLeafDebugBorder = useTemplateEditorStore((s) => s.setLeafDebugBorder)

  const placeElementOnLeaf = useTemplateEditorStore((s) => s.placeElementOnLeaf)
  const patchElement = useTemplateEditorStore((s) => s.patchElement)

  const setDefaultsRaw = useTemplateEditorStore((s) => s.setDefaultsRaw)

  const node = useMemo(() => {
    if (!selection) return null
    return getNodeById(doc.layout, selection.nodeId)
  }, [doc.layout, selection])

  return (
    <div className='h-full flex flex-col'>
      <div className='px-3 py-2 border-b app-bar text-sm font-semibold'>Properties</div>
      <div className='flex-1 overflow-auto p-3 space-y-4'>
        <DefaultsEditor defaults={doc.defaults ?? {}} onChange={setDefaultsRaw} />

        {!selection || !node ? (
          <div className='text-sm text-muted'>No selection.</div>
        ) : (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='text-xs text-muted font-mono'>{selection.nodeId}</div>
              <div className='text-xs text-muted flex items-center gap-1'>
                <span>Alias</span>
                <InfoHint text='Optional name used to reference this node.' />
              </div>
              <div className='flex items-center gap-2'>
                <TextInput
                  value={(node as any).alias ?? ''}
                  onChange={(v) => setAlias(selection.nodeId, v)}
                  placeholder='Alias (optional)'
                  className='w-full'
                />
                <button
                  className='px-2 py-1 text-sm rounded border btn'
                  onClick={() => clearAlias(selection.nodeId)}
                  type='button'
                >
                  Clear
                </button>
              </div>
            </div>

            {node.kind === 'split' ? (
              <SplitEditor
                nodeId={selection.nodeId}
                node={node}
                onRatio={(r) => setSplitRatio(selection.nodeId, r)}
                onGutter={(g) => setSplitGutter(selection.nodeId, g)}
                onDividerVisible={(v) => setSplitDividerVisible(selection.nodeId, v)}
                onDividerThickness={(t) => setSplitDividerThickness(selection.nodeId, t)}
                onUnsplit={() => unsplitAt(selection.nodeId)}
              />
            ) : (
              <LeafEditor
                nodeId={selection.nodeId}
                node={node}
                onSplitV={() => splitLeafAt(selection.nodeId, 'v')}
                onSplitH={() => splitLeafAt(selection.nodeId, 'h')}
                onPadding={(p) => setLeafPadding(selection.nodeId, p)}
                onDebug={(v) => setLeafDebugBorder(selection.nodeId, v)}
                onPlace={(t) => placeElementOnLeaf(selection.nodeId, t)}
                onPatch={(p) => patchElement(selection.nodeId, p)}
                textDefaults={doc.defaults?.text ?? {}}
                code2dDefaults={doc.defaults?.code2d ?? {}}
                imageDefaults={doc.defaults?.image ?? {}}
                leafPaddingDefaults={doc.defaults?.leaf_padding_mm}
              />
            )}
          </div>
        )}

        <VariablesPanel />
      </div>
    </div>
  )
}

function getDefaultTextMaxLines(fit: string | undefined) {
  return fit === 'shrink_to_fit' ? 1 : 6
}

function normalizeFitWrap(fit: string | undefined, wrap: string | undefined) {
  if (fit === 'overflow') return { fit: 'overflow', wrap: 'none' }
  if (wrap === 'none') return { fit: 'overflow', wrap: 'none' }
  if (fit === 'wrap' || fit === 'truncate' || fit === 'shrink_to_fit') return { fit, wrap: wrap ?? 'word' }
  return { fit: fit ?? 'wrap', wrap: wrap ?? 'word' }
}

function normalizeForFitChange(nextFit: string, currentWrap: string | undefined) {
  if (nextFit === 'overflow') return { fit: 'overflow', wrap: 'none' }
  if (currentWrap === 'none' || !currentWrap) return { fit: nextFit, wrap: 'word' }
  return { fit: nextFit, wrap: currentWrap }
}

function normalizeForWrapChange(nextWrap: string, currentFit: string | undefined) {
  if (nextWrap === 'none') return { fit: 'overflow', wrap: 'none' }
  if (currentFit === 'overflow' || !currentFit) return { fit: 'wrap', wrap: nextWrap }
  return { fit: currentFit, wrap: nextWrap }
}

function DefaultsEditor(props: { defaults: TemplateDefaults; onChange: (defaults: TemplateDefaults) => void }) {
  const d = props.defaults
  const leafPad = d.leaf_padding_mm ?? [1.5, 1.5, 1.5, 1.5]
  const text = d.text ?? {}
  const code2d = d.code2d ?? {}
  const image = d.image ?? {}
  const render = d.render ?? {}
  const [isOpen, setIsOpen] = useState(true)

  const set = (patch: Partial<TemplateDefaults>) => props.onChange({ ...d, ...patch })

  return (
    <div className='rounded border panel-muted p-3 space-y-3'>
      <button className='flex items-center justify-between w-full text-sm font-semibold' type='button' onClick={() => setIsOpen(!isOpen)}>
        <span>Template Defaults</span>
        <span className='text-xs text-subtle'>{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <>
          <div className='space-y-2'>
          <div className='text-xs text-muted flex items-center gap-1'>
            <span>Leaf padding (mm)</span>
            <InfoHint text='Padding applied inside each leaf, in mm (top/right/bottom/left).' />
          </div>
            <div className='grid grid-cols-4 gap-2'>
              <NumInput value={leafPad[0]} onChange={(v) => set({ leaf_padding_mm: [v, leafPad[1], leafPad[2], leafPad[3]] })} min={0} />
              <NumInput value={leafPad[1]} onChange={(v) => set({ leaf_padding_mm: [leafPad[0], v, leafPad[2], leafPad[3]] })} min={0} />
              <NumInput value={leafPad[2]} onChange={(v) => set({ leaf_padding_mm: [leafPad[0], leafPad[1], v, leafPad[3]] })} min={0} />
              <NumInput value={leafPad[3]} onChange={(v) => set({ leaf_padding_mm: [leafPad[0], leafPad[1], leafPad[2], v] })} min={0} />
            </div>
            <div className='text-xs text-subtle'>Top / Right / Bottom / Left</div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs text-muted'>Text defaults</div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
            <div className='text-xs text-subtle flex items-center gap-1'>
              <span>Font height (mm)</span>
              <InfoHint text='Default text height for new text elements.' />
            </div>
            <Select
              value={String(text.font_height_mm ?? 4)}
              onChange={(v) => set({ text: { ...text, font_height_mm: Number(v) } })}
              options={fontHeightOptions.map((value) => ({ value: String(value), label: `${value}` }))}
            />
          </div>
          <div className='space-y-1'>
            <div className='text-xs text-subtle flex items-center gap-1'>
              <span>Fit</span>
              <InfoHint text='Overflow behavior: overflow = no wrap, wrap = wrap only, truncate = wrap + cut at max lines, shrink_to_fit = wrap + shrink to fit.' />
            </div>
            <Select
              value={text.fit ?? 'shrink_to_fit'}
              onChange={(v) => {
                const nextFit = v as any
                const normalized = normalizeForFitChange(nextFit, text.wrap)
                set({
                  text: {
                    ...text,
                    fit: normalized.fit as any,
                    wrap: normalized.wrap as any
                  }
                })
              }}
              options={getFitOptions(text.wrap)}
            />
          </div>
          <div className='space-y-1'>
            <div className='text-xs text-subtle flex items-center gap-1'>
              <span>Wrap</span>
              <InfoHint text='Wrap mode: none = no auto breaks, word = break on words, char = break anywhere.' />
            </div>
            <Select
              value={text.wrap ?? 'word'}
              onChange={(v) => {
                const nextWrap = v as any
                const normalized = normalizeForWrapChange(nextWrap, text.fit)
                set({
                  text: {
                    ...text,
                    wrap: normalized.wrap as any,
                    fit: normalized.fit as any
                  }
                })
              }}
              options={getWrapOptions(text.fit)}
            />
          </div>
          <div className='space-y-1'>
            <div className='text-xs text-subtle flex items-center gap-1'>
              <span>Max lines</span>
              <InfoHint text='Maximum number of lines allowed.' />
            </div>
            <NumInput
              value={text.max_lines ?? getDefaultTextMaxLines(text.fit)}
              onChange={(v) => set({ text: { ...text, max_lines: Math.max(1, Math.floor(v)) } })}
              min={1}
              step={1}
            />
          </div>
          <div className='space-y-1'>
            <div className='text-xs text-subtle flex items-center gap-1'>
              <span>Align H</span>
              <InfoHint text='Horizontal alignment inside the text box.' />
            </div>
            <Select
              value={text.align_h ?? 'left'}
              onChange={(v) => set({ text: { ...text, align_h: v as any } })}
                  options={[
                    { value: 'left', label: 'left' },
                    { value: 'center', label: 'center' },
                    { value: 'right', label: 'right' }
                  ]}
                />
          </div>
          <div className='space-y-1'>
            <div className='text-xs text-subtle flex items-center gap-1'>
              <span>Align V</span>
              <InfoHint text='Vertical alignment inside the text box.' />
            </div>
            <Select
              value={text.align_v ?? 'top'}
              onChange={(v) => set({ text: { ...text, align_v: v as any } })}
                  options={[
                    { value: 'top', label: 'top' },
                    { value: 'center', label: 'center' },
                    { value: 'bottom', label: 'bottom' }
                  ]}
                />
              </div>
            </div>
          </div>

          <div className='space-y-2'>
          <div className='text-xs text-muted flex items-center gap-1'>
            <span>2D code defaults</span>
            <InfoHint text='Default settings for QR/DataMatrix elements.' />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <div className='text-xs text-subtle flex items-center gap-1'>
                <span>Quiet zone (mm)</span>
                <InfoHint text='Clear margin around the 2D code.' />
              </div>
              <NumInput value={code2d.quiet_zone_mm ?? 1} onChange={(v) => set({ code2d: { ...code2d, quiet_zone_mm: v } })} min={0} step={0.1} />
            </div>
            <div className='space-y-1'>
              <div className='text-xs text-subtle flex items-center gap-1'>
                <span>Size mode</span>
                <InfoHint text='fixed = use explicit sizing, max = grow to available space.' />
              </div>
              <Select
                value={code2d.size_mode ?? 'fixed'}
                onChange={(v) => set({ code2d: { ...code2d, size_mode: v as any } })}
                options={sizeModeOptions}
              />
            </div>
            <div className='space-y-1'>
              <div className='text-xs text-subtle flex items-center gap-1'>
                <span>Render mode</span>
                <InfoHint text='zpl = native ZPL rendering, image = render as bitmap.' />
              </div>
              <Select
                value={code2d.render_mode ?? 'zpl'}
                onChange={(v) => set({ code2d: { ...code2d, render_mode: v as any } })}
                options={renderModeOptions}
              />
            </div>
            <div className='space-y-1'>
              <div className='text-xs text-subtle flex items-center gap-1'>
                <span>Align H</span>
                <InfoHint text='Horizontal alignment of 2D codes.' />
              </div>
              <Select
                value={code2d.align_h ?? 'center'}
                onChange={(v) => set({ code2d: { ...code2d, align_h: v as any } })}
                options={alignHOptions}
              />
            </div>
            <div className='space-y-1'>
              <div className='text-xs text-subtle flex items-center gap-1'>
                <span>Align V</span>
                <InfoHint text='Vertical alignment of 2D codes.' />
              </div>
              <Select
                value={code2d.align_v ?? 'center'}
                onChange={(v) => set({ code2d: { ...code2d, align_v: v as any } })}
                options={alignVOptions}
              />
            </div>
          </div>
        </div>

          <div className='space-y-2'>
            <div className='text-xs text-muted flex items-center gap-1'>
              <span>Image defaults</span>
              <InfoHint text='Default settings for image elements.' />
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Fit</span>
                  <InfoHint text='How the image scales to its box.' />
                </div>
                <Select value={image.fit ?? 'contain'} onChange={(v) => set({ image: { ...image, fit: v as any } })} options={imageFitOptions} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align H</span>
                  <InfoHint text='Horizontal alignment inside the image box.' />
                </div>
                <Select value={image.align_h ?? 'center'} onChange={(v) => set({ image: { ...image, align_h: v as any } })} options={alignHOptions} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align V</span>
                  <InfoHint text='Vertical alignment inside the image box.' />
                </div>
                <Select value={image.align_v ?? 'center'} onChange={(v) => set({ image: { ...image, align_v: v as any } })} options={alignVOptions} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Input DPI</span>
                  <InfoHint text='DPI used to interpret image pixels.' />
                </div>
                <NumInput value={image.input_dpi ?? 203} onChange={(v) => set({ image: { ...image, input_dpi: Math.max(1, Math.floor(v)) } })} min={1} step={1} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Threshold</span>
                  <InfoHint text='0-255 threshold for black/white conversion.' />
                </div>
                <NumInput
                  value={image.threshold ?? 128}
                  onChange={(v) => set({ image: { ...image, threshold: Math.max(0, Math.min(255, Math.floor(v))) } })}
                  min={0}
                  step={1}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Dither</span>
                  <InfoHint text='Dithering mode for black/white conversion.' />
                </div>
                <Select value={image.dither ?? 'none'} onChange={(v) => set({ image: { ...image, dither: v as any } })} options={imageDitherOptions} />
              </div>
              <label className='flex items-center gap-2 text-sm'>
                <input type='checkbox' checked={image.invert ?? false} onChange={(e) => set({ image: { ...image, invert: e.target.checked } })} />
                <span className='flex items-center gap-1'>
                  Invert
                  <InfoHint text='Swap black/white after rasterization.' />
                </span>
              </label>
            </div>
          </div>

          <div className='space-y-2'>
          <div className='text-xs text-muted flex items-center gap-1'>
            <span>Render defaults</span>
            <InfoHint text='Defaults that affect ZPL rendering behavior.' />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <div className='text-xs text-subtle flex items-center gap-1'>
                <span>Missing variables</span>
                <InfoHint text='How to handle missing variables during render.' />
              </div>
              <Select
                value={render.missing_variables ?? 'error'}
                onChange={(v) => set({ render: { ...render, missing_variables: v as any } })}
                  options={[
                    { value: 'error', label: 'error' },
                    { value: 'empty', label: 'empty' }
                  ]}
                />
            </div>
            <label className='flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={render.emit_ci28 ?? true} onChange={(e) => set({ render: { ...render, emit_ci28: e.target.checked } })} />
              <span className='flex items-center gap-1'>
                emit_ci28 (UTF-8)
                <InfoHint text='Emit CI28 (UTF-8) encoding control code.' />
              </span>
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={render.debug_padding_guides ?? false}
                onChange={(e) => set({ render: { ...render, debug_padding_guides: e.target.checked } })}
              />
              <span className='flex items-center gap-1'>
                Debug padding guides
                <InfoHint text='Render padding guide lines in the output label.' />
              </span>
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={render.debug_gutter_guides ?? false}
                onChange={(e) => set({ render: { ...render, debug_gutter_guides: e.target.checked } })}
              />
              <span className='flex items-center gap-1'>
                Debug gutter guides
                <InfoHint text='Render gutter guide lines for split nodes.' />
              </span>
            </label>
          </div>
        </div>
        </>
      )}
    </div>
  )
}

function SplitEditor(props: {
  nodeId: string
  node: SplitNode
  onRatio: (ratio: number) => void
  onGutter: (gutter: number) => void
  onDividerVisible: (visible: boolean) => void
  onDividerThickness: (thickness: number) => void
  onUnsplit: () => void
}) {
  const gutter = props.node.gutter_mm ?? 0
  const dividerVisible = props.node.divider?.visible ?? false
  const thickness = props.node.divider?.thickness_mm ?? 0.3
  const minGutter = dividerVisible ? thickness : 0

  return (
    <div className='rounded border panel-muted p-3 space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='text-sm font-semibold'>Split</div>
        <button className='px-2 py-1 text-sm rounded border btn' onClick={props.onUnsplit} type='button'>
          Unsplit
        </button>
      </div>

      <div className='grid grid-cols-2 gap-2'>
        <div className='space-y-1'>
          <div className='text-xs text-subtle flex items-center gap-1'>
            <span>Direction</span>
            <InfoHint text='Split direction: v = vertical, h = horizontal.' />
          </div>
          <div className='text-sm font-mono'>{props.node.direction}</div>
        </div>
        <div className='space-y-1'>
          <div className='text-xs text-subtle flex items-center gap-1'>
            <span>Ratio (child0)</span>
            <InfoHint text='Share of space for the first child (0..1).' />
          </div>
          <NumInput
            value={props.node.ratio}
            onChange={(v) => props.onRatio(Math.max(0.01, Math.min(0.99, v)))}
            min={0.01}
            step={0.001}
          />
        </div>
        <div className='space-y-1'>
          <div className='text-xs text-subtle flex items-center gap-1'>
            <span>Gutter (mm)</span>
            <InfoHint text='Gap between the two split children.' />
          </div>
          <NumInput value={gutter} onChange={(v) => props.onGutter(Math.max(minGutter, v))} min={minGutter} step={0.1} />
        </div>
        <div className='space-y-1'>
          <div className='text-xs text-subtle flex items-center gap-1'>
            <span>Divider</span>
            <InfoHint text='Controls the split divider line.' />
          </div>
          <label className='flex items-center gap-2 text-sm'>
            <input type='checkbox' checked={dividerVisible} onChange={(e) => props.onDividerVisible(e.target.checked)} />
            <span className='flex items-center gap-1'>
              Visible
              <InfoHint text='Show a line centered inside the gutter.' />
            </span>
          </label>
        </div>
        <div className='space-y-1'>
          <div className='text-xs text-subtle flex items-center gap-1'>
            <span>Divider thickness (mm)</span>
            <InfoHint text='Thickness of the divider line in mm.' />
          </div>
          <NumInput value={thickness} onChange={(v) => props.onDividerThickness(Math.max(0.1, v))} min={0.1} step={0.1} />
        </div>
      </div>

      <div className='text-xs text-subtle'>Rule: if divider is visible, gutter must be at least the thickness.</div>
    </div>
  )
}

function LeafEditor(props: {
  nodeId: string
  node: LeafNode
  onSplitV: () => void
  onSplitH: () => void
  onPadding: (p: [number, number, number, number] | undefined) => void
  onDebug: (v: boolean) => void
  onPlace: (t: 'text' | 'qr' | 'datamatrix' | 'line' | 'image') => void
  onPatch: (p: Partial<Element>) => void
  textDefaults: NonNullable<TemplateDefaults['text']>
  code2dDefaults: NonNullable<TemplateDefaults['code2d']>
  imageDefaults: NonNullable<TemplateDefaults['image']>
  leafPaddingDefaults?: [number, number, number, number]
}) {
  const pad = props.node.padding_mm
  const e = props.node.elements[0]
  const defaults = props.textDefaults
  const code2dDefaults = props.code2dDefaults
  const imageDefaults = props.imageDefaults
  const leafDefaults = props.leafPaddingDefaults ?? [1.5, 1.5, 1.5, 1.5]
  const defaultMaxLines = getDefaultTextMaxLines(e.fit ?? defaults.fit)
  const maxLinesValue = e.max_lines ?? defaults.max_lines ?? defaultMaxLines
  const qrInputMode = e.type === 'qr' ? e.input_mode ?? (e.character_mode ? 'M' : 'A') : 'A'
  const qrCharacterMode = e.type === 'qr' ? e.character_mode ?? 'N' : 'N'
  const qrThemePreset = e.type === 'qr' ? e.theme?.preset ?? '' : ''
  const qrThemeModuleShape = e.type === 'qr' ? e.theme?.module_shape ?? '' : ''
  const qrThemeFinderShape = e.type === 'qr' ? e.theme?.finder_shape ?? '' : ''

  const fieldClass = (value: any, defaultValue: any) => {
    if (value === undefined || value === null) return ''
    if (defaultValue === undefined || defaultValue === null) return 'border-[var(--warn)] bg-[var(--warn-bg)] text-[var(--warn)]'
    return value !== defaultValue ? 'border-[var(--warn)] bg-[var(--warn-bg)] text-[var(--warn)]' : ''
  }
  const padFieldClass = (value: number | undefined, defaultValue: number) => fieldClass(value, defaultValue)

  return (
    <div className='space-y-3'>
      <div className='rounded border panel-muted p-3 space-y-3'>
        <div className='flex items-center justify-between'>
          <div className='text-sm font-semibold'>Leaf</div>
          <div className='flex gap-2'>
            <button className='px-2 py-1 text-sm rounded border btn' onClick={props.onSplitV} type='button'>
              Split V
            </button>
            <button className='px-2 py-1 text-sm rounded border btn' onClick={props.onSplitH} type='button'>
              Split H
            </button>
          </div>
        </div>

        <div className='space-y-2'>
          <div className='text-xs text-muted flex items-center gap-1'>
            <span>Leaf padding override (mm)</span>
            <InfoHint text='Overrides the template default padding for this leaf.' />
          </div>
          <div className='grid grid-cols-4 gap-2'>
            <NumInput
              value={pad?.[0] ?? 0}
              onChange={(v) => props.onPadding([v, pad?.[1] ?? 0, pad?.[2] ?? 0, pad?.[3] ?? 0])}
              min={0}
              className={padFieldClass(pad?.[0], leafDefaults[0])}
            />
            <NumInput
              value={pad?.[1] ?? 0}
              onChange={(v) => props.onPadding([pad?.[0] ?? 0, v, pad?.[2] ?? 0, pad?.[3] ?? 0])}
              min={0}
              className={padFieldClass(pad?.[1], leafDefaults[1])}
            />
            <NumInput
              value={pad?.[2] ?? 0}
              onChange={(v) => props.onPadding([pad?.[0] ?? 0, pad?.[1] ?? 0, v, pad?.[3] ?? 0])}
              min={0}
              className={padFieldClass(pad?.[2], leafDefaults[2])}
            />
            <NumInput
              value={pad?.[3] ?? 0}
              onChange={(v) => props.onPadding([pad?.[0] ?? 0, pad?.[1] ?? 0, pad?.[2] ?? 0, v])}
              min={0}
              className={padFieldClass(pad?.[3], leafDefaults[3])}
            />
          </div>
          <button
            className='px-2 py-1 text-sm rounded border btn'
            onClick={() => props.onPadding(undefined)}
            type='button'
          >
            Clear override
          </button>
        </div>

        <label className='flex items-center gap-2 text-sm'>
          <input type='checkbox' checked={props.node.debug_border ?? false} onChange={(ev) => props.onDebug(ev.target.checked)} />
          <span className='flex items-center gap-1'>
            Debug border
            <InfoHint text='Draws an outline around the leaf for debugging.' />
          </span>
        </label>
      </div>

      <div className='rounded border panel-muted p-3 space-y-3'>
        <div className='flex items-center justify-between'>
          <div className='text-sm font-semibold flex items-center gap-1'>
            <span>Element</span>
            <InfoHint text='Select the element type stored in this leaf.' />
          </div>
          <Select
            value={e.type}
            onChange={(v) => props.onPlace(v as any)}
            options={[
              { value: 'text', label: 'text' },
              { value: 'qr', label: 'qr' },
              { value: 'datamatrix', label: 'datamatrix' },
              { value: 'image', label: 'image' },
              { value: 'line', label: 'line' }
            ]}
            className='w-auto'
          />
        </div>

        {e.type === 'text' && (
          <div className='space-y-2'>
            <div className='text-xs text-muted flex items-center gap-1'>
              <span>Text</span>
              <InfoHint text='Literal text content for this element.' />
            </div>
            <textarea
              className='w-full min-h-[88px] border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)]'
              value={e.text}
              onChange={(ev) => props.onPatch({ text: ev.target.value })}
            />
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Max lines</span>
                  <InfoHint text='Maximum number of lines allowed for this text.' />
                </div>
                <NumInput
                  value={maxLinesValue}
                  onChange={(v) => props.onPatch({ max_lines: Math.max(1, Math.floor(v)) })}
                  min={1}
                  step={1}
                  className={fieldClass(e.max_lines, defaults.max_lines ?? defaultMaxLines)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Font height (mm)</span>
                  <InfoHint text='Text height for this element.' />
                </div>
                <Select
                  value={String(e.font_height_mm ?? defaults.font_height_mm ?? 4)}
                  onChange={(v) => props.onPatch({ font_height_mm: Math.max(0.1, Number(v)) })}
                  options={fontHeightOptions.map((value) => ({ value: String(value), label: `${value}` }))}
                  className={fieldClass(e.font_height_mm, defaults.font_height_mm)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Fit</span>
                  <InfoHint text='Overflow behavior: overflow = no wrap, wrap = wrap only, truncate = wrap + cut at max lines, shrink_to_fit = wrap + shrink to fit.' />
                </div>
                <Select
                  value={e.fit ?? defaults.fit ?? 'shrink_to_fit'}
                  onChange={(v) => {
                    const nextFit = v as any
                    const normalized = normalizeForFitChange(nextFit, e.wrap ?? defaults.wrap)
                    props.onPatch({ fit: normalized.fit as any, wrap: normalized.wrap as any })
                  }}
                  options={getFitOptions(e.wrap ?? defaults.wrap)}
                  className={fieldClass(e.fit, defaults.fit)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Wrap</span>
                  <InfoHint text='Wrap mode: none = no auto breaks, word = break on words, char = break anywhere.' />
                </div>
                <Select
                  value={e.wrap ?? defaults.wrap ?? 'word'}
                  onChange={(v) => {
                    const nextWrap = v as any
                    const normalized = normalizeForWrapChange(nextWrap, e.fit ?? defaults.fit)
                    props.onPatch({ wrap: normalized.wrap as any, fit: normalized.fit as any })
                  }}
                  options={getWrapOptions(e.fit ?? defaults.fit)}
                  className={fieldClass(e.wrap, defaults.wrap)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align H</span>
                  <InfoHint text='Horizontal alignment inside the text box.' />
                </div>
                <Select
                  value={e.align_h ?? defaults.align_h ?? 'left'}
                  onChange={(v) => props.onPatch({ align_h: v as any })}
                  options={[
                    { value: 'left', label: 'left' },
                    { value: 'center', label: 'center' },
                    { value: 'right', label: 'right' }
                  ]}
                  className={fieldClass(e.align_h, defaults.align_h)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align V</span>
                  <InfoHint text='Vertical alignment inside the text box.' />
                </div>
                <Select
                  value={e.align_v ?? defaults.align_v ?? 'top'}
                  onChange={(v) => props.onPatch({ align_v: v as any })}
                  options={[
                    { value: 'top', label: 'top' },
                    { value: 'center', label: 'center' },
                    { value: 'bottom', label: 'bottom' }
                  ]}
                  className={fieldClass(e.align_v, defaults.align_v)}
                />
              </div>
            </div>
          </div>
        )}

        {e.type === 'qr' && (
          <div className='space-y-2'>
            <div className='text-xs text-muted flex items-center gap-1'>
              <span>QR data</span>
              <InfoHint text='Data encoded in the QR code.' />
            </div>
            <TextInput value={e.data} onChange={(v) => props.onPatch({ data: v })} className='w-full' />
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Magnification</span>
                  <InfoHint text='Module size multiplier for the QR code.' />
                </div>
                <NumInput value={e.magnification ?? 3} onChange={(v) => props.onPatch({ magnification: Math.max(1, Math.min(10, Math.floor(v))) })} min={1} step={1} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Size mode</span>
                  <InfoHint text='fixed = use magnification, max = grow to available space.' />
                </div>
                <Select
                  value={e.size_mode ?? 'fixed'}
                  onChange={(v) => props.onPatch({ size_mode: v as any })}
                  options={sizeModeOptions}
                  className={fieldClass(e.size_mode, code2dDefaults.size_mode)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Render mode</span>
                  <InfoHint text='zpl = native ZPL rendering, image = render as bitmap.' />
                </div>
                <Select
                  value={e.render_mode ?? code2dDefaults.render_mode ?? ''}
                  onChange={(v) => props.onPatch({ render_mode: v ? (v as any) : undefined })}
                  options={renderModeElementOptions}
                  className={fieldClass(e.render_mode, code2dDefaults.render_mode)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align H</span>
                  <InfoHint text='Horizontal alignment inside the element box.' />
                </div>
                <Select
                  value={e.align_h ?? code2dDefaults.align_h ?? 'center'}
                  onChange={(v) => props.onPatch({ align_h: v as any })}
                  options={alignHOptions}
                  className={fieldClass(e.align_h, code2dDefaults.align_h)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align V</span>
                  <InfoHint text='Vertical alignment inside the element box.' />
                </div>
                <Select
                  value={e.align_v ?? code2dDefaults.align_v ?? 'center'}
                  onChange={(v) => props.onPatch({ align_v: v as any })}
                  options={alignVOptions}
                  className={fieldClass(e.align_v, code2dDefaults.align_v)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Error correction</span>
                  <InfoHint text='Error correction level for the QR code.' />
                </div>
                <Select
                  value={e.error_correction ?? 'M'}
                  onChange={(v) => props.onPatch({ error_correction: v as any })}
                  options={qrErrorCorrectionOptions}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Input mode</span>
                  <InfoHint text='Input mode for QR encoding.' />
                </div>
                <Select
                  value={qrInputMode}
                  onChange={(v) => {
                    if (v === 'A') {
                      props.onPatch({ input_mode: 'A', character_mode: undefined })
                      return
                    }
                    props.onPatch({ input_mode: 'M', character_mode: e.character_mode ?? 'N' })
                  }}
                  options={qrInputModeOptions}
                />
              </div>
              {qrInputMode === 'M' && (
                <div className='space-y-1'>
                  <div className='text-xs text-subtle flex items-center gap-1'>
                    <span>Character mode</span>
                    <InfoHint text='Character mode when input mode is M.' />
                  </div>
                  <Select
                    value={qrCharacterMode}
                    onChange={(v) => props.onPatch({ character_mode: v as any, input_mode: 'M' })}
                    options={qrCharacterModeOptions}
                  />
                </div>
              )}
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Quiet zone (mm)</span>
                  <InfoHint text='Clear margin around the QR code.' />
                </div>
                <NumInput
                  value={e.quiet_zone_mm ?? code2dDefaults.quiet_zone_mm ?? 1}
                  onChange={(v) => props.onPatch({ quiet_zone_mm: Math.max(0, v) })}
                  min={0}
                  step={0.1}
                  className={fieldClass(e.quiet_zone_mm, code2dDefaults.quiet_zone_mm)}
                />
              </div>
            </div>
            <div className='space-y-2'>
              <div className='text-xs text-muted flex items-center gap-1'>
                <span>Theme</span>
                <InfoHint text='Visual style presets and optional module overrides.' />
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div className='space-y-1'>
                  <div className='text-xs text-subtle flex items-center gap-1'>
                    <span>Preset</span>
                    <InfoHint text='Select a preset style for the QR modules.' />
                  </div>
                  <Select
                    value={qrThemePreset}
                    onChange={(v) => {
                      if (!v) {
                        props.onPatch({ theme: undefined })
                        return
                      }
                      props.onPatch({ theme: { ...(e.theme ?? {}), preset: v as any } })
                    }}
                    options={[{ value: '', label: 'default' }, ...qrThemePresetOptions]}
                  />
                </div>
                {qrThemePreset && (
                  <>
                    <div className='space-y-1'>
                      <div className='text-xs text-subtle flex items-center gap-1'>
                        <span>Module shape</span>
                        <InfoHint text='Override the shape of normal modules.' />
                      </div>
                      <Select
                        value={qrThemeModuleShape}
                        onChange={(v) =>
                          props.onPatch({
                            theme: { ...(e.theme ?? { preset: qrThemePreset as any }), module_shape: v ? (v as any) : undefined }
                          })
                        }
                        options={[{ value: '', label: 'default' }, ...qrThemeShapeOptions]}
                      />
                    </div>
                    <div className='space-y-1'>
                      <div className='text-xs text-subtle flex items-center gap-1'>
                        <span>Finder shape</span>
                        <InfoHint text='Override the shape of finder patterns.' />
                      </div>
                      <Select
                        value={qrThemeFinderShape}
                        onChange={(v) =>
                          props.onPatch({
                            theme: { ...(e.theme ?? { preset: qrThemePreset as any }), finder_shape: v ? (v as any) : undefined }
                          })
                        }
                        options={[{ value: '', label: 'default' }, ...qrThemeShapeOptions]}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {e.type === 'datamatrix' && (
          <div className='space-y-2'>
            <div className='text-xs text-muted flex items-center gap-1'>
              <span>DataMatrix data</span>
              <InfoHint text='Data encoded in the DataMatrix symbol.' />
            </div>
            <TextInput value={e.data} onChange={(v) => props.onPatch({ data: v })} className='w-full' />
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Module size (mm)</span>
                  <InfoHint text='Size of one DataMatrix module in mm.' />
                </div>
                <NumInput value={e.module_size_mm ?? 0.5} onChange={(v) => props.onPatch({ module_size_mm: Math.max(0.05, v) })} min={0.05} step={0.05} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Size mode</span>
                  <InfoHint text='fixed = use module size, max = grow to available space.' />
                </div>
                <Select
                  value={e.size_mode ?? 'fixed'}
                  onChange={(v) => props.onPatch({ size_mode: v as any })}
                  options={sizeModeOptions}
                  className={fieldClass(e.size_mode, code2dDefaults.size_mode)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Render mode</span>
                  <InfoHint text='zpl = native ZPL rendering, image = render as bitmap.' />
                </div>
                <Select
                  value={e.render_mode ?? code2dDefaults.render_mode ?? ''}
                  onChange={(v) => props.onPatch({ render_mode: v ? (v as any) : undefined })}
                  options={renderModeElementOptions}
                  className={fieldClass(e.render_mode, code2dDefaults.render_mode)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align H</span>
                  <InfoHint text='Horizontal alignment inside the element box.' />
                </div>
                <Select
                  value={e.align_h ?? code2dDefaults.align_h ?? 'center'}
                  onChange={(v) => props.onPatch({ align_h: v as any })}
                  options={alignHOptions}
                  className={fieldClass(e.align_h, code2dDefaults.align_h)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align V</span>
                  <InfoHint text='Vertical alignment inside the element box.' />
                </div>
                <Select
                  value={e.align_v ?? code2dDefaults.align_v ?? 'center'}
                  onChange={(v) => props.onPatch({ align_v: v as any })}
                  options={alignVOptions}
                  className={fieldClass(e.align_v, code2dDefaults.align_v)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Quality</span>
                  <InfoHint text='Symbol quality (only 200 supported in this schema).' />
                </div>
                <Select
                  value={String(e.quality ?? 200)}
                  onChange={(v) => props.onPatch({ quality: Number(v) as any })}
                  options={dataMatrixQualityOptions}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Columns</span>
                  <InfoHint text='Number of columns (0..49).' />
                </div>
                <NumInput
                  value={e.columns ?? 0}
                  onChange={(v) => props.onPatch({ columns: Math.max(0, Math.min(49, Math.floor(v))) })}
                  min={0}
                  step={1}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Rows</span>
                  <InfoHint text='Number of rows (0..49).' />
                </div>
                <NumInput
                  value={e.rows ?? 0}
                  onChange={(v) => props.onPatch({ rows: Math.max(0, Math.min(49, Math.floor(v))) })}
                  min={0}
                  step={1}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Format ID</span>
                  <InfoHint text='Symbol format id (0..6).' />
                </div>
                <NumInput
                  value={e.format_id ?? 0}
                  onChange={(v) => props.onPatch({ format_id: Math.max(0, Math.min(6, Math.floor(v))) })}
                  min={0}
                  step={1}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Escape char</span>
                  <InfoHint text='Single character used for escapes.' />
                </div>
                <TextInput
                  value={e.escape_char ?? ''}
                  onChange={(v) => props.onPatch({ escape_char: v ? v.slice(0, 1) : undefined })}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Quiet zone (mm)</span>
                  <InfoHint text='Clear margin around the DataMatrix symbol.' />
                </div>
                <NumInput
                  value={e.quiet_zone_mm ?? code2dDefaults.quiet_zone_mm ?? 1}
                  onChange={(v) => props.onPatch({ quiet_zone_mm: Math.max(0, v) })}
                  min={0}
                  step={0.1}
                  className={fieldClass(e.quiet_zone_mm, code2dDefaults.quiet_zone_mm)}
                />
              </div>
            </div>
          </div>
        )}

        {e.type === 'image' && (
          <div className='space-y-2'>
            <div className='text-xs text-muted flex items-center gap-1'>
              <span>Image source</span>
              <InfoHint text='Provide a base64 image payload or a URL to fetch.' />
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Source kind</span>
                  <InfoHint text='base64 embeds image data, url fetches from the backend.' />
                </div>
                <Select
                  value={e.source.kind}
                  onChange={(v) =>
                    props.onPatch({
                      source: { ...(e.source ?? { kind: 'base64', data: '' }), kind: v as any }
                    })
                  }
                  options={[
                    { value: 'base64', label: 'base64' },
                    { value: 'url', label: 'url' }
                  ]}
                />
              </div>
              {e.source.kind === 'base64' ? (
                <div className='space-y-1'>
                  <div className='text-xs text-subtle flex items-center gap-1'>
                    <span>Upload</span>
                    <InfoHint text='Select an image to embed as base64. SVGs are rasterized using Input DPI.' />
                  </div>
                  <input
                    type='file'
                    accept='image/*'
                    className='w-full text-sm'
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      try {
                        const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
                        const targetDpi = Math.max(1, Math.floor(e.input_dpi ?? imageDefaults.input_dpi ?? 203))
                        if (isSvg) {
                          const svgText = await readFileAsText(file)
                          const base64 = await rasterizeSvgToPngBase64(svgText, targetDpi)
                          props.onPatch({ source: { kind: 'base64', data: base64 } })
                          return
                        }
                        const dataUrl = await readFileAsDataUrl(file)
                        const base64 = stripDataUrlPrefix(dataUrl)
                        props.onPatch({ source: { kind: 'base64', data: base64 } })
                      } catch (error) {
                        console.warn('[image] failed to read file', error)
                      }
                    }}
                  />
                </div>
              ) : (
                <div className='space-y-1'>
                  <div className='text-xs text-subtle flex items-center gap-1'>
                    <span>Image URL</span>
                    <InfoHint text='URL fetching is disabled by default; enable ZPLGRID_ENABLE_IMAGE_URL=1 on the backend.' />
                  </div>
                  <TextInput
                    value={e.source.data}
                    onChange={(v) => props.onPatch({ source: { kind: 'url', data: v } })}
                    placeholder='https://example.com/image.png'
                  />
                </div>
              )}
            </div>
            {e.source.kind === 'base64' && (
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Base64 data</span>
                  <InfoHint text='Paste or edit the base64 payload (no data: prefix).' />
                </div>
                <textarea
                  className='w-full min-h-[110px] border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)]'
                  value={e.source.data}
                  onChange={(ev) => props.onPatch({ source: { kind: 'base64', data: ev.target.value } })}
                  placeholder='iVBORw0KGgoAAAANSUhEUg...'
                />
              </div>
            )}
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Fit</span>
                  <InfoHint text='How the image scales to its box.' />
                </div>
                <Select
                  value={e.fit ?? imageDefaults.fit ?? 'contain'}
                  onChange={(v) => props.onPatch({ fit: v as any })}
                  options={imageFitOptions}
                  className={fieldClass(e.fit, imageDefaults.fit)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align H</span>
                  <InfoHint text='Horizontal alignment inside the image box.' />
                </div>
                <Select
                  value={e.align_h ?? imageDefaults.align_h ?? 'center'}
                  onChange={(v) => props.onPatch({ align_h: v as any })}
                  options={alignHOptions}
                  className={fieldClass(e.align_h, imageDefaults.align_h)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align V</span>
                  <InfoHint text='Vertical alignment inside the image box.' />
                </div>
                <Select
                  value={e.align_v ?? imageDefaults.align_v ?? 'center'}
                  onChange={(v) => props.onPatch({ align_v: v as any })}
                  options={alignVOptions}
                  className={fieldClass(e.align_v, imageDefaults.align_v)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Input DPI</span>
                  <InfoHint text='DPI used to interpret image pixels.' />
                </div>
                <NumInput
                  value={e.input_dpi ?? imageDefaults.input_dpi ?? 203}
                  onChange={(v) => props.onPatch({ input_dpi: Math.max(1, Math.floor(v)) })}
                  min={1}
                  step={1}
                  className={fieldClass(e.input_dpi, imageDefaults.input_dpi)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Threshold</span>
                  <InfoHint text='0-255 threshold for black/white conversion.' />
                </div>
                <NumInput
                  value={e.threshold ?? imageDefaults.threshold ?? 128}
                  onChange={(v) => props.onPatch({ threshold: Math.max(0, Math.min(255, Math.floor(v))) })}
                  min={0}
                  step={1}
                  className={fieldClass(e.threshold, imageDefaults.threshold)}
                />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Dither</span>
                  <InfoHint text='Dithering mode for black/white conversion.' />
                </div>
                <Select
                  value={e.dither ?? imageDefaults.dither ?? 'none'}
                  onChange={(v) => props.onPatch({ dither: v as any })}
                  options={imageDitherOptions}
                  className={fieldClass(e.dither, imageDefaults.dither)}
                />
              </div>
              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={e.invert ?? imageDefaults.invert ?? false}
                  onChange={(e) => props.onPatch({ invert: e.target.checked })}
                  className={fieldClass(e.invert, imageDefaults.invert)}
                />
                <span className='flex items-center gap-1'>
                  Invert
                  <InfoHint text='Swap black/white after rasterization.' />
                </span>
              </label>
            </div>
          </div>
        )}

        {e.type === 'line' && (
          <div className='space-y-2'>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Orientation</span>
                  <InfoHint text='Line direction: horizontal or vertical.' />
                </div>
                <Select value={e.orientation} onChange={(v) => props.onPatch({ orientation: v as any })} options={[{ value: 'h', label: 'h' }, { value: 'v', label: 'v' }]} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Thickness (mm)</span>
                  <InfoHint text='Thickness of the line in mm.' />
                </div>
                <NumInput value={e.thickness_mm} onChange={(v) => props.onPatch({ thickness_mm: Math.max(0.1, v) })} min={0.1} step={0.1} />
              </div>
              <div className='space-y-1'>
                <div className='text-xs text-subtle flex items-center gap-1'>
                  <span>Align</span>
                  <InfoHint text='Position of the line within the box.' />
                </div>
                <Select
                  value={e.align ?? 'center'}
                  onChange={(v) => props.onPatch({ align: v as any })}
                  options={[
                    { value: 'start', label: 'start' },
                    { value: 'center', label: 'center' },
                    { value: 'end', label: 'end' }
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
