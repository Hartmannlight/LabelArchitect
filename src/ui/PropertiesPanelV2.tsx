import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getNodeById } from '../model/ids'
import type { DataMatrixElement, Element, ImageBackground, ImageElement, LeafNode, QrElement, SplitNode, TemplateDefaults, TextElement } from '../model/types'
import { useTemplateEditorStore } from '../state/store'
import { PROJECT_ELEMENT_DEFAULTS } from '../config/projectDefaults'
import VariablesPanel from './VariablesPanelV2'

type Option = { value: string; label: string }
const elementTypes: Array<{ value: Element['type']; label: string; shortcut: string }> = [
  { value: 'text', label: 'Text', shortcut: 'T' }, { value: 'qr', label: 'QR code', shortcut: 'Q' },
  { value: 'datamatrix', label: 'DataMatrix', shortcut: 'D' }, { value: 'image', label: 'Image', shortcut: 'I' },
  { value: 'line', label: 'Line', shortcut: 'L' }
]
const fitOptions: Option[] = [{ value: 'shrink_to_fit', label: 'Shrink to fit' }, { value: 'wrap', label: 'Wrap all lines' }, { value: 'truncate', label: 'Cut after max lines' }, { value: 'overflow', label: 'No wrapping / allow overflow' }]
const wrapOptions: Option[] = [{ value: 'word', label: 'By word' }, { value: 'char', label: 'By character' }, { value: 'none', label: 'No wrapping' }]
const sizeModeOptions: Option[] = [{ value: 'max', label: 'Use available space' }, { value: 'fixed', label: 'Fixed module size' }]
const renderModeOptions: Option[] = [{ value: 'image', label: 'Image (recommended)' }, { value: 'zpl', label: 'Native ZPL II' }]

function NumInput(props: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState(String(props.value))
  useEffect(() => setDraft(Number.isFinite(props.value) ? String(props.value) : ''), [props.value])
  return <input type='number' value={draft} min={props.min} max={props.max} step={props.step ?? 0.1} onChange={(event) => {
    setDraft(event.target.value); const parsed = Number(event.target.value)
    if (event.target.value !== '' && Number.isFinite(parsed)) props.onChange(parsed)
  }} onBlur={() => {
    const parsed = Number(draft); if (!Number.isFinite(parsed)) return setDraft(String(props.value))
    const bounded = Math.min(props.max ?? Number.POSITIVE_INFINITY, Math.max(props.min ?? Number.NEGATIVE_INFINITY, parsed))
    if (bounded !== parsed) props.onChange(bounded)
  }} />
}
function Select(props: { value: string; onChange: (value: string) => void; options: Option[] }) {
  return <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>{props.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
}
function Field(props: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={`property-field${props.wide ? ' property-field-wide' : ''}`}><span>{props.label}</span>{props.children}{props.hint && <small>{props.hint}</small>}</label>
}
function Card(props: { title: string; description?: string; children: ReactNode; tone?: 'primary' | 'normal' }) {
  return <section className={`property-card${props.tone === 'primary' ? ' property-card-primary' : ''}`}><header><h3>{props.title}</h3>{props.description && <p>{props.description}</p>}</header>{props.children}</section>
}
function Advanced(props: { title: string; description?: string; children: ReactNode }) {
  return <details className='property-advanced'><summary><span>{props.title}</span><small>{props.description ?? 'Less frequently used settings'}</small></summary><div className='property-advanced-body'>{props.children}</div></details>
}
function AlignmentControl(props: { horizontal: 'left' | 'center' | 'right'; vertical: 'top' | 'center' | 'bottom'; onHorizontal: (value: 'left' | 'center' | 'right') => void; onVertical: (value: 'top' | 'center' | 'bottom') => void }) {
  return <div className='alignment-control'><div><span>Horizontal</span><div className='segmented-control'>{(['left', 'center', 'right'] as const).map((value) => <button type='button' key={value} className={props.horizontal === value ? 'active' : ''} onClick={() => props.onHorizontal(value)}>{value === 'left' ? 'Left' : value === 'center' ? 'Center' : 'Right'}</button>)}</div></div><div><span>Vertical</span><div className='segmented-control'>{(['top', 'center', 'bottom'] as const).map((value) => <button type='button' key={value} className={props.vertical === value ? 'active' : ''} onClick={() => props.onVertical(value)}>{value === 'top' ? 'Top' : value === 'center' ? 'Center' : 'Bottom'}</button>)}</div></div></div>
}
function ElementTypePicker(props: { value: Element['type']; onChange: (value: Element['type']) => void }) {
  return <div className='element-type-picker'>{elementTypes.map((type) => <button type='button' key={type.value} className={props.value === type.value ? 'active' : ''} onClick={() => props.onChange(type.value)}><span>{type.label}</span><kbd>{type.shortcut}</kbd></button>)}</div>
}
function NameField(props: { value: string; nodeKind: 'split' | 'leaf'; onChange: (value: string) => void; onClear: () => void }) {
  return <Field label={props.nodeKind === 'leaf' ? 'Element name' : 'Split name'} hint='A friendly name used only to identify this item in the designer.' wide><div className='property-inline'><input value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.nodeKind === 'leaf' ? 'e.g. Product title' : 'e.g. Header and details'} /><button type='button' onClick={props.onClear} disabled={!props.value}>Clear</button></div></Field>
}

