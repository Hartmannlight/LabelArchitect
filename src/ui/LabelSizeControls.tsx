import { useEffect, useState } from 'react'
import { labelSizePresets } from '../api/config'
import { useTemplateEditorStore } from '../state/store'
import ToolbarPopover from './ToolbarPopover'

function DimensionInput({ label, value, integer = false, onChange }: {
  label: string
  value: number
  integer?: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const number = Number(draft)
  const valid = draft.trim() !== '' && Number.isFinite(number) && number >= 1 && (!integer || Number.isInteger(number))

  return <label className='label-size-field'>
    <span>{label}</span>
    <input
      type='number'
      min={1}
      step={integer ? 1 : 'any'}
      value={draft}
      aria-invalid={!valid}
      title={integer ? 'Enter a positive whole number.' : 'Enter a size of at least 1 mm.'}
      onChange={(event) => {
        const next = event.target.valueAsNumber
        setDraft(event.target.value)
        if (Number.isFinite(next) && next >= 1 && (!integer || Number.isInteger(next))) onChange(next)
      }}
      onBlur={() => setDraft(String(value))}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur() }}
    />
  </label>
}

export default function LabelSizeControls() {
  const preview = useTemplateEditorStore((state) => state.preview)
  const setPreviewTarget = useTemplateEditorStore((state) => state.setPreviewTarget)
  const selectedPreset = labelSizePresets.find((preset) =>
    Math.abs(preset.width_mm - preview.width_mm) < 0.001 && Math.abs(preset.height_mm - preview.height_mm) < 0.001
  )

  return <ToolbarPopover label='Label size settings' trigger={<><span>{preview.width_mm} × {preview.height_mm} mm</span><small>{preview.dpi} dpi</small><span aria-hidden='true'>⌄</span></>}>
    <section className='label-size-controls' aria-label='Label size'>
    <div className='label-size-description'><strong>Label size</strong><small>Canvas & preview · saved with template</small></div>
    <label className='label-size-field label-size-preset'>
      <span>Format</span>
      <select value={selectedPreset?.id ?? 'custom'} onChange={(event) => {
        const preset = labelSizePresets.find((entry) => entry.id === event.target.value)
        if (preset) setPreviewTarget({ width_mm: preset.width_mm, height_mm: preset.height_mm })
      }}>
        <option value='custom' disabled>Custom size</option>
        {labelSizePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.width_mm} × {preset.height_mm} mm</option>)}
      </select>
    </label>
    <DimensionInput label='Width (mm)' value={preview.width_mm} onChange={(width_mm) => setPreviewTarget({ width_mm })} />
    <DimensionInput label='Height (mm)' value={preview.height_mm} onChange={(height_mm) => setPreviewTarget({ height_mm })} />
    <button type='button' className='label-size-swap' onClick={() => setPreviewTarget({ width_mm: preview.height_mm, height_mm: preview.width_mm })} title='Swap label width and height'>Swap ↔</button>
    <DimensionInput label='Resolution (dpi)' value={preview.dpi} integer onChange={(dpi) => setPreviewTarget({ dpi })} />
    </section>
  </ToolbarPopover>
}
