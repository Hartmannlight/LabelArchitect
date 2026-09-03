import { PROJECT_DEFAULTS } from '../config/projectDefaults'
import type { LeafNode, SplitNode, TextElement } from './types'
import type { StarterTemplate } from './starterTemplates'

const target = { width_mm: 50, height_mm: 25, dpi: 203 } as const

function textLeaf(text: string, alias: string, overrides: Partial<TextElement> = {}): LeafNode {
  return {
    kind: 'leaf',
    alias,
    elements: [{ type: 'text', text, ...overrides }],
  }
}

function split(
  direction: 'v' | 'h',
  ratio: number,
  first: LeafNode | SplitNode,
  second: LeafNode | SplitNode,
  options: { gutter_mm?: number; divider?: boolean; thickness_mm?: number } = {},
): SplitNode {
  return {
    kind: 'split',
    direction,
    ratio,
    gutter_mm: options.gutter_mm ?? 0,
    divider: {
      visible: options.divider ?? false,
      thickness_mm: options.thickness_mm ?? 0.25,
    },
    children: [first, second],
  }
}

function doc(name: string, layout: LeafNode | SplitNode) {
  return { schema_version: 1 as const, name, defaults: PROJECT_DEFAULTS, layout }
}

export const generalStarterTemplates: StarterTemplate[] = [
  {
    id: 'general-title-only',
    name: 'Nur Titel',
    description: 'Ein frei wählbarer Text, möglichst groß und zentriert.',
    tags: ['allgemein', 'text', 'titel'],
    target,
    variables: [
      { name: 'title', label: 'Titel', type: 'text', mode: 'required', placeholder: 'Werkzeug' },
    ],
    sampleData: { title: 'Werkzeug' },
    template: doc('Nur Titel', textLeaf('{title}', 'title', { font_height_mm: 10, max_lines: 2 })),
  },
  {
    id: 'general-title-subtitle',
    name: 'Titel + Unterzeile',
    description: 'Großer Titel mit einer kleineren Zusatzinformation darunter.',
    tags: ['allgemein', 'text', 'titel'],
    target,
    variables: [
      { name: 'title', label: 'Titel', type: 'text', mode: 'required', placeholder: 'Netzteile' },
      { name: 'subtitle', label: 'Unterzeile', type: 'text', mode: 'required', placeholder: '12 V - Fach B3' },
    ],
    sampleData: { title: 'Netzteile', subtitle: '12 V - Fach B3' },
    template: doc('Titel + Unterzeile', split(
      'h',
      0.64,
      textLeaf('{title}', 'title', { font_height_mm: 7.5, max_lines: 2, align_v: 'bottom' }),
      textLeaf('{subtitle}', 'subtitle', { font_height_mm: 3.2, max_lines: 2, align_v: 'top' }),
      { gutter_mm: 0.7 },
    )),
  },
  {
    id: 'general-free-text',
    name: 'Freitext',
    description: 'Ein beliebiger linksbündiger Text mit bis zu fünf Zeilen.',
    tags: ['allgemein', 'text', 'notiz'],
    target,
    variables: [
      { name: 'text', label: 'Text', type: 'textarea', rows: 5, mode: 'required', placeholder: 'Beliebigen Text eingeben' },
    ],
    sampleData: { text: 'Nur passende Akkus verwenden.\nNach Gebrauch ausschalten.' },
    template: doc('Freitext', textLeaf('{text}', 'text', {
      font_height_mm: 4.2,
      max_lines: 5,
      align_h: 'left',
    })),
  },
  {
    id: 'general-left-right',
    name: 'Links | Rechts',
    description: 'Zwei gleichwertige Texte mit einer klaren Trennlinie.',
    tags: ['allgemein', 'text', 'geteilt'],
    target,
    variables: [
      { name: 'left', label: 'Text links', type: 'text', mode: 'required', placeholder: 'Eingang' },
      { name: 'right', label: 'Text rechts', type: 'text', mode: 'required', placeholder: 'Ausgang' },
    ],
    sampleData: { left: 'EINGANG', right: 'AUSGANG' },
    template: doc('Links | Rechts', split(
      'v',
      0.5,
      textLeaf('{left}', 'left', { font_height_mm: 6.5, max_lines: 3 }),
      textLeaf('{right}', 'right', { font_height_mm: 6.5, max_lines: 3 }),
      { gutter_mm: 1, divider: true },
    )),
  },
  {
    id: 'general-cable-flag-repeat',
    name: 'Kabelfahne · gleicher Text',
    description: 'Derselbe Text auf beiden Seiten mit 10 mm freier Wickelzone.',
    tags: ['allgemein', 'kabel', 'fahne'],
    target,
    variables: [
      { name: 'text', label: 'Beschriftung', type: 'textarea', rows: 3, mode: 'required', placeholder: 'Router · Port 4' },
    ],
    sampleData: { text: 'ROUTER\nPORT 4' },
    template: doc('Kabelfahne · gleicher Text', split(
      'v',
      0.5,
      textLeaf('{text}', 'left', { font_height_mm: 5.5, max_lines: 3 }),
      textLeaf('{text}', 'right', { font_height_mm: 5.5, max_lines: 3 }),
      { gutter_mm: 10, divider: true, thickness_mm: 0.2 },
    )),
  },
  {
    id: 'general-cable-flag-ends',
    name: 'Kabelfahne · zwei Seiten',
    description: 'Unterschiedliche Texte für Quelle und Ziel mit freier Wickelzone.',
    tags: ['allgemein', 'kabel', 'fahne'],
    target,
    variables: [
      { name: 'left', label: 'Linke Seite', type: 'text', mode: 'required', placeholder: 'Patchpanel A-12' },
      { name: 'right', label: 'Rechte Seite', type: 'text', mode: 'required', placeholder: 'Switch Port 08' },
    ],
    sampleData: { left: 'PATCHPANEL\nA-12', right: 'SWITCH\nPORT 08' },
    template: doc('Kabelfahne · zwei Seiten', split(
      'v',
      0.5,
      textLeaf('{left}', 'left', { font_height_mm: 4.8, max_lines: 3 }),
      textLeaf('{right}', 'right', { font_height_mm: 4.8, max_lines: 3 }),
      { gutter_mm: 10, divider: true, thickness_mm: 0.2 },
    )),
  },
  {
    id: 'general-two-up',
    name: '2er-Nutzen',
    description: 'Zwei unabhängige kleine Etiketten mit einer Schnittlinie.',
    tags: ['allgemein', 'mehrfach', 'schnittlinie'],
    target,
    variables: [
      { name: 'first', label: 'Etikett links', type: 'text', mode: 'required', placeholder: 'Kiste A' },
      { name: 'second', label: 'Etikett rechts', type: 'text', mode: 'required', placeholder: 'Kiste B' },
    ],
    sampleData: { first: 'KISTE A', second: 'KISTE B' },
    template: doc('2er-Nutzen', split(
      'v',
      0.5,
      textLeaf('{first}', 'first', { font_height_mm: 6, max_lines: 3 }),
      textLeaf('{second}', 'second', { font_height_mm: 6, max_lines: 3 }),
      { gutter_mm: 0.5, divider: true, thickness_mm: 0.2 },
    )),
  },
  {
    id: 'general-four-up',
    name: '4er-Nutzen',
    description: 'Vier unabhängige Mini-Etiketten mit horizontalen und vertikalen Schnittlinien.',
    tags: ['allgemein', 'mehrfach', 'schnittlinie'],
    target,
    variables: [
      { name: 'text_1', label: 'Text oben links', type: 'text', mode: 'required', placeholder: 'M3' },
      { name: 'text_2', label: 'Text oben rechts', type: 'text', mode: 'required', placeholder: 'M4' },
      { name: 'text_3', label: 'Text unten links', type: 'text', mode: 'required', placeholder: 'M5' },
      { name: 'text_4', label: 'Text unten rechts', type: 'text', mode: 'required', placeholder: 'M6' },
    ],
    sampleData: { text_1: 'M3', text_2: 'M4', text_3: 'M5', text_4: 'M6' },
    template: doc('4er-Nutzen', split(
      'v',
      0.5,
      split(
        'h',
        0.5,
        textLeaf('{text_1}', 'top_left', { font_height_mm: 5.5, max_lines: 2 }),
        textLeaf('{text_3}', 'bottom_left', { font_height_mm: 5.5, max_lines: 2 }),
        { gutter_mm: 0.5, divider: true, thickness_mm: 0.2 },
      ),
      split(
        'h',
        0.5,
        textLeaf('{text_2}', 'top_right', { font_height_mm: 5.5, max_lines: 2 }),
        textLeaf('{text_4}', 'bottom_right', { font_height_mm: 5.5, max_lines: 2 }),
        { gutter_mm: 0.5, divider: true, thickness_mm: 0.2 },
      ),
      { gutter_mm: 0.5, divider: true, thickness_mm: 0.2 },
    )),
  },
  {
    id: 'general-title-detail',
    name: 'Titel + Detailfeld',
    description: 'Großer Titel mit einer kompakten Kennung, einem Datum oder Status rechts.',
    tags: ['allgemein', 'text', 'kennung'],
    target,
    variables: [
      { name: 'title', label: 'Titel', type: 'text', mode: 'required', placeholder: 'Ersatzteile' },
      { name: 'tag', label: 'Detail', type: 'text', mode: 'required', placeholder: 'B-17' },
    ],
    sampleData: { title: 'ERSATZTEILE', tag: 'B-17' },
    template: doc('Titel + Detailfeld', split(
      'v',
      0.72,
      textLeaf('{title}', 'title', { font_height_mm: 7, max_lines: 2 }),
      textLeaf('{tag}', 'tag', { font_height_mm: 6, max_lines: 3 }),
      { gutter_mm: 0.8, divider: true },
    )),
  },
]