export default function PropertiesPanelV2() {
  const doc = useTemplateEditorStore((state) => state.history.present)
  const selection = useTemplateEditorStore((state) => state.selection)
  const node = useMemo(() => selection ? getNodeById(doc.layout, selection.nodeId) : null, [doc.layout, selection])
  const setAlias = useTemplateEditorStore((state) => state.setAlias)
  const clearAlias = useTemplateEditorStore((state) => state.clearAlias)
  return <div className='properties-panel'><header className='properties-header'><div><span>Inspector</span><h2>{node?.kind === 'split' ? 'Layout split' : node?.kind === 'leaf' ? elementTypes.find((entry) => entry.value === node.elements[0].type)?.label : 'Properties'}</h2></div>{selection && <code>{selection.nodeId}</code>}</header><div className='properties-scroll'>
    {!selection || !node ? <div className='properties-empty'><strong>Select something on the label</strong><span>Its most important settings will appear here.</span></div> : <>
      <Card title={node.kind === 'split' ? 'Identify this split' : 'Identify this element'}><NameField value={node.alias ?? ''} nodeKind={node.kind} onChange={(value) => setAlias(selection.nodeId, value)} onClear={() => clearAlias(selection.nodeId)} /></Card>
      <NodeBackgroundProperties nodeId={selection.nodeId} background={node.background} defaults={doc.defaults?.image ?? {}} />
      {node.kind === 'split' ? <SplitProperties nodeId={selection.nodeId} node={node} /> : <ElementProperties nodeId={selection.nodeId} node={node} defaults={doc.defaults ?? {}} />}
    </>}
    <VariablesPanel />
  </div></div>
}

function NodeBackgroundProperties(props: { nodeId: string; background?: ImageBackground; defaults: NonNullable<TemplateDefaults['image']> }) {
  const setBackground = useTemplateEditorStore((state) => state.setNodeBackground)
  const patchBackground = useTemplateEditorStore((state) => state.patchNodeBackground)
  if (!props.background) {
    return <Card title='Background image' description='Place an image behind this entire area and keep its foreground element editable.'><button type='button' onClick={() => setBackground(props.nodeId, { source: { kind: 'base64', data: '' }, fit: 'contain', align_h: 'center', align_v: 'center' })}>Add background image</button></Card>
  }
  const imageElement: ImageElement = { type: 'image', ...props.background, extensions: { ...props.background.extensions, __designer_background: true } }
  return <><Card title='Background image' description='This image is rendered before child backgrounds and foreground content.'><button type='button' className='property-danger' onClick={() => setBackground(props.nodeId, undefined)}>Remove background image</button></Card><ImageProperties element={imageElement} defaults={props.defaults} patch={(patch) => patchBackground(props.nodeId, patch as Partial<ImageBackground>)} /></>
}

