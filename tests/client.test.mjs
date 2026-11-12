// 客户端模块加载测试：用桩 __ModuleLoader__ / require / ctx 真实执行 client.js。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = await fs.readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client.js'), 'utf8');

// 极简 React 桩：只需要 createElement 与 hooks 能被调用。
const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (initial) => ({ current: initial }),
};

let loaded = null;
const registrations = [];
const injections = [];

globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      loaded = definition;
    },
  },
};

// 执行模块定义（不进入 factory，先看外层结构）。
const fn = new Function('window', source);
fn(globalThis.window);

assert.ok(loaded, '调用了 __ModuleLoader__.load');
assert.equal(loaded.id, '@menpengpeng/dsh-plugin-x-article-library', '模块 id 应为包名');
assert.equal(typeof loaded.factory, 'function', 'factory 应为函数');
console.log('模块外壳 OK：id =', loaded.id);

const moduleExports = loaded.factory((name) => {
  if (name === 'react') return React;
  throw new Error(`未预期的依赖：${name}`);
});

assert.ok(Array.isArray(moduleExports.inject), '应声明 inject');
assert.deepEqual(moduleExports.inject, ['slots', 'layout'], 'inject 应为 slots 与 layout');
assert.equal(typeof moduleExports.apply, 'function', '应导出 apply');
console.log('模块导出 OK：inject =', moduleExports.inject.join(', '));

const ctx = {
  slots: {
    inject(name, callback) {
      injections.push(name);
      return callback();
    },
    register(options, component) {
      registrations.push({ options, component });
      return () => {};
    },
  },
};

moduleExports.apply(ctx);

console.log('注入的 slot：', injections.join(', '));
assert.deepEqual(injections, ['sidebar.panellist', 'main'], '应注入两个 slot');

const sidebar = registrations.find((item) => item.options.name === 'sidebar.panellist');
assert.ok(sidebar, '应注册 sidebar.panellist');
assert.equal(sidebar.options.id, 'x-article-library', '侧边栏 id 应稳定');
assert.equal(sidebar.options.label, 'X 文章', '侧边栏文案应为中文');
assert.equal(typeof sidebar.component, 'function', '侧边栏图标应为组件');
assert.ok(Number.isFinite(sidebar.options.order), 'order 应为数字');

const main = registrations.find((item) => item.options.name === 'main');
assert.ok(main, '应注册 main');
assert.equal(main.options.key, 'x-article-library', 'main 的 key 应与侧边栏 id 对应');
assert.equal(typeof main.component, 'function', '主面板应为组件');
console.log('Slot 注册 OK：sidebar(order=' + sidebar.options.order + ') + main(key=' + main.options.key + ')');

// 图标组件应能渲染出 SVG。
const icon = sidebar.component({ active: true });
assert.ok(icon && icon.type === 'div', '图标应渲染 div 容器');
const svg = JSON.stringify(icon);
assert.ok(svg.includes('svg'), '图标应包含 svg');
assert.ok(svg.includes('brand-primary'), '激活态应使用主题色');

// 主面板首次渲染（state 为空时走 loading 分支）。
const tree = main.component({});
assert.ok(tree, '主面板应能渲染');
assert.equal(tree.props.className, 'xal-root', '主面板根节点应有样式类');
const serialized = JSON.stringify(tree);
assert.ok(serialized.includes('xal-spin'), '初始应显示加载态');

// 样式由 Styles 组件提供，桩环境下需显式调用才能拿到内容。
const stylesComponent = tree.children.find((child) => child && typeof child.type === 'function');
assert.ok(stylesComponent, '应包含 Styles 组件');
const cssNode = stylesComponent.type({});
assert.equal(cssNode.type, 'style', 'Styles 应渲染 style 节点');
const cssText = String(cssNode.children[0]);
assert.ok(cssText.length > 2000, '样式表应有实质内容');
assert.ok(cssText.includes('grid-template-columns:minmax(190px,236px)'), '应包含三栏布局定义');
assert.ok(cssText.includes('@container'), '应包含容器查询响应式规则');
console.log('主面板渲染 OK：加载态 + 三栏网格 + 容器查询');

