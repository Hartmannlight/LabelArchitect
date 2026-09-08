import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { URL } from 'node:url'

const studioSource = await readFile(new URL('../src/app/StudioApp.tsx', import.meta.url), 'utf8')

test('Studio manages print services and printers through PrintHub', () => {
  assert.match(studioSource, /function PrinterManagement/)
  assert.match(studioSource, /\/v1\/printer-services/)
  assert.match(studioSource, /\/v1\/ipp-shares/)
  assert.match(studioSource, /function PrintJobs/)
  assert.match(studioSource, /hold_reason === 'label_limit_exceeded'/)
  assert.match(studioSource, /exceeds the configured label limit/)
  assert.match(studioSource, /override_label_limit: overrideLabelLimit/)
  assert.match(studioSource, /output_mode: outputMode/)
  assert.match(studioSource, /Rendered image/)
  assert.match(studioSource, /Native ZPL/)
  assert.doesNotMatch(studioSource, /external hardware console/i)
})

test('printer navigation has a dedicated management view', () => {
  assert.match(studioSource, /View = 'templates' \| 'print' \| 'designer' \| 'printers' \| 'jobs'/)
  assert.match(studioSource, /view === 'printers'/)
})