function SplitProperties(props: { nodeId: string; node: SplitNode }) {
  const setDirection = useTemplateEditorStore((state) => state.setSplitDirection)
  const setRatio = useTemplateEditorStore((state) => state.setSplitRatio)
  const setGutter = useTemplateEditorStore((state) => state.setSplitGutter)
  const setDividerVisible = useTemplateEditorStore((state) => state.setSplitDividerVisible)
  const setDividerThickness = useTemplateEditorStore((state) => state.setSplitDividerThickness)
  const unsplit = useTemplateEditorStore((state) => state.unsplitAt)
  const percent = Math.round(props.node.ratio * 100), dividerVisible = props.node.divider?.visible ?? false, dividerThickness = props.node.divider?.thickness_mm ?? 0.3
  return <><Card title='Layout' description='Choose how the two areas share the available label space.' tone='primary'>
    <Field label='Split direction' wide><div className='segmented-control two'><button type='button' className={props.node.direction === 'v' ? 'active' : ''} onClick={() => setDirection(props.nodeId, 'v')}>Left / right <kbd>V</kbd></button><button type='button' className={props.node.direction === 'h' ? 'active' : ''} onClick={() => setDirection(props.nodeId, 'h')}>Top / bottom <kbd>H</kbd></button></div></Field>
    <Field label={`First area: ${percent}%`} hint={`The second area receives ${100 - percent}%.`} wide><input className='ratio-slider' type='range' min='5' max='95' step='1' value={percent} onChange={(event) => setRatio(props.nodeId, Number(event.target.value) / 100)} /><div className='ratio-presets'>{[25, 33, 50, 67, 75].map((value) => <button type='button' key={value} className={percent === value ? 'active' : ''} onClick={() => setRatio(props.nodeId, value / 100)}>{value}/{100 - value}</button>)}</div></Field>
  </Card><Advanced title='Gap and divider' description='Spacing and an optional line between both areas'><div className='property-grid'><Field label='Gap (mm)'><NumInput value={props.node.gutter_mm ?? 0} min={dividerVisible ? dividerThickness : 0} onChange={(value) => setGutter(props.nodeId, value)} /></Field><Field label='Divider thickness (mm)'><NumInput value={dividerThickness} min={0.1} onChange={(value) => setDividerThickness(props.nodeId, value)} /></Field></div><label className='property-check'><input type='checkbox' checked={dividerVisible} onChange={(event) => setDividerVisible(props.nodeId, event.target.checked)} /><span><strong>Show divider</strong><small>Draw a line in the gap between both areas.</small></span></label></Advanced><button className='property-danger' type='button' onClick={() => unsplit(props.nodeId)}>Remove split and keep its first element</button></>
}

