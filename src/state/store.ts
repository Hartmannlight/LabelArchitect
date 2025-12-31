import { create } from 'zustand'
import type { LabelPreviewTarget, TemplateDoc } from '../model/types'
import { validateTemplate } from '../model/schema'
import { listNodes } from '../model/ids'
import { makeHistory, push, redo, reset, undo, type HistoryState } from './history'
import * as ops from './operations'

export type Tool =
  | 'select'
  | 'split_v'
  | 'split_h'
  | 'place_text'
  | 'place_qr'
  | 'place_dm'
  | 'place_line'
  | 'place_image'

export type Selection = { nodeId: string } | null

export type EditorSettings = {
  scalePxPerMm: number
  snapPercentStep: number
  previewZoom: number
  previewUnit: 'mm' | 'in'
}

export type Theme = 'dark' | 'light'

export type TemplateEditorState = {
  history: HistoryState
  selection: Selection
  tool: Tool
  preview: LabelPreviewTarget
  settings: EditorSettings
  theme: Theme
  validationIssues: string[]

  newTemplate: () => void
  setTool: (tool: Tool) => void
  selectNode: (nodeId: string | null) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void

  setTemplateName: (name: string) => void
  setDefaultsRaw: (defaults: any) => void

  splitLeafAt: (nodeId: string, direction: 'v' | 'h') => void
  unsplitAt: (nodeId: string) => void
  splitSelected: (direction: 'v' | 'h') => void
  unsplitSelected: () => void

  setSplitRatio: (nodeId: string, ratio: number) => void
  setSplitGutter: (nodeId: string, gutterMm: number) => void
  setSplitDividerVisible: (nodeId: string, visible: boolean) => void
  setSplitDividerThickness: (nodeId: string, thicknessMm: number) => void

  setAlias: (nodeId: string, alias: string) => void
  clearAlias: (nodeId: string) => void

  setLeafPadding: (nodeId: string, padding: [number, number, number, number] | undefined) => void
  setLeafDebugBorder: (nodeId: string, value: boolean) => void

  placeElementOnLeaf: (nodeId: string, type: 'text' | 'qr' | 'datamatrix' | 'line' | 'image') => void
  patchElement: (nodeId: string, patch: any) => void

  setPreviewTarget: (preview: Partial<LabelPreviewTarget>) => void
  setSettings: (settings: Partial<EditorSettings>) => void

  undo: () => void
  redo: () => void

  importJson: (text: string) => { ok: true } | { ok: false; issues: string[] }
}

function defaultDoc(): TemplateDoc {
  return {
    schema_version: 1,
    name: 'New template',
    defaults: {
      leaf_padding_mm: [0.375, 0.375, 0.375, 0.375],
      text: {
        font_height_mm: 4.0,
        wrap: 'word',
        fit: 'shrink_to_fit',
        max_lines: 1,
        align_h: 'left',
        align_v: 'top'
      },
      code2d: { quiet_zone_mm: 1.0, render_mode: 'zpl' },
      image: {
        fit: 'contain',
        align_h: 'center',
        align_v: 'center',
        input_dpi: 203,
        threshold: 128,
        dither: 'none',
        invert: false
      },
      render: { missing_variables: 'error', emit_ci28: true }
    },
    layout: {
      kind: 'leaf',
      alias: 'root',
      debug_border: false,
      elements: [{ type: 'text', text: '' }]
    }
  }
}

const TEMPLATE_STORAGE_KEY = 'zplgrid_template_v1'
const THEME_STORAGE_KEY = 'zplgrid_theme_v1'
const PREVIEW_STORAGE_KEY = 'zplgrid_preview_v1'

function loadStoredDoc(): TemplateDoc | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const res = validateTemplate(parsed)
    return res.ok ? res.doc : null
  } catch {
    return null
  }
}

function saveStoredDoc(doc: TemplateDoc) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(doc))
  } catch {
    // Ignore storage write errors (e.g. quota).
  }
}

function loadStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return raw === 'dark' || raw === 'light' ? raw : null
  } catch {
    return null
  }
}

function loadStoredPreview(): LabelPreviewTarget | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const width = Number(parsed?.width_mm)
    const height = Number(parsed?.height_mm)
    const dpi = Number(parsed?.dpi)
    if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(dpi)) return null
    return {
      width_mm: Math.max(1, width),
      height_mm: Math.max(1, height),
      dpi: Math.max(1, dpi)
    }
  } catch {
    return null
  }
}

function saveStoredTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore storage write errors (e.g. quota).
  }
}

function saveStoredPreview(preview: LabelPreviewTarget) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(preview))
  } catch {
    // Ignore storage write errors (e.g. quota).
  }
}

function validate(doc: TemplateDoc): string[] {
  const res = validateTemplate(doc)
  if (!res.ok) return res.issues
  return []
}

