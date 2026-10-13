import { extractTemplateVariables } from '../model/variables'
import { templateLabels } from '../model/labelSet'
import { useTemplateEditorStore } from '../state/store'

export default function LabelSetPanel() {
  const doc = useTemplateEditorStore((state) => state.history.present)
  const setLabels = useTemplateEditorStore((state) => state.setTemplateLabels)
  const labels = templateLabels(doc)
  const fields = extractTemplateVariables({ ...doc, labels: undefined }).variables
  const inputs = Array.from(new Set([...fields, ...extractTemplateVariables(doc).variables]))
  return <section className='property-card'><header><h3>Labels per print</h3><p>Fill the input fields once. One print job sends all labels in this list, in order.</p></header>
    {labels.map((label, index) => <div key={index} className='property-card'>
      <label className='property-field'><span>Label {index + 1} name</span><input value={label.name ?? `Label ${index + 1}`} onChange={(event) => setLabels(labels.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label>
      {fields.map((field) => <label key={field} className='property-field'><span>{field} uses input</span><select value={label.bindings?.[field] ?? field} onChange={(event) => setLabels(labels.map((item, i) => i === index ? { ...item, bindings: { ...item.bindings, [field]: event.target.value } } : item))}>{inputs.map((input) => <option key={input} value={input}>{input}</option>)}</select></label>)}
      {label.layout && <p className='field-help'>This label has its own imported layout.</p>}
      <button type='button' disabled={labels.length === 1} onClick={() => setLabels(labels.filter((_, i) => i !== index))}>Remove label</button>
    </div>)}
    <button type='button' disabled={labels.length >= 25} onClick={() => setLabels([...labels, { name: `Label ${labels.length + 1}` }])}>Add label</button>
  </section>
}
