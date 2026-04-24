import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Edit2, FolderPlus, GripVertical, Lock, Trash2, X } from 'lucide-react';
import type { Category } from '../types';
import Icon from './Icon';
import CategoryEditorModal from './CategoryEditorModal';
import CategoryDeleteModal, { type DeleteCategoryOptions } from './CategoryDeleteModal';
import {
  buildCategoryTree,
  flattenCategoryTree,
  getDescendantCategoryIds,
  normalizeCategories,
  type CategoryTreeNode,
} from '../services/categoryTree';

const ROOT_KEY = '__root__';

type DropPosition = 'before' | 'after' | 'inside' | 'root';

interface DropInstruction {
  position: DropPosition;
  targetId?: string;
}

interface CategoryEditorState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  category?: Category | null;
  parentId?: string;
}

export interface ManagedCategoryDeleteAction {
  categoryId: string;
  deletedCategoryIds: string[];
  options: DeleteCategoryOptions;
}

export interface CategoryManagerSavePayload {
  categories: Category[];
  deleteActions: ManagedCategoryDeleteAction[];
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSave: (payload: CategoryManagerSavePayload) => void;
}

const buildExpandedIds = (categories: Category[]) => {
  const expanded = new Set<string>();

  const visit = (nodes: CategoryTreeNode[]) => {
    nodes.forEach(node => {
      if (node.children.length > 0) {
        expanded.add(node.id);
        visit(node.children);
      }
    });
  };

  visit(buildCategoryTree(categories));
  return expanded;
};

