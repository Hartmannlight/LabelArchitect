import { useMemo } from 'react'
import { useTemplateEditorStore, type Tool } from '../state/store'
import InfoHint from './InfoHint'

type Props = {
  onOpenExport: () => void
  onOpenImport: () => void
}

function ToolButton(props: { tool: Tool; label: string }) {
  const tool = useTemplateEditorStore((s) => s.tool)
  const setTool = useTemplateEditorStore((s) => s.setTool)
  const active = tool === props.tool
  return (
    <button
      className={'px-2 py-1 text-sm rounded border btn ' + (active ? 'btn-active' : '')}
      onClick={() => setTool(props.tool)}
      type='button'
    >
      {props.label}
    </button>
  )
}

export default function TopBar(props: Props) {
  const doc = useTemplateEditorStore((s) => s.history.present)
  const setTemplateName = useTemplateEditorStore((s) => s.setTemplateName)
  const undo = useTemplateEditorStore((s) => s.undo)
  const redo = useTemplateEditorStore((s) => s.redo)
  const preview = useTemplateEditorStore((s) => s.preview)
  const setPreviewTarget = useTemplateEditorStore((s) => s.setPreviewTarget)
  const settings = useTemplateEditorStore((s) => s.settings)
  const setSettings = useTemplateEditorStore((s) => s.setSettings)
  const theme = useTemplateEditorStore((s) => s.theme)
  const toggleTheme = useTemplateEditorStore((s) => s.toggleTheme)
  const newTemplate = useTemplateEditorStore((s) => s.newTemplate)

  const unit = settings.previewUnit ?? 'mm'
  const toDisplay = (valueMm: number) => (unit === 'mm' ? valueMm : valueMm / 25.4)
  const toMm = (value: number) => (unit === 'mm' ? value : value * 25.4)

  const presets = useMemo(() => {
    if (unit === 'mm') {
      return [
        { label: '74 x 26 mm', width: 74, height: 26 },
        { label: '50 x 25 mm', width: 50, height: 25 },
        { label: '58 x 40 mm', width: 58, height: 40 },
        { label: '60 x 40 mm', width: 60, height: 40 },
        { label: '80 x 40 mm', width: 80, height: 40 },
        { label: '100 x 50 mm', width: 100, height: 50 },
        { label: '100 x 150 mm', width: 100, height: 150 }
      ]
    }
    return [
      { label: '2 x 1 in', width: 2, height: 1 },
      { label: '3 x 1 in', width: 3, height: 1 },
      { label: '4 x 2 in', width: 4, height: 2 },
      { label: '2.25 x 1.25 in', width: 2.25, height: 1.25 },
      { label: '4 x 6 in', width: 4, height: 6 },
      { label: '1 x 1 in', width: 1, height: 1 }
    ]
  }, [unit])

  const selectedPreset = useMemo(() => {
    const w = toDisplay(preview.width_mm)
    const h = toDisplay(preview.height_mm)
    const isMatch = (a: number, b: number) => Math.abs(a - b) < 0.01
    const match = presets.find((p) => isMatch(p.width, w) && isMatch(p.height, h))
    return match?.label ?? 'Custom'
  }, [presets, preview.height_mm, preview.width_mm, unit])

  return (
    <div className='px-2 py-2 border-b app-bar flex items-center gap-2'>
      <div className='flex items-center gap-2'>
        <input
          className='border rounded px-2 py-1 text-sm w-[220px] bg-[var(--panel-muted)] border-[var(--border)]'
          value={doc.name ?? ''}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder='Template name'
        />
        <InfoHint text='Name used in the exported template.' />
        <button className='px-2 py-1 text-sm rounded border btn' onClick={undo} type='button'>
          Undo
        </button>
        <button className='px-2 py-1 text-sm rounded border btn' onClick={redo} type='button'>
          Redo
        </button>
      </div>

      <div className='flex items-center gap-1 ml-2'>
        <ToolButton tool='select' label='Select' />
        <ToolButton tool='split_v' label='Split V' />
        <ToolButton tool='split_h' label='Split H' />
        <ToolButton tool='place_text' label='Text' />
        <ToolButton tool='place_qr' label='QR' />
        <ToolButton tool='place_dm' label='DataMatrix' />
        <ToolButton tool='place_image' label='Image' />
        <ToolButton tool='place_line' label='Line' />
      </div>

      <div className='flex-1' />

      <div className='flex items-center gap-2 text-sm'>
        <div className='flex items-center gap-1'>
          <span className='text-muted'>Unit</span>
          <InfoHint text='Switch between millimeters and inches for label size.' />
          <select
            className='border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)]'
            value={unit}
            onChange={(e) => setSettings({ previewUnit: e.target.value as 'mm' | 'in' })}
          >
            <option value='mm'>mm</option>
            <option value='in'>in</option>
          </select>

          <span className='text-muted ml-2'>Label</span>
          <InfoHint text='Choose a common label size preset.' />
          <select
            className='border rounded px-2 py-1 text-sm bg-[var(--panel-muted)] border-[var(--border)]'
            value={selectedPreset}
            onChange={(e) => {
              const preset = presets.find((p) => p.label === e.target.value)
              if (!preset) return
              setPreviewTarget({ width_mm: toMm(preset.width), height_mm: toMm(preset.height) })
            }}
          >
            <option value='Custom'>Custom</option>
            {presets.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>

          <span className='text-muted'>W</span>
          <InfoHint text={unit === 'mm' ? 'Label width in millimeters.' : 'Label width in inches.'} />
          <input
            className='w-16 border rounded px-2 py-1 bg-[var(--panel-muted)] border-[var(--border)]'
            type='number'
            value={Number.isFinite(toDisplay(preview.width_mm)) ? Number(toDisplay(preview.width_mm).toFixed(2)) : ''}
            min={unit === 'mm' ? 1 : 0.1}
            step={unit === 'mm' ? 1 : 0.01}
            onChange={(e) => setPreviewTarget({ width_mm: toMm(Number(e.target.value)) })}
          />
          <span className='text-muted'>H</span>
          <InfoHint text={unit === 'mm' ? 'Label height in millimeters.' : 'Label height in inches.'} />
          <input
            className='w-16 border rounded px-2 py-1 bg-[var(--panel-muted)] border-[var(--border)]'
            type='number'
            value={Number.isFinite(toDisplay(preview.height_mm)) ? Number(toDisplay(preview.height_mm).toFixed(2)) : ''}
            min={unit === 'mm' ? 1 : 0.1}
            step={unit === 'mm' ? 1 : 0.01}
            onChange={(e) => setPreviewTarget({ height_mm: toMm(Number(e.target.value)) })}
          />
          <span className='text-muted'>dpi</span>
          <InfoHint text='Printer resolution (dots per inch).' />
          <input
            className='w-20 border rounded px-2 py-1 bg-[var(--panel-muted)] border-[var(--border)]'
            type='number'
            value={preview.dpi}
            min={50}
            step={1}
            onChange={(e) => setPreviewTarget({ dpi: Number(e.target.value) })}
          />
        </div>

        <div className='flex items-center gap-1 ml-2'>
          <span className='text-muted'>Snap%</span>
          <InfoHint text='Split snap step in percent while dragging.' />
          <input
            className='w-16 border rounded px-2 py-1 bg-[var(--panel-muted)] border-[var(--border)]'
            type='number'
            value={settings.snapPercentStep}
            min={5}
            step={5}
            onChange={(e) => setSettings({ snapPercentStep: Math.max(5, Number(e.target.value)) })}
          />
        </div>

        <div className='flex items-center gap-2 ml-2'>
          <button className='px-2 py-1 rounded border btn' onClick={newTemplate} type='button'>
            New
          </button>
          <button className='px-2 py-1 rounded border btn' onClick={props.onOpenImport} type='button'>
            Import
          </button>
          <button className='px-2 py-1 rounded border btn' onClick={props.onOpenExport} type='button'>
            Export
          </button>
          <button className='px-2 py-1 rounded border btn' onClick={toggleTheme} type='button'>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </div>
  )
}
