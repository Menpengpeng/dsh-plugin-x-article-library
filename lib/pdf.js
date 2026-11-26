// 把本地文章（article.md）导出为 PDF。
// 生成路径：Markdown -> 带样式的 HTML -> Chrome headless --print-to-pdf。
// 不引入运行时依赖；Chrome 为本机已安装的浏览器，找不到时明确报错。
import fs from 'node:fs/promises';
import path from 'node:path';
import { htmlToPdf } from './pdf-print.js';

/** 常见 Chrome / Edge 安装路径，按优先级探测。 */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

/** 找到可用的 Chrome/Edge 可执行文件。 */
export async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // 下一个候选
    }
  }
  return null;
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(https?:|mailto:)/i.test(value)) return value;
  if (/^(data:|javascript:|file:)/i.test(value)) return '';
  return '';
}

/** 内联标记：粗体/斜体/删除线/行内代码/链接。外部内容先转义。 */
function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, href) => {
    const safe = safeUrl(href.replace(/&amp;/g, '&'));
    return safe ? '<a href="' + escapeHtml(safe) + '">' + label + '</a>' : label;
  });
  return out;
}

/** 把本地图片引用改写为绝对路径（file://），让 Chrome 能加载。 */
function imageSrc(src, articleDirAbs) {
  const value = String(src || '').trim();
  const local = value.match(/^assets\/([A-Za-z0-9._-]+)$/);
  if (local) return 'file:///' + path.join(articleDirAbs, 'assets', local[1]).replace(/\\/g, '/');
  if (/^https?:/i.test(value)) return value;
  return '';
}

/**
 * 极简 Markdown -> HTML（够文章阅读用）；外部内容全程当不可信数据。
 * 支持：标题、段落、列表、引用、代码块、水平线、图片、行内样式。
 */
export function markdownToHtml(markdown, articleDirAbs) {
  const lines = String(markdown || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s*' + fence[1]).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++;
      out.push('<pre><code>' + escapeHtml(body.join('\n')) + '</code></pre>');
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      out.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
      i++;
      continue;
    }

    // 水平线
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + markdownToHtml(body.join('\n'), articleDirAbs) + '</blockquote>');
      continue;
    }

    // 列表
    if (/^\s*([-*+]|\d{1,9}[.)])\s+/.test(line)) {
      const ordered = /^\s*\d{1,9}[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d{1,9}[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d{1,9}[.)])\s+/, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push('<' + tag + '>' + items.map((item) => '<li>' + renderInline(item) + '</li>').join('') + '</' + tag + '>');
      continue;
    }

    // 独占一行的图片
    const imageOnly = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (imageOnly) {
      const src = imageSrc(imageOnly[2], articleDirAbs);
      if (src) {
        out.push('<figure><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(imageOnly[1]) + '" />'
          + (imageOnly[3] ? '<figcaption>' + escapeHtml(imageOnly[3]) + '</figcaption>' : '')
          + '</figure>');
      }
      i++;
      continue;
    }

    // 空行
    if (!line.trim()) {
      i++;
      continue;
    }

    // 普通段落（合并连续行）
    const para = [];
    while (i < lines.length && lines[i].trim()
      && !/^(#{1,6})\s|^\s*(```|~~~)|^\s*>\s?|^\s*([-*+]|\d{1,9}[.)])\s+|^\s*!\[/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push('<p>' + renderInline(para.join(' ')) + '</p>');
    else { out.push('<p>' + renderInline(line) + '</p>'); i++; }
  }
  return out.join('\n');
}

