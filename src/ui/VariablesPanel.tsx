import { useMemo } from 'react'
import InfoHint from './InfoHint'
import { extractTemplateVariables, TEMPLATE_MACROS } from '../model/variables'
import { useTemplateEditorStore } from '../state/store'

export default function VariablesPanel() {
  const doc = useTemplateEditorStore((s) => s.history.present)
  const variableValues = useTemplateEditorStore((s) => s.variableValues)
  const setVariableValue = useTemplateEditorStore((s) => s.setVariableValue)
  const { variables, macros } = useMemo(() => extractTemplateVariables(doc), [doc])
  const macroList = useMemo(() => Array.from(TEMPLATE_MACROS).sort(), [])
  const usedMacros = useMemo(() => new Set(macros), [macros])

  return (
    <div className='rounded border panel-muted p-3 space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='text-sm font-semibold'>Variables</div>
        <InfoHint text='Placeholders use {name}. Use {{ and }} for literal braces.' />
      </div>

      {variables.length === 0 ? (
        <div className='text-xs text-muted'>No variable placeholders found in this template.</div>
      ) : (
        <div className='space-y-2'>
          <div className='text-xs text-muted'>Required variables</div>
          <div className='grid grid-cols-[140px_minmax(0,1fr)] gap-2 text-xs items-center'>
            {variables.map((key) => (
              <div key={key} className='contents'>
                <div className='text-xs font-mono'>{`{${key}}`}</div>
                <input
                  className='border rounded px-2 py-1 text-xs bg-[var(--panel-muted)] border-[var(--border)]'
                  value={variableValues[key] ?? ''}
                  onChange={(e) => setVariableValue(key, e.target.value)}
                  placeholder='(empty ok)'
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='space-y-1 text-xs'>
        <div className='text-muted'>Macros (auto-filled on backend)</div>
        <div className='flex flex-wrap gap-2 text-[11px] text-muted'>
          {macroList.map((m) => (
            <span
              key={m}
              className={
                'px-2 py-0.5 rounded border ' +
                (usedMacros.has(m) ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)]')
              }
            >
              {`{${m}}`}
            </span>
          ))}
        </div>
        <div className='text-[11px] text-subtle'>
          Counters increment only on print (not render/preview/draft). {'{_template_name}'} and {'{_counter_template*}'} require
          template.name to be set.
        </div>
      </div>
    </div>
  )
}
