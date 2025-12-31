import type { LeafNode, Node, SplitNode } from './types'

export type NodeEntry = {
  nodeId: string
  kind: Node['kind']
  alias?: string
  depth: number
  node: Node
}

export function listNodes(root: Node): NodeEntry[] {
  const out: NodeEntry[] = []
  const walk = (node: Node, nodeId: string, depth: number) => {
    out.push({ nodeId, kind: node.kind, alias: (node as any).alias, depth, node })
    if (node.kind === 'split') {
      walk(node.children[0], `${nodeId}/0`, depth + 1)
      walk(node.children[1], `${nodeId}/1`, depth + 1)
    }
  }
  walk(root, 'r', 0)
  return out
}

export function getNodeById(root: Node, nodeId: string): Node | null {
  if (nodeId === 'r') return root
  const parts = nodeId.split('/').slice(1)
  let cur: Node = root
  for (const p of parts) {
    if (cur.kind !== 'split') return null
    if (p === '0') cur = cur.children[0]
    else if (p === '1') cur = cur.children[1]
    else return null
  }
  return cur
}

export function updateNodeById(root: Node, nodeId: string, updater: (node: Node) => Node): Node {
  if (nodeId === 'r') return updater(root)

  const parts = nodeId.split('/').slice(1)
  const walk = (node: Node, idx: number): Node => {
    if (idx >= parts.length) return updater(node)
    const step = parts[idx]
    if (node.kind !== 'split') return node
    const left = node.children[0]
    const right = node.children[1]
    if (step === '0') {
      const newLeft = walk(left, idx + 1)
      if (newLeft === left) return node
      return { ...node, children: [newLeft, right] }
    }
    if (step === '1') {
      const newRight = walk(right, idx + 1)
      if (newRight === right) return node
      return { ...node, children: [left, newRight] }
    }
    return node
  }
  return walk(root, 0)
}

export function isLeaf(node: Node): node is LeafNode {
  return node.kind === 'leaf'
}

export function isSplit(node: Node): node is SplitNode {
  return node.kind === 'split'
}