/** 构造完整 HTML 文档（内联样式，A4 友好，中文字体）。 */
export function buildHtml({ title, author, publishedAt, sourceUrl, bodyHtml }) {
  const meta = [];
  if (author) meta.push('<span>作者：' + escapeHtml(author) + '</span>');
  if (publishedAt) meta.push('<span>发布于：' + escapeHtml(publishedAt) + '</span>');
  if (sourceUrl) meta.push('<span>原文：' + escapeHtml(sourceUrl) + '</span>');
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>' + escapeHtml(title || '文章')
    + '</title><style>'
    + '@page{size:A4;margin:18mm 16mm}'
    + 'body{font-family:"Microsoft YaHei","微软雅黑","PingFang SC","Noto Sans CJK SC",sans-serif;'
    + 'font-size:11pt;line-height:1.75;color:#1a1a1a;margin:0}'
    + 'h1{font-size:20pt;line-height:1.35;margin:0 0 10px;word-break:break-word}'
    + 'h2{font-size:16pt;margin:20px 0 8px}h3{font-size:13pt;margin:16px 0 6px}'
    + 'h4,h5,h6{font-size:11.5pt;margin:14px 0 5px}'
    + '.xal-meta{font-size:9pt;color:#666;display:flex;flex-wrap:wrap;gap:12px;'
    + 'padding-bottom:8px;margin-bottom:16px;border-bottom:1px solid #ddd;word-break:break-all}'
    + 'p{margin:0 0 10px}blockquote{border-left:3px solid #ccc;padding:4px 12px;margin:0 0 12px;color:#555;background:#fafafa}'
    + 'pre{background:#f5f5f5;border:1px solid #e5e5e5;border-radius:4px;padding:10px;white-space:pre-wrap;'
    + 'word-break:break-word;font-size:9pt}'
    + 'code{font-family:Consolas,Monaco,monospace;background:#f5f5f5;padding:1px 4px;border-radius:3px;font-size:9.5pt}'
    + 'pre code{background:none;padding:0}'
    + 'ul,ol{margin:0 0 12px;padding-left:22px}li{margin:3px 0}'
    + 'a{color:#1a6dc4;text-decoration:none;word-break:break-all}'
    + 'figure{margin:12px 0;text-align:center}figure img{max-width:100%;height:auto;border:1px solid #eee;border-radius:4px}'
    + 'figcaption{font-size:9pt;color:#888;margin-top:4px}hr{border:0;border-top:1px solid #ddd;margin:18px 0}'
    + markStyle()
    + '</style></head><body><h1>' + escapeHtml(title || '文章') + '</h1>'
    + (meta.length ? '<div class="xal-meta">' + meta.join('') + '</div>' : '')
    + '<article>' + bodyHtml + '</article></body></html>';
}

/** 划线/评论标记在 PDF 里也保留（复用正文里的 ==高亮== 语法）。 */
function markStyle() {
  return 'mark.xal-mark{background:#fff2a8;border-bottom:1px solid #e0b400;color:inherit}'
    + 'mark.xal-mark.has-comment{border-bottom-style:dashed}';
}

/**
 * 导出文章为 PDF 文件。
 * @param {object} opts
 * @param {string} opts.body Markdown 正文
 * @param {string} opts.articleDirAbs 文章目录绝对路径（用于本地图片）
 * @param {string} opts.title / author / publishedAt / sourceUrl
 * @param {string} opts.target 目标 PDF 路径
 * @returns {Promise<{path:string, bytes:number}>}
 */
export async function exportArticlePdf(opts) {
  const chrome = await findChrome();
  if (!chrome) throw Object.assign(new Error('未找到 Chrome/Edge，无法导出 PDF（可设置 CHROME_PATH）'), { code: 'no-chrome' });
  const bodyHtml = markdownToHtml(opts.body, opts.articleDirAbs);
  const html = buildHtml({
    title: opts.title,
    author: opts.author,
    publishedAt: opts.publishedAt,
    sourceUrl: opts.sourceUrl,
    bodyHtml,
  });
  const bytes = await htmlToPdf(html, chrome);
  if (!bytes.length || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw Object.assign(new Error('生成的 PDF 无效'), { code: 'invalid-pdf' });
  }
  await fs.mkdir(path.dirname(opts.target), { recursive: true });
  await fs.writeFile(opts.target, bytes);
  return { path: opts.target, bytes: bytes.length };
}
