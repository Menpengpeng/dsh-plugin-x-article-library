// Host 半部：注册 HTTP 接口与 AI 工具，管理资料库服务的生命周期。

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LibraryService } from './lib/library.js';
import { parseLinks } from './lib/core.js';
import { revealPath, openDirectory } from './lib/reveal.js';
import { buildRequest, consumeStream } from './lib/assistant.js';

const ROUTE = '/api/x-article-library';
const ASSET_ROUTE = '/api/x-article-library/asset';
const MAX_BODY_BYTES = 64 * 1024;

export const name = 'x-article-library';
export const inject = ['webServer', 'connection', 'tools', 'llm'];

/** 解析 DSH 数据根目录（与宿主默认值保持一致）。 */
function dshHome() {
  const configured = String(process.env.DSH_HOME || '').trim();
  if (configured) {
    const expanded = configured.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.join(os.homedir(), '.dsh');
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(value));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('请求内容过大'), { code: 'too-large' });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('请求体不是合法 JSON'), { code: 'bad-json' });
  }
}

/** 业务错误到 HTTP 状态码的映射。 */
function statusOf(error) {
  const code = error?.code;
  if (code === 'not-found' || code === 'ENOENT' || code === 'EISDIR') return 404;
  if (code === 'too-large') return 413;
  if (code === 'EACCES' || code === 'EPERM') return 403;
  if (code === 'ENOSPC') return 507;
  // 平台不支持定位文件属于「本机能力不足」，用 501 与输入错误区分开。
  if (code === 'unsupported') return 501;
  // 没有可用模型 / AI 服务缺失也是环境能力问题，不是输入错了。
  if (code === 'no-model' || code === 'unavailable') return 501;
  if (['invalid', 'bad-json', 'duplicate', 'no-root', 'not-ready', 'unsafe-path', 'ENOTDIR', 'ENAMETOOLONG'].includes(code)) return 400;
  return 500;
}

