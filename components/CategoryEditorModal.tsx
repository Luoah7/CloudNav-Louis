import React, { useEffect, useState } from 'react';
import { Check, FolderPlus, Lock, Palette, X } from 'lucide-react';
import type { Category } from '../types';
import Icon from './Icon';
import IconSelector from './IconSelector';

interface CategoryEditorModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  category?: Category | null;
  parentId?: string;
  parentName?: string;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; password?: string; parentId?: string }) => void;
}

const CategoryEditorModal: React.FC<CategoryEditorModalProps> = ({
  isOpen,
  mode,
  category,
  parentId,
  parentName,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [password, setPassword] = useState('');
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(category?.name || '');
    setIcon(category?.icon || 'Folder');
    setPassword(category?.password || '');
  }, [isOpen, category]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      icon,
      password: password.trim() || undefined,
      parentId: mode === 'edit' ? category?.parentId : parentId,
    });
  };

  return (
    <div className="liquid-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="liquid-panel w-full max-w-md overflow-hidden rounded-2xl"
      >
        <div className="flex items-center justify-between border-b liquid-divider p-5">
          <div className="flex items-center gap-3">
            <div className="liquid-section flex h-10 w-10 items-center justify-center rounded-xl text-blue-600 dark:text-blue-400">
              <FolderPlus size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {mode === 'edit' ? '编辑文件夹' : '新增文件夹'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {parentName ? `位置：${parentName}` : '位置：一级目录'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/70">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">文件夹名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm outline-none dark:text-white"
              placeholder="输入文件夹名称"
              autoFocus
            />
          </div>

          <div className="liquid-section flex items-center gap-3 rounded-xl p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white/70 dark:border-slate-600/50 dark:bg-slate-900/30">
              <Icon name={icon} size={18} />
            </div>
            <button
              type="button"
              onClick={() => setIsIconSelectorOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/65 px-3 py-2 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-600/50 dark:bg-slate-900/20 dark:text-slate-300"
            >
              <Palette size={15} />
              选择图标
            </button>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
              <Lock size={12} />
              访问密码（可选）
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm outline-none dark:text-white"
              placeholder="留空则不锁定"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t liquid-divider p-4">
          <button type="button" onClick={onClose} className="rounded-xl bg-white/55 px-4 py-2 text-sm text-slate-600 hover:bg-white/80 dark:bg-slate-700/60 dark:text-slate-300">
            取消
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check size={15} />
            保存
          </button>
        </div>
      </form>

      {isIconSelectorOpen && (
        <div className="liquid-overlay fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="liquid-panel flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b liquid-divider p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">选择图标</h3>
              <button type="button" onClick={() => setIsIconSelectorOpen(false)} className="rounded p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/70">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto p-4">
              <IconSelector
                onSelectIcon={(iconName) => {
                  setIcon(iconName);
                  setIsIconSelectorOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryEditorModal;
