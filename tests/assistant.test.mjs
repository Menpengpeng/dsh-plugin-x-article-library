// 问 AI 的纯逻辑：提示词构造、超长截断、历史裁剪、流式消费。
import assert from 'node:assert/strict';
import {
  buildRequest,
  clipArticle,
  consumeStream,
  trimHistory,
  textBlocks,
  MAX_ARTICLE_CHARS,
  MAX_HISTORY_TURNS,
} from '../lib/assistant.js';

const selection = { provider: 'p', model: 'm' };

// content 必须是 block 数组：宿主对它做 content.some(...)，
// 直接传字符串会报 "content.some is not a function"。
function flatText(message) {
  if (!Array.isArray(message.content)) {
    throw new Error('message.content 必须是数组，实际是 ' + typeof message.content);
  }
  return message.content.map((block) => {
    if (block.type !== 'text') throw new Error('未预期的 block 类型：' + block.type);
    return block.text;
  }).join('');
}

function assertAllBlocks(messages, label) {
  for (const message of messages) {
    assert.ok(Array.isArray(message.content), `${label}：content 必须是数组`);
    assert.ok(message.content.length > 0, `${label}：content 不能为空`);
    for (const block of message.content) {
      assert.equal(block.type, 'text', `${label}：block 类型应为 text`);
      assert.equal(typeof block.text, 'string', `${label}：block.text 应为字符串`);
    }
    // 宿主 forAdapter 会对 assistant 消息读 message.source.replayState，
    // 没有 source 就会报 "Cannot read properties of undefined (reading 'replayState')"。
    if (message.role === 'assistant') {
      assert.ok(message.source, `${label}：assistant 消息必须有 source`);
      assert.equal(message.source.kind, 'model', `${label}：source.kind 应为 model`);
      assert.equal(typeof message.source.provider, 'string', `${label}：source.provider 应为字符串`);
      assert.equal(typeof message.source.model, 'string', `${label}：source.model 应为字符串`);
      // 模拟宿主的真实访问，这一步不抛错才算过。
      assert.equal(message.source.replayState, undefined, `${label}：新建消息不应带 replayState`);
    }
  }
}

// ---- 1. 首轮总结：不传 question 就是总结，且正文完整送进去 ----
{
  const req = buildRequest({ selection, title: '标题', body: '正文内容', history: [], question: '' });
  assert.equal(req.provider, 'p');
  assert.equal(req.model, 'm');
  assert.equal(req.messages.length, 1, '总结只有一条 user 消息');
  assert.equal(req.messages[0].role, 'user');
  assertAllBlocks(req.messages, '首轮总结');
  const text = flatText(req.messages[0]);
  assert.ok(text.includes('正文内容'), '正文应送进提示');
  assert.ok(text.includes('标题'), '标题应带上');
  assert.ok(text.includes('结构化'), '应包含总结指令');
  assert.ok(req.system && req.system.length > 0, '应有 system 提示');
  console.log('首轮总结请求 OK');
}

// ---- 2. 追问：带历史、最后一条是本轮问题 ----
{
  const req = buildRequest({
    selection,
    title: 'T',
    body: 'B',
    history: [
      { role: 'user', content: '第一个问题' },
      { role: 'assistant', content: '第一个回答' },
    ],
    question: '第二个问题',
  });
  assertAllBlocks(req.messages, '多轮追问');
  const last = req.messages[req.messages.length - 1];
  assert.equal(last.role, 'user');
  assert.equal(flatText(last), '第二个问题');
  assert.ok(req.messages.some((m) => flatText(m) === '第一个问题'), '历史应保留');
  assert.ok(req.messages.some((m) => flatText(m) === '第一个回答'), '历史回答应保留');
  console.log('多轮追问请求 OK');
}

// ---- 2.5. textBlocks：纯文本包成单个 text block ----
{
  const blocks = textBlocks('你好');
  assert.deepEqual(blocks, [{ type: 'text', text: '你好' }]);
  assert.deepEqual(textBlocks(undefined), [{ type: 'text', text: '' }], 'undefined 也要安全');
  assert.deepEqual(textBlocks(123), [{ type: 'text', text: '123' }], '非字符串要转成字符串');
  console.log('textBlocks OK');
}

// ---- 3. 超长正文截断并明确告知 ----
{
  assert.equal(clipArticle('短文本').truncated, false);
  const long = 'x'.repeat(MAX_ARTICLE_CHARS + 500);
  const clipped = clipArticle(long);
  assert.equal(clipped.truncated, true);
  assert.ok(clipped.text.includes('已省略'), '应说明被截断');
  assert.ok(clipped.text.length < long.length + 200);
  console.log('超长正文截断 OK');
}

// ---- 4. 历史裁剪：只留最近若干轮，且首条必须是 user ----
{
  const many = [];
  for (let i = 0; i < 20; i += 1) {
    many.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'm' + i });
  }
  const kept = trimHistory(many);
  assert.ok(kept.length <= MAX_HISTORY_TURNS * 2, '不能超过上限');
  assert.equal(kept[0].role, 'user', '首条必须是 user，否则部分供应商会拒绝');

  // 传入以 assistant 开头的历史，也必须被修掉
  const odd = trimHistory([{ role: 'assistant', content: 'a' }, { role: 'user', content: 'u' }]);
  assert.equal(odd[0].role, 'user', '开头是 assistant 时应丢掉');

  // 脏数据要被过滤
  const dirty = trimHistory([null, { role: 'system', content: 'x' }, { role: 'user', content: '' }, { role: 'user', content: 'ok' }]);
  assert.equal(dirty.length, 1);
  assert.equal(dirty[0].content, 'ok');
  console.log('历史裁剪 OK');
}

// ---- 5. 流式消费：拼接文本、透传增量、正确识别错误 ----
{
  async function* ok() {
    yield { type: 'text-delta', text: '你' };
    yield { type: 'text-delta', text: '好' };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
  const deltas = [];
  const text = await consumeStream(ok(), (piece) => deltas.push(piece));
  assert.equal(text, '你好');
  assert.deepEqual(deltas, ['你', '好']);
  console.log('流式拼接 OK');

  async function* failed() {
    yield { type: 'text-delta', text: '半截' };
    yield { type: 'finish', reason: { kind: 'error', failure: { code: 'QUOTA', message: '额度不足' } } };
  }
  await assert.rejects(() => consumeStream(failed()), (error) => {
    assert.equal(error.code, 'QUOTA');
    assert.ok(error.message.includes('额度不足'));
    return true;
  });
  console.log('流式错误识别 OK');

  async function* aborted() {
    yield { type: 'finish', reason: { kind: 'aborted' } };
  }
  await assert.rejects(() => consumeStream(aborted()), (error) => error.message.includes('已取消'));
  console.log('取消识别 OK');

  // 只有 finish 没有文本，返回空串（由调用方处理）
  async function* empty() {
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
  assert.equal(await consumeStream(empty()), '');
  console.log('空回答 OK');
}

// ---- 6. reasoningEffort 只在存在时才带上 ----
{
  const without = buildRequest({ selection, title: 'T', body: 'B', history: [], question: '' });
  assert.ok(!('reasoningEffort' in without), '未设置时不应带该字段');

  const withEffort = buildRequest({
    selection: { provider: 'p', model: 'm', reasoningEffort: 'high' },
    title: 'T', body: 'B', history: [], question: '',
  });
  assert.equal(withEffort.reasoningEffort, 'high');
  console.log('reasoningEffort 传递 OK');
}

console.log('\n问 AI 逻辑测试全部通过。');
