// Host 层集成测试：用假 ctx 启动插件，真实走 HTTP 路由、工具与错误分支。
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-host-'));
process.env.DSH_HOME = path.join(root, 'dsh-home');

const routes = new Map();
const tools = new Map();
const effects = [];
let rejection = undefined;
// 由测试用例注入的假目录选择器（模拟宿主挂载的 ctx.directoryPicker）。
let pickerStub = undefined;

const ctx = {
  get(name) {
    if (name === 'directoryPicker') return pickerStub;
    if (name === 'webServer') {
      return {
        register(definition) {
          if (routes.has(definition.path)) throw new Error(`duplicate route: ${definition.path}`);
          routes.set(definition.path, definition);
          return () => routes.delete(definition.path);
        },
      };
    }
    if (name === 'connection') {
      return { requestRejection: () => rejection };
    }
    if (name === 'tools') {
      return {
        register(definition) {
          if (tools.has(definition.name)) throw new Error(`duplicate tool: ${definition.name}`);
          tools.set(definition.name, definition);
          return () => tools.delete(definition.name);
        },
      };
    }
    return undefined;
  },
  effect(disposer, label) {
    effects.push({ disposer: disposer(), label });
  },
};

const plugin = await import('../index.js');
assert.deepEqual(plugin.inject, ['webServer', 'connection', 'tools', 'llm'], '插件应声明依赖服务');
plugin.apply(ctx, {});
await new Promise((resolve) => setTimeout(resolve, 300));

console.log('注册路由：', [...routes.keys()].join(', '));
console.log('注册工具：', [...tools.keys()].join(', '));
assert.ok(routes.has('/api/x-article-library'), '主路由应注册');
assert.ok(routes.has('/api/x-article-library/asset'), '资源路由应注册');
assert.ok(tools.has('x_article_library'), 'AI 工具应注册');

// 用真实 HTTP 服务器承载这些 handler，模拟 Harness 的调用方式。
const server = http.createServer(async (req, res) => {
  const definition = routes.get(String(req.url || '').split('?')[0]);
  if (!definition) {
    res.statusCode = 404;
    return res.end('not found');
  }
  try {
    await definition.handler(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error?.message || error));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function httpCall(pathname, options = {}) {
  const response = await fetch(base + pathname, options);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, text, json };
}

// 1) GET 状态
const state = await httpCall('/api/x-article-library');
assert.equal(state.status, 200, 'GET 应返回 200');
assert.equal(state.headers.get('cache-control'), 'no-store', '应禁用缓存');
assert.ok(Array.isArray(state.json.articles), '应返回文章数组');
assert.ok(state.json.defaultStorageRoot.includes('X Article Library'), '应返回默认存储目录');
console.log('GET 状态 OK：默认目录 =', state.json.defaultStorageRoot);

// 2) 方法限制
const put = await httpCall('/api/x-article-library', { method: 'PUT' });
assert.equal(put.status, 405, 'PUT 应被拒绝');

// 3) Content-Type 限制
const wrongType = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'text/plain' },
  body: JSON.stringify({ type: 'state' }),
});
assert.equal(wrongType.status, 415, '非 JSON 请求应返回 415');

// 4) 非法 JSON
const badJson = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: 'not json',
});
assert.equal(badJson.status, 400, '非法 JSON 应返回 400');

// 5) 未知操作
const unknown = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'nope' }),
});
assert.equal(unknown.status, 400, '未知操作应返回 400');
console.log('接口防护 OK：405 / 415 / 400 分支均正确');

// 6) 超大请求体
const big = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'state', padding: 'x'.repeat(80 * 1024) }),
});
assert.equal(big.status, 413, '超大请求体应返回 413');
console.log('请求体上限 OK：413');

// 7) 链接解析
const parsed = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'parse', links: 'https://x.com/a/status/20 https://x.com/a/status/20 https://bad.example/x' }),
});
assert.equal(parsed.json.postIds.length, 1, '重复链接应去重');
assert.equal(parsed.json.invalid.length, 1, '非法链接应记录');
console.log('解析接口 OK：', JSON.stringify(parsed.json));

// 8) 设置存储目录（写探针）
const settings = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'settings', patch: { storageRoot: path.join(root, 'store'), downloadConcurrency: 3 } }),
});
assert.equal(settings.status, 200, '设置应成功');
assert.equal(settings.json.settings.downloadConcurrency, 3, '并发数应保存');
console.log('设置接口 OK：存储目录 =', settings.json.settings.storageRoot);

// 9) 目录浏览
const browse = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'browse', path: root }),
});
assert.equal(browse.status, 200, '浏览应成功');
assert.ok(Array.isArray(browse.json.entries), '应返回目录列表');
assert.ok(browse.json.shortcuts.length >= 4, '应返回快捷入口');
console.log('目录浏览 OK：', browse.json.entries.length, '个子目录；上级 =', browse.json.parent);

// 10) 不可读目录
const badBrowse = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'browse', path: path.join(root, 'no-such-dir') }),
});
assert.equal(badBrowse.status, 400, '不存在目录应返回 400');
console.log('目录错误分支 OK：', badBrowse.json.error);

// 10.1) 打开目录：不存在的目录应 404，非目录应 400
const openMissing = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'openFolder', path: path.join(root, 'no-such-dir') }),
});
assert.equal(openMissing.status, 404, '打开不存在目录应返回 404');

// 10.2) 定位未下载的文章应 400（not-ready），不应把坏路径交给系统
const revealNotReady = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'reveal', postId: '999999' }),
});
assert.equal(revealNotReady.status, 404, '定位不存在的文章应返回 404');
console.log('定位/打开目录错误分支 OK');

