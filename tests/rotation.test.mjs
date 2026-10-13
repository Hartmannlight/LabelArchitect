import test from 'node:test'
import assert from 'node:assert/strict'
import { computeLayout, rotationOf } from '../src/model/layout.ts'
import { createCableFlagTemplate, configureCableFlag, cableFlagGeometry, defaultCableFlag, swapCableEnds } from '../src/model/cableFlag.ts'

const leaf = (rotation_deg = 0) => ({ kind: 'leaf', rotation_deg, padding_mm: [1, 2, 3, 4], elements: [{ type: 'text', text: 'A' }] })

test('quarter turns swap layout axes, preserve asymmetric padding, and compose', () => {
  for (const angle of [0, 90, 180, -90, 270]) {
    const result = computeLayout(leaf(angle), 40, 24, { scalePxPerMm: 10 }).leaves[0]
    assert.deepEqual(result.rect, { x: 0, y: 0, w: 400, h: 240 })
    assert.equal(result.localContentRect.w, ([90, -90, 270].includes(angle) ? 240 : 400) - 60)
    assert.equal(result.localContentRect.h, ([90, -90, 270].includes(angle) ? 400 : 240) - 40)
    assert.equal(rotationOf(result.transform), angle === 270 ? -90 : angle)
  }
  const root = { kind: 'split', rotation_deg: 90, direction: 'h', ratio: .25, gutter_mm: 2, children: [leaf(-90), leaf()] }
  const result = computeLayout(root, 40, 24, { scalePxPerMm: 10 })
  assert.deepEqual(result.leaves[0].rect, { x: 305, y: 0, w: 95, h: 240 })
  assert.equal(rotationOf(result.leaves[0].transform), 0)
  assert.equal(result.splits[0].direction, 'v')
  assert.equal(result.splits[0].reversed, true)
})

test('75 by 50 cable flag wraps over 75 mm and reserves circumference plus padding', () => {
  const target = { width_mm: 75, height_mm: 50 }
  const doc = createCableFlagTemplate()
  const geometry = cableFlagGeometry(target, defaultCableFlag)
  assert.equal(doc.layout.direction, 'v')
  assert.equal(doc.layout.gutter_mm, Math.PI * 6)
  assert.equal(geometry.faceLength, (75 - Math.PI * 6) / 2)
  assert.equal(geometry.textLength, geometry.faceLength - 2 - 1.5)
  const render = computeLayout(doc.layout, 75, 50, { scalePxPerMm: 10 })
  assert.equal(render.leaves.length, 2)
  assert.equal(rotationOf(render.leaves[0].transform), 90)
  assert.equal(rotationOf(render.leaves[1].transform), -90)
  assert.equal(render.leaves[0].localContentRect.w, 470)
  assert.throws(() => configureCableFlag(doc, target, { ...defaultCableFlag, diameter_mm: 30 }), /less than 6 mm/)
  assert.throws(() => cableFlagGeometry(target, { ...defaultCableFlag, diameter_mm: NaN }))
})

test('partner label swaps device, port and additional details as one endpoint', () => {
  const values = { from_device: 'SW321', from_port: '32', from_bundle: '', to_device: '#543', to_port: '1', to_bundle: 'B11', extra: 'unchanged' }
  const partner = swapCableEnds(values)
  assert.deepEqual(partner, { from_device: '#543', from_port: '1', from_bundle: 'B11', to_device: 'SW321', to_port: '32', to_bundle: '', extra: 'unchanged' })
  assert.deepEqual(swapCableEnds(partner), values)
  assert.equal(values.from_device, 'SW321')
})

test('editing face rotation preserves the chosen angle and cable-side padding', () => {
  for (const angle of [0, 90, 180, -90]) {
    const doc = createCableFlagTemplate()
    doc.layout.children[0].rotation_deg = angle
    const changed = configureCableFlag(doc, { width_mm: 75, height_mm: 50 }, defaultCableFlag)
    const front = computeLayout(changed.layout, 75, 50, { scalePxPerMm: 10 }).leaves[0]
    assert.equal(rotationOf(front.transform), angle)
    assert.equal(front.rect.x + front.rect.w - front.contentRect.x - front.contentRect.w, 20)
  }
})
