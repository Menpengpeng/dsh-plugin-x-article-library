// 阅读三态的服务层行为：未读 / 未读完(reading) / 已读，以及未读统计。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LibraryService } from '../lib/library.js';

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-readstate-'));
const dataDir = path.join(base, 'data');
const root = path.join(base, 'library');
await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(root, { recursive: true });

const service = new LibraryService({ dataDir, defaultStorageRoot: root });
await service.init();

function addArticle(postId, readState = 'unread', readingProgress = 0) {
  service.store.state.articles[postId] = {
    postId,
    originalUrl: 'https://x.com/u/status/' + postId,
    normalizedUrl: 'https://x.com/u/status/' + postId,
    title: '文章 ' + postId,
    excerpt: '',
    authorName: '作者',
    authorUsername: 'u',
    publishedAt: '2026-11-01T00:00:00.000Z',
    threadMode: 'full',
    downloadStatus: 'ready',
    downloadStage: '',
    imageCount: 0,
    collectionIds: [],
    tags: [],
    starred: false,
    readState,
    readingProgress,
    lastReadAt: '',
    storageRoot: root,
    relativeMarkdownPath: 'articles/' + postId + '/article.md',
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    downloadedAt: new Date().toISOString(),
  };
}

addArticle('111', 'unread', 0);
addArticle('222', 'reading', 0.4);
addArticle('333', 'read', 1);

const check = (condition, message) => {
  assert.ok(condition, message);
  console.log('OK  ' + message);
};

// 未读统计应包含 unread 与 reading，不含已读。
check(service.stats().unread === 2, '未读统计 = 2（未读 1 + 未读完 1），实际 ' + service.stats().unread);

// reading 是合法的 readState，且进度被夹在 0–1。
await service.updateArticle('111', { readState: 'reading', readingProgress: 0.5 });
check(service.store.state.articles['111'].readState === 'reading', '可把文章标为未读完');
check(service.store.state.articles['111'].readingProgress === 0.5, '阅读进度写入为 0.5');
check(service.stats().unread === 2, '标为未读完的文章仍计入未读');

await service.updateArticle('111', { readingProgress: 2 });
check(service.store.state.articles['111'].readingProgress === 1, '进度超过 1 被夹到 1');
await service.updateArticle('111', { readingProgress: -1 });
check(service.store.state.articles['111'].readingProgress === 0, '进度低于 0 被夹到 0');

// 读完转 read。
await service.updateArticle('111', { readState: 'read', readingProgress: 1 });
check(service.store.state.articles['111'].readState === 'read', '可把文章标为已读');
check(service.stats().unread === 1, '读完从未读统计中移除，实际 ' + service.stats().unread);

// 非法状态被拒绝，保持原值。
await service.updateArticle('111', { readState: 'bogus' });
check(service.store.state.articles['111'].readState === 'read', '非法 readState 被拒绝，保持已读');

await fs.rm(base, { recursive: true, force: true });
console.log('\n阅读三态服务层测试全部通过。');
