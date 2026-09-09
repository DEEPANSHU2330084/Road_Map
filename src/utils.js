export const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function walk(node, fn, parent = null) {
  if (!node) return;
  fn(node, parent);
  (node.children || []).forEach(child => walk(child, fn, node));
}

export function findNode(root, id) {
  let found = null;
  walk(root, node => { if (node.id === id) found = node; });
  return found;
}

export function updateNode(root, id, updater) {
  if (root.id === id) return updater(root);
  return {
    ...root,
    children: (root.children || []).map(child => updateNode(child, id, updater))
  };
}

export function addChild(root, parentId, child) {
  return updateNode(root, parentId, node => ({
    ...node,
    children: [...(node.children || []), child]
  }));
}

export function deleteNode(root, id) {
  return {
    ...root,
    children: (root.children || [])
      .filter(child => child.id !== id)
      .map(child => deleteNode(child, id))
  };
}

export function countProblems(root) {
  let total = 0, solved = 0;
  walk(root, node => {
    for (const p of node.page?.problems || []) {
      total++;
      if (p.solved) solved++;
    }
  });
  return { total, solved };
}

export function progressOf(node) {
  const ps = node.page?.problems || [];
  if (!ps.length) return 0;
  return Math.round(ps.filter(p => p.solved).length / ps.length * 100);
}

export function collectNodes(root) {
  const result = [];
  walk(root, node => { if (node.id !== root.id) result.push(node); });
  return result;
}