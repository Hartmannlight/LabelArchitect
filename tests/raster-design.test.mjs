import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyRasterDesign, newRasterId, parseRasterDesign, parseRasterDesignFile, serializeRasterDesign, MAX_RASTER_DESIGN_BYTES } from '../src/model/rasterDesign.ts'

test('image and print identifiers do not require secure-context randomUUID', () => {
  assert.match(newRasterId(), /^[a-f0-9]{32}$/)
  assert.notEqual(newRasterId(), newRasterId())
})

test('raster designs round trip with physical dimensions and embedded content', () => {
  const doc = emptyRasterDesign()
  doc.elements.push({ id: 'text', kind: 'text', x: 1, y: 2, width: 30, height: 8, fontSize: 4, text: 'Hello\nB1' })
  assert.deepEqual(parseRasterDesign(JSON.parse(JSON.stringify(doc))), doc)
})

test('designs larger than the old 10 MB limit can be saved and loaded', () => {
  const source = 'data:image/png;base64,' + 'A'.repeat(5_400_000)
  const element = { kind: 'image', x: 0, y: 0, width: 20, height: 20, source }
  const doc = { ...emptyRasterDesign(), elements: [{ ...element, id: 'one' }, { ...element, id: 'two' }] }
  const exported = serializeRasterDesign(doc)
  assert.ok(Buffer.byteLength(exported) > 10_000_000)
  assert.deepEqual(parseRasterDesignFile(exported), doc)
})

test('editing, export and import enforce the same UTF-8 byte budget', () => {
  const base = { ...emptyRasterDesign(), name: 'Ä' }
  const element = { kind: 'image', x: 0, y: 0, width: 20, height: 20, source: 'data:image/png;base64,' + 'A'.repeat(6_800_000) }
  const tooLarge = { ...base, elements: ['a', 'b', 'c'].map((id) => ({ ...element, id })) }
  assert.throws(() => parseRasterDesign(tooLarge), /20 MB/)
  assert.throws(() => serializeRasterDesign(tooLarge), /20 MB/)
  assert.throws(() => parseRasterDesignFile(JSON.stringify(tooLarge)), /20 MB/)
  const exact = { ...base, padding: '' }
  exact.padding = ' '.repeat(MAX_RASTER_DESIGN_BYTES - Buffer.byteLength(JSON.stringify(exact)))
  assert.equal(Buffer.byteLength(serializeRasterDesign(exact)), MAX_RASTER_DESIGN_BYTES)
  assert.equal(parseRasterDesignFile(serializeRasterDesign(exact)).name, 'Ä')
  assert.throws(() => parseRasterDesign({ ...exact, padding: exact.padding + 'x' }), /20 MB/)
})

test('import refuses remote images, excessive sizes, invalid numbers and duplicate IDs', () => {
  const element = { id: 'image', kind: 'image', x: 0, y: 0, width: 10, height: 10, source: 'https://example.com/tracker.png' }
  assert.throws(() => parseRasterDesign({ ...emptyRasterDesign(), elements: [element] }))
  assert.throws(() => parseRasterDesign({ ...emptyRasterDesign(), widthMm: Infinity }))
  assert.throws(() => parseRasterDesign({ ...emptyRasterDesign(), widthMm: 301 }))
  const rect = { ...element, kind: 'rectangle' }
  assert.throws(() => parseRasterDesign({ ...emptyRasterDesign(), elements: [rect, rect] }))
  assert.throws(() => parseRasterDesign({ ...emptyRasterDesign(), elements: [{ ...rect, x: NaN }] }))
})
import { Buffer } from 'node:buffer';