// 10.3) 目录选择：宿主未挂载服务时应优雅降级，而不是报错
const pickNoService = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'pickFolder' }),
});
assert.equal(pickNoService.status, 200, '没有目录选择服务时应正常返回');
assert.equal(pickNoService.json.kind, 'unsupported', '应返回 unsupported 让前端降级');

// 10.4) 非 native 后端（远程场景）同样降级
pickerStub = { capability: () => ({ kind: 'browse' }) };
const pickBrowse = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'pickFolder' }),
});
assert.equal(pickBrowse.json.kind, 'unsupported', 'browse 后端应由前端接管，返回 unsupported');

// 10.5) native 后端：用户选中目录
pickerStub = { capability: () => ({ kind: 'native', pick: async () => 'D:\\文章库' }) };
const pickOk = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'pickFolder' }),
});
assert.equal(pickOk.status, 200);
assert.equal(pickOk.json.kind, 'picked', '应返回 picked');
assert.equal(pickOk.json.path, 'D:\\文章库', '应带回选中路径');

// 10.6) 用户取消：返回 cancelled，不是错误
pickerStub = { capability: () => ({ kind: 'native', pick: async () => null }) };
const pickCancel = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'pickFolder' }),
});
assert.equal(pickCancel.status, 200, '取消不是错误');
assert.equal(pickCancel.json.kind, 'cancelled');

// 10.7) native 后端抛错时要转成可读错误
pickerStub = { capability: () => ({ kind: 'native', pick: async () => { throw new Error('koffi 加载失败'); } }) };
const pickFail = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'pickFolder' }),
});
assert.equal(pickFail.status, 400, '选择失败应返回 400');
assert.ok(String(pickFail.json.error || '').includes('koffi'), '应带上底层原因');

pickerStub = undefined;
console.log('目录选择 OK：降级 / 选中 / 取消 / 失败 四种分支');

// 11) 收藏夹 CRUD
const created = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'createCollection', name: '阅读清单' }),
});
assert.equal(created.status, 200, '建收藏夹应成功');
assert.equal(created.json.collection.name, '阅读清单');

const duplicated = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'createCollection', name: '阅读清单' }),
});
assert.equal(duplicated.status, 400, '重名应被拒绝');

const removed = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'deleteCollection', id: created.json.collection.id }),
});
assert.equal(removed.json.deleted, true, '删除收藏夹应成功');
console.log('收藏夹 CRUD OK：创建 / 重名拒绝 / 删除');

// 12) 读过不存在的文章
const notFound = await httpCall('/api/x-article-library', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'read', postId: '1234567890123456789' }),
});
assert.equal(notFound.status, 404, '不存在文章应返回 404');
console.log('404 分支 OK');

// 13) 认证拒绝（requestRejection 返回状态码）
rejection = 401;
const denied = await httpCall('/api/x-article-library');
assert.equal(denied.status, 401, '认证失败应返回 401');
rejection = undefined;
console.log('认证防护 OK：401');

// 14) 资源路由
const asset = await httpCall('/api/x-article-library/asset?postId=20&name=001.jpg');
assert.ok([404, 400].includes(asset.status), '缺失资源应报错而非崩溃');
const traversal = await httpCall('/api/x-article-library/asset?postId=20&name=../index.json');
assert.ok([400, 404].includes(traversal.status), '路径穿越应被拒绝');
console.log('资源路由 OK：缺失 ' + asset.status + '，穿越 ' + traversal.status);

// 15) 工具执行
const tool = tools.get('x_article_library');
const listResult = await tool.execute({ action: 'list' });
assert.ok(Array.isArray(listResult.articles), 'list 应返回数组');
const settingsResult = await tool.execute({ action: 'settings' });
assert.ok(settingsResult.storageRoot, 'settings 应返回存储目录');
await assert.rejects(() => tool.execute({ action: 'add', links: 'https://example.com/x' }), /没有识别到有效的 X 链接/, '无效链接应抛错');
const rendered = tool.output.render({ action: 'list' }, listResult);
assert.equal(rendered[0].type, 'text', 'render 应返回文本块');
console.log('AI 工具 OK：list / settings / 无效链接报错 / render');

// 15.5) 问 AI：没有模型时要给明确提示，而不是天知道报什么错
{
  // ai 是 HTTP 动作（不进 AI 工具的 action 枚举），这里直接走路由。
  const jsonPost = (payload) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const aiInfo = await httpCall('/api/x-article-library', jsonPost({ type: 'ai' }));
  assert.equal(aiInfo.status, 200, 'ai 动作应可用');
  assert.equal(aiInfo.json.available, false, '测试环境没有 agentDefaultModel，应报告不可用');
  assert.equal(aiInfo.json.model, '', '没有模型时 model 应为空串');

  // 没有模型时问 AI 必须给出可读原因，不能崩。这是环境能力问题，用 501。
  const askFail = await httpCall('/api/x-article-library', jsonPost({ type: 'ask', postId: '20', question: '' }));
  assert.equal(askFail.status, 501, '没有可用模型时应返回 501');
  assert.ok(String(askFail.json.error || '').includes('模型'), '错误信息应说明没有可用模型');
  console.log('问 AI 降级 OK：无模型时明确报错');
}

// 16) 释放
assert.equal(effects.length, 3, '应注册 3 个 effect');
for (const effect of effects) effect.disposer();
assert.equal(routes.size, 0, '释放后路由应清空');
assert.equal(tools.size, 0, '释放后工具应清空');
console.log('生命周期 OK：释放后路由与工具均已注销');

server.close();
console.log('\nHost 层集成测试全部通过。');