/** 应用内目录浏览：只列出目录，跳过隐藏项。 */
async function browseDirectory(targetPath) {
  const home = os.homedir();
  const current = targetPath ? path.resolve(String(targetPath)) : home;
  let listing;
  try {
    listing = await fs.readdir(current, { withFileTypes: true });
  } catch (error) {
    throw Object.assign(new Error(error.code === 'ENOENT' ? '目录不存在' : `无法读取目录：${error.message}`), { code: 'invalid' });
  }
  const entries = listing
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => ({ name: entry.name, path: path.join(current, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const parent = path.dirname(current);
  return {
    path: current,
    name: path.basename(current) || current,
    parent: parent === current ? null : parent,
    entries,
    shortcuts: [
      { label: '主目录', path: home },
      { label: '文档', path: path.join(home, 'Documents') },
      { label: '桌面', path: path.join(home, 'Desktop') },
      { label: '下载', path: path.join(home, 'Downloads') },
    ],
  };
}

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export function apply(ctx, config = {}) {
  const dataDir = path.join(dshHome(), 'storages', 'x-article-library');
  const defaultStorageRoot = config?.storageRoot
    ? path.resolve(String(config.storageRoot))
    : path.join(os.homedir(), 'Documents', 'X Article Library');

  const service = new LibraryService({ dataDir, defaultStorageRoot });
  const ready = service.init();
  ready.catch((error) => {
    console.error(`[x-article-library] 初始化失败：${error?.message || error}`);
  });

  /**
   * 探测宿主的目录选择后端。
   * 桌面版（win32/macOS + 回环监听 + 非 SSH）会挂 native 后端，能弹系统对话框；
   * 其他情况是 browse 或干脆没有，前端据此决定「浏览…」是弹系统框还是退回内置列表。
   */
  const pickerCapability = () => {
    const picker = ctx.get('directoryPicker');
    if (typeof picker?.capability !== 'function') return { kind: 'none' };
    const capability = picker.capability();
    return { kind: capability?.kind || 'unknown', canPick: typeof capability?.pick === 'function' };
  };

  /** 统一状态快照，附带默认目录等运行时信息。 */
  const snapshot = () => ({ ...service.snapshot(), defaultStorageRoot, dataDir, picker: pickerCapability() });

  /**
   * 当前模型路由。
   * 用宿主的 agentDefaultModel（用户可在界面切换），拿不到就返回 null，
   * 由调用方给出「没有可用模型」的明确提示，而不是猜一个。
   */
  const assistantSelection = () => {
    try {
      const defaults = ctx.get('agentDefaultModel');
      const selection = defaults?.currentSelection?.();
      if (!selection || !selection.provider || !selection.model) return null;
      return selection;
    } catch {
      return null;
    }
  };

  const actions = {
    async state() {
      await ready;
      return snapshot();
    },
    async parse(input) {
      return parseLinks(String(input.links || ''));
    },
    async import(input) {
      await ready;
      const result = await service.importLinks({
        links: String(input.links || ''),
        threadMode: input.threadMode,
        duplicatePolicy: input.duplicatePolicy,
        tags: input.tags,
        collectionIds: input.collectionIds,
      });
      return { ...result, state: snapshot() };
    },
    async download(input) {
      await ready;
      const queued = service.enqueueDownload(input.postIds);
      return { queued, state: snapshot() };
    },
    async read(input) {
      await ready;
      return service.readContent(String(input.postId || ''));
    },
    async update(input) {
      await ready;
      const item = await service.updateArticle(String(input.postId || ''), input.patch || {});
      return { item, state: snapshot() };
    },
    async remove(input) {
      await ready;
      const result = await service.removeArticle(String(input.postId || ''), Boolean(input.deleteFiles));
      return { ...result, state: snapshot() };
    },
    async createCollection(input) {
      await ready;
      const collection = await service.createCollection(input);
      return { collection, state: snapshot() };
    },
    async updateCollection(input) {
      await ready;
      const collection = await service.updateCollection(String(input.id || ''), input.patch || {});
      return { collection, state: snapshot() };
    },
    async deleteCollection(input) {
      await ready;
      const result = await service.deleteCollection(String(input.id || ''));
      return { ...result, state: snapshot() };
    },
    async settings(input) {
      await ready;
      const settings = await service.updateSettings(input.patch || {});
      return { settings, state: snapshot() };
    },
    /**
     * 问 AI：不传 question 就是首轮整篇总结，传了就是追问。
     * 用宿主当前选中的模型（agentDefaultModel），不自己拧 provider/model。
     */
    async ask(input) {
      await ready;
      const postId = String(input.postId || '');
      const question = String(input.question || '').trim();
      const history = Array.isArray(input.history) ? input.history : [];

      const selection = assistantSelection();
      if (!selection) {
        throw Object.assign(new Error('当前没有可用的模型，先在界面里选择模型'), { code: 'no-model' });
      }

      const article = await service.readContent(postId);
      const request = buildRequest({
        selection,
        title: article.title,
        body: article.body,
        history,
        question,
      });

      const llm = ctx.get('llm');
      if (!llm || typeof llm.stream !== 'function') {
        throw Object.assign(new Error('AI 能力不可用'), { code: 'unavailable' });
      }

      request.sessionId = `xal-${postId}`;
      const text = await consumeStream(llm.stream(request));
      if (!text.trim()) {
        throw Object.assign(new Error('模型没有返回内容，换个问法试试'), { code: 'empty' });
      }
      return { answer: text, model: selection.model, provider: selection.provider };
    },
    /** 当前模型路由，供界面显示「用哪个模型回答」。 */
    async ai() {
      const selection = assistantSelection();
      return {
        available: Boolean(selection),
        provider: selection ? selection.provider : '',
        model: selection ? selection.model : '',
      };
    },
    async scan() {
      await ready;
      const report = await service.scan();
      return { report, state: snapshot() };
    },
    async browse(input) {
      return browseDirectory(input.path);
    },
    /** 在系统文件管理器中定位某篇文章的正文文件。 */
    async reveal(input) {
      await ready;
      const located = await service.locateArticle(String(input.postId || ''));
      const result = await revealPath(located.file);
      return { ...result, postId: located.postId, file: located.file, dir: located.dir };
    },
    /** 打开一个目录本身（设置页里「打开存储文件夹」用）。 */
    async openFolder(input) {
      await ready;
      const raw = String(input.path || '').trim();
      const target = raw ? path.resolve(raw) : service.ensureRoot();
      let stats;
      try {
        stats = await fs.stat(target);
      } catch {
        throw Object.assign(new Error('目录不存在'), { code: 'not-found' });
      }
      if (!stats.isDirectory()) throw Object.assign(new Error('不是目录'), { code: 'invalid' });
      return await openDirectory(target);
    },
    /**
     * 弹出系统目录选择框。
     *
     * 优先用宿主挂载的 ctx.directoryPicker：只有它的 native 后端会把对话框开在
     * 宿主自己的桌面上。插件自己 spawn 一个子进程去弹框在桌面版里拿不到交互桌面，
     * PowerShell 的 FolderBrowserDialog 会被直接拒绝。
     * 没有 native 后端时返回 kind='unsupported'，由前端退回应用内目录浏览。
     */
    async pickFolder(input) {
      await ready;
      const picker = ctx.get('directoryPicker');
      if (typeof picker?.capability !== 'function') {
        return { kind: 'unsupported', reason: '宿主未挂载目录选择服务' };
      }
      const capability = picker.capability();
      if (capability?.kind !== 'native' || typeof capability.pick !== 'function') {
        return { kind: 'unsupported', reason: `宿主目录选择后端为 ${capability?.kind || '未知'}` };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      try {
        const picked = await capability.pick(controller.signal);
        // pick 返回 null 表示用户取消，不是错误。
        return picked ? { kind: 'picked', path: String(picked) } : { kind: 'cancelled' };
      } catch (error) {
        if (error?.name === 'AbortError') throw Object.assign(new Error('选择目录超时'), { code: 'timeout' });
        throw Object.assign(new Error(`打开目录选择框失败：${error?.message || error}`), { code: 'invalid' });
      } finally {
        clearTimeout(timer);
      }
    },
  };

  const web = ctx.get('webServer');
  const connection = ctx.get('connection');

  /** 准入检查：复用 Harness 的 Host/Origin 与登录态防护。 */
  const rejected = (req, res) => {
    const rejection = connection?.requestRejection?.(req);
    if (rejection === undefined || rejection === null || rejection === false) return false;
    res.statusCode = typeof rejection === 'number' ? rejection : rejection.statusCode || 401;
    res.end();
    return true;
  };

  if (web) {
    const dispose = web.register({
      kind: 'exact',
      path: ROUTE,
      async handler(req, res) {
        if (rejected(req, res)) return;
        try {
          if (req.method === 'GET') {
            await ready;
            return sendJson(res, 200, snapshot());
          }
          if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 GET 与 POST' });
          const contentType = String(req.headers['content-type'] || '').toLowerCase();
          if (!contentType.includes('application/json')) return sendJson(res, 415, { error: '请求需为 application/json' });
          const body = await readJsonBody(req);
          const type = String(body.type || '');
          const action = actions[type];
          if (!action) return sendJson(res, 400, { error: `未知操作：${type || '(空)'}` });
          return sendJson(res, 200, await action(body));
        } catch (error) {
          return sendJson(res, statusOf(error), { error: String(error?.message || error) });
        }
      },
    });
    ctx.effect(() => dispose, 'x-article-library route');

    const disposeAsset = web.register({
      kind: 'exact',
      path: ASSET_ROUTE,
      async handler(req, res) {
        if (rejected(req, res)) return;
        if (req.method !== 'GET') return sendJson(res, 405, { error: '仅支持 GET' });
        try {
          await ready;
          const url = new URL(req.url || '/', 'http://localhost');
          const buffer = await service.readAsset(String(url.searchParams.get('postId') || ''), String(url.searchParams.get('name') || ''));
          res.statusCode = 200;
          res.setHeader('content-type', MIME[path.extname(String(url.searchParams.get('name') || '')).toLowerCase()] || 'application/octet-stream');
          res.setHeader('cache-control', 'private, max-age=86400');
          res.setHeader('x-content-type-options', 'nosniff');
          res.end(buffer);
        } catch (error) {
          return sendJson(res, statusOf(error), { error: String(error?.message || error) });
        }
      },
    });
    ctx.effect(() => disposeAsset, 'x-article-library asset route');
  }

  const tools = ctx.get('tools');
  if (tools) {
    const disposeTool = tools.register({
      name: 'x_article_library',
      description: '管理本地 X 文章库：把公开 X 链接保存为 Markdown、列出文章、读取正文、重试失败下载。不登录、不读取用户书签，只处理公开内容。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'list', 'read', 'retry', 'settings'] },
          links: { type: 'string', description: '要保存的 X 链接，可多个，用换行或空格分隔' },
          postId: { type: 'string', description: '读取正文时的文章 ID' },
          collection: { type: 'string', description: '导入时归入的收藏夹名称（需已存在）' },
          threadMode: { type: 'string', enum: ['full', 'single'], description: 'full=包含作者自线程，single=只取单条' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(input) {
        await ready;
        if (input.action === 'add') {
          const parsed = parseLinks(String(input.links || ''));
          if (!parsed.postIds.length) {
            const detail = parsed.invalid.length ? `无法识别：${parsed.invalid.slice(0, 3).join('、')}` : '';
            throw new Error(`没有识别到有效的 X 链接。${detail}`);
          }
          let collectionIds = [];
          if (input.collection) {
            const found = service.snapshot().collections.find((item) => item.name === String(input.collection));
            if (found) collectionIds = [found.id];
          }
          const result = await service.importLinks({
            links: parsed.postIds.join(' '),
            threadMode: input.threadMode,
            duplicatePolicy: 'skip',
            collectionIds,
          });
          return { created: result.created, skipped: result.skipped, invalid: result.invalid };
        }
        if (input.action === 'list') {
          const current = service.snapshot();
          return {
            total: current.stats.total,
            collections: current.collections.map((item) => item.name),
            articles: current.articles.slice(0, 50).map((item) => ({
              postId: item.postId,
              title: item.title,
              author: item.authorName,
              status: item.downloadStatus,
              addedAt: item.addedAt,
            })),
          };
        }
        if (input.action === 'read') {
          const content = await service.readContent(String(input.postId || ''));
          return {
            title: content.title,
            author: content.authorName,
            sourceUrl: content.sourceUrl,
            body: content.body.slice(0, 20000),
          };
        }
        if (input.action === 'retry') {
          const pending = service.snapshot().articles.filter((item) => item.downloadStatus !== 'ready').map((item) => item.postId);
          return { queued: service.enqueueDownload(pending) };
        }
        const settings = service.settings;
        return {
          storageRoot: settings.storageRoot,
          cacheImages: settings.cacheImages,
          concurrency: settings.downloadConcurrency,
          // 宿主目录选择后端：native 表示「浏览…」会弹系统对话框，none/browse 表示退回应用内列表。
          picker: pickerCapability(),
        };
      },
    });
    ctx.effect(() => disposeTool, 'x-article-library tool');
  }
}
