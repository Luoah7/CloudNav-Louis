import type { Category } from '../types';

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface FlatCategory {
  category: Category;
  depth: number;
  path: string;
}

const COMMON_CATEGORY: Category = { id: 'common', name: '常用推荐', icon: 'Star' };

const categorySort = (a: Category, b: Category) => {
  if (a.id === 'common') return -1;
  if (b.id === 'common') return 1;
  return 0;
};

export const normalizeCategories = (categories: Category[]): Category[] => {
  const source = categories.length ? categories : [COMMON_CATEGORY];
  const hasCommon = source.some(cat => cat.id === 'common');
  const withCommon = hasCommon ? source : [COMMON_CATEGORY, ...source];
  const ids = new Set(withCommon.map(cat => cat.id));

  const wouldCreateCycle = (categoryId: string, parentId: string | undefined) => {
    let current = parentId;
    const visited = new Set<string>();

    while (current) {
      if (current === categoryId || visited.has(current)) return true;
      visited.add(current);
      current = withCommon.find(cat => cat.id === current)?.parentId;
    }

    return false;
  };

  return withCommon
    .map(cat => {
      const parentId = cat.id === 'common' ? undefined : cat.parentId;
      const validParentId =
        parentId && ids.has(parentId) && parentId !== 'common' && !wouldCreateCycle(cat.id, parentId)
          ? parentId
          : undefined;

      const normalized: Category = {
        ...cat,
        parentId: validParentId,
      };

      if (!normalized.parentId) {
        delete normalized.parentId;
      }

      return normalized;
    })
    .sort(categorySort);
};

export const buildCategoryTree = (categories: Category[]): CategoryTreeNode[] => {
  const normalized = normalizeCategories(categories);
  const nodeMap = new Map<string, CategoryTreeNode>();

  normalized.forEach(cat => {
    nodeMap.set(cat.id, { ...cat, children: [] });
  });

  const roots: CategoryTreeNode[] = [];

  normalized.forEach(cat => {
    const node = nodeMap.get(cat.id);
    if (!node) return;

    if (cat.parentId && nodeMap.has(cat.parentId)) {
      nodeMap.get(cat.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

export const getDescendantCategoryIds = (
  categories: Category[],
  categoryId: string,
  includeSelf = true
): string[] => {
  const normalized = normalizeCategories(categories);
  const childrenByParent = new Map<string, Category[]>();

  normalized.forEach(cat => {
    if (!cat.parentId) return;
    const children = childrenByParent.get(cat.parentId) || [];
    children.push(cat);
    childrenByParent.set(cat.parentId, children);
  });

  const result: string[] = includeSelf ? [categoryId] : [];
  const visit = (id: string) => {
    (childrenByParent.get(id) || []).forEach(child => {
      result.push(child.id);
      visit(child.id);
    });
  };

  visit(categoryId);
  return result;
};

export const isDescendantCategory = (
  categories: Category[],
  ancestorId: string,
  categoryId: string
) => getDescendantCategoryIds(categories, ancestorId).includes(categoryId);

export const getCategoryPath = (categories: Category[], categoryId: string, separator = ' / ') => {
  const normalized = normalizeCategories(categories);
  const map = new Map(normalized.map(cat => [cat.id, cat]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current = map.get(categoryId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }

  return names.join(separator);
};

export const getAncestorCategoryIds = (categories: Category[], categoryId: string): string[] => {
  const normalized = normalizeCategories(categories);
  const map = new Map(normalized.map(cat => [cat.id, cat]));
  const ancestors: string[] = [];
  const visited = new Set<string>();
  let current = map.get(categoryId);

  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    ancestors.unshift(current.parentId);
    current = map.get(current.parentId);
  }

  return ancestors;
};

export const flattenCategoryTree = (
  categories: Category[],
  options: { excludeIds?: Set<string>; includeCommon?: boolean } = {}
): FlatCategory[] => {
  const { excludeIds = new Set<string>(), includeCommon = true } = options;
  const result: FlatCategory[] = [];

  const visit = (nodes: CategoryTreeNode[], depth: number) => {
    nodes.forEach(node => {
      if ((!includeCommon && node.id === 'common') || excludeIds.has(node.id)) {
        return;
      }

      result.push({
        category: node,
        depth,
        path: getCategoryPath(categories, node.id),
      });

      visit(node.children, depth + 1);
    });
  };

  visit(buildCategoryTree(categories), 0);
  return result;
};
