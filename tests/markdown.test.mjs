// 客户端 Markdown 渲染器测试：从 client.js 中抽出渲染逻辑并验证安全性与常见语法。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = await fs.readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client.js'), 'utf8');

// 抽取渲染相关函数源码，在一个沙箱式作用域里执行。
const start = source.indexOf('const SAFE_PROTOCOLS');
const end = source.indexOf('// ===== 网络与格式化 =====');
if (start < 0 || end < 0) throw new Error('未能定位渲染器源码区间');
const rendererSource = source.slice(start, end);

const factory = new Function(`const API = '/api/x-article-library';\n${rendererSource}\nreturn { renderMarkdown, renderInline, safeHref, assetNameFor, escapeHtml };`);
const { renderMarkdown, renderInline, safeHref, assetNameFor } = factory();

let passed = 0;
const check = (label, condition) => {
  if (!condition) throw new Error(`失败：${label}`);
  passed += 1;
};

// 安全：脚本与危险协议
const evil = renderMarkdown('# 标题\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![a](javascript:alert(1))\n\n<iframe src="https://evil.example"></iframe>', '20');
check('不应出现可执行的 script 标签', !/<script/i.test(evil));
check('script 应被当作纯文本转义', evil.includes('&lt;script&gt;'));
check('javascript: 链接应被剥离', !/href="javascript:/i.test(evil));
check('javascript: 图片应被丢弃', !/src="javascript:/i.test(evil));
check('iframe 应被转义', !/<iframe/i.test(evil));

// 图片：仅允许 assets/ 本地资源与 http(s) 远程图
check('本地资源名提取正确', assetNameFor('assets/001.jpg') === '001.jpg');
check('越界资源名被拒绝', assetNameFor('assets/../secret') === '');
check('绝对路径被拒绝', assetNameFor('/etc/passwd') === '');
check('协议相对地址被拒绝', assetNameFor('//evil.example/a.png') === '');

const localImage = renderMarkdown('![配图](assets/001.jpg)', '20');
check('本地图片生成资源 URL', localImage.includes('/api/x-article-library/asset?postId=20&amp;name=001.jpg'));
check('本地图片使用 figure', localImage.includes('<figure'));
const remoteImage = renderMarkdown('![远程](https://pbs.twimg.com/a.png)', '20');
check('远程图片直接引用', remoteImage.includes('src="https://pbs.twimg.com/a.png"'));
const blockedImage = renderMarkdown('![坏图](data:image/png;base64,AAA)', '20');
check('data: 图片被丢弃', !blockedImage.includes('<img'));

// 链接白名单
check('https 链接保留', safeHref('https://x.com/a') === 'https://x.com/a');
check('mailto 保留', safeHref('mailto:a@b.com') === 'mailto:a@b.com');
check('javascript 拒绝', safeHref('javascript:void(0)') === '');
check('data 拒绝', safeHref('data:text/html,<script>') === '');
check('相对锚点保留', safeHref('#section') === '#section');

// 常见语法
const doc = renderMarkdown([
  '# 一级标题',
  '## 二级标题',
  '',
  '普通段落有 **粗体**、*斜体*、`行内代码`、~~删除线~~。',
  '',
  '- 列表项一',
  '- 列表项二',
  '',
  '1. 有序一',
  '2. 有序二',
  '',
  '> 引用文字',
  '',
  '```js',
  'const a = 1 < 2 && 3 > 2;',
  '```',
  '',
  '| 列A | 列B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '---',
  '',
  '[链接](https://x.com/a)',
].join('\n'), '20');

check('h1 生成', doc.includes('<h1>一级标题</h1>'));
check('h2 生成', doc.includes('<h2>二级标题</h2>'));
check('粗体生成', doc.includes('<strong>粗体</strong>'));
check('斜体生成', doc.includes('<em>斜体</em>'));
check('行内代码生成', doc.includes('<code>行内代码</code>'));
check('删除线生成', doc.includes('<del>删除线</del>'));
check('无序列表生成', doc.includes('<ul><li>列表项一</li>'));
check('有序列表生成', doc.includes('<ol><li>有序一</li>'));
check('引用生成', doc.includes('<blockquote>'));
check('代码块生成', doc.includes('const a = 1 &lt; 2 &amp;&amp; 3 &gt; 2;'));
check('代码块保留语言标记', doc.includes('data-lang="js"'));
check('表格生成', doc.includes('<table><thead>'));
check('表格表头正确', doc.includes('<th>列A</th>'));
check('表格数据正确', doc.includes('<td>1</td>'));
check('分隔线生成', doc.includes('<hr />'));
check('安全链接生成', doc.includes('href="https://x.com/a"') && doc.includes('rel="noreferrer noopener"'));

// 畸形输入不应抛错
const weird = ['', '   ', '######', '```\n未闭合代码块', '| 孤立竖线', '***', '![无地址]()', '[空]()', '> > 嵌套引用', '- '.repeat(50)];
for (const input of weird) {
  try {
    renderMarkdown(input, '20');
    passed += 1;
  } catch (error) {
    throw new Error(`畸形输入抛错（${JSON.stringify(input)}）：${error.message}`);
  }
}

// XSS 回归：属性注入
const attrAttack = renderMarkdown('[点我](https://x.com/a" onmouseover="alert(1))', '20');
check('属性注入被转义', !/onmouseover="alert\(1\)"/.test(attrAttack) || !attrAttack.includes('<a '));
const altAttack = renderMarkdown('![x" onerror="alert(1)](https://pbs.twimg.com/a.png)', '20');
check('alt 属性注入被转义', !/onerror="alert\(1\)"/.test(altAttack) || altAttack.includes('&quot;'));

// BOM 与换行兼容
check('BOM 开头正常渲染', renderMarkdown('\uFEFF# 标题', '20').includes('<h1>标题</h1>'));
check('CRLF 正常渲染', renderMarkdown('# A\r\n\r\n段落', '20').includes('<h1>A</h1>'));

console.log(`Markdown 渲染器：${passed} 项检查全部通过。`);
