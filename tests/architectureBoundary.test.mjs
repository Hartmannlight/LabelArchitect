import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { URL } from 'node:url'

const studioSource = await readFile(new URL('../src/app/StudioApp.tsx', import.meta.url), 'utf8')

test('Studio delegates physical printer administration to Fleet Console', () => {
  assert.match(studioSource, /Manage printer fleet/)
  assert.match(studioSource, /function PrintJobs/)
  assert.doesNotMatch(studioSource, /PrinterDiscoveryControls|PrinterSettingsEditor/)
  assert.doesNotMatch(studioSource, /\/configuration|\/status|\/prints\/zpl/)
})

test('legacy printer navigation lands on logical print jobs', () => {
  assert.match(studioSource, /value === 'printers'\) return 'jobs'/)
})
