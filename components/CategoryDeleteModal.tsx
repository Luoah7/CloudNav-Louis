import React, { useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Category } from '../types';
import { flattenCategoryTree, getDescendantCategoryIds } from '../services/categoryTree';

export type DeleteCategoryOptions =
  | { mode: 'move'; targetCategoryId: string }
  | { mode: 'deleteLinks' };

interface CategoryDeleteModalProps {
  isOpen: boolean;
  category: Category | null;
  categories: Category[];
  onClose: () => void;
  onConfirm: (categoryId: string, options: DeleteCategoryOptions) => void;
}

const CategoryDeleteModal: React.FC<CategoryDeleteModalProps> = ({
  isOpen,
  category,
  categories,
  onClose,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'move' | 'deleteLinks'>('move');
  const deletingIds = useMemo(() => (
    category ? new Set(getDescendantCategoryIds(categories, category.id)) : new Set<string>()
  ), [categories, category]);
  const targetOptions = useMemo(() => (
    flattenCategoryTree(categories).filter(({ category: item }) => !deletingIds.has(item.id))
  ), [categories, deletingIds]);
  const [targetId, setTargetId] = useState('common');

  React.useEffect(() => {
    if (!isOpen) return;
    setMode('move');
    setTargetId(targetOptions[0]?.category.id || 'common');
  }, [isOpen, targetOptions]);

  if (!isOpen || !category) return null;

  const handleConfirm = () => {
    if (mode === 'move') {
      if (!targetId) return;
      onConfirm(category.id, { mode: 'move', targetCategoryId: targetId });
    } else {
      onConfirm(category.id, { mode: 'deleteLinks' });
    }
  };

  return (
    <div className="liquid-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="liquid-panel w-full max-w-md overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b liquid-divider p-5">
          <div className="flex items-center gap-3">
            <div className="liquid-section flex h-10 w-10 items-center justify-center rounded-xl text-red-600 dark:text-red-400">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">删除文件夹</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">将删除“{category.name}”及其子文件夹</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/70">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5 text-sm">
          <label className="liquid-section flex cursor-pointer gap-3 rounded-xl p-3 transition-colors hover:bg-white/65 dark:hover:bg-slate-700/45">
            <input type="radio" checked={mode === 'move'} onChange={() => setMode('move')} className="mt-1" />
            <span>
              <span className="block font-medium text-slate-800 dark:text-slate-100">迁移书签后删除</span>
              <span className="mt-1 block text-xs text-slate-500">文件夹树下的书签会移动到目标文件夹。</span>
            </span>
          </label>
          {mode === 'move' && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm dark:text-white"
            >
              {targetOptions.map(({ category: item, path }) => (
                <option key={item.id} value={item.id}>{path}</option>
              ))}
            </select>
          )}
          <label className="flex cursor-pointer gap-3 rounded-xl border border-red-200/80 bg-red-50/55 p-3 transition-colors hover:bg-red-50/80 dark:border-red-900/60 dark:bg-red-900/10 dark:hover:bg-red-900/20">
            <input type="radio" checked={mode === 'deleteLinks'} onChange={() => setMode('deleteLinks')} className="mt-1" />
            <span>
              <span className="block font-medium text-red-600 dark:text-red-400">连同书签一起删除</span>
              <span className="mt-1 block text-xs text-slate-500">文件夹树下的书签会一起删除。</span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t liquid-divider p-4">
          <button onClick={onClose} className="rounded-xl bg-white/55 px-4 py-2 text-sm text-slate-600 hover:bg-white/80 dark:bg-slate-700/60 dark:text-slate-300">
            取消
          </button>
          <button onClick={handleConfirm} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryDeleteModal;
