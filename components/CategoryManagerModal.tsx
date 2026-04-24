import React, { useMemo, useState } from 'react';
import { X, ArrowUp, ArrowDown, Trash2, Edit2, Plus, Check, Lock, Palette } from 'lucide-react';
import { Category } from '../types';
import Icon from './Icon';
import IconSelector from './IconSelector';
import {
  flattenCategoryTree,
  getDescendantCategoryIds,
  normalizeCategories,
} from '../services/categoryTree';

export type DeleteCategoryOptions =
  | { mode: 'move'; targetCategoryId: string }
  | { mode: 'deleteLinks' };

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdateCategories: (newCategories: Category[]) => void;
  onDeleteCategory: (id: string, options: DeleteCategoryOptions) => void;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdateCategories,
  onDeleteCategory,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editParentId, setEditParentId] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [newCatPassword, setNewCatPassword] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Folder');
  const [newCatParentId, setNewCatParentId] = useState('');

  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [iconSelectorTarget, setIconSelectorTarget] = useState<'edit' | 'new' | null>(null);

  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleteMode, setDeleteMode] = useState<'move' | 'deleteLinks'>('move');
  const [deleteTargetId, setDeleteTargetId] = useState('common');

  const normalizedCategories = useMemo(() => normalizeCategories(categories), [categories]);
  const flatCategories = useMemo(() => flattenCategoryTree(normalizedCategories), [normalizedCategories]);

  if (!isOpen) return null;

  const siblingItems = (cat: Category) => flatCategories.filter(item => item.category.parentId === cat.parentId);
  const canMove = (cat: Category, direction: 'up' | 'down') => {
    if (cat.id === 'common') return false;
    const siblings = siblingItems(cat);
    const index = siblings.findIndex(item => item.category.id === cat.id);
    return direction === 'up' ? index > 0 : index >= 0 && index < siblings.length - 1;
  };

  const handleMove = (cat: Category, direction: 'up' | 'down') => {
    const siblings = siblingItems(cat);
    const siblingIndex = siblings.findIndex(item => item.category.id === cat.id);
    const targetSibling = direction === 'up' ? siblings[siblingIndex - 1] : siblings[siblingIndex + 1];
    if (!targetSibling) return;

    const newCats = [...normalizedCategories];
    const currentIndex = newCats.findIndex(item => item.id === cat.id);
    const targetIndex = newCats.findIndex(item => item.id === targetSibling.category.id);
    if (currentIndex === -1 || targetIndex === -1) return;

    [newCats[currentIndex], newCats[targetIndex]] = [newCats[targetIndex], newCats[currentIndex]];
    onUpdateCategories(newCats);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditPassword(cat.password || '');
    setEditIcon(cat.icon);
    setEditParentId(cat.parentId || '');
  };

  const handleStartEdit = (cat: Category) => {
    startEdit(cat);
  };

  const parentOptions = (editingCategoryId?: string) => {
    const excludedIds = new Set<string>(['common']);
    if (editingCategoryId) {
      getDescendantCategoryIds(normalizedCategories, editingCategoryId).forEach(id => excludedIds.add(id));
    }
    return flatCategories.filter(({ category }) => !excludedIds.has(category.id));
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    const invalidParentIds = new Set(getDescendantCategoryIds(normalizedCategories, editingId));
    if (editParentId && invalidParentIds.has(editParentId)) {
      alert('不能把分类移动到自己或自己的子分类下');
      return;
    }

    const newCats = normalizedCategories.map(c => c.id === editingId ? {
      ...c,
      name: editName.trim(),
      icon: editIcon,
      password: editPassword.trim() || undefined,
      parentId: editParentId || undefined,
    } : c);
    onUpdateCategories(newCats);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      icon: newCatIcon,
      password: newCatPassword.trim() || undefined,
      parentId: newCatParentId || undefined,
    };

    onUpdateCategories([...normalizedCategories, newCat]);
    setNewCatName('');
    setNewCatPassword('');
    setNewCatIcon('Folder');
    setNewCatParentId('');
  };

  const handleDeleteClick = (cat: Category) => {
    const deletingIds = new Set(getDescendantCategoryIds(normalizedCategories, cat.id));
    const firstTarget = flatCategories.find(({ category }) => !deletingIds.has(category.id))?.category.id || 'common';
    setPendingDelete(cat);
    setDeleteMode('move');
    setDeleteTargetId(firstTarget);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (deleteMode === 'move') {
      if (!deleteTargetId) {
        alert('请选择迁移目标分类');
        return;
      }
      onDeleteCategory(pendingDelete.id, { mode: 'move', targetCategoryId: deleteTargetId });
    } else {
      onDeleteCategory(pendingDelete.id, { mode: 'deleteLinks' });
    }
    setPendingDelete(null);
  };

  const openIconSelector = (target: 'edit' | 'new') => {
    setIconSelectorTarget(target);
    setIsIconSelectorOpen(true);
  };

  const handleIconSelect = (iconName: string) => {
    if (iconSelectorTarget === 'edit') {
      setEditIcon(iconName);
    } else if (iconSelectorTarget === 'new') {
      setNewCatIcon(iconName);
    }
  };

  const cancelIconSelector = () => {
    setIsIconSelectorOpen(false);
    setIconSelectorTarget(null);
  };

  const deleteTargetOptions = pendingDelete
    ? flatCategories.filter(({ category }) => !getDescendantCategoryIds(normalizedCategories, pendingDelete.id).includes(category.id))
    : [];

  return (
    <div className="liquid-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="liquid-panel w-full max-w-2xl overflow-hidden rounded-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-4 border-b liquid-divider">
          <h3 className="text-lg font-semibold dark:text-white">分类管理</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/60 dark:hover:bg-slate-700/70 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {flatCategories.map(({ category: cat, depth, path }) => (
            <div key={cat.id} className="liquid-section flex flex-col p-3 rounded-xl group gap-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1 mr-2">
                  <button
                    onClick={() => handleMove(cat, 'up')}
                    disabled={!canMove(cat, 'up')}
                    className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMove(cat, 'down')}
                    disabled={!canMove(cat, 'down')}
                    className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {editingId === cat.id && cat.id !== 'common' ? (
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon name={editIcon} size={16} />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="liquid-input flex-1 p-1.5 px-2 text-sm rounded dark:text-white outline-none"
                          placeholder="分类名称"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          onClick={() => openIconSelector('edit')}
                          title="选择图标"
                        >
                          <Palette size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-slate-400" />
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="liquid-input flex-1 p-1.5 px-2 text-sm rounded dark:text-white outline-none"
                          placeholder="密码（可选）"
                        />
                      </div>
                      <select
                        value={editParentId}
                        onChange={(e) => setEditParentId(e.target.value)}
                        className="liquid-input p-1.5 px-2 text-sm rounded dark:text-white outline-none"
                      >
                        <option value="">一级分类</option>
                        {parentOptions(cat.id).map(({ category, path }) => (
                          <option key={category.id} value={category.id}>{path}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 14 }}>
                      <Icon name={cat.icon} size={16} />
                      <span className="font-medium dark:text-slate-200 truncate" title={path}>
                        {cat.name}
                        {cat.id === 'common' && (
                          <span className="ml-2 text-xs text-slate-400">(默认分类，不可编辑)</span>
                        )}
                      </span>
                      {cat.password && <Lock size={12} className="text-slate-400" />}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 self-start mt-1">
                  {editingId === cat.id ? (
                    <button onClick={saveEdit} className="text-green-500 hover:bg-green-50 dark:hover:bg-slate-600 p-1.5 rounded bg-white/60 dark:bg-slate-800/70 shadow-sm border border-white/70 dark:border-slate-600">
                      <Check size={16} />
                    </button>
                  ) : (
                    <>
                      {cat.id !== 'common' && (
                        <button onClick={() => handleStartEdit(cat)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                          <Edit2 size={14} />
                        </button>
                      )}
                      {cat.id !== 'common' && (
                        <button
                          onClick={() => handleDeleteClick(cat)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {cat.id === 'common' && (
                        <div className="p-1.5 text-slate-300" title="常用推荐分类不能被删除">
                          <Lock size={14} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t liquid-divider bg-white/25 dark:bg-slate-900/20">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">添加新分类</label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon name={newCatIcon} size={16} />
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="分类名称"
                className="liquid-input flex-1 p-2 rounded-lg dark:text-white text-sm outline-none"
              />
              <button
                type="button"
                className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                onClick={() => openIconSelector('new')}
                title="选择图标"
              >
                <Palette size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={newCatPassword}
                  onChange={(e) => setNewCatPassword(e.target.value)}
                  placeholder="密码 (可选)"
                  className="liquid-input w-full pl-8 p-2 rounded-lg dark:text-white text-sm outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={!newCatName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <Plus size={18} />
              </button>
            </div>
            <select
              value={newCatParentId}
              onChange={(e) => setNewCatParentId(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">一级分类</option>
              {parentOptions().map(({ category, path }) => (
                <option key={category.id} value={category.id}>{path}</option>
              ))}
            </select>
          </div>

          {isIconSelectorOpen && (
            <div className="liquid-overlay fixed inset-0 z-60 flex items-center justify-center p-4">
              <div className="liquid-panel rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">选择图标</h3>
                  <button
                    type="button"
                    onClick={cancelIconSelector}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <IconSelector
                    onSelectIcon={(iconName) => {
                      handleIconSelect(iconName);
                      setIsIconSelectorOpen(false);
                      setIconSelectorTarget(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {pendingDelete && (
            <div className="liquid-overlay fixed inset-0 z-60 flex items-center justify-center p-4">
              <div className="liquid-panel w-full max-w-md rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-900 dark:text-white">删除分类</h4>
                  <button onClick={() => setPendingDelete(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    将删除“<span className="font-medium text-slate-900 dark:text-white">{pendingDelete.name}</span>”及其所有子分类。
                  </p>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input type="radio" checked={deleteMode === 'move'} onChange={() => setDeleteMode('move')} className="mt-1" />
                    <span className="flex-1">
                      <span className="block font-medium text-slate-800 dark:text-slate-100">迁移书签后删除分类</span>
                      <span className="block text-xs text-slate-500 mt-1">分类树下的书签会移动到目标分类。</span>
                    </span>
                  </label>
                  {deleteMode === 'move' && (
                    <select
                      value={deleteTargetId}
                      onChange={(e) => setDeleteTargetId(e.target.value)}
                      className="liquid-input w-full p-2 rounded-lg dark:text-white text-sm outline-none"
                    >
                      {deleteTargetOptions.map(({ category, path }) => (
                        <option key={category.id} value={category.id}>{path}</option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-red-200 dark:border-red-900/60 cursor-pointer">
                    <input type="radio" checked={deleteMode === 'deleteLinks'} onChange={() => setDeleteMode('deleteLinks')} className="mt-1" />
                    <span className="flex-1">
                      <span className="block font-medium text-red-600 dark:text-red-400">连同书签一起删除</span>
                      <span className="block text-xs text-slate-500 mt-1">分类树下的书签会一起删除。</span>
                    </span>
                  </label>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t liquid-divider">
                  <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg bg-white/55 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300">
                    取消
                  </button>
                  <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white">
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;
