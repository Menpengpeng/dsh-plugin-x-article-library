// 端到端验证 pdf.js：造一篇带中文/图片/列表的 Markdown，导出真实 PDF 并检验。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findChrome, markdownToHtml, buildHtml, exportArticlePdf } from '../lib/pdf.js';
import { htmlToPdf } from '../lib/pdf-print.js';

const assert = (c, m) => { if (!c) throw new Error('断言失败: ' + m); console.log('OK  ' + m); };

const chrome = await findChrome();
assert(chrome, '找到 Chrome/Edge: ' + chrome);

// HTML 渲染
const body = '# 大标题\n\n这是**中文**正文，带一段==划线==和[链接](https://example.com)。\n\n## 小节\n\n- 第一项\n- 第二项\n\n> 一段引用\n\n```js\nconst x = 1;\n```\n';
const html = markdownToHtml(body, path.join(os.tmpdir(), 'fake'));
assert(html.includes('<h1>大标题</h1>'), 'Markdown 标题正确渲染');
assert(html.includes('<strong>中文</strong>'), '粗体正确渲染');
assert(html.includes('<ul>'), '列表正确渲染');
assert(html.includes('<blockquote>'), '引用正确渲染');
assert(html.includes('<pre><code>'), '代码块正确渲染');

const doc = buildHtml({ title: '测试文章', author: '作者', publishedAt: '2026-11-26', sourceUrl: 'https://x.com/u/status/123', bodyHtml: html });
assert(doc.includes('charset="utf-8"'), 'HTML 声明 UTF-8');
assert(doc.includes('Microsoft YaHei'), '使用中文字体');

// 真实生成 PDF
const bytes = await htmlToPdf(doc, chrome);
assert(bytes.length > 1000, '生成 PDF 有内容: ' + bytes.length + ' 字节');
assert(bytes.subarray(0, 5).toString('ascii') === '%PDF-', 'PDF 签名正确');

// exportArticlePdf 落到指定路径
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-pdf-e2e-'));
const target = path.join(tmp, 'article.pdf');
const result = await exportArticlePdf({ body, articleDirAbs: tmp, title: '测试文章', author: '作者', publishedAt: '2026-11-26', sourceUrl: '', target });
assert(result.path === target, '导出到指定路径');
const stat = await fs.stat(target);
assert(stat.size === result.bytes && stat.size > 1000, '文件已写盘且非空: ' + stat.size);
await fs.rm(tmp, { recursive: true, force: true });

console.log('\nPDF 导出端到端验证全部通过。');
