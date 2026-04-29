import React, { useState, useMemo } from 'react';
import type { LinkItem, Category } from '../types';
import { getDescendantCategoryIds } from '../services/categoryTree';
import type { FlatCategory } from '../services/categoryTree';

interface UseBatchSelectionParams {
  links: LinkItem[];
  categories: Category[];
  selectedCategory: string;
  flatCategories: FlatCategory[];
  displayedLinks: LinkItem[];
  currentChildCategories: Category[];
  authToken: string;
  updateData: (links: LinkItem[], categories: Category[]) => void;
  setSelectedCategory: (id: string) => void;
  setIsAuthOpen: (open: boolean) => void;
}

export function useBatchSelection({
  links,
  categories,
  selectedCategory,
  flatCategories,
  displayedLinks,
  currentChildCategories,
  authToken,
  updateData,
  setSelectedCategory,
  setIsAuthOpen,
}: UseBatchSelectionParams) {
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [batchActionMenuOpen, setBatchActionMenuOpen] = useState(false);

  const selectedItemCount = selectedLinks.size + selectedCategories.size;
  const isBatchSelectionActive = selectedItemCount > 0;

  const currentSelectableLinkIds = useMemo(() => displayedLinks.map(link => link.id), [displayedLinks]);
  const currentSelectableCategoryIds = useMemo(() => currentChildCategories.map(category => category.id), [currentChildCategories]);
  const isAllCurrentSelected = (
    (currentSelectableLinkIds.length > 0 || currentSelectableCategoryIds.length > 0) &&
    currentSelectableLinkIds.every(id => selectedLinks.has(id)) &&
    currentSelectableCategoryIds.every(id => selectedCategories.has(id))
  );
  const batchMoveTargetOptions = useMemo(() => {
    const blockedIds = new Set<string>();
    selectedCategories.forEach(categoryId => {
      getDescendantCategoryIds(categories, categoryId).forEach(id => blockedIds.add(id));
    });

    return flatCategories.filter(({ category }) => {
      if (blockedIds.has(category.id)) return false;
      if (selectedCategories.size > 0 && category.id === 'common') return false;
      return true;
    });
  }, [categories, flatCategories, selectedCategories]);

  const clearBatchSelection = () => {
    setSelectedLinks(new Set());
    setSelectedCategories(new Set());
    setBatchActionMenuOpen(false);
  };

  const toggleLinkSelection = (linkId: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linkId)) {
        newSet.delete(linkId);
      } else {
        newSet.add(linkId);
      }
      return newSet;
    });
  };

  const toggleCategorySelection = (categoryId: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (isAllCurrentSelected) {
      clearBatchSelection();
      return;
    }

    setSelectedLinks(new Set(currentSelectableLinkIds));
    setSelectedCategories(new Set(currentSelectableCategoryIds));
  };

  const handleBatchDelete = () => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (selectedItemCount === 0) {
      alert('请先选择要删除的项目');
      return;
    }

    const deletingCategoryIds = new Set<string>();
    selectedCategories.forEach(categoryId => {
      getDescendantCategoryIds(categories, categoryId).forEach(id => deletingCategoryIds.add(id));
    });
    const affectedLinkCount = links.filter(link => selectedLinks.has(link.id) || deletingCategoryIds.has(link.categoryId)).length;
    const message = `确定删除选中的 ${selectedItemCount} 项吗？${deletingCategoryIds.size > 0 ? `\n将同时删除 ${deletingCategoryIds.size} 个文件夹及其中 ${affectedLinkCount} 个书签。` : ''}`;

    if (confirm(message)) {
      const newLinks = links.filter(link => !selectedLinks.has(link.id) && !deletingCategoryIds.has(link.categoryId));
      const newCategories = categories.filter(category => !deletingCategoryIds.has(category.id));
      updateData(newLinks, newCategories);
      if (deletingCategoryIds.has(selectedCategory)) {
        setSelectedCategory('common');
      }
      clearBatchSelection();
    }
  };

  const handleBatchMove = (targetCategoryId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (selectedItemCount === 0) {
      alert('请先选择要移动的项目');
      return;
    }

    const blockedTargetIds = new Set<string>();
    selectedCategories.forEach(categoryId => {
      getDescendantCategoryIds(categories, categoryId).forEach(id => blockedTargetIds.add(id));
    });
    if (blockedTargetIds.has(targetCategoryId)) {
      alert('不能移动到选中文件夹自身或其子文件夹中');
      return;
    }

    const newLinks = links.map(link =>
      selectedLinks.has(link.id) ? { ...link, categoryId: targetCategoryId } : link
    );
    const newCategories = categories.map(category =>
      selectedCategories.has(category.id)
        ? { ...category, parentId: targetCategoryId }
        : category
    );
    updateData(newLinks, newCategories);
    clearBatchSelection();
  };

  const handleBatchCopyLinks = (targetCategoryId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (selectedLinks.size === 0) {
      alert('请选择要复制的书签');
      return;
    }

    const now = Date.now();
    const copiedLinks = links
      .filter(link => selectedLinks.has(link.id))
      .map((link, index) => ({
        ...link,
        id: `${now}-${index}-${link.id}`,
        categoryId: targetCategoryId,
        createdAt: now + index,
        order: undefined,
      }));

    updateData([...links, ...copiedLinks], categories);
    clearBatchSelection();
  };

  return {
    selectedLinks,
    selectedCategories,
    batchActionMenuOpen,
    setBatchActionMenuOpen,
    selectedItemCount,
    isBatchSelectionActive,
    isAllCurrentSelected,
    currentSelectableLinkIds,
    currentSelectableCategoryIds,
    batchMoveTargetOptions,
    clearBatchSelection,
    toggleLinkSelection,
    toggleCategorySelection,
    handleSelectAll,
    handleBatchDelete,
    handleBatchMove,
    handleBatchCopyLinks,
  };
}
