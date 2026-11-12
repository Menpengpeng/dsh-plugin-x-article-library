// 存储位置切换 + 文件定位的实测。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LibraryService } from '../lib/library.js';
import { explorerTarget, revealPath } from '../lib/reveal.js';

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-root-'));
const dataDir = path.join(base, 'data');
const rootA = path.join(base, 'library-a');
const rootB = path.join(base, 'library-b');
await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(rootA, { recursive: true });
await fs.mkdir(rootB, { recursive: true });

// ---- 1. explorerTarget：Explorer 会在逗号和等号处截断 ----
{
  const target = explorerTarget('C:\\tmp\\a, b=c.md');
  assert.ok(!target.includes(','), '逗号必须转义，否则 Explorer 截断');
  assert.ok(target.includes('%2C'), '逗号应编码为 %2C');
  assert.ok(target.includes('%3D'), '等号应编码为 %3D');
  assert.ok(target.startsWith('file:///'), '应是 file URI');

  // 非 ASCII 必须还原成字面字符，百分号编码的中文会被 Explorer 拒绝并打开文档目录。
  const cn = explorerTarget('C:\\tmp\\中文 目录\\文章.md');
  assert.ok(cn.includes('中文'), '中文应保留字面形式');
  assert.ok(!cn.includes('%E4%'), '不应保留中文的百分号编码');
  assert.ok(cn.includes('%20'), '空格仍应编码');
  console.log('explorerTarget OK：逗号/等号转义、非 ASCII 还原、空格编码');
}

// ---- 2. 写入一篇文章到 rootA ----
const service = new LibraryService({ dataDir, defaultStorageRoot: rootA });
await service.init();
assert.equal(service.settings.storageRoot, rootA, '初始根目录应为 A');

const postId = '20';
service.store.state.articles[postId] = {
  postId,
  originalUrl: 'https://x.com/jack/status/20',
  normalizedUrl: 'https://x.com/jack/status/20',
  title: '测试文章',
  excerpt: '',
  authorName: 'jack',
  authorUsername: 'jack',
  publishedAt: '2006-03-21T00:00:00.000Z',
  threadMode: 'full',
  downloadStatus: 'ready',
  downloadStage: '',
  imageCount: 0,
  collectionIds: [],
  tags: [],
  starred: false,
  readState: 'unread',
  readingProgress: 0,
  lastReadAt: '',
  storageRoot: rootA,
  relativeMarkdownPath: 'articles/20/article.md',
  contentHash: '',
  lastError: '',
  addedAt: new Date().toISOString(),
  downloadedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
await fs.mkdir(path.join(rootA, 'articles', postId), { recursive: true });
await fs.writeFile(path.join(rootA, 'articles', postId, 'article.md'), '\uFEFF# 测试文章\n\n正文内容。');
await service.store.save();

// 能读到
const first = await service.readContent(postId);
assert.equal(first.title, '测试文章');
console.log('初始读取 OK');

// ---- 3. 关键场景：切换全局存储位置后，旧文章仍能读 ----
await service.updateSettings({ storageRoot: rootB });
assert.equal(service.settings.storageRoot, rootB, '全局根目录已切到 B');

const afterSwitch = await service.readContent(postId);
assert.equal(afterSwitch.title, '测试文章', '切换存储位置后旧文章必须仍可读');
assert.ok(afterSwitch.body.includes('正文内容'), '正文应完整');
console.log('切换存储位置后旧文章仍可读 OK（这是修复的核心缺陷）');

// 定位也指向原目录
const located = await service.locateArticle(postId);
assert.equal(located.root, rootA, '定位应指向文章实际所在目录 A');
assert.equal(located.file, path.join(rootA, 'articles', postId, 'article.md'));
console.log('定位路径 OK：', located.file);

// ---- 4. 删除含文件也用原根目录 ----
const removed = await service.removeArticle(postId, true);
assert.equal(removed.filesDeleted, true, '应删除文件');
let stillThere = true;
try {
  await fs.access(path.join(rootA, 'articles', postId));
} catch {
  stillThere = false;
}
assert.equal(stillThere, false, '文件应已从 rootA 删除（而不是去 rootB 找）');
console.log('删除含文件走原根目录 OK');

// ---- 5. 缺失文件时定位报 not-found，而不是把坏路径丢给系统 ----
await assert.rejects(
  () => service.locateArticle(postId),
  (error) => error.code === 'not-found',
  '文章不存在时应报 not-found',
);

// ---- 6. 旧数据没有 storageRoot 时回退到全局设置 ----
service.store.state.articles['21'] = {
  postId: '21',
  title: '旧文章',
  downloadStatus: 'ready',
  relativeMarkdownPath: 'articles/21/article.md',
  collectionIds: [],
  tags: [],
  addedAt: new Date().toISOString(),
};
await fs.mkdir(path.join(rootB, 'articles', '21'), { recursive: true });
await fs.writeFile(path.join(rootB, 'articles', '21', 'article.md'), '\uFEFF# 旧文章\n\n老数据没有 storageRoot 字段。');
const legacy = await service.readContent('21');
assert.equal(legacy.title, '旧文章', '旧数据应回退到全局设置仍可读');
console.log('旧数据（无 storageRoot）兼容 OK');

// ---- 7. 真实调用定位：确认不抛错 ----
if (process.platform === 'win32') {
  const result = await revealPath(path.join(rootB, 'articles', '21', 'article.md'));
  assert.equal(result.revealed, true);
  assert.equal(result.mode, 'select');
  console.log('真实 Explorer 定位调用 OK（退出码 1 已按成功处理）');
}

await fs.rm(base, { recursive: true, force: true });
console.log('\n存储位置与文件定位测试全部通过。');
