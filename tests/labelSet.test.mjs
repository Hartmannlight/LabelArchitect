import test from 'node:test'
import assert from 'node:assert/strict'
import { createCableFlagTemplate } from '../src/model/cableFlag.ts'
import { extractTemplateVariables } from '../src/model/variables.ts'
import { labelPreviewTemplate, templateLabels } from '../src/model/labelSet.ts'
import { validateTemplate } from '../src/model/schema.ts'

test('cable pair round trips with two shared fields and preserves preview bindings', () => {
  const doc = createCableFlagTemplate()
  const validated = validateTemplate(JSON.parse(JSON.stringify(doc)))
  assert.equal(validated.ok, true)
  assert.deepEqual(extractTemplateVariables(validated.doc).variables, ['from', 'to'])
  assert.equal(templateLabels(validated.doc).length, 2)
  const partner = labelPreviewTemplate(validated.doc, 1)
  assert.deepEqual(partner.labels[0].bindings, { from: 'to', to: 'from' })
  assert.equal(partner.labels.length, 1)
  for (const face of partner.layout.children) {
    assert.equal(face.elements[0].wrap, 'none')
    assert.equal(face.elements[0].fit, 'shrink_to_fit')
    assert.equal(face.elements[0].align_h, 'center')
    assert.equal(face.elements[0].align_v, 'center')
  }
  assert.equal(partner.layout.divider.visible, true)
})

test('independent layouts share input fields, macros and legacy single labels remain printable', () => {
  const doc = { schema_version: 1, layout: { kind: 'leaf', elements: [{ type: 'text', text: '{unused}' }] }, labels: [
    { layout: { kind: 'leaf', elements: [{ type: 'text', text: '{text}' }] }, bindings: { text: 'shared' } },
    { layout: { kind: 'leaf', elements: [{ type: 'text', text: '{shared} {_date_yyyy_mm_dd}' }] } },
  ] }
  assert.deepEqual(extractTemplateVariables(doc), { variables: ['shared'], macros: ['_date_yyyy_mm_dd'] })
  assert.equal(validateTemplate(doc).ok, true)
  const legacy = { schema_version: 1, layout: doc.layout }
  assert.equal(templateLabels(legacy).length, 1)
  assert.equal(labelPreviewTemplate(legacy, 0).layout, legacy.layout)
})

test('label limits and invalid input mappings are rejected on import', () => {
  const doc = createCableFlagTemplate()
  for (const labels of [[], Array(26).fill({}), [{ bindings: { 'bad field': 'from' } }], [{ bindings: { from: 'bad field' } }]]) {
    assert.equal(validateTemplate({ ...doc, labels }).ok, false)
  }
})
