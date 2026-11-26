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
  assert.ok(source.includes("t('调整所属收藏夹") || source.includes("t('调整所属收藏夹…')"), '右键菜单应能调整所属收藏夹（支持 i18n）');
  assert.ok(source.includes("t('重命名标题"), '右键菜单应能重命名文章（支持 i18n）');
  assert.ok(source.includes("t('重命名收藏夹"), '收藏夹右键应能重命名（支持 i18n）');

  // 两个右键入口都要真的接上。
  assert.ok(/onContextMenu: \(event\) => openArticleMenu\(event, item\)/.test(source), '文章卡片应挂 openArticleMenu');
  assert.ok(/onContextMenu: \(event\) => openCollectionMenu\(event, item\)/.test(source), '收藏夹应挂 openCollectionMenu');
  console.log('右键菜单 OK：文章卡片 + 收藏夹两个入口，动作齐全');
}

// 正文字号：工具栏要有可拖动的滑杆，且字号必须真的传导到正文样式上。
{
  assert.ok(/className: 'xal-fontctl'/.test(source), '阅读器工具栏应有字号控件');
  assert.ok(/type: 'range'/.test(source), '字号控件应是拖动滑杆，不是只能点的按钮');
  assert.ok(source.includes("'aria-label': t('正文字号')"), '滑杆要有无障碍标签（支持 i18n）');

  // 范围要落在合理区间，且默认值与 CSS 兜底一致。
  const min = Number((source.match(/const FONT_MIN = (\d+);/) || [])[1]);
  const max = Number((source.match(/const FONT_MAX = (\d+);/) || [])[1]);
  const preset = Number((source.match(/const FONT_DEFAULT = (\d+);/) || [])[1]);
  assert.ok(min >= 10 && min <= 14, '最小字号应在 10–14px，实际 ' + min);
  assert.ok(max >= 20 && max <= 30, '最大字号应在 20–30px，实际 ' + max);
  assert.ok(preset > min && preset <= max, '默认字号应落在区间内，实际 ' + preset);

  // 字号通过 CSS 变量下发，正文与标题都跟着走；CSS 兜底值要和 FONT_DEFAULT 一致。
  assert.ok(source.includes("'--xal-reader-font-size': activeFont + 'px'"), '应把字号写成 CSS 变量');
  assert.ok(cssText.includes('--xal-reader-font-size'), '样式应引用字号变量');
  const fallback = (cssText.match(/var\(--xal-reader-font-size,(\d+)px\)/) || [])[1];
  assert.equal(Number(fallback), preset, 'CSS 兜底字号应与 FONT_DEFAULT 一致');
  assert.ok(/\.xal-md\{[^}]*line-height:1\.72/.test(cssText), '正文行高不应被字号改动带偏');

  // 标题用 em 相对单位，这样放大字号时标题会同比放大，不会反而更小。
  assert.ok(/\.xal-md h1\{font-size:1\.4286em\}/.test(source), '正文标题应使用 em 相对单位');
  assert.ok(!/\.xal-md h[1-6][^{]*\{font-size:\d+px/.test(cssText), '正文标题不应再写死 px');

  // 拖动过程中只更新本地状态，松手才落盘。
  assert.ok(/onMouseUp: \(\) => \{ if \(fontSize !== null\) saveFont\(fontSize\); \}/.test(source), '松手才保存字号');
  assert.ok(/onChange: \(event\) => setFontSize\(clampFont\(event\.target\.value\)\)/.test(source), '拖动时只改本地状态');
  assert.ok(source.includes('readerFontScale'), '字号应持久化到 readerFontScale');
  console.log('正文字号 OK：拖动滑杆 ' + min + '–' + max + 'px，默认 ' + preset + '，松手保存');
}

// 已读/未读完/未读三态标签：标题行要根据 readState 显示不同标签。
{
  assert.ok(cssText.includes('.xal-readtag'), '应有阅读状态标签样式');
  assert.ok(cssText.includes('.xal-readtag.unread'), '应有未读样式');
  assert.ok(cssText.includes('.xal-readtag.reading'), '应有未读完样式');
  assert.ok(cssText.includes('.xal-readtag.read'), '应有已读样式');

  // 标签的类名与文案都由 readState 决定，而非写死。
  assert.ok(source.includes("item.readState === 'read' ? 'read' : item.readState === 'reading' ? 'reading' : 'unread'"), '标签类名应由 readState 三态决定');
  assert.ok(source.includes("item.readState === 'read' ? t('已读') : item.readState === 'reading' ? t('未读完') : t('未读')"), '标签文案应为已读/未读完/未读（支持 i18n）');
  // 打开文章先标「未读完」，滚到底才转为「已读」。
  assert.ok(source.includes("patch = { readState: 'reading' }"), '打开文章应标记为未读完');
  assert.ok(source.includes("readState: finished ? 'read' : 'reading'"), '读到底应转为已读');
  assert.ok(source.includes('readingProgress'), '应上报阅读进度');
  console.log('阅读状态三态 OK：未读 / 未读完 / 已读，滚动到底自动转已读');
}

// 阅读模式（方案 A：bot 式模式 chip）：进入后隐藏导航/列表/工具栏，只留正文。
{
  assert.ok(source.includes('const [focusMode, setFocusMode] = useState(null)'), '应有阅读模式状态（null=待初始化）');
  assert.ok(cssText.includes('.xal-root.focus{grid-template-columns:minmax(0,1fr)}'), '阅读模式应切成单列');
  assert.ok(cssText.includes('.xal-root.focus .xal-nav,.xal-root.focus .xal-list-col{display:none}'), '阅读模式应隐藏左栏与列表');
  assert.ok(cssText.includes('.xal-root.focus .xal-tools'), '阅读模式应隐藏工具栏功能菜单');
  // 模式 chip：常驻显示、hover 出关闭图标、点击退出（参考 bot）。
  assert.ok(source.includes("className: 'xal-mode-chip'"), '应有模式 chip 而非悬浮按钮');
  assert.ok(cssText.includes('.xal-mode-chip:hover .rest-glyph{display:none}'), 'chip hover 应切换为关闭图标');
  assert.ok(cssText.includes('.xal-mode-chip:hover .exit-glyph{display:inline-flex}'), 'chip hover 应显示退出图标');
  assert.ok(/onClick: \(\) => setFocus\(false\)/.test(source), '点击 chip 应退出阅读模式');
  // 统一 setFocus：进入/退出都持久化状态。
  assert.ok(source.includes('const setFocus = useCallback'), '应有统一模式切换函数');
  assert.ok(/call\('settings', \{ patch: \{ readerFocusMode:/.test(source), '模式状态应持久化');
  assert.ok(source.includes('data.settings.readerFocusMode'), '加载时应恢复已保存的模式');
  assert.ok(/onClick: \(\) => setFocus\(true\)/.test(source), '工具栏按钮应进入阅读模式');
  assert.ok(source.includes("event.key === 'Escape'"), '应支持 Esc 退出');
  // 持久化后，换文章不再强制退出——这是与 bot 会话模式一致的行为。
  assert.ok(!/setFocusMode\(false\);[\s\S]{0,40}try \{/.test(source.slice(source.indexOf('const openArticle'), source.indexOf('const openArticle') + 600)), '换文章不应强制退出阅读模式');
  console.log('阅读模式 OK：bot 式 chip 切换 + 状态持久化 + Esc 退出');
}

// 上次读到的位置：仅「未读完」时在正文内按进度画一条红线。
{
  assert.ok(cssText.includes('.xal-reading-mark'), '应有红线样式');
  assert.ok(/\.xal-reading-mark\{[^}]*position:absolute/.test(cssText), '红线应绝对定位在正文内');
  assert.ok(cssText.includes('--dsw-alias-state-error-primary'), '红线应用主题错误色（红色）');
  assert.ok(cssText.includes('上次读到这里'), '红线应有「上次读到这里」提示');
  assert.ok(source.includes("className: 'xal-reading-mark'"), '正文应渲染红线元素');
  assert.ok(source.includes('height * progress'), '红线位置应按阅读进度换算');
  assert.ok(source.includes("readState !== 'reading'"), '仅未读完时显示红线');
  assert.ok(source.includes('ResizeObserver'), '应跟随图片加载/字号变化重新测量位置');
  assert.ok(source.includes('autoScrolledRef'), '应只自动定位一次，避免反复跳动');
  assert.ok(source.includes('scroller.scrollTop = target'), '打开未读完文章应自动滚到上次位置');
  console.log('上次读到红线 OK：仅未读完显示，按进度定位，随高度变化重算，打开时自动定位');
}

// 工具栏吸顶：滚动正文时功能按钮固定在阅读器顶部。
{
  assert.ok(/\.xal-tools\{[^}]*position:sticky/.test(cssText), '工具栏应 sticky 吸顶');
  assert.ok(/\.xal-tools\{[^}]*top:0/.test(cssText), '吸顶位置应为顶部');
  assert.ok(/\.xal-tools\{[^}]*background:/.test(cssText), '吸顶工具栏应有背景遮住下方文字');
  assert.ok(/\.xal-tools\{[^}]*z-index:/.test(cssText), '吸顶工具栏应在正文之上');
  assert.ok(/\.xal-root\.focus \.xal-tools\{display:none\}/.test(cssText), '阅读模式应彻底隐藏吸顶工具栏');
  assert.ok(!/className: 'xal-tools', style: \{[^}]*marginBottom/.test(source), '不应保留内联 marginBottom 干扰吸顶');
  console.log('工具栏吸顶 OK：sticky 固定顶部、有背景、阅读模式隐藏');
}

// 中英文界面：所有 UI 文案走 t()，词条表齐备，设置里可切换语言。
{
  assert.ok(source.includes('function t(zh, vars)'), '应有 t() 翻译函数');
  assert.ok(source.includes('function setLang(lang)'), '应有 setLang() 切换语言');
  assert.ok(/t\('[^']*[\u4e00-\u9fa5]/.test(source), 'UI 文案应通过 t() 包裹中文原文');
  // 词条表要覆盖足够多的条目，且中英两侧都能占位符替换。
  const enBlock = source.slice(source.indexOf('en: {'), source.indexOf('\n    };', source.indexOf('en: {')));
  const entries = [...enBlock.matchAll(/'([^']*[\u4e00-\u9fa5][^']*)'\s*:/g)];
  assert.ok(entries.length > 100, '英文词条应覆盖主要 UI，实际 ' + entries.length);
  assert.ok(enBlock.includes('{n}'), '词条应支持 {n} 占位符');
  assert.ok(source.includes('setLang(data && data.settings && data.settings.language)'), '加载时应应用已保存的语言');
  assert.ok(/downloadConcurrency: concurrency,\s*language/.test(source), '保存设置应包含 language');
  assert.ok(source.includes("h('option', { value: 'en' }, t('English'))"), '设置里应有英文选项');
  console.log('中英文 OK：' + entries.length + ' 条词条，t()/setLang 齐备，设置可切换');
}

// 划线评论：选中正文后浮出工具条，写回 article.md 的 ==高亮== 标记能渲染。
{
  assert.ok(source.includes('function onMarkdownMouseUp'), '应有正文选中监听');
  assert.ok(source.includes("className: 'xal-selbar'"), '应有浮动划线工具条');
  assert.ok(source.includes("t('划线')") || source.includes("t('划线')"), '应有划线按钮并支持 i18n');
  assert.ok(source.includes("t('评论')"), '应有评论按钮并支持 i18n');
  assert.ok(!source.includes('window.prompt'), 'Electron 下 prompt 不可用，不应使用 window.prompt');
  assert.ok(source.includes('commentPrompt'), '应使用插件内评论输入框');
  assert.ok(source.includes("call('annotate'"), '应调用 annotate 写回文件');
  assert.ok(/occurrence: (selection|sel)\.occurrence/.test(source), '应传递出现序号用于定位');
  // 渲染器要把 ==...== 解析为高亮，评论以 data-comment 承载，供悬浮查看。
  assert.ok(/==\(\[\^=\]\+\)==/.test(source), '渲染器应识别 ==高亮== 标记');
  assert.ok(source.includes('xal-mark'), '高亮应生成带样式的 mark 元素');
  assert.ok(source.includes('data-comment'), '评论应挂在 mark 上供悬浮查看');
  assert.ok(cssText.includes('.xal-md mark.xal-mark'), '应有高亮样式');
  // 评论气泡：明显的圆形徽章 + 自定义悬浮卡片，而不是 9px 的原生 title 提示。
  assert.ok(cssText.includes('width:16px') && cssText.includes('height:16px'), '评论徽章应是明显的圆形标记');
  assert.ok(source.includes('onMarkdownOver') && source.includes('commentPeek'), '悬浮应显示自定义评论卡片');
  assert.ok(cssText.includes('.xal-comment-peek'), '评论卡片应有样式（正常字号、可换行）');
  assert.ok(!/title=.+escapeHtml\(mark\.comment\)/.test(source), '不应再用原生 title 显示评论');
  console.log('划线评论 OK：选中浮条 + 写回 ==标记== + 明显徽章 + 悬浮卡片');
}

// 粘贴即添加：搜索框粘贴 X 链接时识别并弹确认框。
{
  assert.ok(source.includes('function onSearchPaste'), '应有粘贴处理函数');
  assert.ok(source.includes('onPaste: onSearchPaste'), '搜索框应绑定粘贴监听');
  // 走 paste 事件的 clipboardData，不依赖 navigator.clipboard 权限。
  assert.ok(source.includes("event.clipboardData && event.clipboardData.getData('text/plain')"), '应从 paste 事件读剪贴板文本');
  // 主路径走 paste 事件；按钮兜底才用 clipboard API，且失败会明确提示。
  assert.ok(source.includes('navigator.clipboard.readText') && source.includes('无法读取剪贴板'), '按钮兜底用 clipboard API，失败有提示');
  assert.ok(source.includes('twitter\\.com') && source.includes('status'), '应识别 X/Twitter 链接');
  assert.ok(source.includes('setPasteLinks(links)'), '识别到链接应弹确认');
  assert.ok(source.includes('className: \'xal-paste-links\''), '确认框应列出检测到的链接');
  assert.ok(source.includes("call('import'"), '确认后应调用 import 导入');
  assert.ok(cssText.includes('.xal-paste-links'), '粘贴链接列表应有样式');
  console.log('粘贴即添加 OK：paste 事件读剪贴板 + 识别 X 链接 + 确认导入');
}

// 导出 PDF：工具栏按钮 + 调用 exportPdf action。
{
  assert.ok(source.includes('async function exportPdf'), '应有导出处理函数');
  assert.ok(source.includes("call('exportPdf'"), '应调用 exportPdf action');
  assert.ok(source.includes("t('导出 PDF')"), '应有导出按钮文案');
  assert.ok(source.includes('name: \'download\''), '应有下载图标');
  assert.ok(source.includes('exportingPdf'), '应有导出中状态防重复点击');
  assert.ok(source.includes("t('已导出 PDF：{n}'"), '导出后应提示文件路径');
  console.log('导出 PDF OK：工具栏按钮 + exportPdf action + 路径提示');
}

console.log('\n客户端模块测试全部通过。');