function ElementProperties(props: { nodeId: string; node: LeafNode; defaults: TemplateDefaults }) {
  const placeElement = useTemplateEditorStore((state) => state.placeElementOnLeaf), patchElement = useTemplateEditorStore((state) => state.patchElement), splitLeaf = useTemplateEditorStore((state) => state.splitLeafAt), setLeafPadding = useTemplateEditorStore((state) => state.setLeafPadding), setLeafDebug = useTemplateEditorStore((state) => state.setLeafDebugBorder)
  const element = props.node.elements[0], patch = (value: Partial<Element>) => patchElement(props.nodeId, value)
  return <><Card title='Element type' description='Changing the type replaces the content of this area.'><ElementTypePicker value={element.type} onChange={(value) => placeElement(props.nodeId, value)} /></Card>
    {element.type === 'text' && <TextProperties element={element} defaults={props.defaults.text ?? {}} patch={patch} />}{element.type === 'qr' && <QrProperties element={element} defaults={props.defaults.code2d ?? {}} patch={patch} />}{element.type === 'datamatrix' && <DataMatrixProperties element={element} defaults={props.defaults.code2d ?? {}} patch={patch} />}{element.type === 'image' && <ImageProperties element={element} defaults={props.defaults.image ?? {}} patch={patch} />}{element.type === 'line' && <LineProperties element={element} patch={patch} />}
    <Advanced title='Spacing and area' description='Padding around this element and designer diagnostics'><p className='property-explainer'>Padding adds empty space between the selected element and the edge of its area. It does not add another visible object.</p><PaddingFields value={props.node.padding_mm ?? props.defaults.leaf_padding_mm ?? [0.5, 0.5, 0.5, 0.5]} onChange={(value) => setLeafPadding(props.nodeId, value)} /><label className='property-check'><input type='checkbox' checked={props.node.debug_border ?? false} onChange={(event) => setLeafDebug(props.nodeId, event.target.checked)} /><span><strong>Show area outline</strong><small>Designer aid only; useful while arranging elements.</small></span></label></Advanced>
    <Advanced title='Split this area' description='Create another element beside or below this one'><div className='property-split-actions'><button type='button' onClick={() => splitLeaf(props.nodeId, 'v')}>Left / right <kbd>V</kbd></button><button type='button' onClick={() => splitLeaf(props.nodeId, 'h')}>Top / bottom <kbd>H</kbd></button></div></Advanced>
  </>
}
function ContentCard(props: { title: string; description: string; value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) {
  return <Card title={props.title} description={props.description} tone='primary'><textarea className='property-content-input' rows={props.rows ?? 4} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} /></Card>
}
function TextProperties(props: { element: TextElement; defaults: NonNullable<TemplateDefaults['text']>; patch: (patch: Partial<Element>) => void }) {
  const horizontal = props.element.align_h ?? props.defaults.align_h ?? 'center', vertical = props.element.align_v ?? props.defaults.align_v ?? 'center', fit = props.element.fit ?? props.defaults.fit ?? 'shrink_to_fit'
  return <>
    <ContentCard title='Text content' description='This is the text that will be printed. Dynamic values can be inserted below.' value={props.element.text} onChange={(value) => props.patch({ text: value })} placeholder='Enter the text for this label…' />
    <Card title='Text layout' description='The settings most often needed when placing text.'>
      <AlignmentControl horizontal={horizontal} vertical={vertical} onHorizontal={(value) => props.patch({ align_h: value })} onVertical={(value) => props.patch({ align_v: value })} />
      <div className='property-grid'>
        <Field label='Font height (mm)'><NumInput value={props.element.font_height_mm ?? props.defaults.font_height_mm ?? 4} min={0.5} onChange={(value) => props.patch({ font_height_mm: value })} /></Field>
        <Field label={fit === 'wrap' ? 'Warn above lines' : 'Maximum lines'} hint={fit === 'wrap' ? 'Wrap keeps every line and warns when this target is exceeded.' : fit === 'overflow' ? 'Not used while overflow is selected.' : 'Truncate cuts here; shrink-to-fit reduces the font until the text fits.'}><NumInput value={props.element.max_lines ?? props.defaults.max_lines ?? 2} min={1} step={1} onChange={(value) => props.patch({ max_lines: Math.floor(value) })} /></Field>
        <Field label='When text is too large'><Select value={fit} options={fitOptions} onChange={(value) => props.patch(value === 'overflow' ? { fit: 'overflow', wrap: 'none' } : { fit: value as TextElement['fit'], wrap: props.element.wrap === 'none' ? 'word' : props.element.wrap })} /></Field>
        <Field label='Wrap at'><Select value={props.element.wrap ?? props.defaults.wrap ?? 'word'} options={wrapOptions} onChange={(value) => props.patch(value === 'none' ? { wrap: 'none', fit: 'overflow' } : { wrap: value as TextElement['wrap'], fit: fit === 'overflow' ? 'wrap' : fit })} /></Field>
      </div>
    </Card>
    <Advanced title='Fine typography and bounds' description='Character width, inner padding and size constraints'>
      <Field label='Font width (mm)' hint='0 uses the natural character width.'><NumInput value={props.element.font_width_mm ?? props.defaults.font_width_mm ?? 0} min={0} onChange={(value) => props.patch({ font_width_mm: value || undefined })} /></Field>
      <ElementBounds element={props.element} patch={props.patch} />
    </Advanced>
  </>
}
function QrProperties(props: { element: QrElement; defaults: NonNullable<TemplateDefaults['code2d']>; patch: (patch: Partial<Element>) => void }) {
  const horizontal = props.element.align_h ?? props.defaults.align_h ?? 'center', vertical = props.element.align_v ?? props.defaults.align_v ?? 'center'
  const renderMode = props.element.render_mode ?? PROJECT_ELEMENT_DEFAULTS.qr?.render_mode ?? 'image'
  const shapeOptions = [{ value: 'square', label: 'Square' }, { value: 'circle', label: 'Circle' }, { value: 'rounded', label: 'Rounded' }]
  return <>
    <ContentCard title='QR code content' description='Enter the value a scanner should return, such as a URL, ID or dynamic field.' value={props.element.data} onChange={(value) => props.patch({ data: value })} placeholder='https://example.com or {product_id}' rows={3} />
    <Card title='Position and rendering' description='QR codes use image rendering by default, with native ZPL II available when needed.'>
      <AlignmentControl horizontal={horizontal} vertical={vertical} onHorizontal={(value) => props.patch({ align_h: value })} onVertical={(value) => props.patch({ align_v: value })} />
      <div className='property-grid'>
        <Field label='Render method'><Select value={renderMode} options={renderModeOptions} onChange={(value) => props.patch({ render_mode: value as QrElement['render_mode'] })} /></Field>
        <Field label='Sizing'><Select value={props.element.size_mode ?? props.defaults.size_mode ?? 'max'} options={sizeModeOptions} onChange={(value) => props.patch({ size_mode: value as QrElement['size_mode'] })} /></Field>
        <Field label='Error correction'><Select value={props.element.error_correction ?? 'M'} options={['L', 'M', 'Q', 'H'].map((value) => ({ value, label: value }))} onChange={(value) => props.patch({ error_correction: value as QrElement['error_correction'] })} /></Field>
        <Field label='Visual style'><Select value={props.element.theme?.preset ?? 'classic'} options={[{ value: 'classic', label: 'Classic' }, { value: 'dots', label: 'Dots' }, { value: 'rounded', label: 'Rounded' }]} onChange={(value) => props.patch({ theme: { ...props.element.theme, preset: value as NonNullable<QrElement['theme']>['preset'] } })} /></Field>
      </div>
    </Card>
    <Advanced title='QR code details' description='Module size, clear margin, input mode and exact shapes'>
      <div className='property-grid'>
        <Field label='Magnification'><NumInput value={props.element.magnification ?? 3} min={1} max={10} step={1} onChange={(value) => props.patch({ magnification: Math.floor(value) })} /></Field>
        <Field label='Quiet zone (mm)'><NumInput value={props.element.quiet_zone_mm ?? props.defaults.quiet_zone_mm ?? 1} min={0} onChange={(value) => props.patch({ quiet_zone_mm: value })} /></Field>
        <Field label='Input mode'><Select value={props.element.input_mode ?? 'A'} options={[{ value: 'A', label: 'Automatic' }, { value: 'M', label: 'Manual' }]} onChange={(value) => props.patch({ input_mode: value as QrElement['input_mode'] })} /></Field>
        {props.element.input_mode === 'M' && <Field label='Character mode'><Select value={props.element.character_mode ?? 'A'} options={[{ value: 'A', label: 'Alphanumeric' }, { value: 'N', label: 'Numeric' }]} onChange={(value) => props.patch({ character_mode: value as QrElement['character_mode'] })} /></Field>}
        {renderMode === 'image' && <Field label='Module shape'><Select value={props.element.theme?.module_shape ?? 'square'} options={shapeOptions} onChange={(value) => props.patch({ theme: { ...props.element.theme, module_shape: value as NonNullable<QrElement['theme']>['module_shape'] } })} /></Field>}
        {renderMode === 'image' && <Field label='Finder shape'><Select value={props.element.theme?.finder_shape ?? 'square'} options={shapeOptions} onChange={(value) => props.patch({ theme: { ...props.element.theme, finder_shape: value as NonNullable<QrElement['theme']>['finder_shape'] } })} /></Field>}
      </div>
      <ElementBounds element={props.element} patch={props.patch} />
    </Advanced>
  </>
}
function DataMatrixProperties(props: { element: DataMatrixElement; defaults: NonNullable<TemplateDefaults['code2d']>; patch: (patch: Partial<Element>) => void }) {
  const horizontal = props.element.align_h ?? props.defaults.align_h ?? 'center', vertical = props.element.align_v ?? props.defaults.align_v ?? 'center'
  const renderMode = props.element.render_mode ?? PROJECT_ELEMENT_DEFAULTS.datamatrix?.render_mode ?? 'image'
  const sizeMode = props.element.size_mode ?? props.defaults.size_mode ?? 'max'
  const nativeMax = renderMode === 'zpl' && sizeMode === 'max'
  const setRenderMode = (value: DataMatrixElement['render_mode']) => {
    if (value === 'zpl' && sizeMode === 'max') {
      props.patch({ render_mode: value, columns: props.element.columns && props.element.columns > 0 ? props.element.columns : 10, rows: props.element.rows && props.element.rows > 0 ? props.element.rows : 10 })
      return
    }
    props.patch({ render_mode: value })
  }
  const setSizeMode = (value: DataMatrixElement['size_mode']) => {
    if (value === 'max' && renderMode === 'zpl') {
      props.patch({ size_mode: value, columns: props.element.columns && props.element.columns > 0 ? props.element.columns : 10, rows: props.element.rows && props.element.rows > 0 ? props.element.rows : 10 })
      return
    }
    props.patch({ size_mode: value })
  }
  return <>
    <ContentCard title='DataMatrix content' description='Enter the value encoded in the symbol. Dynamic fields use braces, for example {serial_number}.' value={props.element.data} onChange={(value) => props.patch({ data: value })} placeholder='Enter the encoded value…' rows={3} />
    <Card title='Position and rendering' description='DataMatrix uses image rendering by default. Native ZPL II remains available for compatible printers.'>
      <AlignmentControl horizontal={horizontal} vertical={vertical} onHorizontal={(value) => props.patch({ align_h: value })} onVertical={(value) => props.patch({ align_v: value })} />
      <div className='property-grid'>
        <Field label='Render method'><Select value={renderMode} options={renderModeOptions} onChange={(value) => setRenderMode(value as DataMatrixElement['render_mode'])} /></Field>
        <Field label='Size mode'><Select value={sizeMode} options={[{ value: 'max', label: 'Fill available space' }, { value: 'fixed', label: 'Fixed module size' }]} onChange={(value) => setSizeMode(value as DataMatrixElement['size_mode'])} /></Field>
        {sizeMode === 'fixed' && <Field label='Module size (mm)'><NumInput value={props.element.module_size_mm ?? 0.5} min={0.05} step={0.05} onChange={(value) => props.patch({ module_size_mm: value })} /></Field>}
        {nativeMax && <Field label='Columns (required)' hint='Required by native ZPL II when filling the available space.'><NumInput value={props.element.columns ?? 10} min={1} max={49} step={1} onChange={(value) => props.patch({ columns: Math.floor(value) })} /></Field>}
        {nativeMax && <Field label='Rows (required)' hint='Required by native ZPL II when filling the available space.'><NumInput value={props.element.rows ?? 10} min={1} max={49} step={1} onChange={(value) => props.patch({ rows: Math.floor(value) })} /></Field>}
      </div>
    </Card>
    <Advanced title='DataMatrix details' description='Clear margin and low-level encoder settings'>
      <div className='property-grid'>
        <Field label='Quiet zone (mm)'><NumInput value={props.element.quiet_zone_mm ?? props.defaults.quiet_zone_mm ?? 1} min={0} onChange={(value) => props.patch({ quiet_zone_mm: value })} /></Field>
        <Field label='Format ID'><NumInput value={props.element.format_id ?? 0} min={0} max={6} step={1} onChange={(value) => props.patch({ format_id: Math.floor(value) })} /></Field>
        <Field label='Escape character'><input value={props.element.escape_char ?? ''} maxLength={1} onChange={(event) => props.patch({ escape_char: event.target.value || undefined })} /></Field>
      </div>
      <ElementBounds element={props.element} patch={props.patch} />
    </Advanced>
  </>
}
function stripDataUrl(value: string) { const marker = 'base64,', index = value.indexOf(marker); return index >= 0 ? value.slice(index + marker.length) : value }
function fileAsDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }) }
function ImageProperties(props: { element: ImageElement; defaults: NonNullable<TemplateDefaults['image']>; patch: (patch: Partial<Element>) => void }) {
  const horizontal = props.element.align_h ?? props.defaults.align_h ?? 'center', vertical = props.element.align_v ?? props.defaults.align_v ?? 'center', kind = props.element.source.kind
  return <><Card title='Image source' description='Upload an image or reference one by URL.' tone='primary'><div className='segmented-control two'><button type='button' className={kind === 'base64' ? 'active' : ''} onClick={() => props.patch({ source: { kind: 'base64', data: '' } })}>Upload</button><button type='button' className={kind === 'url' ? 'active' : ''} onClick={() => props.patch({ source: { kind: 'url', data: '' } })}>URL</button></div>{kind === 'base64' ? <label className='image-drop'><input type='file' accept='image/*' onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; props.patch({ source: { kind: 'base64', data: stripDataUrl(await fileAsDataUrl(file)) } }) }} /><strong>{props.element.source.data ? 'Replace image' : 'Choose an image'}</strong><span>{props.element.source.data ? 'Image data is embedded in this template.' : 'PNG, JPEG, GIF or SVG'}</span></label> : <Field label='Image URL' hint='The backend must allow remote image URLs.' wide><input value={props.element.source.data} onChange={(event) => props.patch({ source: { kind: 'url', data: event.target.value } })} placeholder='https://example.com/image.png' /></Field>}</Card><Card title='Position and fit'><AlignmentControl horizontal={horizontal} vertical={vertical} onHorizontal={(value) => props.patch({ align_h: value })} onVertical={(value) => props.patch({ align_v: value })} /><Field label='Fit inside area' wide><Select value={props.element.fit ?? props.defaults.fit ?? 'contain'} options={[{ value: 'contain', label: 'Contain – show complete image' }, { value: 'cover', label: 'Cover – fill and crop' }, { value: 'stretch', label: 'Stretch to fill' }, { value: 'none', label: 'Original size' }]} onChange={(value) => props.patch({ fit: value as ImageElement['fit'] })} /></Field></Card><Advanced title='Image processing' description='Raster quality and black/white conversion'><div className='property-grid'><Field label='Input DPI'><NumInput value={props.element.input_dpi ?? props.defaults.input_dpi ?? 203} min={1} step={1} onChange={(value) => props.patch({ input_dpi: Math.floor(value) })} /></Field><Field label='Threshold (0–255)'><NumInput value={props.element.threshold ?? props.defaults.threshold ?? 128} min={0} max={255} step={1} onChange={(value) => props.patch({ threshold: Math.floor(value) })} /></Field><Field label='Dithering'><Select value={props.element.dither ?? props.defaults.dither ?? 'none'} options={[{ value: 'none', label: 'None' }, { value: 'floyd_steinberg', label: 'Floyd–Steinberg' }, { value: 'bayer', label: 'Bayer' }]} onChange={(value) => props.patch({ dither: value as ImageElement['dither'] })} /></Field></div><label className='property-check'><input type='checkbox' checked={props.element.invert ?? props.defaults.invert ?? false} onChange={(event) => props.patch({ invert: event.target.checked })} /><span><strong>Invert black and white</strong></span></label>{kind === 'base64' && <Field label='Embedded Base64 data' wide><textarea rows={4} value={props.element.source.data} onChange={(event) => props.patch({ source: { kind: 'base64', data: event.target.value } })} /></Field>}<ElementBounds element={props.element} patch={props.patch} /></Advanced></>
}
function LineProperties(props: { element: Extract<Element, { type: 'line' }>; patch: (patch: Partial<Element>) => void }) {
  return <Card title='Line' description='Set the direction, thickness and position of the separator.' tone='primary'><Field label='Direction' wide><div className='segmented-control two'><button type='button' className={props.element.orientation === 'h' ? 'active' : ''} onClick={() => props.patch({ orientation: 'h' })}>Horizontal</button><button type='button' className={props.element.orientation === 'v' ? 'active' : ''} onClick={() => props.patch({ orientation: 'v' })}>Vertical</button></div></Field><div className='property-grid'><Field label='Thickness (mm)'><NumInput value={props.element.thickness_mm} min={0.1} onChange={(value) => props.patch({ thickness_mm: value })} /></Field><Field label='Position'><Select value={props.element.align ?? 'center'} options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }, { value: 'end', label: 'End' }]} onChange={(value) => props.patch({ align: value as 'start' | 'center' | 'end' })} /></Field></div></Card>
}
function PaddingFields(props: { value: [number, number, number, number]; onChange: (value: [number, number, number, number]) => void }) {
  const labels = ['Top', 'Right', 'Bottom', 'Left']
  return <div className='property-grid four'>{props.value.map((value, index) => <Field key={labels[index]} label={`${labels[index]} (mm)`}><NumInput value={value} min={0} onChange={(next) => { const copy = [...props.value] as [number, number, number, number]; copy[index] = next; props.onChange(copy) }} /></Field>)}</div>
}
function ElementBounds(props: { element: Element; patch: (patch: Partial<Element>) => void }) {
  if (props.element.extensions?.__designer_background) return null
  const padding = props.element.padding_mm ?? [0, 0, 0, 0]
  return <details className='property-nested'><summary>Element bounds</summary><div className='property-nested-body'><PaddingFields value={padding} onChange={(value) => props.patch({ padding_mm: value })} /><div className='property-grid'><Field label='Minimum width (mm)'><NumInput value={props.element.min_size_mm?.[0] ?? 0} min={0} onChange={(value) => props.patch({ min_size_mm: [value, props.element.min_size_mm?.[1] ?? 0] })} /></Field><Field label='Minimum height (mm)'><NumInput value={props.element.min_size_mm?.[1] ?? 0} min={0} onChange={(value) => props.patch({ min_size_mm: [props.element.min_size_mm?.[0] ?? 0, value] })} /></Field><Field label='Maximum width (mm)'><NumInput value={props.element.max_size_mm?.[0] ?? 0} min={0} onChange={(value) => props.patch({ max_size_mm: [value, props.element.max_size_mm?.[1] ?? 0] })} /></Field><Field label='Maximum height (mm)'><NumInput value={props.element.max_size_mm?.[1] ?? 0} min={0} onChange={(value) => props.patch({ max_size_mm: [props.element.max_size_mm?.[0] ?? 0, value] })} /></Field></div></div></details>
}
