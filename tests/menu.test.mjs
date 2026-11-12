// 右键菜单相关的服务层行为：重命名文章 / 调整收藏夹 / 重命名收藏夹 + Front Matter 同步。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LibraryService } from '../lib/library.js';
import { buildMarkdown, splitFrontMatter, extractMeta } from '../lib/core.js';

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-menu-'));
const dataDir = path.join(base, 'data');
const root = path.join(base, 'library');
await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(root, { recursive: true });

const service = new LibraryService({ dataDir, defaultStorageRoot: root });
await service.init();

const postId = '1234567890';
const articleFile = path.join(root, 'articles', postId, 'article.md');
await fs.mkdir(path.dirname(articleFile), { recursive: true });

// 造一篇已下载的文章，文件里带旧标题的 Front Matter。
await fs.writeFile(articleFile, buildMarkdown({
  meta: {
    postId,
    sourceUrl: 'https://x.com/someone/status/' + postId,
    title: '原标题',
    authorName: '作者',
    authorUsername: 'someone',
    publishedAt: '2026-11-01T00:00:00.000Z',
    threadMode: 'full',
    imageCount: 0,
  },
  body: '# 正文\n\n这里是内容，改标题不应该动它。',
  tags: ['旧标签'],
  collections: [],
}), 'utf8');

