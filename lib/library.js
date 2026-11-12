// 资料库应用服务：索引持久化、链接导入、下载队列、文件写入与检索。

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  articleDir,
  buildMarkdown,
  collectImages,
  downloadImage,
  extractMeta,
  fetchMarkdown,
  isInside,
  normalizedUrl,
  parseLinks,
  POST_ID_PATTERN,
  rewriteImages,
  safeFileName,
  splitFrontMatter,
  stripHeaderBlock,
  writeFileAtomic,
} from './core.js';

const DB_VERSION = 1;
const DEFAULT_SETTINGS = {
  storageRoot: '',
  defaultCollectionId: '',
  defaultThreadMode: 'full',
  duplicatePolicy: 'skip',
  cacheImages: true,
  downloadConcurrency: 2,
  readerFontScale: 1,
};

function nowIso() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** 去掉 Markdown 标记，用于生成列表摘要。 */
function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value, limit) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** 索引文件：单一 JSON，原子替换写入。 */
class IndexStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'index.json');
    this.state = { version: DB_VERSION, articles: {}, collections: [], settings: { ...DEFAULT_SETTINGS }, jobs: {} };
    this.writing = Promise.resolve();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.state;
    await fs.mkdir(this.directory, { recursive: true });
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      this.state = {
        version: DB_VERSION,
        articles: parsed.articles && typeof parsed.articles === 'object' ? parsed.articles : {},
        collections: Array.isArray(parsed.collections) ? parsed.collections : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        jobs: parsed.jobs && typeof parsed.jobs === 'object' ? parsed.jobs : {},
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // 索引损坏时保留备份，避免直接覆盖用户数据。
        await fs.rename(this.file, `${this.file}.broken-${Date.now()}`).catch(() => {});
      }
    }
    this.loaded = true;
    return this.state;
  }

  /** 串行写入，避免并发覆盖。 */
  save() {
    this.writing = this.writing.then(async () => {
      await fs.mkdir(this.directory, { recursive: true });
      await writeFileAtomic(this.file, JSON.stringify(this.state, null, 2));
    });
    return this.writing;
  }
}

/** 下载队列：同 postId 去重，限制并发。 */
class DownloadQueue {
  constructor(runner, concurrency) {
    this.runner = runner;
    this.concurrency = Math.max(1, Math.min(4, concurrency || 2));
    this.pending = [];
    this.active = new Set();
  }

  enqueue(postId) {
    if (this.active.has(postId) || this.pending.includes(postId)) return false;
    this.pending.push(postId);
    this.pump();
    return true;
  }

  pump() {
    while (this.active.size < this.concurrency && this.pending.length > 0) {
      const postId = this.pending.shift();
      this.active.add(postId);
      Promise.resolve()
        .then(() => this.runner(postId))
        .catch(() => {})
        .finally(() => {
          this.active.delete(postId);
          this.pump();
        });
    }
  }

  cancel(postId) {
    const index = this.pending.indexOf(postId);
    if (index >= 0) {
      this.pending.splice(index, 1);
      return true;
    }
    return false;
  }

  status(postId) {
    if (this.active.has(postId)) return 'running';
    if (this.pending.includes(postId)) return 'queued';
    return 'idle';
  }

  snapshot() {
    return { active: [...this.active], pending: [...this.pending], concurrency: this.concurrency };
  }
}

export class LibraryService {
  /**
   * @param {{dataDir:string, defaultStorageRoot:string}} options
   */
  constructor(options) {
    this.store = new IndexStore(options.dataDir);
    this.defaultStorageRoot = options.defaultStorageRoot;
    this.queue = new DownloadQueue((postId) => this.runDownload(postId), DEFAULT_SETTINGS.downloadConcurrency);
    this.running = new Map();
  }

  async init() {
    await this.store.load();
    const settings = this.store.state.settings;
    if (!settings.storageRoot) {
      settings.storageRoot = this.defaultStorageRoot;
      await this.store.save();
    }
    this.queue.concurrency = Number(settings.downloadConcurrency) || 2;
    // 重启后把中断的任务恢复为可重试状态。
    let dirty = false;
    for (const [id, job] of Object.entries(this.store.state.jobs)) {
      if (job.status === 'running' || job.status === 'queued') {
        this.store.state.jobs[id] = { ...job, status: 'failed', errorCode: 'interrupted', errorMessage: '插件重启导致任务中断', finishedAt: nowIso() };
        dirty = true;
      }
    }
    for (const article of Object.values(this.store.state.articles)) {
      if (article.downloadStatus === 'downloading' || article.downloadStatus === 'queued') {
        article.downloadStatus = 'failed';
        article.downloadStage = '';
        article.lastError = '插件重启导致任务中断';
        article.updatedAt = nowIso();
        dirty = true;
      }
    }
    if (dirty) await this.store.save();
    return this;
  }

