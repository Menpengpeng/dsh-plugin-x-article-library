// 问 AI：把文章正文交给宿主当前模型，支持首轮总结与多轮追问。
//
// 设计要点：
// - 不自己找 provider/model，一律读 ctx.agentDefaultModel.currentSelection()，
//   这样用户在界面上换模型后，问 AI 立刻跟着换。
// - 正文按需截断：超长文章只取前 N 字符并在提示里明确说明，避免直接撞上下文上限。
// - 多轮对话只保留最近几轮，防止越问越长。

/** 首轮总结的提示词：结构化要点，方便扫读。 */
export const SUMMARY_PROMPT = [
  '请阅读下面这篇 X 文章的正文，用中文输出一份结构化要点总结。',
  '',
  '要求：',
  '1. 先用 1-2 句话说清这篇文章在讲什么。',
  '2. 再用 3-6 条列表列出核心观点，每条一行，具体、不要空话。',
  '3. 如果文章里有明确的数据、结论或可操作步骤，优先保留。',
  '4. 不要复述原文，不要加「本文」这类套话，不要输出 Markdown 标题。',
  '5. 直接给结果，不要写「好的」「以下是」。',
].join('\n');

/** 追问时的系统提示：强调基于原文，避免模型自由发挥。 */
export const CHAT_SYSTEM_PROMPT = [
  '你是一名阅读助手，正在帮助用户理解一篇 X 文章。',
  '回答必须基于提供的文章正文；正文里没有的信息，明确说「文章里没提到」，不要编造。',
  '用中文回答，简洁直接，不要客套。',
].join('\n');

/** 单篇文章送进模型的正文上限（字符）。超出部分截断并告知模型。 */
export const MAX_ARTICLE_CHARS = 24000;

/** 多轮对话保留的最大轮数（一问一答算一轮）。 */
export const MAX_HISTORY_TURNS = 8;

/**
 * 截断超长正文，并在结尾说明被截断，让模型知道内容不完整。
 * @param {string} text - 原始正文。
 * @param {number} limit - 字符上限。
 */
export function clipArticle(text, limit = MAX_ARTICLE_CHARS) {
  const source = String(text || '');
  if (source.length <= limit) return { text: source, truncated: false };
  return {
    text: `${source.slice(0, limit)}\n\n【注意：正文过长，以上仅为前 ${limit} 个字符，后续内容已省略。】`,
    truncated: true,
  };
}

/** 只保留最近若干轮对话，且保证第一条是 user（否则部分供应商会拒绝）。 */
export function trimHistory(messages, turns = MAX_HISTORY_TURNS) {
  const list = Array.isArray(messages) ? messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()) : [];
  const kept = list.slice(-turns * 2);
  while (kept.length && kept[0].role !== 'user') kept.shift();
  return kept;
}

/**
 * 构造一次 llm.stream 的调用参数。
 * @param {object} input
 * @param {{provider: string, model: string, reasoningEffort?: string}} input.selection - 当前模型路由。
 * @param {string} input.title - 文章标题。
 * @param {string} input.body - 文章正文。
 * @param {Array<{role: string, content: string}>} input.history - 已有对话。
 * @param {string} input.question - 本轮问题（空表示要首轮总结）。
 */
/**
 * 把一段纯文本包成宿主认识的 content block 数组。
 * 宿主对 message.content 做的是 `content.some(...)`，只接受 block 数组，
 * 直接传字符串会报 `content.some is not a function`。
 */
export function textBlocks(text) {
  return [{ type: 'text', text: String(text ?? '') }];
}

/**
 * 把内部简写的 { role, content: string } 转成宿主消息形状。
 *
 * 两处都踩过坑，别动：
 * - content 必须是 block 数组，宿主对它做 content.some(...)；
 * - assistant 消息必须带 source，宿主 forAdapter 会读 message.source.replayState
 *   来判断要不要清掉跨 adapter 的 replay 状态，source 缺失就是
 *   "Cannot read properties of undefined (reading 'replayState')"。
 */
function toHostMessage(message, selection) {
  const base = { role: message.role, content: textBlocks(message.content) };
  if (message.role !== 'assistant') return base;
  return {
    ...base,
    source: {
      kind: 'model',
      provider: selection.provider,
      model: selection.model,
    },
  };
}

export function buildRequest({ selection, title, body, history, question }) {
  const clipped = clipArticle(body);
  const articleBlock = [
    `【文章标题】${title || '（无标题）'}`,
    '【文章正文】',
    clipped.text,
  ].join('\n');

  const isSummary = !String(question || '').trim();
  if (isSummary) {
    return {
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
      system: CHAT_SYSTEM_PROMPT,
      messages: [
        toHostMessage({ role: 'user', content: `${articleBlock}\n\n${SUMMARY_PROMPT}` }, selection),
      ],
      purpose: 'x-article-summary',
    };
  }

  const historyMessages = trimHistory(history);
  return {
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
    system: CHAT_SYSTEM_PROMPT,
    messages: [
      toHostMessage({ role: 'user', content: `${articleBlock}\n\n以上是文章正文。` }, selection),
      toHostMessage({ role: 'assistant', content: '好的，我已经读完了这篇文章，你可以就它提问。' }, selection),
      ...historyMessages.map((message) => toHostMessage(message, selection)),
      toHostMessage({ role: 'user', content: String(question).trim() }, selection),
    ],
    purpose: 'x-article-chat',
  };
}

/**
 * 消费 llm.stream 的 chunk 流，边回调文本边拼出完整回答。
 * @param {AsyncIterable} stream - llm.stream 的返回。
 * @param {(text: string) => void} [onDelta] - 每段增量文本回调。
 */
export async function consumeStream(stream, onDelta) {
  let text = '';
  let failure;
  for await (const chunk of stream) {
    if (!chunk || typeof chunk !== 'object') continue;
    if (chunk.type === 'text-delta') {
      const piece = String(chunk.text || '');
      if (piece) {
        text += piece;
        if (onDelta) onDelta(piece);
      }
      continue;
    }
    if (chunk.type === 'finish') {
      const reason = chunk.reason || {};
      if (reason.kind === 'error' || reason.kind === 'aborted') {
        failure = reason.failure || { code: reason.kind, message: reason.kind === 'aborted' ? '已取消' : '模型调用失败' };
      }
    }
  }
  if (failure) {
    const error = new Error(String(failure.message || '模型调用失败'));
    error.code = String(failure.code || 'llm-error');
    throw error;
  }
  return text;
}
