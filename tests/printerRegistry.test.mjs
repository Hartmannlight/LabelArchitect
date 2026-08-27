import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registrationPayload, settingsPayload } from '../src/api/printerRegistry.ts'

test('registration sends identity only; media and resolution come from ZebraTamer', () => {
  const body = registrationPayload('http://pi:8080', 'zebra-usb', { name: 'Workshop', width: '70', height: '30', dpi: '300' })
  assert.deepEqual(body, { base_url: 'http://pi:8080', printer_id: 'zebra-usb', name: 'Workshop' })
  assert.equal('id' in body, false)
  assert.equal('enabled' in body, false)
})

const printer = { registry: { revision: 7 }, connection: { protocol: 'raw9100' }, media: { loaded: { width_mm: 50, height_mm: 50, color: 'white', type: 'virtual' }, dynamic_source: { kind: 'zpl_emulator_settings' } }, alignment: { dpi: 203, offset_x_mm: 0, offset_y_mm: 0 }, zpl: { print_mode: 'tear_off', darkness: 10, print_speed: 3 }, defaults: { copies: 1, rotation: 0 } }
const fields = { name: 'Edited', enabled: false, width: '60', height: '30', dpi: '300', offsetX: '2', offsetY: '1', darkness: '12', speed: '4', copies: '2', rotation: '90' }

test('settings preserve dynamic media and never change identity or endpoint', () => {
  const body = settingsPayload(printer, fields)
  assert.equal(body.revision, 7)
  assert.equal('connection' in body.settings, false)
  assert.equal('id' in body.settings, false)
  assert.equal('media' in body.settings, false)
  assert.equal(body.settings.alignment.dpi, 203)
  assert.equal(body.settings.alignment.offset_x_mm, 2)
  assert.equal(body.settings.zpl.print_mode, 'tear_off')
  assert.equal(body.settings.enabled, false)
})

test('manual media edits preserve other media fields', () => {
  const manual = { ...printer, media: { loaded: printer.media.loaded } }
  const body = settingsPayload(manual, fields)
  assert.deepEqual(body.settings.media.loaded, { width_mm: 60, height_mm: 30, color: 'white', type: 'virtual' })
  assert.equal(body.settings.alignment.dpi, 300)
})

test('ZebraTamer settings never write duplicate media or device defaults', () => {
  const agent = { ...printer, connection: { protocol: 'zebra_tamer' } }
  const body = settingsPayload(agent, fields)
  assert.deepEqual(body.settings, { name: 'Edited', enabled: false, defaults: { copies: 2, rotation: 90 } })
})
