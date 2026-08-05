import { useMemo, useState } from 'react'
import { getNodeById } from '../model/ids'
import type { Element } from '../model/types'
import { extractTemplateVariables } from '../model/variables'
import { useTemplateEditorStore } from '../state/store'

const automaticValues = [
  { value: '_date_dd_mm_yyyy', label: 'Current date — DD.MM.YYYY' },
  { value: '_date_yyyy_mm_dd', label: 'Current date — YYYY-MM-DD' },
  { value: '_time_hh_mm', label: 'Current time — HH:MM' },
  { value: '_time_hh_mm_ss', label: 'Current time with seconds' },
  { value: '_now_iso', label: 'Current date and time — ISO' },
  { value: '_short_id', label: 'Short unique ID' },
  { value: '_uuid', label: 'Full unique ID — UUID' },
  { value: '_printer_id', label: 'Printer ID' },
  { value: '_template_name', label: 'Template name' },
  { value: '_counter_daily', label: 'Daily counter' },
  { value: '_counter_global', label: 'Global counter' },
  { value: '_counter_printer', label: 'Counter per printer' },
  { value: '_counter_template', label: 'Counter per template' },
] as const

function normalizeFieldName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[0-9]+/, '')
}

export default function VariablesPanelV2() {
  const doc = useTemplateEditorStore((state) => state.history.present)
  const selection = useTemplateEditorStore((state) => state.selection)
  const variableValues = useTemplateEditorStore((state) => state.variableValues)
  const setVariableValue = useTemplateEditorStore((state) => state.setVariableValue)
  const patchElement = useTemplateEditorStore((state) => state.patchElement)
  const [showBuilder, setShowBuilder] = useState(false)
  const [fieldName, setFieldName] = useState('')
  const [exampleValue, setExampleValue] = useState('')
  const [automaticValue, setAutomaticValue] = useState<(typeof automaticValues)[number]['value']>('_date_dd_mm_yyyy')
  const { variables } = useMemo(() => extractTemplateVariables(doc), [doc])
  const selectedElement = useMemo(() => {
    if (!selection) return null
    const node = getNodeById(doc.layout, selection.nodeId)
    return node?.kind === 'leaf' ? node.elements[0] : null
  }, [doc.layout, selection])
  const canInsert = selectedElement?.type === 'text' || selectedElement?.type === 'qr' || selectedElement?.type === 'datamatrix'

  const insertToken = (token: string) => {
    if (!selection || !selectedElement || !canInsert) return
    if (selectedElement.type === 'text') {
      const separator = selectedElement.text && !/\s$/.test(selectedElement.text) ? ' ' : ''
      patchElement(selection.nodeId, { text: `${selectedElement.text}${separator}${token}` })
    } else {
      const data = selectedElement.data ?? ''
      patchElement(selection.nodeId, { data: `${data}${token}` } as Partial<Element>)
    }
  }

  const createField = () => {
    const normalized = normalizeFieldName(fieldName)
    if (!normalized) return
    insertToken(`{${normalized}}`)
    setVariableValue(normalized, exampleValue)
    setFieldName('')
    setExampleValue('')
    setShowBuilder(false)
  }

  return <section className='dynamic-data-card'>
    <header><div><span>Changing content</span><h3>Values that change when printing</h3></div></header>
    <p>This is optional. Insert an automatic value, or add a field that PrintHub asks for before printing.</p>

    <div className='data-source-list'>
      <div className='data-source-row'>
        <header><strong>Automatic value</strong><span>PrintHub fills this in by itself.</span></header>
        <div className='automatic-value-row'>
          <label><span className='sr-only'>Automatic value</span><select aria-label='Automatic value' value={automaticValue} onChange={(event) => setAutomaticValue(event.target.value as (typeof automaticValues)[number]['value'])}>{automaticValues.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <button type='button' disabled={!canInsert} onClick={() => insertToken(`{${automaticValue}}`)}>Insert</button>
        </div>
      </div>

      <div className='data-source-row'>
        <header><strong>Entered before printing</strong><span>For product names, order numbers, prices and similar values.</span></header>
        {!showBuilder ? <button type='button' onClick={() => setShowBuilder(true)}>Add an input field</button> : <div className='variable-builder'>
          <div className='builder-step'><span>1</span><label><strong>What should PrintHub ask for?</strong><input autoFocus value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder='e.g. product name' /><small>Use a short descriptive name. Spaces are converted to underscores.</small></label></div>
          <div className='builder-step'><span>2</span><label><strong>Example shown in the preview</strong><input value={exampleValue} onChange={(event) => setExampleValue(event.target.value)} placeholder='e.g. Cordless drill' /></label></div>
          <div className='builder-preview'><span>Stored in the template as</span><code>{`{${normalizeFieldName(fieldName) || 'field_name'}}`}</code></div>
          {!canInsert && <div className='builder-warning'>Select a Text, QR code or DataMatrix element first.</div>}
          <div className='builder-actions'><button type='button' onClick={() => setShowBuilder(false)}>Cancel</button><button type='button' className='dynamic-primary' disabled={!normalizeFieldName(fieldName) || !canInsert} onClick={createField}>Create and insert</button></div>
        </div>}
      </div>
    </div>

    {!canInsert && <p className='dynamic-hint'>Select a Text, QR code or DataMatrix element to insert changing content.</p>}

    {variables.length > 0 && <details className='variable-list'><summary>Input fields used in this template ({variables.length})</summary><div>{variables.map((name) => <label key={name}><code>{`{${name}}`}</code><input value={variableValues[name] ?? ''} onChange={(event) => setVariableValue(name, event.target.value)} placeholder='Preview value' /></label>)}</div></details>}
  </section>
}
