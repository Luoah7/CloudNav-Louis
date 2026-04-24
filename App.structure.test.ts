import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const contextMenuSource = readFileSync(new URL('./components/ContextMenu.tsx', import.meta.url), 'utf8');
const linkModalSource = readFileSync(new URL('./components/LinkModal.tsx', import.meta.url), 'utf8');
const searchConfigModalSource = readFileSync(new URL('./components/SearchConfigModal.tsx', import.meta.url), 'utf8');
const settingsModalSource = readFileSync(new URL('./components/SettingsModal.tsx', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const packageSource = readFileSync(new URL('./package.json', import.meta.url), 'utf8');
const devServerSource = readFileSync(new URL('./scripts/dev-server.mjs', import.meta.url), 'utf8');
const modalSources = [
  './components/AuthModal.tsx',
  './components/BackupModal.tsx',
  './components/CategoryAuthModal.tsx',
  './components/CategoryDeleteModal.tsx',
  './components/CategoryEditorModal.tsx',
  './components/ImportModal.tsx',
  './components/LinkModal.tsx',
  './components/QRCodeModal.tsx',
  './components/SearchConfigModal.tsx',
  './components/SettingsModal.tsx',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));

test('App no longer references the old centralized category manager', () => {
  assert.equal(appSource.includes('CategoryManagerModal'), false);
  assert.equal(appSource.includes('isCatManagerOpen'), false);
});

test('pin entry points are removed from link UI', () => {
  assert.equal(contextMenuSource.includes('置顶/取消置顶'), false);
  assert.equal(contextMenuSource.includes('onTogglePin'), false);
  assert.equal(linkModalSource.includes('setPinned'), false);
  assert.equal(linkModalSource.includes('置顶'), false);
});

test('main content uses concise create labels and blank-area folder actions', () => {
  assert.equal(appSource.includes('<span>新文件夹</span>'), false);
  assert.equal(appSource.includes('<span>新书签</span>'), false);
  assert.equal(appSource.includes('新增文件夹'), false);
  assert.equal(appSource.includes('handleContentBlankContextMenu'), true);
  assert.equal(appSource.includes('删除当前文件夹'), true);
});

test('detailed link cards center content vertically', () => {
  assert.equal(appSource.includes("isDetailedView ? 'items-start gap-4'"), false);
  assert.equal(appSource.includes('min-h-[96px] rounded-lg px-4 py-3'), true);
});

test('search input uses smaller centered text', () => {
  assert.equal(appSource.includes('text-[13px] text-center'), true);
  assert.equal(appSource.includes("style={{ fontSize: '16px' }}"), false);
});

test('detailed card hostname is aligned to the right of the title row', () => {
  assert.equal(appSource.includes('items-start justify-between gap-3'), true);
  assert.equal(appSource.includes('shrink-0 truncate text-right text-[11px]'), true);
  assert.equal(appSource.includes('flex-1 px-8 text-center'), false);
});

test('common category can be renamed from sidebar hover edit action', () => {
  assert.equal(appSource.includes('commonNameEditorOpen'), true);
  assert.equal(appSource.includes('保存常用推荐'), true);
  assert.equal(appSource.includes('修改常用推荐名称'), true);
});

test('settings no longer exposes generated random favicon choices', () => {
  assert.equal(settingsModalSource.includes('随机生成'), false);
  assert.equal(settingsModalSource.includes('选择生成的随机图标'), false);
  assert.equal(settingsModalSource.includes('generatedIcons'), false);
});

test('global font stack uses SF Pro before PingFang SC', () => {
  assert.equal(indexSource.includes('"SF Pro Text", "SF Pro Display", "PingFang SC"'), true);
});

test('default product title no longer includes legacy Chinese prefix', () => {
  assert.equal(indexSource.includes('<title>CloudNav</title>'), true);
  assert.equal(packageSource.includes('cloudnav-(云航)'), false);
  assert.equal(appSource.includes("title: 'CloudNav'"), true);
});

test('dev server writes info to CloudNav/.dev-server-info.json and stays on port 3000', () => {
  assert.equal(packageSource.includes('"dev": "node scripts/dev-server.mjs"'), true);
  assert.equal(devServerSource.includes("CloudNav/.dev-server-info.json"), true);
  assert.equal(devServerSource.includes('strictPort: true'), true);
});

test('sidebar title is centered and nav/card titles use matching size', () => {
  assert.equal(appSource.includes('h-16 flex items-center justify-center px-6'), true);
  assert.equal(appSource.includes('truncate flex-1 text-left text-[13px]'), true);
  assert.equal(appSource.includes('truncate text-[13px] font-semibold text-slate-800'), true);
  assert.equal(appSource.includes('min-w-0 truncate text-[13px] font-medium'), true);
});

test('sidebar footer shows only the version string and keeps balanced spacing', () => {
  assert.equal(appSource.includes('Fork 项目'), false);
  assert.equal(appSource.includes("const APP_VERSION = 'v1.8.1'"), true);
  assert.equal(appSource.includes('mt-4 flex items-center justify-between border-t liquid-divider px-1 pt-3 text-xs'), true);
});

test('modals use white lightbox with glass panels and normalized typography', () => {
  assert.equal(indexSource.includes('.liquid-panel'), true);
  assert.equal(indexSource.includes('.liquid-overlay'), true);
  assert.equal(indexSource.includes('background: rgba(248, 250, 252, 0.78);'), true);
  assert.equal(indexSource.includes('background: rgba(255, 255, 255, 0.85);'), true);
  assert.equal(indexSource.includes('backdrop-filter: blur(24px) saturate(150%);'), true);
  assert.equal(indexSource.includes('border: 1px solid rgba(226, 232, 240, 0.6);'), true);
  assert.equal(indexSource.includes('font-size: 13px;'), true);
  for (const source of modalSources) {
    assert.equal(source.includes('liquid-panel'), true);
    assert.equal(source.includes('liquid-overlay'), true);
  }
});

test('dark theme uses vscode-like neutrals instead of blue glass surfaces', () => {
  assert.equal(indexSource.includes('background-color: #050505;'), true);
  assert.equal(indexSource.includes('background: rgba(26, 26, 26, 0.5);'), true);
  assert.equal(indexSource.includes('background: #252526;'), true);
  assert.equal(appSource.includes("dark:bg-[#0a0a0a]/60"), true);
});

test('search source manager supports a persisted default source', () => {
  assert.equal(appSource.includes('defaultSourceId'), true);
  assert.equal(searchConfigModalSource.includes('设为默认'), true);
  assert.equal(searchConfigModalSource.includes('localDefaultSourceId'), true);
});

test('blank area context menus close on left click outside', () => {
  assert.equal(appSource.includes("event.button !== 0"), true);
  assert.equal(appSource.includes("target.closest('[data-menu-surface]')"), true);
});

test('view mode control is a single button showing the selected mode', () => {
  assert.equal(appSource.includes("handleViewModeChange('simple')"), false);
  assert.equal(appSource.includes("handleViewModeChange('detailed')"), false);
  assert.equal(appSource.includes("siteSettings.cardStyle === 'simple' ? '简约' : '详情'"), true);
});

test('theme control supports light dark and system modes with selected state', () => {
  assert.equal(appSource.includes("type ThemeMode = 'light' | 'dark' | 'system'"), true);
  assert.equal(appSource.includes('currentThemeOption'), true);
  assert.equal(appSource.includes('跟随系统'), true);
  assert.equal(appSource.includes("themeMode === option.id && <Check"), true);
});

test('batch actions are activated by hover checkboxes instead of a batch edit button', () => {
  assert.equal(appSource.includes('toggleBatchEditMode'), false);
  assert.equal(appSource.includes('批量编辑'), false);
  assert.equal(appSource.includes('renderSelectionCheckbox'), true);
  assert.equal(appSource.includes('selectedCategories'), true);
  assert.equal(appSource.includes('取消批量操作'), true);
});

test('simple link grid leaves room for hover controls', () => {
  assert.equal(appSource.includes('grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'), false);
  assert.equal(appSource.includes('grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'), true);
  assert.equal(appSource.includes("isDetailedView ? 'items-center gap-4 pl-6' : 'items-center gap-3 pl-7 pr-12'"), true);
});
