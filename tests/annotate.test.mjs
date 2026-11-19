// 验证 annotate：把选中文字写回 article.md，带评论/不带评论，且能被 splitFrontMatter 读回。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LibraryService } from '../lib/library.js';
import { buildMarkdown, splitFrontMatter } from '../lib/core.js';

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-annotate-'));
const dataDir = path.join(base, 'data');
const root = path.join(base, 'library');
await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(root, { recursive: true });

const service = new LibraryService({ dataDir, defaultStorageRoot: root });
await service.init();

const postId = '999888777';
const rel = 'articles/' + postId + '/article.md';
const target = path.join(root, rel);
await fs.mkdir(path.dirname(target), { recursive: true });

const body = '# 标题\n\n这是第一段，有问题需要划线。\n\n这是第二段，重复的词需要划线。\n';
await fs.writeFile(target, buildMarkdown({
  meta: { postId, sourceUrl: 'https://x.com/u/status/' + postId, title: '测试', authorName: '作者', authorUsername: 'u', publishedAt: '2026-11-01T00:00:00.000Z', threadMode: 'full', imageCount: 0 },
  body,
  tags: [],
  collections: [],
}), 'utf8');

service.store.state.articles[postId] = {
  postId, originalUrl: 'https://x.com/u/status/' + postId, normalizedUrl: 'https://x.com/u/status/' + postId,
  title: '测试', excerpt: '', authorName: '作者', authorUsername: 'u', publishedAt: '2026-11-01T00:00:00.000Z',
  threadMode: 'full', downloadStatus: 'ready', downloadStage: '', imageCount: 0, collectionIds: [], tags: [],
  starred: false, readState: 'unread', readingProgress: 0, lastReadAt: '', storageRoot: root,
  relativeMarkdownPath: rel, addedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), downloadedAt: new Date().toISOString(),
};

const check = (c, m) => { assert.ok(c, m); console.log('OK  ' + m); };

// 第一次出现的「划线」加纯划线。
let result = await service.annotate({ postId, text: '需要划线', occurrence: 0, comment: '' });
check(result.ok, '纯划线写入成功');
let saved = splitFrontMatter(await fs.readFile(target, 'utf8')).body;
check(saved.includes('==需要划线=='), '正文出现 ==高亮== 标记');
check(!saved.includes('<!--c:'), '无评论时不写评论注释');

// 第二次出现的「划线」加评论。
result = await service.annotate({ postId, text: '需要划线', occurrence: 1, comment: '这里要改' });
check(result.ok, '带评论的划线写入成功');
saved = splitFrontMatter(await fs.readFile(target, 'utf8')).body;
check(/==需要划线==<!--c:[A-Za-z0-9+/=]+-->/.test(saved), '正文出现带 base64 评论的高亮标记');
const decoded = Buffer.from((saved.match(/<!--c:([A-Za-z0-9+/=]+)-->/) || [])[1], 'base64').toString('utf8');
check(decoded === '这里要改', '评论内容可正确还原，实际: ' + decoded);

// 找不到文字时报错。
try {
  await service.annotate({ postId, text: '不存在的文字', occurrence: 0, comment: '' });
  check(false, '应该报错');
} catch (e) {
  check(e.code === 'not-found-in-body', '找不到的文字报 not-found-in-body');
}

await fs.rm(base, { recursive: true, force: true });
console.log('\n划线评论服务层测试全部通过。');
