import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import { refreshPrinter } from '../src/api/printerRefresh.ts'
import { errorText } from '../src/api/errorText.ts'

test('refreshes emulator media without querying unsupported live status', async () => {
  const printer = { id: 'virtual-zebra', capabilities: { supports_status: false }, media: { loaded: { width_mm: 40, height_mm: 30 } } }
  const client = { get: mock.fn(async () => printer), getStatus: mock.fn() }
  assert.deepEqual(await refreshPrinter('virtual-zebra', client), { printer, status: null })
  assert.deepEqual(client.get.mock.calls[0].arguments, ['virtual-zebra'])
  assert.equal(client.getStatus.mock.callCount(), 0)
})

test('queries live status when freshly loaded printer capabilities allow it', async () => {
  const printer = { id: 'zebra', enabled: true, capabilities: { supports_status: true } }
  const status = { normalized: { summary: { ready: true } } }
  const client = { get: mock.fn(async () => printer), getStatus: mock.fn(async () => status) }
  assert.deepEqual(await refreshPrinter('zebra', client), { printer, status })
  assert.deepEqual(client.getStatus.mock.calls[0].arguments, ['zebra'])
  assert.equal(client.getStatus.mock.callCount(), 1)
})

for (const [name, printer] of [
  ['disabled printer', { enabled: false, capabilities: { supports_status: true } }],
  ['missing capabilities', {}],
]) {
  test(`does not query live status for ${name}`, async () => {
    const client = { get: async () => printer, getStatus: mock.fn() }
    assert.equal((await refreshPrinter('printer', client)).status, null)
    assert.equal(client.getStatus.mock.callCount(), 0)
  })
}

test('propagates connection errors instead of reporting a successful refresh', async () => {
  const failure = new Error('Connection failed')
  const client = { get: async () => { throw failure }, getStatus: mock.fn() }
  await assert.rejects(refreshPrinter('printer', client), (error) => error === failure)
  assert.equal(client.getStatus.mock.callCount(), 0)
})

test('preserves live status failures and displays the API explanation', async () => {
  const failure = Object.assign(new Error('Conflict'), { detail: { detail: 'Printer is disabled' } })
  const client = { get: async () => ({ capabilities: { supports_status: true } }), getStatus: async () => { throw failure } }
  await assert.rejects(refreshPrinter('printer', client), (error) => error === failure)
  assert.equal(errorText(failure), 'Printer is disabled')
  assert.equal(errorText(new Error('Network failed')), 'Network failed')
})