for (const cls of ['.xal-root', '.xal-nav', '.xal-list-col', '.xal-reader', '.xal-md', '.xal-dialog', '.xal-overlay', '.xal-item', '.xal-btn']) {
  assert.ok(cssText.includes(cls), `样式应包含 ${cls}`);
}
console.log('样式表 OK：', cssText.length, '字符，关键类齐全');

// 图标集：所有被引用的名字都必须有定义，且统一走 currentColor 描边（跟随主题）。
{
  const iconBlock = source.slice(source.indexOf('const ICONS = {'), source.indexOf('/** 渲染一个线性图标'));
  const defined = new Set([...iconBlock.matchAll(/^\s+(\w+): '/gm)].map((match) => match[1]));
  assert.ok(defined.size >= 10, '图标集应有足够条目，实际 ' + defined.size);

  const referenced = new Set([...source.matchAll(/h\(Glyph, \{ name: '(\w+)'/g)].map((match) => match[1]));
  // navItem 通过变量传图标名，单独收集。
  for (const match of source.matchAll(/navItem\([^)]*?'(\w+)',?\s*\)/gs)) referenced.add(match[1]);
  for (const name of ['all', 'unread', 'star', 'warn', 'author', 'settings', 'folder', 'folderOpen', 'plus', 'refresh', 'scan', 'external', 'trash', 'close', 'check', 'chevronUp']) {
    referenced.add(name);
  }

  const missing = [...referenced].filter((name) => !defined.has(name));
  assert.deepEqual(missing, [], '引用了未定义的图标：' + missing.join(', '));
  console.log('图标 OK：定义 ' + defined.size + ' 个，引用 ' + referenced.size + ' 个');

  assert.ok(source.includes("stroke: 'currentColor'"), '图标应使用 currentColor，自动跟随主题');
  assert.ok(!/[\u{1F4C1}\u{1F4C2}\u2605\u2606]|📂|📁|★|☆/u.test(cssText), '样式表不应残留 emoji 图标');
}

// 界面上不应再有靠 emoji 充当的图标（统一改成 SVG）。
{
  const emojiIcons = [...source.matchAll(/(?:'|\s)(📂|📁|★|☆|➕|🗑)(?:\s|')/gu)].map((match) => match[1]);
  assert.deepEqual(emojiIcons, [], '源码中不应残留 emoji 图标：' + emojiIcons.join(' '));
  console.log('无 emoji 图标残留 OK');
}

// 右键菜单：列表项与收藏夹都要挂 onContextMenu，菜单项要覆盖需求里的两个动作。
{
  assert.ok(source.includes('function ContextMenu'), '应有通用右键菜单组件');
  assert.ok(source.includes('function PromptDialog'), '应有重命名输入框');
  assert.ok(source.includes('function CollectionPicker'), '应有收藏夹勾选框');
  assert.ok(source.includes('调整所属收藏夹'), '右键菜单应能调整所属收藏夹');
  assert.ok(source.includes('重命名标题'), '右键菜单应能重命名文章');
  assert.ok(source.includes('重命名收藏夹'), '收藏夹右键应能重命名');

  // 两个右键入口都要真的接上。
  assert.ok(/onContextMenu: \(event\) => openArticleMenu\(event, item\)/.test(source), '文章卡片应挂 openArticleMenu');
  assert.ok(/onContextMenu: \(event\) => openCollectionMenu\(event, item\)/.test(source), '收藏夹应挂 openCollectionMenu');
  console.log('右键菜单 OK：文章卡片 + 收藏夹两个入口，动作齐全');
}

console.log('\n客户端模块测试全部通过。');