  get settings() {
    return this.store.state.settings;
  }

  /** 对外状态快照。 */
  snapshot() {
    const articles = Object.values(this.store.state.articles)
      .map((article) => this.toListItem(article))
      .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
    return {
      settings: this.settings,
      collections: [...this.store.state.collections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      articles,
      queue: this.queue.snapshot(),
      stats: this.stats(),
    };
  }

  toListItem(article) {
    return {
      postId: article.postId,
      title: article.title,
      excerpt: article.excerpt,
      authorName: article.authorName,
      authorUsername: article.authorUsername,
      publishedAt: article.publishedAt,
      threadMode: article.threadMode,
      downloadStatus: article.downloadStatus,
      downloadStage: article.downloadStage || '',
      imageCount: article.imageCount || 0,
      collectionIds: article.collectionIds || [],
      tags: article.tags || [],
      starred: Boolean(article.starred),
      readState: article.readState || 'unread',
      readingProgress: Number(article.readingProgress) || 0,
      lastError: article.lastError || '',
      normalizedUrl: article.normalizedUrl || normalizedUrl(article.postId),
      addedAt: article.addedAt,
      updatedAt: article.updatedAt,
      downloadedAt: article.downloadedAt || '',
    };
  }

  stats() {
    const articles = Object.values(this.store.state.articles);
    const byStatus = {};
    for (const article of articles) {
      byStatus[article.downloadStatus] = (byStatus[article.downloadStatus] || 0) + 1;
    }
    const authors = new Map();
    for (const article of articles) {
      const key = article.authorUsername || article.authorName || '未知作者';
      const entry = authors.get(key) || { username: article.authorUsername || '', name: article.authorName || '未知作者', count: 0 };
      entry.count += 1;
      authors.set(key, entry);
    }
    return {
      total: articles.length,
      unread: articles.filter((item) => (item.readState || 'unread') === 'unread').length,
      starred: articles.filter((item) => item.starred).length,
      failed: articles.filter((item) => ['failed', 'blocked', 'missing'].includes(item.downloadStatus)).length,
      byStatus,
      authors: [...authors.values()].sort((a, b) => b.count - a.count),
    };
  }

  ensureRoot() {
    const root = this.settings.storageRoot || this.defaultStorageRoot;
    if (!root) throw Object.assign(new Error('尚未设置文章存储目录'), { code: 'no-root' });
    return root;
  }

  /**
   * 取某篇文章实际所在的存储根目录。
   *
   * 文章下载时会把当次的根目录记进 storageRoot。之后用户在设置里改了全局存储位置，
   * 旧文章仍然留在原来的目录里，因此读取时必须优先用它自己的根目录，否则会全部读不到。
   * 早期数据没有这个字段，回退到全局设置。
   */
  rootFor(article) {
    const own = String(article?.storageRoot || '').trim();
    return own || this.ensureRoot();
  }

  /** 导入链接：解析、去重、建立占位记录并排队下载。 */
  async importLinks(input) {
    const parsed = parseLinks(input.links);
    const threadMode = input.threadMode === 'single' ? 'single' : 'full';
    const duplicatePolicy = input.duplicatePolicy === 'overwrite' ? 'overwrite' : 'skip';
    const tags = Array.isArray(input.tags)
      ? input.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
      : [];
    const knownIds = Array.isArray(input.collectionIds)
      ? input.collectionIds.filter((id) => this.store.state.collections.some((item) => item.id === id))
      : [];

    const created = [];
    const skipped = [];
    const existing = [];

    for (const postId of parsed.postIds.slice(0, 100)) {
      const current = this.store.state.articles[postId];
      if (current) {
        existing.push(postId);
        if (duplicatePolicy === 'skip' && current.downloadStatus === 'ready') {
          skipped.push(postId);
          continue;
        }
        if (knownIds.length) {
          current.collectionIds = [...new Set([...(current.collectionIds || []), ...knownIds])];
        }
        if (tags.length) {
          current.tags = [...new Set([...(current.tags || []), ...tags])];
        }
        current.threadMode = threadMode;
        current.updatedAt = nowIso();
      } else {
        this.store.state.articles[postId] = {
          postId,
          originalUrl: normalizedUrl(postId),
          normalizedUrl: normalizedUrl(postId),
          title: '',
          excerpt: '',
          authorName: '',
          authorUsername: '',
          publishedAt: '',
          threadMode,
          downloadStatus: 'queued',
          downloadStage: '等待下载',
          imageCount: 0,
          collectionIds: knownIds,
          tags,
          starred: false,
          readState: 'unread',
          readingProgress: 0,
          lastReadAt: '',
          relativeMarkdownPath: '',
          contentHash: '',
          lastError: '',
          addedAt: nowIso(),
          downloadedAt: '',
          updatedAt: nowIso(),
        };
        created.push(postId);
      }
      this.queue.enqueue(postId);
    }

    await this.store.save();
    return {
      created,
      skipped,
      existing,
      duplicates: parsed.duplicates,
      invalid: parsed.invalid,
      total: parsed.postIds.length,
    };
  }

  /** 单篇下载入口（供队列与工具调用）。 */
  enqueueDownload(postIds) {
    const list = Array.isArray(postIds) ? postIds : [postIds];
    const queued = [];
    for (const raw of list) {
      const postId = String(raw || '').trim();
      if (!POST_ID_PATTERN.test(postId)) continue;
      const article = this.store.state.articles[postId];
      if (!article) continue;
      article.downloadStatus = 'queued';
      article.downloadStage = '等待下载';
      article.lastError = '';
      article.updatedAt = nowIso();
      if (this.queue.enqueue(postId)) queued.push(postId);
    }
    void this.store.save();
    return queued;
  }

  /** 执行单篇下载。 */
  async runDownload(postId) {
    const article = this.store.state.articles[postId];
    if (!article) return;
    const jobId = `${postId}-${Date.now()}`;
    const job = {
      id: jobId,
      postId,
      status: 'running',
      stage: '获取正文',
      progress: 5,
      errorCode: '',
      errorMessage: '',
      createdAt: nowIso(),
      startedAt: nowIso(),
      finishedAt: '',
    };
    this.store.state.jobs[jobId] = job;
    const controller = new AbortController();
    this.running.set(postId, { job, controller });

    const update = async (patch) => {
      Object.assign(article, patch, { updatedAt: nowIso() });
      if (patch.downloadStage !== undefined) job.stage = patch.downloadStage;
      await this.store.save();
    };

    try {
      await update({ downloadStatus: 'downloading', downloadStage: '获取正文' });

      const markdown = await fetchMarkdown(postId, {
        thread: article.threadMode !== 'single',
        signal: controller.signal,
      });
      const { frontMatter, body: rawBody } = splitFrontMatter(markdown);
      const meta = extractMeta(frontMatter, postId);
      const body = stripHeaderBlock(rawBody);
      const images = this.settings.cacheImages ? collectImages(body) : [];

      await update({ downloadStage: `处理正文（${images.length} 张图片）` });

      const root = this.ensureRoot();
      const dir = articleDir(root, postId);
      if (!isInside(root, dir)) throw Object.assign(new Error('目标路径越出存储根目录'), { code: 'unsafe-path' });

      const mapping = new Map();
      const failures = [];
      const pending = images.slice(0, 30);
      if (pending.length) {
        await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
        let index = 0;
        for (const remote of pending) {
          index += 1;
          job.stage = `下载图片 ${index}/${pending.length}`;
          try {
            const image = await downloadImage(remote, { signal: controller.signal });
            const name = `${String(index).padStart(3, '0')}${image.extension}`;
            await writeFileAtomic(path.join(dir, 'assets', name), image.buffer);
            mapping.set(remote, `assets/${name}`);
          } catch (error) {
            failures.push({ url: remote, reason: String(error?.message || error) });
          }
        }
      }

      const localizedBody = mapping.size ? rewriteImages(body, mapping) : body;
      const collectionNames = (article.collectionIds || [])
        .map((id) => this.store.state.collections.find((item) => item.id === id)?.name)
        .filter(Boolean);
      const finalMarkdown = buildMarkdown({
        meta: { ...meta, postId, imageCount: mapping.size, threadMode: article.threadMode },
        body: localizedBody,
        tags: article.tags,
        collections: collectionNames,
      });

      await update({ downloadStage: '写入文件' });

      const target = path.join(dir, 'article.md');
      await writeFileAtomic(target, `\uFEFF${finalMarkdown}`);
      await writeFileAtomic(
        path.join(dir, 'metadata.json'),
        JSON.stringify(
          {
            postId,
            sourceUrl: meta.sourceUrl,
            title: meta.title,
            authorName: meta.authorName,
            authorUsername: meta.authorUsername,
            publishedAt: meta.publishedAt,
            downloadedAt: nowIso(),
            threadMode: article.threadMode,
            imageCount: mapping.size,
            failedImages: failures,
            markdownPath: 'article.md',
          },
          null,
          2,
        ),
      );

      Object.assign(article, {
        title: meta.title,
        excerpt: clampText(stripMarkdown(localizedBody), 180),
        authorName: meta.authorName,
        authorUsername: meta.authorUsername,
        publishedAt: meta.publishedAt,
        imageCount: mapping.size,
        downloadStatus: 'ready',
        downloadStage: '',
        lastError: '',
        storageRoot: root,
        relativeMarkdownPath: path.relative(root, target).split(path.sep).join('/'),
        contentHash: sha256(localizedBody),
        downloadedAt: nowIso(),
        updatedAt: nowIso(),
      });
      Object.assign(job, { status: 'ready', stage: '完成', progress: 100, finishedAt: nowIso() });
      await this.store.save();
    } catch (error) {
      const code = error?.code || 'error';
      const message = String(error?.message || error);
      Object.assign(article, {
        downloadStatus: code === 'blocked' ? 'blocked' : 'failed',
        downloadStage: '',
        lastError: message,
        updatedAt: nowIso(),
      });
      Object.assign(job, {
        status: code === 'blocked' ? 'blocked' : 'failed',
        errorCode: code,
        errorMessage: message,
        finishedAt: nowIso(),
      });
      await this.store.save();
    } finally {
      this.running.delete(postId);
    }
  }

  /** 读取正文用于预览。 */
  async readContent(postId) {
    const article = this.store.state.articles[String(postId)];
    if (!article) throw Object.assign(new Error('文章不存在'), { code: 'not-found' });
    if (article.downloadStatus !== 'ready' || !article.relativeMarkdownPath) {
      throw Object.assign(new Error('文章尚未下载完成'), { code: 'not-ready' });
    }
    const root = this.rootFor(article);
    const target = path.join(root, article.relativeMarkdownPath);
    if (!isInside(root, target)) throw Object.assign(new Error('路径非法'), { code: 'unsafe-path' });
    const raw = await fs.readFile(target, 'utf8');
    const { body } = splitFrontMatter(raw);
    return {
      postId: article.postId,
      title: article.title,
      body,
      authorName: article.authorName,
      authorUsername: article.authorUsername,
      publishedAt: article.publishedAt,
      sourceUrl: article.normalizedUrl,
      imageCount: article.imageCount,
      readingProgress: article.readingProgress,
    };
  }

  /**
   * 取某篇文章正文与所在目录的绝对路径，用于「在资源管理器中定位」。
   * 只返回真实存在的文件路径；不存在时报 not-found 而不是把坏路径交给系统。
   */
  async locateArticle(postId) {
    const article = this.store.state.articles[String(postId)];
    if (!article) throw Object.assign(new Error('文章不存在'), { code: 'not-found' });
    if (article.downloadStatus !== 'ready' || !article.relativeMarkdownPath) {
      throw Object.assign(new Error('文章尚未下载完成'), { code: 'not-ready' });
    }
    const root = this.rootFor(article);
    const target = path.join(root, article.relativeMarkdownPath);
    if (!isInside(root, target)) throw Object.assign(new Error('路径非法'), { code: 'unsafe-path' });
    try {
      await fs.access(target);
    } catch {
      throw Object.assign(new Error('文件不存在，可能已被移动或删除'), { code: 'not-found' });
    }
    return { postId: article.postId, root, file: target, dir: path.dirname(target), title: article.title };
  }

  /** 读取文章资源文件（仅允许 assets 下的简单文件名）。 */
  async readAsset(postId, name) {
    const article = this.store.state.articles[String(postId)];
    const root = article ? this.rootFor(article) : this.ensureRoot();
    const safeName = path.basename(String(name || ''));
    if (!safeName || safeName !== name) throw Object.assign(new Error('资源名非法'), { code: 'unsafe-path' });
    const target = path.join(articleDir(root, String(postId)), 'assets', safeName);
    if (!isInside(root, target)) throw Object.assign(new Error('资源路径非法'), { code: 'unsafe-path' });
    return fs.readFile(target);
  }

  /** 更新文章属性。 */
  async updateArticle(postId, patch) {
    const article = this.store.state.articles[String(postId)];
    if (!article) throw Object.assign(new Error('文章不存在'), { code: 'not-found' });
    if (patch.starred !== undefined) article.starred = Boolean(patch.starred);
    if (patch.readState) {
      if (['unread', 'reading', 'read'].includes(patch.readState)) article.readState = patch.readState;
    }
    if (patch.readingProgress !== undefined) {
      article.readingProgress = Math.max(0, Math.min(1, Number(patch.readingProgress) || 0));
    }
    if (Array.isArray(patch.tags)) article.tags = patch.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
    if (Array.isArray(patch.collectionIds)) {
      article.collectionIds = patch.collectionIds.filter((id) => this.store.state.collections.some((item) => item.id === id));
    }
    if (patch.title) article.title = String(patch.title).trim().slice(0, 200);
    if (patch.readState && patch.readState !== 'unread') article.lastReadAt = nowIso();
    article.updatedAt = nowIso();
    await this.store.save();
    return this.toListItem(article);
  }

  /** 移除记录，可选删除本地文件。 */
  async removeArticle(postId, deleteFiles) {
    const key = String(postId);
    const article = this.store.state.articles[key];
    if (!article) return { removed: false, filesDeleted: false };
    this.queue.cancel(key);
    delete this.store.state.articles[key];
    let filesDeleted = false;
    if (deleteFiles) {
      // 用文章自己的根目录：用户改过全局存储位置后，旧文件仍留在原处。
      const root = String(article.storageRoot || '').trim() || this.settings.storageRoot || this.defaultStorageRoot;
      const dir = articleDir(root, key);
      if (isInside(root, dir)) {
        await fs.rm(dir, { recursive: true, force: true });
        filesDeleted = true;
      }
    }
    await this.store.save();
    return { removed: true, filesDeleted };
  }

  /** 收藏夹增删改。 */
  async createCollection(input) {
    const name = String(input.name || '').trim().slice(0, 40);
    if (!name) throw Object.assign(new Error('收藏夹名称不能为空'), { code: 'invalid' });
    if (this.store.state.collections.some((item) => item.name === name)) {
      throw Object.assign(new Error('已存在同名收藏夹'), { code: 'duplicate' });
    }
    const collection = {
      id: `c_${crypto.randomBytes(6).toString('hex')}`,
      name,
      color: String(input.color || '').slice(0, 32),
      order: this.store.state.collections.length,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.store.state.collections.push(collection);
    await this.store.save();
    return collection;
  }

  async updateCollection(id, patch) {
    const collection = this.store.state.collections.find((item) => item.id === id);
    if (!collection) throw Object.assign(new Error('收藏夹不存在'), { code: 'not-found' });
    if (patch.name) collection.name = String(patch.name).trim().slice(0, 40) || collection.name;
    if (patch.color !== undefined) collection.color = String(patch.color).slice(0, 32);
    if (patch.order !== undefined) collection.order = Number(patch.order) || 0;
    collection.updatedAt = nowIso();
    await this.store.save();
    return collection;
  }

  async deleteCollection(id) {
    const before = this.store.state.collections.length;
    this.store.state.collections = this.store.state.collections.filter((item) => item.id !== id);
    if (this.store.state.collections.length === before) return { deleted: false };
    for (const article of Object.values(this.store.state.articles)) {
      if (article.collectionIds?.includes(id)) {
        article.collectionIds = article.collectionIds.filter((item) => item !== id);
      }
    }
    if (this.settings.defaultCollectionId === id) this.settings.defaultCollectionId = '';
    await this.store.save();
    return { deleted: true };
  }

  /** 更新设置。 */
  async updateSettings(patch) {
    const settings = this.store.state.settings;
    if (patch.storageRoot !== undefined) {
      const next = String(patch.storageRoot || '').trim();
      if (next) {
        await fs.mkdir(next, { recursive: true });
        const probe = path.join(next, `.write-test-${Date.now()}`);
        await fs.writeFile(probe, 'ok');
        await fs.rm(probe, { force: true });
      }
      settings.storageRoot = next || this.defaultStorageRoot;
      settings.storageRootValidatedAt = nowIso();
    }
    if (patch.defaultCollectionId !== undefined) settings.defaultCollectionId = String(patch.defaultCollectionId || '');
    if (patch.defaultThreadMode !== undefined) settings.defaultThreadMode = patch.defaultThreadMode === 'single' ? 'single' : 'full';
    if (patch.duplicatePolicy !== undefined) settings.duplicatePolicy = patch.duplicatePolicy === 'overwrite' ? 'overwrite' : 'skip';
    if (patch.cacheImages !== undefined) settings.cacheImages = Boolean(patch.cacheImages);
    if (patch.downloadConcurrency !== undefined) {
      const value = Math.max(1, Math.min(4, Number(patch.downloadConcurrency) || 2));
      settings.downloadConcurrency = value;
      this.queue.concurrency = value;
    }
    if (patch.readerFontScale !== undefined) {
      settings.readerFontScale = Math.max(0.8, Math.min(1.6, Number(patch.readerFontScale) || 1));
    }
    await this.store.save();
    return settings;
  }

  /** 扫描存储目录，恢复或更新索引。 */
  async scan() {
    const root = this.ensureRoot();
    const articlesDir = path.join(root, 'articles');
    const report = { scanned: 0, imported: 0, updated: 0, missing: 0, errors: [] };
    let entries = [];
    try {
      entries = await fs.readdir(articlesDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return report;
      throw error;
    }
    const seen = new Set();
    for (const entry of entries) {
      if (!entry.isDirectory() || !POST_ID_PATTERN.test(entry.name)) continue;
      report.scanned += 1;
      const postId = entry.name;
      seen.add(postId);
      const markdownPath = path.join(articlesDir, postId, 'article.md');
      let raw;
      try {
        raw = await fs.readFile(markdownPath, 'utf8');
      } catch {
        report.missing += 1;
        continue;
      }
      try {
        const { frontMatter, body } = splitFrontMatter(raw);
        const meta = extractMeta(frontMatter, postId);
        const hash = sha256(body);
        const relative = path.relative(root, markdownPath).split(path.sep).join('/');
        const existing = this.store.state.articles[postId];
        if (existing) {
          if (existing.contentHash !== hash) {
            existing.contentHash = hash;
            existing.excerpt = clampText(stripMarkdown(body), 180);
            existing.updatedAt = nowIso();
            report.updated += 1;
          }
          if (existing.downloadStatus !== 'ready') {
            existing.downloadStatus = 'ready';
            existing.lastError = '';
          }
          existing.relativeMarkdownPath = relative;
          // 旧数据没有 storageRoot，扫描到就补上，之后改全局设置也不会失联。
          existing.storageRoot = root;
        } else {
          this.store.state.articles[postId] = {
            postId,
            originalUrl: meta.sourceUrl,
            normalizedUrl: meta.sourceUrl,
            title: meta.title,
            excerpt: clampText(stripMarkdown(body), 180),
            authorName: meta.authorName,
            authorUsername: meta.authorUsername,
            publishedAt: meta.publishedAt,
            threadMode: meta.threadMode === 'full' ? 'full' : 'single',
            downloadStatus: 'ready',
            downloadStage: '',
            imageCount: Number(frontMatter.image_count) || 0,
            collectionIds: [],
            tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
            starred: false,
            readState: 'unread',
            readingProgress: 0,
            lastReadAt: '',
            storageRoot: root,
            relativeMarkdownPath: relative,
            contentHash: hash,
            lastError: '',
            addedAt: nowIso(),
            downloadedAt: nowIso(),
            updatedAt: nowIso(),
          };
          report.imported += 1;
        }
      } catch (error) {
        report.errors.push({ postId, reason: String(error?.message || error) });
      }
    }
    for (const article of Object.values(this.store.state.articles)) {
      if (article.downloadStatus === 'ready' && !seen.has(article.postId)) {
        article.downloadStatus = 'missing';
        article.lastError = '本地文件已丢失';
        article.updatedAt = nowIso();
      }
    }
    await this.store.save();
    return report;
  }
}

export { DEFAULT_SETTINGS, safeFileName };