export const useTemplateEditorStore = create<TemplateEditorState>((set, get) => {
  const initial = loadStoredDoc() ?? defaultDoc()
  const initialTheme = loadStoredTheme() ?? 'dark'
  const initialPreview = loadStoredPreview() ?? { width_mm: 74, height_mm: 26, dpi: 203 }
  return {
    history: makeHistory(initial),
    selection: { nodeId: 'r' },
    tool: 'select',
    preview: initialPreview,
    settings: { scalePxPerMm: 8, snapPercentStep: 5, previewZoom: 1, previewUnit: 'mm' },
    theme: initialTheme,
    validationIssues: validate(initial),

    newTemplate: () => {
      const next = defaultDoc()
      const h = reset(get().history, next)
      set({ history: h, selection: { nodeId: 'r' }, validationIssues: validate(next) })
    },

    setTool: (tool) => set({ tool }),
    selectNode: (nodeId) => set({ selection: nodeId ? { nodeId } : null }),
    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

    setTemplateName: (name) => {
      const h = get().history
      const next = ops.setTemplateName(h.present, name)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setDefaultsRaw: (defaults) => {
      const h = get().history
      const next = ops.setDefaults(h.present, defaults)
      set({ history: push(h, next), validationIssues: validate(next) })
    },


    splitLeafAt: (nodeId, direction) => {
      const h = get().history
      const next = ops.splitLeaf(h.present, nodeId, direction)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    unsplitAt: (nodeId) => {
      const h = get().history
      const next = ops.unsplit(h.present, nodeId)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    splitSelected: (direction) => {
      const sel = get().selection
      if (!sel) return
      get().splitLeafAt(sel.nodeId, direction)
    },

    unsplitSelected: () => {
      const sel = get().selection
      if (!sel) return
      get().unsplitAt(sel.nodeId)
    },

    setSplitRatio: (nodeId, ratio) => {
      const h = get().history
      const next = ops.setSplitRatio(h.present, nodeId, ratio)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setSplitGutter: (nodeId, gutterMm) => {
      const h = get().history
      const cur = h.present
      const node = listNodes(cur.layout).find((n) => n.nodeId === nodeId)?.node
      if (!node || node.kind !== 'split') return
      let nextGutter = gutterMm
      if (node.divider?.visible) {
        const thickness = node.divider.thickness_mm ?? 0.3
        if (nextGutter < thickness) nextGutter = thickness
      }
      const next = ops.setSplitGutter(cur, nodeId, nextGutter)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setSplitDividerVisible: (nodeId, visible) => {
      const h = get().history
      const cur = h.present
      const node = listNodes(cur.layout).find((n) => n.nodeId === nodeId)?.node
      if (!node || node.kind !== 'split') return
      const divider = { ...(node.divider ?? { visible: false, thickness_mm: 0.3 }), visible }
      let next = ops.setSplitDivider(cur, nodeId, divider)
      if (visible) {
        const gutter = node.gutter_mm ?? 0
        const thickness = divider.thickness_mm ?? 0.3
        if (gutter < thickness) {
          next = ops.setSplitGutter(next, nodeId, thickness)
        }
      }
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setSplitDividerThickness: (nodeId, thicknessMm) => {
      const h = get().history
      const cur = h.present
      const node = listNodes(cur.layout).find((n) => n.nodeId === nodeId)?.node
      if (!node || node.kind !== 'split') return
      const divider = { ...(node.divider ?? { visible: false, thickness_mm: 0.3 }), thickness_mm: thicknessMm }
      let next = ops.setSplitDivider(cur, nodeId, divider)
      if (divider.visible) {
        const gutter = node.gutter_mm ?? 0
        if (gutter < thicknessMm) {
          next = ops.setSplitGutter(next, nodeId, thicknessMm)
        }
      }
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setAlias: (nodeId, alias) => {
      const h = get().history
      const next = ops.setNodeAlias(h.present, nodeId, alias || undefined)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    clearAlias: (nodeId) => {
      const h = get().history
      const next = ops.setNodeAlias(h.present, nodeId, undefined)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setLeafPadding: (nodeId, padding) => {
      const h = get().history
      const next = ops.setLeafPadding(h.present, nodeId, padding)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setLeafDebugBorder: (nodeId, value) => {
      const h = get().history
      const next = ops.toggleLeafDebugBorder(h.present, nodeId, value)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    placeElementOnLeaf: (nodeId, type) => {
      const h = get().history
      const next = ops.setLeafElement(h.present, nodeId, ops.makeDefaultElement(type))
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    patchElement: (nodeId, patch) => {
      const h = get().history
      const next = ops.updateLeafElement(h.present, nodeId, patch)
      set({ history: push(h, next), validationIssues: validate(next) })
    },

    setPreviewTarget: (preview) => set({ preview: { ...get().preview, ...preview } }),
    setSettings: (settings) => set({ settings: { ...get().settings, ...settings } }),

    undo: () => {
      const h = undo(get().history)
      set({ history: h, validationIssues: validate(h.present) })
    },

    redo: () => {
      const h = redo(get().history)
      set({ history: h, validationIssues: validate(h.present) })
    },

    importJson: (text) => {
      try {
        const value = JSON.parse(text)
        const res = validateTemplate(value)
        if (!res.ok) return { ok: false, issues: res.issues }
        const h = reset(get().history, res.doc)
        set({ history: h, selection: { nodeId: 'r' }, validationIssues: validate(res.doc) })
        return { ok: true }
      } catch (e: any) {
        return { ok: false, issues: [String(e?.message ?? e)] }
      }
    }
  }
})

useTemplateEditorStore.subscribe((state, prev) => {
  if (state.history.present !== prev.history.present) {
    saveStoredDoc(state.history.present)
  }
  if (state.theme !== prev.theme) {
    saveStoredTheme(state.theme)
  }
  if (state.preview !== prev.preview) {
    saveStoredPreview(state.preview)
  }
})