const serializeCategories = (categories: Category[]) => JSON.stringify(
  normalizeCategories(categories).map(category => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    password: category.password || '',
    parentId: category.parentId || '',
    order: category.order || 0,
  }))
);

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSave,
}) => {
  const [draftCategories, setDraftCategories] = useState<Category[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editorState, setEditorState] = useState<CategoryEditorState>({ isOpen: false, mode: 'create' });
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [pendingDeleteActions, setPendingDeleteActions] = useState<ManagedCategoryDeleteAction[]>([]);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dropInstruction, setDropInstruction] = useState<DropInstruction | null>(null);

  const normalizedSourceCategories = useMemo(() => normalizeCategories(categories), [categories]);
  const sourceSnapshot = useMemo(() => serializeCategories(normalizedSourceCategories), [normalizedSourceCategories]);
  const categoryTree = useMemo(() => buildCategoryTree(draftCategories).filter(node => node.id !== 'common'), [draftCategories]);
  const flatCategories = useMemo(() => flattenCategoryTree(draftCategories, { includeCommon: false }), [draftCategories]);
  const editorParentOptions = useMemo(() => {
    const excludedIds = new Set<string>(['common']);
    if (editorState.mode === 'edit' && editorState.category) {
      getDescendantCategoryIds(draftCategories, editorState.category.id).forEach(id => excludedIds.add(id));
    }

    return flattenCategoryTree(draftCategories, { includeCommon: false, excludeIds: excludedIds }).map(({ category, path }) => ({
      id: category.id,
      path,
    }));
  }, [draftCategories, editorState]);

  useEffect(() => {
    if (!isOpen) return;
    const normalized = normalizeCategories(categories);
    setDraftCategories(normalized);
    setExpandedIds(buildExpandedIds(normalized));
    setPendingDeleteActions([]);
    setDeletingCategory(null);
    setEditorState({ isOpen: false, mode: 'create' });
    setDraggedCategoryId(null);
    setDropInstruction(null);
  }, [categories, isOpen]);

  if (!isOpen) return null;

  const draftSnapshot = serializeCategories(draftCategories);
  const hasUnsavedChanges = draftSnapshot !== sourceSnapshot || pendingDeleteActions.length > 0;

  const closeWithGuard = () => {
    if (hasUnsavedChanges && !window.confirm('目录管理中有未保存的更改，确认放弃吗？')) {
      return;
    }
    onClose();
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const openCreateCategory = (parentId?: string) => {
    setEditorState({ isOpen: true, mode: 'create', parentId });
    if (parentId) {
      setExpandedIds(prev => new Set(prev).add(parentId));
    }
  };

  const openEditCategory = (category: Category) => {
    if (category.id === 'common') return;
    setEditorState({ isOpen: true, mode: 'edit', category });
  };

  const closeEditor = () => {
    setEditorState({ isOpen: false, mode: 'create' });
  };

  const handleSaveCategory = (data: { name: string; icon: string; password?: string; parentId?: string }) => {
    setDraftCategories(prev => {
      if (editorState.mode === 'edit' && editorState.category) {
        return normalizeCategories(prev.map(category => (
          category.id === editorState.category?.id
            ? {
                ...category,
                ...data,
                order: category.parentId !== data.parentId ? undefined : category.order,
              }
            : category
        )));
      }

      const newCategory: Category = {
        id: `cat_${Date.now()}`,
        name: data.name,
        icon: data.icon,
        password: data.password,
        parentId: data.parentId,
      };

      return normalizeCategories([...prev, newCategory]);
    });

    if (data.parentId) {
      setExpandedIds(prev => new Set(prev).add(data.parentId!));
    }

    closeEditor();
  };

  const handleConfirmDelete = (categoryId: string, options: DeleteCategoryOptions) => {
    const deletedCategoryIds = getDescendantCategoryIds(draftCategories, categoryId);
    const deletedIdSet = new Set(deletedCategoryIds);

    setDraftCategories(prev => normalizeCategories(prev.filter(category => !deletedIdSet.has(category.id))));
    setPendingDeleteActions(prev => {
      const remaining = prev.filter(action => !action.deletedCategoryIds.some(id => deletedIdSet.has(id)));
      return [...remaining, { categoryId, deletedCategoryIds, options }];
    });
    setDeletingCategory(null);
  };

  const createOrderedChildrenMap = (sourceCategories: Category[]) => {
    const orderedChildren = new Map<string, string[]>();

    const visit = (nodes: CategoryTreeNode[], parentId?: string) => {
      const parentKey = parentId || ROOT_KEY;
      orderedChildren.set(
        parentKey,
        nodes
          .filter(node => !(parentId === undefined && node.id === 'common'))
          .map(node => node.id)
      );

      nodes.forEach(node => visit(node.children, node.id));
    };

    visit(buildCategoryTree(sourceCategories));
    return orderedChildren;
  };

  const moveCategory = (instruction: DropInstruction) => {
    if (!draggedCategoryId) return;

    setDraftCategories(prev => {
      const normalized = normalizeCategories(prev);
      const categoryMap = new Map(normalized.map(category => [category.id, { ...category }]));
      const dragged = categoryMap.get(draggedCategoryId);
      if (!dragged || dragged.id === 'common') return prev;

      if (instruction.targetId) {
        const invalidTargetIds = new Set(getDescendantCategoryIds(normalized, draggedCategoryId));
        if (invalidTargetIds.has(instruction.targetId)) {
          return prev;
        }
      }

      const orderedChildren = createOrderedChildrenMap(normalized);
      const getOrderedChildren = (parentId?: string) => [...(orderedChildren.get(parentId || ROOT_KEY) || [])];
      const oldParentId = dragged.parentId;
      const oldParentKey = oldParentId || ROOT_KEY;
      const oldSiblingIds = getOrderedChildren(oldParentId).filter(id => id !== draggedCategoryId);

      let newParentId: string | undefined;
      let newSiblingIds: string[];

      if (instruction.position === 'root') {
        newParentId = undefined;
        newSiblingIds = [...getOrderedChildren(undefined).filter(id => id !== draggedCategoryId), draggedCategoryId];
      } else {
        const target = instruction.targetId ? categoryMap.get(instruction.targetId) : undefined;
        if (!target) return prev;

        if (instruction.position === 'inside') {
          newParentId = target.id;
          newSiblingIds = [...getOrderedChildren(target.id).filter(id => id !== draggedCategoryId), draggedCategoryId];
        } else {
          newParentId = target.parentId;
          newSiblingIds = getOrderedChildren(newParentId).filter(id => id !== draggedCategoryId);
          const targetIndex = newSiblingIds.indexOf(target.id);
          if (targetIndex === -1) return prev;
          const insertIndex = instruction.position === 'before' ? targetIndex : targetIndex + 1;
          newSiblingIds.splice(insertIndex, 0, draggedCategoryId);
        }
      }

      dragged.parentId = newParentId;
      if (!newParentId) {
        delete dragged.parentId;
      }

      const applyOrders = (parentId: string | undefined, siblingIds: string[]) => {
        siblingIds.forEach((id, index) => {
          const category = categoryMap.get(id);
          if (!category) return;
          category.order = index + 1;
        });
      };

      if ((newParentId || ROOT_KEY) === oldParentKey) {
        applyOrders(newParentId, newSiblingIds);
      } else {
        applyOrders(oldParentId, oldSiblingIds);
        applyOrders(newParentId, newSiblingIds);
      }

      const commonCategory = categoryMap.get('common');
      if (commonCategory) {
        commonCategory.order = 0;
      }

      return normalizeCategories(Array.from(categoryMap.values()));
    });

    setDraggedCategoryId(null);
    setDropInstruction(null);
  };

  const handleRowDragOver = (event: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    if (!draggedCategoryId || draggedCategoryId === categoryId) return;
    const invalidTargetIds = new Set(getDescendantCategoryIds(draftCategories, draggedCategoryId));
    if (invalidTargetIds.has(categoryId)) return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const ratio = rect.height ? offsetY / rect.height : 0;

    let position: DropPosition = 'inside';
    if (ratio < 0.25) {
      position = 'before';
    } else if (ratio > 0.75) {
      position = 'after';
    }

    setDropInstruction({ targetId: categoryId, position });
  };

  const handleRootDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggedCategoryId) return;
    event.preventDefault();
    setDropInstruction({ position: 'root' });
  };

  const handleDragEnd = () => {
    setDraggedCategoryId(null);
    setDropInstruction(null);
  };

  const renderRows = (nodes: CategoryTreeNode[], depth = 0): React.ReactNode => (
    nodes.map(node => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);
      const isDragging = draggedCategoryId === node.id;
      const isDropTarget = dropInstruction?.targetId === node.id;
      const showDropBefore = isDropTarget && dropInstruction?.position === 'before';
      const showDropAfter = isDropTarget && dropInstruction?.position === 'after';
      const showDropInside = isDropTarget && dropInstruction?.position === 'inside';

      return (
        <div key={node.id} className="space-y-1">
          <div
            className={`relative rounded-xl border transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-50/80 opacity-70 dark:border-blue-500/40 dark:bg-blue-500/10'
                : 'liquid-section'
            } ${showDropInside ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}`}
            style={{ marginLeft: depth * 16 }}
          >
            {showDropBefore && <div className="absolute left-10 right-4 top-0 h-0.5 rounded-full bg-blue-500" />}
            {showDropAfter && <div className="absolute bottom-0 left-10 right-4 h-0.5 rounded-full bg-blue-500" />}

            <div
              className="flex items-center gap-2 p-3"
              onDragOver={(event) => handleRowDragOver(event, node.id)}
              onDrop={(event) => {
                event.preventDefault();
                if (dropInstruction?.targetId === node.id) {
                  moveCategory(dropInstruction);
                }
              }}
            >
              <button
                type="button"
                onClick={() => hasChildren && toggleExpanded(node.id)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors ${
                  hasChildren ? 'hover:bg-white/70 hover:text-blue-500 dark:hover:bg-white/10' : 'text-transparent'
                }`}
                disabled={!hasChildren}
                aria-label={isExpanded ? '收起目录' : '展开目录'}
              >
                <ChevronRight size={14} className={isExpanded ? 'rotate-90' : ''} />
              </button>

              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggedCategoryId(node.id);
                }}
                onDragEnd={handleDragEnd}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/70 hover:text-blue-500 dark:hover:bg-white/10"
                title="拖拽排序或调整上下级"
              >
                <GripVertical size={15} />
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/75 text-blue-500 dark:border-white/10 dark:bg-white/5">
                  <Icon name={node.icon} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {node.name}
                    </span>
                    {node.password && <Lock size={13} className="shrink-0 text-amber-500" />}
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {hasChildren ? `${node.children.length} 个子目录` : '叶子目录'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openCreateCategory(node.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/70 hover:text-blue-500 dark:hover:bg-white/10"
                  title="新增子目录"
                >
                  <FolderPlus size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => openEditCategory(node)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/70 hover:text-blue-500 dark:hover:bg-white/10"
                  title="编辑目录"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingCategory(node)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  title="删除目录"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="space-y-1">
              {renderRows(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    })
  );

  return (
    <>
      <div className="liquid-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="liquid-panel flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b liquid-divider px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">管理目录</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                仅在此处支持目录拖拽排序和上下级调整，保存后才会生效。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateCategory()}
                className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <FolderPlus size={15} />
                新增一级目录
              </button>
              <button
                type="button"
                onClick={closeWithGuard}
                className="rounded-full p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/70"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {draggedCategoryId && (
              <div
                className={`mb-3 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors ${
                  dropInstruction?.position === 'root'
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400'
                }`}
                onDragOver={handleRootDragOver}
                onDrop={(event) => {
                  event.preventDefault();
                  moveCategory({ position: 'root' });
                }}
              >
                拖到这里，调整为一级目录
              </div>
            )}

            <div className="mb-4 rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              拖到条目上边缘或下边缘可调整同级顺序，拖到条目中间可移入其下作为子目录。
            </div>

            {categoryTree.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400 dark:border-white/10">
                还没有可管理的目录
              </div>
            ) : (
              <div className="space-y-2">
                {renderRows(categoryTree)}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t liquid-divider px-5 py-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {hasUnsavedChanges ? '存在未保存的目录变更' : '当前没有未保存的变更'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeWithGuard}
                className="rounded-xl bg-white/55 px-4 py-2 text-sm text-slate-600 hover:bg-white/80 dark:bg-slate-700/60 dark:text-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => onSave({ categories: draftCategories, deleteActions: pendingDeleteActions })}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Check size={15} />
                保存
              </button>
            </div>
          </div>
        </div>
      </div>

      <CategoryEditorModal
        isOpen={editorState.isOpen}
        mode={editorState.mode}
        category={editorState.category}
        parentId={editorState.parentId}
        parentName={
          editorState.parentId
            ? flatCategories.find(item => item.category.id === editorState.parentId)?.path
            : undefined
        }
        parentOptions={editorParentOptions}
        onClose={closeEditor}
        onSave={handleSaveCategory}
      />

      <CategoryDeleteModal
        isOpen={!!deletingCategory}
        category={deletingCategory}
        categories={draftCategories}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};

export default CategoryManagerModal;
