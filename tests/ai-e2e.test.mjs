// 问 AI 端到端：用 mock 的 llm + agentDefaultModel 跑真实的 ask 链路，
// 确认 provider/model 真的被传给宿主、正文真的进了提示、回答真的被返回。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-ai-'));
// dataDir 由 DSH_HOME 决定，必须在 import 插件前设置，避免污染真实 profile。
process.env.DSH_HOME = path.join(tmp, 'home');
const dataDir = path.join(tmp, 'home', 'storages', 'x-article-library');
const storageRoot = path.join(tmp, 'store');

const routes = new Map();
const tools = new Map();
const effects = [];
const calls = [];
let rejection = undefined;

// 记录每次 llm.stream 收到的参数，并回放一段固定文本。
const captured = [];
const llmStub = {
  stream(options) {
    captured.push(options);
    const chunks = [
      { type: 'text-delta', text: '这是' },
      { type: 'text-delta', text: 'AI 的回答' },
      { type: 'finish', reason: { kind: 'stop' } },
    ];
    return (async function* () {
      for (const chunk of chunks) yield chunk;
    })();
  },
};

const selectionStub = {
  currentSelection: () => ({ provider: 'test-provider', model: 'test-model', reasoningEffort: 'medium' }),
};

const ctx = {
  get(name) {
    if (name === 'llm') return llmStub;
    if (name === 'agentDefaultModel') return selectionStub;
    if (name === 'webServer') {
      return {
        register(definition) {
          if (routes.has(definition.path)) throw new Error('duplicate route: ' + definition.path);
          routes.set(definition.path, definition);
          return () => routes.delete(definition.path);
        },
      };
    }
    if (name === 'connection') return { requestRejection: () => rejection };
    if (name === 'tools') {
      return {
        register(definition) {
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
plugin.apply(ctx, { storageRoot });
await new Promise((resolve) => setTimeout(resolve, 150));

let server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = routes.get(url.pathname);
  if (!route) {
    res.writeHead(404).end('{}');
    return;
  }
  route.handler(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let base = 'http://127.0.0.1:' + server.address().port;

const post = (payload) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

async function call(payload) {
  const response = await fetch(base + '/api/x-article-library', post(payload));
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 响应用原文断言 */ }
  return { status: response.status, json, text };
}

// 1) ai 动作应报告当前模型
{
  const result = await call({ type: 'ai' });
  assert.equal(result.status, 200);
  assert.equal(result.json.available, true, '有 agentDefaultModel 时应报告可用');
  assert.equal(result.json.provider, 'test-provider');
  assert.equal(result.json.model, 'test-model');
  console.log('ai 动作 OK：' + result.json.provider + '/' + result.json.model);
}

// 2) 导入一篇真实文章，供 ask 读取
const importResult = await call({ type: 'import', links: 'https://x.com/tester/status/1234567890123', duplicatePolicy: 'skip' });
assert.equal(importResult.status, 200, '导入应成功');
const postId = importResult.json.state.articles[0].postId;
console.log('导入 OK：postId =', postId);

// 手工造一篇可读文章：真实下载需要外网，这里直接按插件的存储布局落盘，
// 再用 scan 让 service 从磁盘重建索引（走的就是「扫描存储目录」的真实路径）。
const articleDir = path.join(storageRoot, 'articles', postId);
await fs.mkdir(articleDir, { recursive: true });
const md = [
  '---',
  'x_post_id: "' + postId + '"',
  'source_url: "https://x.com/tester/status/' + postId + '"',
  'title: "测试文章标题"',
  'author_name: "测试作者"',
  'author_username: "tester"',
  'published_at: "2026-01-02T03:04:05.000Z"',
  'thread_mode: "full"',
  'tags: []',
  'image_count: 0',
  '---',
  '',
  '这是文章正文，里面讲了三个要点。',
].join('\n');
await fs.writeFile(path.join(articleDir, 'article.md'), md, 'utf8');

// 导入只是为了拿到一个真实 postId；随后直接按插件存储布局落盘，
// 并直接改索引文件把这篇摘掉，让 scan 走「磁盘有文件、索引没有」的重建路径。
// 注意：service 在内存里缓存了索引，改文件后必须重启插件实例才读得到。
const indexFile = path.join(dataDir, 'index.json');
for (let i = 0; i < 60; i += 1) {
  try {
    await fs.access(indexFile);
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));
delete index.articles[postId];
index.jobs = {};
await fs.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8');

// 关掉旧实例的路由，重新 apply 一次，强制从磁盘重新加载索引。
server.close();
for (const { disposer } of effects) disposer();
effects.length = 0;
routes.clear();
tools.clear();
plugin.apply(ctx, { storageRoot });
await new Promise((resolve) => setTimeout(resolve, 200));
server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = routes.get(url.pathname);
  if (!route) {
    res.writeHead(404).end('{}');
    return;
  }
  route.handler(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
base = 'http://127.0.0.1:' + server.address().port;

await call({ type: 'scan' });
const stateNow = await call({ type: 'state' });
const record = stateNow.json.articles.find((a) => a.postId === postId);
assert.ok(record, 'scan 后应能从磁盘重建出这篇文章');
assert.equal(record.downloadStatus, 'ready', 'scan 后应可读，实际：' + record.downloadStatus);
assert.equal(record.title, '测试文章标题', 'scan 应从 Front Matter 读出标题');

// 3) 首轮总结：真正的 ask，验证 llm 收到的参数
{
  captured.length = 0;
  const result = await call({ type: 'ask', postId, question: '' });
  assert.equal(result.status, 200, '首轮总结应成功，实际：' + result.text);
  assert.equal(result.json.answer, '这是AI 的回答', '应返回模型拼出的文本');
  assert.equal(result.json.provider, 'test-provider', '应回报所用 provider');
  assert.equal(result.json.model, 'test-model', '应回报所用 model');

  assert.equal(captured.length, 1, '应只调用一次 llm.stream');
  const sent = captured[0];
  assert.equal(sent.provider, 'test-provider', 'provider 应透传');
  assert.equal(sent.model, 'test-model', 'model 应透传');
  assert.equal(sent.reasoningEffort, 'medium', 'reasoningEffort 应透传');
  assert.ok(sent.system && sent.system.length > 0, '应有 system');
  assert.ok(sent.messages.length >= 1, '应有消息');

  // 关键回归：content 必须是 block 数组。宿主内部对它做 content.some(...)，
  // 传裸字符串会在运行时炸 "content.some is not a function"。
  for (const message of sent.messages) {
    assert.ok(Array.isArray(message.content), '每条消息的 content 必须是数组（实际：' + typeof message.content + '）');
    for (const block of message.content) {
      assert.equal(block.type, 'text', 'block 类型应为 text');
      assert.equal(typeof block.text, 'string', 'block.text 应为字符串');
    }
  }

  const flat = sent.messages.flatMap((m) => m.content.map((b) => b.text)).join('\n');
  assert.ok(flat.includes('这是文章正文'), '正文应真的进提示');
  assert.ok(flat.includes('测试文章标题'), '标题应真的进提示');
  assert.ok(flat.includes('结构化'), '总结指令应存在');
  console.log('首轮总结 E2E OK：正文与标题都已送进模型，content 为 block 数组');
}

// 4) 追问：历史应被带上
{
  captured.length = 0;
  const result = await call({
    type: 'ask',
    postId,
    question: '第二个要点是什么？',
    history: [
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '第一答' },
    ],
  });
  assert.equal(result.status, 200, '追问应成功');
  const sentMessages = captured[0].messages;
  for (const message of sentMessages) {
    assert.ok(Array.isArray(message.content), '追问的每条消息 content 也必须是数组');
  }
  const flat = sentMessages.flatMap((m) => m.content.map((b) => b.text)).join('\n');
  assert.ok(flat.includes('第一问'), '历史问题应带上');
  assert.ok(flat.includes('第一答'), '历史回答应带上');
  assert.ok(flat.includes('第二个要点是什么'), '本轮问题应带上');
  assert.ok(flat.includes('这是文章正文'), '追问也应带原文');
  console.log('多轮追问 E2E OK：历史与原文都在，content 为 block 数组');
}

// 5) 模型报错时应把错误码透出来，不能当成空回答
{
  const failing = {
    stream() {
      return (async function* () {
        yield { type: 'text-delta', text: '半截' };
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'QUOTA', message: '额度不足' } } };
      })();
    },
  };
  const original = ctx.get;
  ctx.get = (name) => (name === 'llm' ? failing : original(name));
  const result = await call({ type: 'ask', postId, question: '随便问问' });
  ctx.get = original;
  assert.equal(result.status, 500, '模型报错应是 500');
  assert.ok(String(result.json.error).includes('额度不足'), '应透出模型错误信息');
  console.log('模型报错透传 OK：' + result.json.error);
}

// 6) 模型返回空文本时应给可读提示
{
  const empty = {
    stream() {
      return (async function* () {
        yield { type: 'finish', reason: { kind: 'stop' } };
      })();
    },
  };
  const original = ctx.get;
  ctx.get = (name) => (name === 'llm' ? empty : original(name));
  const result = await call({ type: 'ask', postId, question: '再问一次' });
  ctx.get = original;
  assert.equal(result.status, 500, '空回答应是 500');
  assert.ok(String(result.json.error).includes('没有返回内容'), '应说明模型没返回内容');
  console.log('空回答提示 OK：' + result.json.error);
}

// 7) 没有模型时应 501
{
  const original = ctx.get;
  ctx.get = (name) => (name === 'agentDefaultModel' ? { currentSelection: () => ({ provider: '', model: '' }) } : original(name));
  const result = await call({ type: 'ask', postId, question: '' });
  ctx.get = original;
  assert.equal(result.status, 501, '没有模型应是 501');
  assert.ok(String(result.json.error).includes('模型'), '应提示没有可用模型');
  console.log('无模型降级 OK');
}

// 8) 文章不存在时是 404，不要变成 500
{
  const result = await call({ type: 'ask', postId: '999999', question: '' });
  assert.equal(result.status, 404, '文章不存在应是 404');
  console.log('文章不存在 OK：404');
}

server.close();
for (const { disposer } of effects) disposer();
await fs.rm(tmp, { recursive: true, force: true });
console.log('\n问 AI 端到端测试全部通过。');
