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
// 导出状态：hasPdf 决定按钮是「导出 PDF」还是「查看 PDF」。
{
  const { LibraryService } = await import('../lib/library.js');
  const root = path.join(tmp, 'lib');
  const dataDir = path.join(tmp, 'data');
  await fs.mkdir(path.join(root, 'articles', '30'), { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    path.join(root, 'articles', '30', 'article.md'),
    '\uFEFF---\ntitle: 状态测试\n---\n\n# 状态测试\n\n正文。',
    'utf8',
  );

  const service = new LibraryService({ dataDir, defaultStorageRoot: root });
  await service.init();
  service.store.state.articles['30'] = {
    postId: '30',
    title: '状态测试',
    downloadStatus: 'ready',
    relativeMarkdownPath: 'articles/30/article.md',
    storageRoot: root,
    collectionIds: [],
    tags: [],
    readState: 'unread',
    readingProgress: 0,
    addedAt: new Date().toISOString(),
  };
  await service.store.save();

  // 未导出时：hasPdf 为假
  let list = service.snapshot().articles.find((item) => item.postId === '30');
  assert(list.hasPdf === false, '未导出时 hasPdf 应为 false');

  // 导出后：hasPdf 变真，PDF 落盘
  const exported = await service.exportPdf('30');
  assert(exported.bytes > 1000, '导出应生成非空 PDF');
  list = service.snapshot().articles.find((item) => item.postId === '30');
  assert(list.hasPdf === true, '导出后 hasPdf 应为 true');
  const pdfPath = path.join(root, 'articles', '30', 'article.pdf');
  const stat = await fs.stat(pdfPath);
  assert(stat.size > 1000, 'PDF 应写盘');
  console.log('导出后标记 OK：hasPdf 由 false 变 true，PDF 落盘');

  // 删除 PDF 后扫描：标记应被自动校准回 false
  await fs.rm(pdfPath);
  await service.scan();
  list = service.snapshot().articles.find((item) => item.postId === '30');
  assert(list.hasPdf === false, 'PDF 被删除后扫描应把 hasPdf 校准回 false');
  console.log('扫描校准 OK：PDF 被删除后 hasPdf 自动回到 false');

  // PDF 不存在时 openPdf 应报 not-found，而不是抛系统错误
  let rejected = null;
  try {
    await service.openPdf('30');
  } catch (error) {
    rejected = error;
  }
  assert(rejected && rejected.code === 'not-found', 'PDF 不存在时 openPdf 应报 not-found');
  console.log('openPdf 缺失处理 OK：报 not-found');
}

await fs.rm(tmp, { recursive: true, force: true });

console.log('\nPDF 导出端到端验证全部通过。');
