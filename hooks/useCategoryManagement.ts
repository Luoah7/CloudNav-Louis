import React, { useState, useMemo } from 'react';
import type { Category } from '../types';
import {
  buildCategoryTree,
  flattenCategoryTree,
  getAncestorCategoryIds,
  getDescendantCategoryIds,
} from '../services/categoryTree';
import type { CategoryTreeNode, FlatCategory } from '../services/categoryTree';
import type { CategoryManagerSavePayload } from '../components/CategoryManagerModal';
import type { DeleteCategoryOptions } from '../components/CategoryDeleteModal';

interface UseCategoryManagementParams {
  categories: Category[];
  links: import('../types').LinkItem[];
  selectedCategory: string;
  authToken: string;
  updateData: (links: import('../types').LinkItem[], categories: Category[]) => void;
  setSelectedCategory: (id: string) => void;
  setIsAuthOpen: (open: boolean) => void;
}

export function useCategoryManagement({
  categories,
  links,
  selectedCategory,
  authToken,
  updateData,
  setSelectedCategory,
  setIsAuthOpen,
}: UseCategoryManagementParams) {
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [categoryEditor, setCategoryEditor] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    parentId?: string;
    category?: Category | null;
  }>({ isOpen: false, mode: 'create' });
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [pendingCategoryManagerSave, setPendingCategoryManagerSave] = useState<CategoryManagerSavePayload | null>(null);
  const [commonNameEditorOpen, setCommonNameEditorOpen] = useState(false);
  const [commonNameDraft, setCommonNameDraft] = useState('');

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenCategoryTree(categories), [categories]);

  const categoryEditorParentOptions = useMemo(() => {
    const excludedIds = new Set<string>(['common']);
    if (categoryEditor.mode === 'edit' && categoryEditor.category) {
      getDescendantCategoryIds(categories, categoryEditor.category.id).forEach(id => excludedIds.add(id));
    }
    return flattenCategoryTree(categories, { includeCommon: false, excludeIds: excludedIds }).map(({ category, path }) => ({
      id: category.id,
      path,
    }));
  }, [categories, categoryEditor]);

  const selectedCategoryIds = useMemo(() => (
    selectedCategory !== 'all' && selectedCategory !== 'common'
      ? new Set(getDescendantCategoryIds(categories, selectedCategory))
      : new Set<string>()
  ), [categories, selectedCategory]);

  const currentChildCategories = useMemo(() => {
    const parentId = selectedCategory === 'all' ? undefined : selectedCategory;
    if (selectedCategory === 'common') return [];
    return categories
      .filter(cat => cat.id !== 'common' && cat.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories, selectedCategory]);

  const isCategoryLocked = (catId: string) => {
    const categoryIds = [...getAncestorCategoryIds(categories, catId), catId];
    return categoryIds.some(id => {
      const cat = categories.find(c => c.id === id);
      return !!cat?.password && !unlockedCategoryIds.has(id);
    });
  };

  const commonCategory = categories.find(category => category.id === 'common') || null;
  const commonCategoryName = commonCategory?.name || '常用推荐';

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategoryIds(prev => {
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
    if (!authToken) { setIsAuthOpen(true); return; }
    setCategoryEditor({ isOpen: true, mode: 'create', parentId });
  };

  const openCategoryManager = () => {
    setIsCategoryManagerOpen(true);
  };

  const openEditCategory = (category: Category) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (category.id === 'common') return;
    setCategoryEditor({ isOpen: true, mode: 'edit', category });
  };

  const closeCategoryEditor = () => {
    setCategoryEditor({ isOpen: false, mode: 'create' });
  };

  const handleSaveCategory = (data: { name: string; icon: string; password?: string; parentId?: string }) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (categoryEditor.mode === 'edit' && categoryEditor.category) {
      const updated = categories.map(cat => cat.id === categoryEditor.category?.id
        ? {
            ...cat,
            ...data,
            order: cat.parentId !== data.parentId ? undefined : cat.order,
          }
        : cat
      );
      updateData(links, updated);
    } else {
      const newCategory: Category = {
        id: Date.now().toString(),
        name: data.name,
        icon: data.icon,
        password: data.password,
        parentId: data.parentId || undefined,
      };
      updateData(links, [...categories, newCategory]);
      if (newCategory.parentId) {
        setExpandedCategoryIds(prev => new Set(prev).add(newCategory.parentId!));
      }
    }

    closeCategoryEditor();
  };

  const applyCategoryManagerSave = ({ categories: nextCategories, deleteActions }: CategoryManagerSavePayload) => {
    const validCategoryIds = new Set(nextCategories.map(category => category.id));
    let nextLinks = links;
    let nextSelectedCategory = selectedCategory;

    deleteActions.forEach(action => {
      const deletingIds = new Set(action.deletedCategoryIds);
      if (action.options.mode === 'move') {
        const targetCategoryId = validCategoryIds.has(action.options.targetCategoryId)
          ? action.options.targetCategoryId
          : 'common';
        nextLinks = nextLinks.map(link => deletingIds.has(link.categoryId)
          ? { ...link, categoryId: targetCategoryId }
          : link
        );
      } else {
        nextLinks = nextLinks.filter(link => !deletingIds.has(link.categoryId));
      }

      if (deletingIds.has(nextSelectedCategory)) {
        nextSelectedCategory = 'common';
      }
    });

    if (nextSelectedCategory !== selectedCategory) {
      setSelectedCategory(nextSelectedCategory);
    }

    updateData(nextLinks, nextCategories);
    setIsCategoryManagerOpen(false);
  };

  const handleSaveCategoryManager = (payload: CategoryManagerSavePayload) => {
    if (!authToken) {
      setPendingCategoryManagerSave(payload);
      setIsAuthOpen(true);
      return;
    }
    applyCategoryManagerSave(payload);
  };

  const openDeleteCategory = (category: Category) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (category.id === 'common') return;
    setDeletingCategory(category);
  };

  const handleCategoryClick = (cat: Category) => {
    const lockedCategory = [...getAncestorCategoryIds(categories, cat.id), cat.id]
      .map(id => categories.find(c => c.id === id))
      .find(category => category?.password && !unlockedCategoryIds.has(category.id));

    if (lockedCategory) {
      setCatAuthModalData(lockedCategory);
      return;
    }
    setSelectedCategory(cat.id);
  };

  const handleUnlockCategory = (catId: string) => {
    setUnlockedCategoryIds(prev => new Set(prev).add(catId));
    setSelectedCategory(catId);
  };

  const handleDeleteCategory = (catId: string, options: DeleteCategoryOptions) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (catId === 'common') {
      alert('"常用推荐"分类不能被删除');
      return;
    }

    const deletingIds = new Set(getDescendantCategoryIds(categories, catId));
    let newCats = categories.filter(c => !deletingIds.has(c.id));

    if (!newCats.some(c => c.id === 'common')) {
      newCats = [
        { id: 'common', name: '常用推荐', icon: 'Star' },
        ...newCats,
      ];
    }

    const newLinks = options.mode === 'move'
      ? links.map(l => deletingIds.has(l.categoryId) ? { ...l, categoryId: options.targetCategoryId } : l)
      : links.filter(l => !deletingIds.has(l.categoryId));

    if (deletingIds.has(selectedCategory)) {
      setSelectedCategory('common');
    }

    updateData(newLinks, newCats);
    setDeletingCategory(null);
  };

  const openCommonNameEditor = (event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!authToken) { setIsAuthOpen(true); return; }
    setCommonNameDraft(commonCategoryName);
    setCommonNameEditorOpen(true);
  };

  const handleSaveCommonName = () => {
    if (!authToken) { setIsAuthOpen(true); return; }
    const nextName = commonNameDraft.trim() || '常用推荐';
    const hasCommon = categories.some(category => category.id === 'common');
    const nextCategories = hasCommon
      ? categories.map(category => category.id === 'common' ? { ...category, name: nextName, icon: category.icon || 'Star' } : category)
      : [{ id: 'common', name: nextName, icon: 'Star' }, ...categories];

    updateData(links, nextCategories);
    setCommonNameEditorOpen(false);
  };

  return {
    unlockedCategoryIds,
    expandedCategoryIds,
    setExpandedCategoryIds,
    categoryEditor,
    deletingCategory,
    setDeletingCategory,
    catAuthModalData,
    setCatAuthModalData,
    isCategoryManagerOpen,
    setIsCategoryManagerOpen,
    pendingCategoryManagerSave,
    setPendingCategoryManagerSave,
    commonNameEditorOpen,
    setCommonNameEditorOpen,
    commonNameDraft,
    setCommonNameDraft,
    categoryTree,
    flatCategories,
    categoryEditorParentOptions,
    selectedCategoryIds,
    currentChildCategories,
    isCategoryLocked,
    commonCategory,
    commonCategoryName,
    toggleCategoryExpanded,
    openCreateCategory,
    openCategoryManager,
    openEditCategory,
    closeCategoryEditor,
    handleSaveCategory,
    applyCategoryManagerSave,
    handleSaveCategoryManager,
    openDeleteCategory,
    handleCategoryClick,
    handleUnlockCategory,
    handleDeleteCategory,
    openCommonNameEditor,
    handleSaveCommonName,
  };
}
