import { useState } from 'react';
import {
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { LinkItem, Category } from '../types';

interface UseSortingParams {
  links: LinkItem[];
  categories: Category[];
  selectedCategory: string;
  selectedCategoryIds: Set<string>;
  updateData: (links: LinkItem[], categories: Category[]) => void;
}

export function useSorting({
  links,
  categories,
  selectedCategory,
  selectedCategoryIds,
  updateData,
}: UseSortingParams) {
  const [isSortingMode, setIsSortingMode] = useState<string | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const categoryLinks = links.filter(link =>
        selectedCategory === 'all' ||
        (selectedCategory === 'common'
          ? link.categoryId === 'common' || link.favorite
          : selectedCategoryIds.has(link.categoryId))
      );

      const activeIndex = categoryLinks.findIndex(link => link.id === active.id);
      const overIndex = categoryLinks.findIndex(link => link.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const reorderedCategoryLinks = arrayMove<LinkItem>(categoryLinks, activeIndex, overIndex);

        const updatedLinks = links.map(link => {
          const reorderedIndex = reorderedCategoryLinks.findIndex(l => l.id === link.id);
          if (reorderedIndex !== -1) {
            return { ...link, order: reorderedIndex };
          }
          return link;
        });

        updatedLinks.sort((a, b) => (a.order || 0) - (b.order || 0));

        updateData(updatedLinks, categories);
      }
    }
  };

  const startSorting = (categoryId: string) => {
    setIsSortingMode(categoryId);
  };

  const saveSorting = () => {
    updateData(links, categories);
    setIsSortingMode(null);
  };

  const cancelSorting = () => {
    setIsSortingMode(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return {
    isSortingMode,
    sensors,
    handleDragEnd,
    startSorting,
    saveSorting,
    cancelSorting,
  };
}
