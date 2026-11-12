// 文章核心逻辑：链接解析、Xtracticle 下载、Front Matter 解析、图片本地化与文件写入。

import fs from 'node:fs/promises';
import path from 'node:path';
import { request, requestText } from './http.js';

/** 支持解析的域名白名单（含常见镜像与 Nitter 实例）。 */
const SUPPORTED_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
  'fxtwitter.com',
  'www.fxtwitter.com',
  'vxtwitter.com',
  'fixupx.com',
  'nitter.net',
  'nitter.poast.org',
  'nitter.privacydev.net',
]);

const IMAGE_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
]);

/** 帖子 ID 形态：X 早期帖子 ID 可能很短，统一按 1–25 位数字校验。 */
export const POST_ID_PATTERN = /^\d{1,25}$/;

/** 从 URL 路径中提取帖子 ID。 */
const POST_ID_IN_PATH = /\/status(?:es)?\/(\d{1,25})/i;

export const DOWNLOAD_BASE = 'https://xtracticle.com/api/markdown';

/**
 * 从任意文本中提取 X 链接的 Post ID。
 * @param {string} input 用户粘贴的文本
 * @returns {{postIds:string[], invalid:string[], duplicates:number}}
 */
export function parseLinks(input) {
  const text = String(input || '');
  const matches = text.match(/https?:\/\/[^\s<>"'）)】\]]+/gi) || [];
  const bare = text.match(/(?:^|\s)(\d{1,25})(?=\s|$)/g) || [];

  const seen = new Set();
  const postIds = [];
  const invalid = [];
  let duplicates = 0;

  const push = (postId) => {
    if (seen.has(postId)) {
      duplicates += 1;
      return;
    }
    seen.add(postId);
    postIds.push(postId);
  };

  for (const candidate of matches) {
    const parsed = parsePostUrl(candidate);
    if (parsed) push(parsed);
    else invalid.push(candidate);
  }

  for (const chunk of bare) {
    const id = chunk.trim();
    if (POST_ID_PATTERN.test(id)) push(id);
  }

  return { postIds, invalid, duplicates };
}

/**
 * 解析单个 URL，返回 Post ID 或 null。
 * @param {string} url
 * @returns {string|null}
 */
export function parsePostUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url).trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (!SUPPORTED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const match = parsed.pathname.match(POST_ID_IN_PATH);
  return match ? match[1] : null;
}

/** 统一的标准来源链接。 */
export function normalizedUrl(postId) {
  return `https://x.com/i/web/status/${postId}`;
}

/**
 * 调用 Xtracticle 拉取 Markdown 正文。
 * @param {string} postId
 * @param {{thread?:boolean, signal?:AbortSignal, timeoutMs?:number}} options
 */
export async function fetchMarkdown(postId, options = {}) {
  const thread = options.thread === true ? 1 : 0;
  const url = `${DOWNLOAD_BASE}/${encodeURIComponent(postId)}?thread=${thread}&front_matter=1`;
  const response = await requestText(url, {
    timeoutMs: options.timeoutMs ?? 45000,
    maxBytes: 12 * 1024 * 1024,
    signal: options.signal,
    headers: { accept: 'text/markdown, text/plain;q=0.9, */*;q=0.8' },
  });

  if (response.status === 404) {
    throw Object.assign(new Error('内容不可公开访问：可能已删除、受保护、有年龄限制或账号私密'), {
      code: 'blocked',
      status: 404,
    });
  }
  if (response.status === 429) {
    throw Object.assign(new Error('下载服务限流，请稍后再试'), { code: 'rate-limit', status: 429 });
  }
  if (response.status < 200 || response.status >= 300) {
    throw Object.assign(new Error(`下载服务返回 HTTP ${response.status}`), { code: 'upstream', status: response.status });
  }

  const markdown = response.text.trim();
  if (!markdown) {
    throw Object.assign(new Error('下载服务返回了空内容'), { code: 'empty' });
  }
  if (/^Post not found/i.test(markdown.slice(0, 40))) {
    throw Object.assign(new Error('内容不可公开访问：可能已删除、受保护、有年龄限制或账号私密'), { code: 'blocked' });
  }
  return markdown;
}

/**
 * 解析 Markdown 的 YAML Front Matter。
 * @param {string} markdown
 */
export function splitFrontMatter(markdown) {
  const source = String(markdown || '').replace(/^\uFEFF/, '');
  if (!source.startsWith('---')) return { frontMatter: {}, body: source.trim() };
  const end = source.indexOf('\n---', 3);
  if (end < 0) return { frontMatter: {}, body: source.trim() };
  const raw = source.slice(3, end).trim();
  const body = source.slice(end + 4).replace(/^[\r\n]+/, '');
  return { frontMatter: parseYamlLite(raw), body: body.trim() };
}

/** 极简 YAML 解析：只处理标量、行内数组和简单列表，足够覆盖 Front Matter。 */
function parseYamlLite(raw) {
  const result = {};
  // 块状列表：`key:` 之后跟若干 `  - item` 行。
  // 之前直接跳过所有缩进行，导致自己写出的 tags / collections 读不回来。
  let listKey = '';
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;

    const itemMatch = /^\s+-\s*(.*)$/.exec(line);
    if (itemMatch) {
      if (listKey) {
        const item = unquote(itemMatch[1].trim());
        if (item) result[listKey].push(item);
      }
      continue;
    }
    if (/^\s/.test(line)) continue;

    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (!key) continue;
    listKey = '';
    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
      continue;
    }
    if (!value) {
      // 可能是块状列表的开头，先占位成空数组。
      result[key] = [];
      listKey = key;
      continue;
    }
    result[key] = unquote(value);
  }
  return result;
}