service.store.state.articles[postId] = {
  postId,
  originalUrl: 'https://x.com/someone/status/' + postId,
  normalizedUrl: 'https://x.com/someone/status/' + postId,
  title: '原标题',
  excerpt: '',
  authorName: '作者',
  authorUsername: 'someone',
  publishedAt: '2026-11-01T00:00:00.000Z',
  threadMode: 'full',
  downloadStatus: 'ready',
  downloadStage: '',
  imageCount: 0,
  collectionIds: [],
  tags: ['旧标签'],
  starred: false,
  readState: 'unread',
  readingProgress: 0,
  lastReadAt: '',
  storageRoot: root,
  relativeMarkdownPath: 'articles/' + postId + '/article.md',
  contentHash: '',
  lastError: '',
  addedAt: new Date().toISOString(),
  downloadedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
await service.store.save();

// ---- 1. 重命名文章：索引与文件都要变，正文不能动 ----
{
  const updated = await service.updateArticle(postId, { title: '我的新标题' });
  assert.equal(updated.title, '我的新标题', '索引里的标题应更新');

  const raw = await fs.readFile(articleFile, 'utf8');
  const { frontMatter, body } = splitFrontMatter(raw);
  assert.equal(frontMatter.title, '我的新标题', '文件里的 Front Matter 标题应同步');
  assert.ok(body.includes('这里是内容，改标题不应该动它'), '正文必须原样保留');
  assert.equal(frontMatter.x_post_id, postId, 'post id 不应被破坏');
  assert.equal(frontMatter.source_url, 'https://x.com/someone/status/' + postId, '来源链接不应被破坏');
  console.log('重命名文章 OK：索引 + Front Matter 同步，正文未动');
}

// ---- 2. 调整所属收藏夹：文件里的 collections 跟着变 ----
{
  const a = await service.createCollection({ name: 'AI相关' });
  const b = await service.createCollection({ name: '自媒体' });

  await service.updateArticle(postId, { collectionIds: [a.id, b.id] });
  let raw = await fs.readFile(articleFile, 'utf8');
  let parsed = splitFrontMatter(raw).frontMatter;
  assert.deepEqual(parsed.collections, ['AI相关', '自媒体'], '文件应写入收藏夹名称');

  // 移除一个
  await service.updateArticle(postId, { collectionIds: [b.id] });
  raw = await fs.readFile(articleFile, 'utf8');
  parsed = splitFrontMatter(raw).frontMatter;
  assert.deepEqual(parsed.collections, ['自媒体'], '移除后文件应只剩一个');

  // 全部移除
  await service.updateArticle(postId, { collectionIds: [] });
  raw = await fs.readFile(articleFile, 'utf8');
  parsed = splitFrontMatter(raw).frontMatter;
  assert.deepEqual(parsed.collections, [], '清空后应为空数组');
  console.log('调整所属收藏夹 OK：增删清空都同步到文件');
}

// ---- 3. 重命名收藏夹 ----
{
  const list = service.snapshot().collections;
  const target = list.find((item) => item.name === '自媒体');
  const renamed = await service.updateCollection(target.id, { name: '内容运营' });
  assert.equal(renamed.name, '内容运营', '收藏夹应改名');

  // 同名拒绝由 createCollection 保证；updateCollection 允许改名，但不能与已有重名冲突时被静默覆盖。
  const snapshot = service.snapshot();
  assert.ok(snapshot.collections.some((item) => item.name === '内容运营'));
  console.log('重命名收藏夹 OK');
}

// ---- 4. 无效的收藏夹 id 会被过滤掉 ----
{
  await service.updateArticle(postId, { collectionIds: ['不存在的id'] });
  const item = service.snapshot().articles.find((entry) => entry.postId === postId);
  assert.deepEqual(item.collectionIds, [], '不存在的收藏夹 id 应被过滤');
  console.log('非法收藏夹 id 过滤 OK');
}

// ---- 5. 文件被删掉后改标题不应崩 ----
{
  await fs.rm(articleFile, { force: true });
  const updated = await service.updateArticle(postId, { title: '文件没了也能改' });
  assert.equal(updated.title, '文件没了也能改', '文件缺失时索引仍应更新成功');
  console.log('文件缺失时改标题不崩 OK（索引是权威）');
}

// ---- 6. 标题长度与空白处理 ----
{
  const long = '   ' + 'x'.repeat(300) + '  ';
  const updated = await service.updateArticle(postId, { title: long });
  assert.equal(updated.title.length, 200, '标题应截断到 200');
  assert.ok(!updated.title.startsWith(' '), '标题应去掉首尾空白');
  console.log('标题长度与空白处理 OK');
}

// ---- 7. Front Matter 字段名兼容：扫描重建不能把元数据读丢 ----
{
  // buildMarkdown 写出的是 author_name / source_url / published_at / thread_mode，
  // extractMeta 必须认得这套名字，否则「扫描存储目录」重建后标题、作者、来源全空。
  const meta = {
    postId: '9876543210',
    sourceUrl: 'https://x.com/someone/status/9876543210',
    title: '重建出来的标题',
    authorName: '某作者',
    authorUsername: 'someone',
    publishedAt: '2026-02-03T04:05:06.000Z',
    threadMode: 'full',
    imageCount: 2,
  };
  const written = buildMarkdown({ meta, body: '正文内容', tags: [], collections: [] });
  const parsed = splitFrontMatter(written);
  const rebuilt = extractMeta(parsed.frontMatter, meta.postId);
  assert.equal(rebuilt.title, '重建出来的标题', '标题应能从 Front Matter 读回');
  assert.equal(rebuilt.authorName, '某作者', '作者名应能读回');
  assert.equal(rebuilt.authorUsername, 'someone', '用户名应能读回');
  assert.equal(rebuilt.publishedAt, '2026-02-03T04:05:06.000Z', '发布时间应能读回');
  assert.equal(rebuilt.sourceUrl, 'https://x.com/i/web/status/9876543210', '来源应能读回');
  assert.equal(rebuilt.threadMode, 'full', '线程模式应能读回');

  // 老格式（author 带 @、source、published、type）也要认。
  const legacy = extractMeta({
    title: '老格式',
    author: '老王 (@laowang)',
    source: 'https://x.com/laowang/status/111222333444',
    published: '2026-03-04',
    type: 'thread',
  }, '111222333444');
  assert.equal(legacy.authorName, '老王');
  assert.equal(legacy.authorUsername, 'laowang');
  assert.equal(legacy.publishedAt, '2026-03-04T00:00:00.000Z');
  assert.equal(legacy.threadMode, 'full');
  assert.ok(legacy.sourceUrl.includes('111222333444'));
  console.log('Front Matter 字段名兼容 OK（新格式 + 老格式）');
}

await fs.rm(base, { recursive: true, force: true });
console.log('\n右键菜单相关服务层测试全部通过。');
