import type { LabelPreviewTarget, TemplateDoc } from './types'
import { PROJECT_DEFAULTS } from '../config/projectDefaults'

export type StarterTemplate = {
  id: string
  name: string
  description: string
  tags: string[]
  template: TemplateDoc
  variables: Array<Record<string, unknown>>
  sampleData: Record<string, unknown>
  target: LabelPreviewTarget
}

const defaults: TemplateDoc['defaults'] = PROJECT_DEFAULTS

export const starterTemplates: StarterTemplate[] = [
  {
    id: 'asset-label',
    name: 'Asset label',
    description: 'QR identifier with a readable title and secondary detail.',
    tags: ['asset', 'inventory', 'qr'],
    target: { width_mm: 50, height_mm: 25, dpi: 203 },
    variables: [
      { name: 'title', label: 'Title', type: 'text', mode: 'required', source_hint: 'entity.display_name' },
      { name: 'identifier', label: 'Identifier', type: 'text', mode: 'required', source_hint: 'entity.id' },
      { name: 'detail', label: 'Detail', type: 'text', mode: 'optional', source_hint: 'entity.description' }
    ],
    sampleData: { title: 'Cordless drill', identifier: 'TD-000184', detail: 'Workshop · Shelf 2' },
    template: {
      schema_version: 1, name: 'Asset label', defaults,
      layout: { kind: 'split', direction: 'v', ratio: .36, gutter_mm: 1, divider: { visible: false, thickness_mm: .2 }, children: [
        { kind: 'leaf', alias: 'code', elements: [{ type: 'qr', data: '{identifier}', size_mode: 'max', render_mode: 'image', align_h: 'center', align_v: 'center' }] },
        { kind: 'split', direction: 'h', ratio: .58, gutter_mm: .5, divider: { visible: false, thickness_mm: .2 }, children: [
          { kind: 'leaf', alias: 'title', elements: [{ type: 'text', text: '{title}', font_height_mm: 4.5, fit: 'shrink_to_fit', max_lines: 2, align_v: 'bottom' }] },
          { kind: 'leaf', alias: 'detail', elements: [{ type: 'text', text: '{detail}', font_height_mm: 2.5, fit: 'shrink_to_fit', max_lines: 2, align_v: 'top' }] }
        ] }
      ] }
    }
  },
  {
    id: 'location-label',
    name: 'Location label',
    description: 'Large container name plus a scannable stable location id.',
    tags: ['location', 'container', 'qr'],
    target: { width_mm: 74, height_mm: 26, dpi: 203 },
    variables: [
      { name: 'container_name', label: 'Container name', type: 'text', mode: 'required', source_hint: 'location.name' },
      { name: 'location_uuid', label: 'Location ID', type: 'text', mode: 'required', source_hint: 'location.id' }
    ],
    sampleData: { container_name: 'Electronics · Box 4', location_uuid: 'a8ad8f5c-51fd-4db0-a71f' },
    template: {
      schema_version: 1, name: 'Location label', defaults,
      layout: { kind: 'split', direction: 'v', ratio: .72, gutter_mm: 1.2, divider: { visible: false, thickness_mm: .2 }, children: [
        { kind: 'leaf', alias: 'name', elements: [{ type: 'text', text: '{container_name}', font_height_mm: 7, fit: 'shrink_to_fit', max_lines: 2, align_v: 'center' }] },
        { kind: 'leaf', alias: 'code', elements: [{ type: 'qr', data: '{location_uuid}', size_mode: 'max', render_mode: 'image', align_h: 'center', align_v: 'center' }] }
      ] }
    }
  },
  {
    id: 'freeform-note',
    name: 'Simple note',
    description: 'A flexible two-line label for PrintHub-only use cases.',
    tags: ['general', 'text'],
    target: { width_mm: 50, height_mm: 25, dpi: 203 },
    variables: [
      { name: 'headline', label: 'Headline', type: 'text', mode: 'required' },
      { name: 'note', label: 'Note', type: 'text', mode: 'optional' }
    ],
    sampleData: { headline: 'Fragile', note: 'Store upright' },
    template: {
      schema_version: 1, name: 'Simple note', defaults,
      layout: { kind: 'split', direction: 'h', ratio: .58, gutter_mm: 1, divider: { visible: true, thickness_mm: .3 }, children: [
        { kind: 'leaf', alias: 'headline', elements: [{ type: 'text', text: '{headline}', font_height_mm: 8, fit: 'shrink_to_fit', max_lines: 1, align_h: 'center', align_v: 'center' }] },
        { kind: 'leaf', alias: 'note', elements: [{ type: 'text', text: '{note}', font_height_mm: 3.5, fit: 'shrink_to_fit', max_lines: 2, align_h: 'center', align_v: 'center' }] }
      ] }
    }
  }
]
