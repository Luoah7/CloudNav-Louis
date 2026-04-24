import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, CheckCircle2, Globe, Search, ExternalLink, RotateCcw, Star } from 'lucide-react';
import { ExternalSearchSource } from '../types';
import { createDefaultSearchSources, resolveDefaultSearchSource } from '../services/searchBehavior';

interface SearchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: ExternalSearchSource[];
  defaultSourceId?: string;
  onSave: (sources: ExternalSearchSource[], defaultSourceId?: string) => void;
}

const SearchConfigModal: React.FC<SearchConfigModalProps> = ({ 
  isOpen, onClose, sources, defaultSourceId, onSave 
}) => {
  const [localSources, setLocalSources] = useState<ExternalSearchSource[]>(sources);
  const [localDefaultSourceId, setLocalDefaultSourceId] = useState<string>('');
  const [newSource, setNewSource] = useState<Partial<ExternalSearchSource>>({
    name: '',
    url: '',
    icon: 'Globe',
    enabled: true
  });

  // 当sources变化或modal打开时，更新localSources
  useEffect(() => {
    if (isOpen) {
      setLocalSources(sources);
      setLocalDefaultSourceId(resolveDefaultSearchSource(sources, defaultSourceId)?.id || '');
    }
  }, [sources, defaultSourceId, isOpen]);

  const handleAddSource = () => {
    if (!newSource.name || !newSource.url) return;
    
    const source: ExternalSearchSource = {
      id: Date.now().toString(),
      name: newSource.name!,
      url: newSource.url!,
      icon: newSource.icon || 'Globe',
      enabled: newSource.enabled !== false,
      createdAt: Date.now()
    };
    
    const nextSources = [...localSources, source];
    setLocalSources(nextSources);
    if (!resolveDefaultSearchSource(nextSources, localDefaultSourceId)) {
      setLocalDefaultSourceId(source.id);
    }
    setNewSource({ name: '', url: '', icon: 'Globe', enabled: true });
  };

  const handleDeleteSource = (id: string) => {
    const nextSources = localSources.filter(source => source.id !== id);
    setLocalSources(nextSources);
    setLocalDefaultSourceId(resolveDefaultSearchSource(nextSources, localDefaultSourceId === id ? undefined : localDefaultSourceId)?.id || '');
  };

  const handleToggleEnabled = (id: string) => {
    const nextSources = localSources.map(source =>
      source.id === id ? { ...source, enabled: !source.enabled } : source
    );
    setLocalSources(nextSources);
    setLocalDefaultSourceId(resolveDefaultSearchSource(nextSources, localDefaultSourceId)?.id || '');
  };

  const handleSave = () => {
    const resolvedDefault = resolveDefaultSearchSource(localSources, localDefaultSourceId);
    onSave(localSources, resolvedDefault?.id);
    onClose();
  };

  const handleReset = () => {
    const defaultSources = createDefaultSearchSources();
    setLocalSources(defaultSources);
    setLocalDefaultSourceId(defaultSources[0]?.id || '');
  };

  const handleCancel = () => {
    setLocalSources(sources);
    setLocalDefaultSourceId(resolveDefaultSearchSource(sources, defaultSourceId)?.id || '');
    setNewSource({ name: '', url: '', icon: 'Globe', enabled: true });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="liquid-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="liquid-panel w-full max-w-2xl overflow-hidden rounded-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b liquid-divider shrink-0">
          <div className="flex items-center gap-2">
            <Search size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold dark:text-white">搜索源管理</h2>
          </div>
          <button onClick={handleCancel} className="p-1 hover:bg-white/60 dark:hover:bg-slate-700/70 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* 添加新搜索源 */}
          <div className="liquid-section p-4 rounded-2xl">
            <h3 className="text-sm font-medium dark:text-white mb-3">添加新搜索源</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">名称</label>
                <input
                  type="text"
                  value={newSource.name || ''}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="例如：Google"
                  className="liquid-input w-full p-2 text-sm rounded-lg dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">搜索URL</label>
                <input
                  type="text"
                  value={newSource.url || ''}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder="例如：https://www.google.com/search?q={query}"
                  className="liquid-input w-full p-2 text-sm rounded-lg dark:text-white outline-none"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                提示：URL中必须包含 <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">{'{query}'}</code> 作为搜索关键词占位符
              </span>
              <button
                onClick={handleAddSource}
                disabled={!newSource.name || !newSource.url}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> 添加
              </button>
            </div>
          </div>

          {/* 搜索源列表 */}
          <div>
            <h3 className="text-sm font-medium dark:text-white mb-3">已配置的搜索源</h3>
            <div className="space-y-2">
              {localSources.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Globe size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无搜索源配置</p>
                </div>
              ) : (
                localSources.map((source) => (
                  <div key={source.id} className="liquid-section flex items-center justify-between p-3 rounded-xl">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={source.enabled}
                          onChange={() => handleToggleEnabled(source.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <Globe size={16} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm dark:text-white truncate">{source.name}</span>
                          {source.id === localDefaultSourceId && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                              <CheckCircle2 size={12} />
                              默认
                            </span>
                          )}
                          {source.enabled && (
                            <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                              启用
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {source.url}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => source.enabled && setLocalDefaultSourceId(source.id)}
                        disabled={!source.enabled || source.id === localDefaultSourceId}
                        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          source.id === localDefaultSourceId
                            ? 'cursor-default bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300'
                        }`}
                        title={source.enabled ? '设为默认搜索源' : '启用后可设为默认'}
                      >
                        <Star size={14} className={source.id === localDefaultSourceId ? 'fill-current' : ''} />
                        {source.id === localDefaultSourceId ? '默认' : '设为默认'}
                      </button>
                      <button
                        onClick={() => handleDeleteSource(source.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 使用说明 */}
          <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 p-4 dark:border-blue-800/50 dark:bg-blue-900/20">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
              <ExternalLink size={14} /> 使用说明
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <li>• 点击首页搜索框左侧的放大镜图标切换搜索源</li>
              <li>• 搜索URL中必须包含 <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{query}'}</code> 占位符</li>
              <li>• 配置信息会自动保存到本地存储和云端（如果已登录）</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t liquid-divider shrink-0">
          <div className="flex justify-between items-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm bg-orange-600 text-white hover:bg-orange-700 rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <RotateCcw size={16} /> 重置为默认
            </button>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm bg-white/55 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 font-medium"
              >
                <Check size={16} /> 保存配置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchConfigModal;
