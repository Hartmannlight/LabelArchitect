import { useMemo, useState } from 'react'
import { useTemplateEditorStore } from '../state/store'

type Props = {
  mode: 'export' | 'import'
  onClose: () => void
}

export default function JsonDialog(props: Props) {
  const doc = useTemplateEditorStore((s) => s.history.present)
  const issues = useTemplateEditorStore((s) => s.validationIssues)
  const importJson = useTemplateEditorStore((s) => s.importJson)
  const [text, setText] = useState('')
  const [importIssues, setImportIssues] = useState<string[] | null>(null)

  const exported = useMemo(() => JSON.stringify(doc, null, 2), [doc])

  const close = () => {
    setImportIssues(null)
    props.onClose()
  }

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-6'>
      <div className='w-full max-w-4xl rounded border panel overflow-hidden'>
        <div className='px-3 py-2 border-b app-bar flex items-center justify-between'>
          <div className='text-sm font-semibold'>{props.mode === 'export' ? 'Export JSON' : 'Import JSON'}</div>
          <button className='px-2 py-1 text-sm rounded border btn' onClick={close} type='button'>
            Close
          </button>
        </div>

        <div className='p-3 space-y-3'>
          {props.mode === 'export' ? (
            <>
              {issues.length > 0 && (
                <div className='rounded border border-[var(--warn)] bg-[var(--warn-bg)] p-2 text-sm text-warn'>
                  Export is allowed, but current template has validation issues. Fix them before compiling.
                </div>
              )}
              <div className='flex gap-2'>
                <button
                  className='px-2 py-1 text-sm rounded border btn'
                  onClick={async () => {
                    await navigator.clipboard.writeText(exported)
                  }}
                  type='button'
                >
                  Copy
                </button>
                <button
                  className='px-2 py-1 text-sm rounded border btn'
                  onClick={() => downloadText(`${doc.name ?? 'template'}.json`, exported)}
                  type='button'
                >
                  Download
                </button>
              </div>
              <pre className='max-h-[60vh] overflow-auto rounded border panel-muted p-3 text-xs'>{exported}</pre>
            </>
          ) : (
            <>
              <div className='text-sm text-muted'>Paste JSON or upload a file.</div>
              <div className='flex items-center gap-2'>
                <input
                  type='file'
                  accept='application/json,.json'
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    f.text().then((t) => setText(t))
                  }}
                />
                <button
                  className='px-2 py-1 text-sm rounded border btn'
                  onClick={() => {
                    const res = importJson(text)
                    if (res.ok) {
                      setImportIssues(null)
                      close()
                    } else {
                      setImportIssues(res.issues)
                    }
                  }}
                  type='button'
                >
                  Import
                </button>
              </div>

              <textarea
                className='w-full h-[45vh] border rounded p-2 text-xs font-mono bg-[var(--panel-muted)] border-[var(--border)]'
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='{ ... }'
              />

              {importIssues && (
                <div className='rounded border border-[var(--danger)] bg-[var(--danger-bg)] p-2 text-sm text-danger'>
                  <div className='font-semibold mb-1'>Import failed</div>
                  <ul className='list-disc pl-5 space-y-1'>
                    {importIssues.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