function unquote(value) {
  const text = String(value);
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

/**
 * 从 Front Matter 中提取结构化元数据。
 * @param {Record<string, unknown>} frontMatter
 * @param {string} fallbackPostId
 */
export function extractMeta(frontMatter, fallbackPostId) {
  // 同时认两套字段名：buildMarkdown 写的是 xxx_yyy 这种下划线风格，
  // 早期手写或外部工具产出的文件可能是 author / source / published。
  const title = String(frontMatter.title || '').trim() || `X 文章 ${fallbackPostId}`;

  const authorNameRaw = String(frontMatter.author_name || '').trim();
  const authorUsernameRaw = String(frontMatter.author_username || '').trim();
  const authorRaw = String(frontMatter.author || '').trim();
  const usernameMatch = authorRaw.match(/\(@([A-Za-z0-9_]+)\)/);
  const authorUsername = authorUsernameRaw || (usernameMatch ? usernameMatch[1] : '');
  const authorName = authorNameRaw || authorRaw.replace(/\s*\(@[A-Za-z0-9_]+\)\s*/, '').trim() || authorUsername || '未知作者';

  // source_url 是权威来源，其次才是 source，最后按 postId 兜底。
  const sourceRaw = String(frontMatter.source_url || frontMatter.source || '').trim();
  const sourceMatch = sourceRaw.match(POST_ID_IN_PATH) || sourceRaw.match(/\/(\d{6,})\b/);
  const published = String(frontMatter.published_at || frontMatter.published || '').trim();
  const threadMode = String(frontMatter.thread_mode || frontMatter.type || '').trim();

  return {
    title,
    authorName,
    authorUsername,
    sourceUrl: sourceMatch ? normalizedUrl(sourceMatch[1]) : normalizedUrl(fallbackPostId),
    publishedAt: normalizeDate(published),
    threadMode: threadMode === 'thread' || threadMode === 'full' ? 'full' : 'auto',
  };
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

/**
 * 去掉正文开头与 Front Matter 重复的标题与作者信息块。
 * Xtracticle 的输出形如：
 *   # 标题
 *   **Author:** jack ([@jack](...))
 *   **Date:** ...
 *   **Source:** ...
 *   ---
 * 这些信息已在阅读器头部单独展示，正文里重复出现会让排版变差。
 * 只有确实存在 Author/Date/Source 标记时才裁剪，避免误删正常的正文标题。
 * @param {string} body
 */
export function stripHeaderBlock(body) {
  const lines = String(body || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const isMeta = (line) => /^\*\*(Author|Date|Source|Published|Type):\*\*/i.test(line.trim());
  const hasMeta = lines.slice(0, 12).some(isMeta);
  if (!hasMeta) return lines.join('\n').trim();

  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index < lines.length && /^#\s+/.test(lines[index].trim())) index += 1;
  while (index < lines.length && (!lines[index].trim() || isMeta(lines[index]))) index += 1;
  if (index < lines.length && /^\s*(---|\*\*\*|___)\s*$/.test(lines[index])) index += 1;
  while (index < lines.length && !lines[index].trim()) index += 1;
  return lines.slice(index).join('\n').trim();
}

/**
 * 收集 Markdown 中的远程图片地址（Markdown 语法与 HTML img 标签）。
 * @param {string} markdown
 */
export function collectImages(markdown) {
  const found = [];
  const seen = new Set();
  const push = (rawUrl) => {
    const url = String(rawUrl || '').trim();
    if (!url || seen.has(url)) return;
    if (!/^https?:\/\//i.test(url)) return;
    seen.add(url);
    found.push(url);
  };
  for (const match of String(markdown).matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) push(match[1]);
  for (const match of String(markdown).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) push(match[1]);
  return found;
}

/**
 * 下载单张图片并返回扩展名与内容。
 * @param {string} url
 * @param {{maxBytes?:number, signal?:AbortSignal}} options
 */
export async function downloadImage(url, options = {}) {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const response = await request(url, {
    timeoutMs: 30000,
    maxBytes,
    signal: options.signal,
    headers: { accept: 'image/*' },
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`图片 HTTP ${response.status}`);
  }
  const contentType = String(response.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
  const extension = IMAGE_EXTENSIONS.get(contentType);
  if (!extension) throw new Error(`不支持的图片类型：${contentType || '未知'}`);
  if (response.body.length === 0) throw new Error('图片内容为空');
  return { extension, buffer: response.body, contentType };
}

/**
 * 把 Markdown 中的远程图片替换为本地相对路径。
 * @param {string} markdown
 * @param {Map<string,string>} mapping 远程 URL → 相对路径
 */
export function rewriteImages(markdown, mapping) {
  let output = String(markdown);
  for (const [remote, local] of mapping) {
    output = output.split(remote).join(local);
  }
  return output;
}

/**
 * 原子写入：先写临时文件再重命名。
 * @param {string} target
 * @param {string|Buffer} content
 */
export async function writeFileAtomic(target, content) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temp, content);
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

/** 安全文件名：去掉非法字符并限制长度。 */
export function safeFileName(value, fallback = 'article') {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!cleaned) return fallback;
  return cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned;
}

/**
 * 校验目标路径仍位于根目录内。
 * @param {string} root
 * @param {string} target
 */
export function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** 生成文章目录路径。 */
export function articleDir(root, postId) {
  return path.join(root, 'articles', String(postId));
}

/**
 * 构建完整的 Markdown 文件内容。
 * @param {object} input
 */
export function buildMarkdown(input) {
  const { meta, body, tags, collections } = input;
  const lines = [
    '---',
    `x_post_id: "${meta.postId}"`,
    `source_url: "${meta.sourceUrl}"`,
    `title: ${yamlString(meta.title)}`,
    `author_name: ${yamlString(meta.authorName)}`,
    `author_username: "${meta.authorUsername}"`,
    `published_at: "${meta.publishedAt}"`,
    `downloaded_at: "${new Date().toISOString()}"`,
    `thread_mode: "${meta.threadMode}"`,
  ];
  if (tags?.length) {
    lines.push('tags:');
    for (const tag of tags) lines.push(`  - ${yamlString(tag)}`);
  } else {
    lines.push('tags: []');
  }
  if (collections?.length) {
    lines.push('collections:');
    for (const name of collections) lines.push(`  - ${yamlString(name)}`);
  } else {
    lines.push('collections: []');
  }
  lines.push(`image_count: ${Number(meta.imageCount || 0)}`);
  lines.push('---', '', body, '');
  return lines.join('\n');
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}
