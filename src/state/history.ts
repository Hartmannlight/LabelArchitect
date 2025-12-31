import type { TemplateDoc } from '../model/types'

export type HistoryState = {
  past: TemplateDoc[]
  present: TemplateDoc
  future: TemplateDoc[]
}

export function makeHistory(present: TemplateDoc): HistoryState {
  return { past: [], present, future: [] }
}

export function push(history: HistoryState, next: TemplateDoc): HistoryState {
  if (history.present === next) return history
  return { past: [...history.past, history.present], present: next, future: [] }
}

export function undo(history: HistoryState): HistoryState {
  const last = history.past.at(-1)
  if (!last) return history
  return { past: history.past.slice(0, -1), present: last, future: [history.present, ...history.future] }
}

export function redo(history: HistoryState): HistoryState {
  const next = history.future[0]
  if (!next) return history
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) }
}

export function reset(history: HistoryState, present: TemplateDoc): HistoryState {
  return { past: [], present, future: [] }
}
