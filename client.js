window.__ModuleLoader__.load({
  id: '@menpengpeng/dsh-plugin-x-article-library',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const API = '/api/x-article-library';

    // ===== 界面语言 =====
    // 所有用户可见文案都走 t()。默认中文，设置里可切英文。
    const I18N = {
      zh: {},
      en: {
        '请求失败（HTTP {n}）': 'Request failed (HTTP {n})',
        '刚刚': 'Just now',
        '{n} 分钟前': '{n} min ago',
        '{n} 小时前': '{n} h ago',
        '{n} 天前': '{n} d ago',
        '已就绪': 'Ready',
        '下载中': 'Downloading',
        '排队中': 'Queued',
        '失败': 'Failed',
        '不可访问': 'Inaccessible',
        '文件缺失': 'File missing',
        '未知': 'Unknown',
        '调整所属收藏夹': 'Move to Collection',
        '帖子 {n}': 'Post {n}',
        '还没有收藏夹，先在左栏建一个。': 'No collections yet. Create one in the left panel first.',
        '取消': 'Cancel',
        '保存中…': 'Saving…',
        '保存': 'Save',
        '问 AI': 'Ask AI',
        '当前使用的模型': 'Current model',
        '关闭': 'Close',
        '正在读这篇文章…': 'Reading this article…',
        '还没有内容': 'No content yet',
        '思考中…': 'Thinking…',
        '就这篇文章提问…': 'Ask about this article…',
        '发送': 'Send',
        '不能为空': 'Cannot be empty',
        '没有可导入的链接，请检查地址是否为公开帖子': 'No importable links. Please check that the URLs point to public posts.',
        '添加 X 文章': 'Add X Article',
        '粘贴公开的 X 帖子或长文链接，支持一次多条。只支持公开内容；私密、受保护或已删除的帖子无法下载。': 'Paste public X post or long-form article links; multiple links are supported. Only public content is supported; private, protected, or deleted posts cannot be downloaded.',
        '链接': 'Links',
        '已识别 {n} 个帖子': 'Detected {n} post(s)',
        '内容范围': 'Content range',
        '包含作者自线程（长文完整）': "Include author's own thread (full long-form post)",
        '只取单条帖子': 'Single post only',
        '重复链接': 'Duplicate links',
        '跳过已存在的': 'Skip existing',
        '重新下载并覆盖': 'Redownload and overwrite',
        '归入收藏夹': 'Add to collection',
        '不归类': 'Uncategorized',
        '标签（可选，空格或逗号分隔）': 'Tags (optional, separated by spaces or commas)',
        '如 设计 长文': 'e.g. design longform',
        '新增 {created} 篇，跳过 {skipped} 篇': 'Added {created}, skipped {skipped}',
        '，无法识别 {invalid} 条': ', {invalid} unrecognized',
        '。下载在后台进行，完成后会自动出现在列表中。': '. Downloads run in the background and appear in the list when finished.',
        '导入中…': 'Importing…',
        '开始导入': 'Start Import',
        '设置': 'Settings',
        '文章以 Markdown 保存在你选定的目录下，每篇文章一个文件夹，包含 article.md、metadata.json 与本地图片。分类信息只存在索引里，改变分类不会移动文件。': 'Articles are saved as Markdown in your chosen folder, one folder per article containing article.md, metadata.json, and local images. Collection info lives only in the index; changing collections does not move files.',
        '存储位置': 'Storage location',
        '打开系统文件夹选择框': 'Open system folder picker',
        '选择中…': 'Selecting…',
        '浏览…': 'Browse…',
        '在系统资源管理器中打开该目录': 'Open this folder in File Explorer',
        '打开': 'Open',
        '默认：{n}': 'Default: {n}',
        '点「浏览…」会弹出系统文件夹选择框；若当前环境没有桌面显示，会自动退回应用内目录列表。已经是相对路径的写法会被拒绝。': 'Clicking "Browse…" opens the system folder picker; if no desktop is available, it falls back to the in-app folder list. Relative paths are not accepted.',
        '收起': 'Collapse',
        '上级目录': 'Parent folder',
        '这个目录下没有子目录': 'No subfolders in this directory',
        '使用这个目录': 'Use this folder',
        '同时下载数': 'Concurrent downloads',
        '1（最稳）': '1 (most stable)',
        '2（推荐）': '2 (recommended)',
        '4（最快）': '4 (fastest)',
        '图片': 'Images',
        '下载到本地（离线可看）': 'Download locally (view offline)',
        '保留远程链接': 'Keep remote links',
        '维护': 'Maintenance',
        '扫描中…': 'Scanning…',
        '扫描存储目录': 'Scan storage folder',
        '用于找回被手工放进目录的文章': 'Use this to recover articles manually placed in the folder',
        '保存设置': 'Save Settings',
        '重命名标题…': 'Rename title…',
        '重命名文章': 'Rename article',
        '标题': 'Title',
        '取消收藏': 'Unstar',
        '加入收藏': 'Star',
        '调整所属收藏夹…': 'Move to Collection…',
        '打开所在位置': 'Open file location',
        '从库中移除': 'Remove from library',
        '删除含文件': 'Delete including files',
        '重命名收藏夹…': 'Rename collection…',
        '重命名收藏夹': 'Rename collection',
        '名称': 'Name',
        '删除收藏夹': 'Delete collection',
        '正在载入文章库…': 'Loading library…',
        '文章库暂不可用': 'Library unavailable',
        '未知错误': 'Unknown error',
        '全部文章': 'All Articles',
        '未读': 'Unread',
        '收藏': 'Starred',
        '收藏按钮': 'Star',
        '作者': 'Author',
        '需要处理': 'Needs Attention',
        '收藏夹': 'Collections',
        '资料库': 'Library',
        '博主': 'Authors',
        '创建': 'Create',
        '收藏夹名称': 'Collection name',
        '新建收藏夹': 'New Collection',
        '添加 X 链接': 'Add X link',
        '添加': 'Add',
        '搜索标题、作者、标签…': 'Search titles, authors, tags…',
        '搜索标题、作者、标签…或粘贴 X 链接': 'Search titles, authors, tags… or paste an X link',
        '检测到剪贴板中的 X 链接，是否添加到文章库？': 'An X link was detected in your paste. Add it to the library?',
        '添加 {n} 篇': 'Add {n} article(s)',
        '已添加 {n} 篇': 'Added {n} article(s)',
        '，跳过 {n} 篇': ', skipped {n}',
        '从剪贴板粘贴 X 链接': 'Paste an X link from the clipboard',
        '粘贴链接': 'Paste link',
        '无法读取剪贴板，请在搜索框按 Ctrl+V 粘贴': 'Cannot read clipboard—press Ctrl+V in the search box',
        '剪贴板中没有 X 链接': 'No X link in the clipboard',
        '重试所有失败的下载': 'Retry all failed downloads',
        '重试': 'Retry',
        '（无标题）': '(Untitled)',
        '已读': 'Read',
        '未读完': 'Partially read',
        '已收藏': 'Starred',
        '未知作者': 'Unknown author',
        '图 {n}': '{n} img',
        '没有匹配的文章': 'No matching articles',
        '还没有文章': 'No articles yet',
        '换个关键词或分类试试': 'Try a different keyword or collection',
        '点击上方「+ 添加」，粘贴公开的 X 链接': 'Click "+ Add" above and paste a public X link',
        '进入阅读模式（Esc 退出）': 'Enter reading mode (Esc to exit)',
        '阅读模式': 'Reading Mode',
        '用 AI 总结这篇文章，可继续追问': 'Summarize this article with AI and keep asking follow-ups',
        '在资源管理器中显示该文件': 'Show this file in File Explorer',
        '打开原帖': 'Open original post',
        '只移除索引，保留磁盘文件': 'Remove from index only, keep files on disk',
        '同时删除磁盘上的文件': 'Also delete files on disk',
        '{n} 张图片': '{n} image(s)',
        '上次读到的位置（{n}%）': 'Last read position ({n}%)',
        '正在读取…': 'Loading…',
        ' 正在读取…': ' Loading…',
        '正在下载，稍候会自动出现': 'Downloading; it will appear automatically when done',
        '这篇文章还没有可读内容': 'This article has no readable content yet',
        '重新下载': 'Redownload',
        '选择一篇开始阅读': 'Select an article to start reading',
        'X 文章库': 'X Article Library',
        '在左侧选一篇已下载的文章，正文会显示在这里。': 'Select a downloaded article on the left; its content will appear here.',
        '把公开的 X 帖子或长文链接贴进来，会自动转成可离线阅读的 Markdown，并按收藏夹和博主归类。': 'Paste public X posts or long-form links; they are converted to offline-readable Markdown and organized by collection and author.',
        '添加链接': 'Add Links',
        '在资源管理器中打开存储目录': 'Open storage folder in File Explorer',
        '打开存储目录': 'Open Storage Folder',
        '退出阅读模式（Esc）': 'Exit reading mode (Esc)',
        '点击退出阅读模式（Esc）': 'Click to exit reading mode (Esc)',
        '阅读模式已开启，点击退出': 'Reading mode on, click to exit',
        '退出阅读': 'Exit Reading',
        '拖动调整正文字号（{min}–{max}px）': 'Drag to adjust font size ({min}–{max}px)',
        '正文字号': 'Font size',
        'X 文章': 'X Article',
        '语言': 'Language',
        '中文': 'Chinese',
        'English': 'English',
        '划线': 'Highlight',
        '评论': 'Comment',
        '写评论': 'Write a comment',
        '评论内容': 'Comment',
        '写下你的想法…': 'Write your thoughts…',
      },
    };
    let currentLang = 'zh';
    function setLang(lang) { currentLang = lang === 'en' ? 'en' : 'zh'; }
    // t('中文原文', { n: 3 })：查英文映射，支持 {name} 占位符；中文原样返回。
    function t(zh, vars) {
      if (currentLang === 'en') {
        const en = I18N.en[zh];
        if (en) {
          return vars ? en.replace(/\{(\w+)\}/g, (m, key) => (vars[key] === undefined ? m : String(vars[key]))) : en;
        }
      }
      // 中文也支持占位符替换，保持两边行为一致。
      return vars ? String(zh).replace(/\{(\w+)\}/g, (m, key) => (vars[key] === undefined ? m : String(vars[key]))) : zh;
    }

    // ===== 受限 Markdown 渲染 =====
    // 只支持常用语法，禁原生 HTML、内联脚本与危险链接；外部内容一律当不可信数据。
    const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function safeHref(raw) {
      const value = String(raw || '').trim();
      if (!value) return '';
      if (/^(\.{0,2}\/|#|\?)/.test(value)) return value;
      try {
        const url = new URL(value, 'https://placeholder.invalid');
        return SAFE_PROTOCOLS.includes(url.protocol) ? value : '';
      } catch {
        return '';
      }
    }

    function assetNameFor(raw) {
      const value = String(raw || '').trim();
      return /^assets\/[A-Za-z0-9._-]+$/.test(value) ? value.slice(7) : '';
    }

    function renderInline(text) {
      // 先抽出划线标记（含可选评论），用占位符保护，避免后续转义把它们改掉。
      const marks = [];
      let work = String(text == null ? '' : text).replace(/==([^=]+)==(?:<!--c:([A-Za-z0-9+/=]+)-->)?/g, (whole, body, encoded) => {
        let comment = '';
        if (encoded) {
          try { comment = decodeURIComponent(escape(atob(encoded))); } catch { comment = ''; }
        }
        const idx = marks.length;
        marks.push({ body, comment });
        return '\u0000M' + idx + '\u0000';
      });
      let out = escapeHtml(work);
      // 还原划线（对 body 再做一次 inline 渲染，支持里面再加粗等）。
      out = out.replace(/\u0000M(\d+)\u0000/g, (whole, idx) => {
        const mark = marks[Number(idx)];
        if (!mark) return '';
        const inner = renderInline(mark.body);
        if (mark.comment) {
          return '<mark class="xal-mark has-comment" data-comment="' + escapeHtml(mark.comment) + '">' + inner + '<sup class="xal-mark-note" aria-label="comment">💬</sup></mark>';
        }
        return '<mark class="xal-mark">' + inner + '</mark>';
      });
      out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
      out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, href) => {
        const safe = safeHref(href.replace(/&amp;/g, '&'));
        if (!safe) return label;
        return '<a href="' + escapeHtml(safe) + '" target="_blank" rel="noreferrer noopener">' + label + '</a>';
      });
      return out;
    }

    function renderMarkdown(markdown, postId) {
      const lines = String(markdown || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
      const blocks = [];
      let index = 0;

      const imageHtml = (alt, src, title) => {
        const name = assetNameFor(src);
        if (name && postId) {
          const url = API + '/asset?postId=' + encodeURIComponent(postId) + '&name=' + encodeURIComponent(name);
          const caption = title || alt;
          return '<figure class="xal-figure"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" />' + (caption ? '<figcaption>' + escapeHtml(caption) + '</figcaption>' : '') + '</figure>';
        }
        const safe = safeHref(src);
        if (!safe || !/^https?:/i.test(safe)) return '';
        return '<figure class="xal-figure"><img src="' + escapeHtml(safe) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" />' + (alt ? '<figcaption>' + escapeHtml(alt) + '</figcaption>' : '') + '</figure>';
      };

      while (index < lines.length) {
        const line = lines[index];

        const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)\s*$/);
        if (fence) {
          const marker = fence[1];
          const language = fence[2] || '';
          const body = [];
          index += 1;
          while (index < lines.length && !lines[index].trim().startsWith(marker)) {
            body.push(lines[index]);
            index += 1;
          }
          index += 1;
          blocks.push('<pre class="xal-code"' + (language ? ' data-lang="' + escapeHtml(language) + '"' : '') + '><code>' + escapeHtml(body.join('\n')) + '</code></pre>');
          continue;
        }

        if (!line.trim()) {
          index += 1;
          continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          const level = Math.min(6, heading[1].length);
          blocks.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
          index += 1;
          continue;
        }

        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
          blocks.push('<hr />');
          index += 1;
          continue;
        }

        if (/^\s*>\s?/.test(line)) {
          const body = [];
          while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
            body.push(lines[index].replace(/^\s*>\s?/, ''));
            index += 1;
          }
          blocks.push('<blockquote>' + renderMarkdown(body.join('\n'), postId) + '</blockquote>');
          continue;
        }

        if (/^\s*([-*+]|\d{1,9}[.)])\s+/.test(line)) {
          const ordered = /^\s*\d{1,9}[.)]\s+/.test(line);
          const items = [];
          while (index < lines.length && /^\s*([-*+]|\d{1,9}[.)])\s+/.test(lines[index])) {
            items.push(lines[index].replace(/^\s*([-*+]|\d{1,9}[.)])\s+/, ''));
            index += 1;
          }
          const tag = ordered ? 'ol' : 'ul';
          blocks.push('<' + tag + '>' + items.map((item) => '<li>' + renderInline(item) + '</li>').join('') + '</' + tag + '>');
          continue;
        }

        const imageOnly = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/);
        if (imageOnly) {
          const html = imageHtml(imageOnly[1], imageOnly[2], imageOnly[3]);
          if (html) blocks.push(html);
          index += 1;
          continue;
        }

        if (/^\s*\|/.test(line) && /^\s*\|?[\s:-]*\|/.test(lines[index + 1] || '')) {
          const headerCells = line.split('|').slice(1, -1).map((cell) => cell.trim());
          const rows = [];
          index += 2;
          while (index < lines.length && /^\s*\|/.test(lines[index])) {
            rows.push(lines[index].split('|').slice(1, -1).map((cell) => cell.trim()));
            index += 1;
          }
          const head = '<tr>' + headerCells.map((cell) => '<th>' + renderInline(cell) + '</th>').join('') + '</tr>';
          const body = rows.map((row) => '<tr>' + row.map((cell) => '<td>' + renderInline(cell) + '</td>').join('') + '</tr>').join('');
          blocks.push('<div class="xal-table-wrap"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>');
          continue;
        }

        const paragraph = [];
        while (index < lines.length && lines[index].trim()) {
          const current = lines[index];
          if (/^\s*(```|~~~)/.test(current) || /^#{1,6}\s/.test(current) || /^\s*>\s?/.test(current) || /^\s*([-*+]|\d{1,9}[.)])\s+/.test(current)) break;
          paragraph.push(current);
          index += 1;
        }
        if (!paragraph.length) {
          index += 1;
          continue;
        }
        const html = paragraph
          .map((text) => {
            const image = text.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/);
            if (image) return imageHtml(image[1], image[2], image[3]);
            return renderInline(text);
          })
          .join('<br />');
        blocks.push('<p>' + html + '</p>');
      }

      return blocks.join('\n');
    }

    // ===== 网络与格式化 =====
    async function call(type, payload) {
      const response = await fetch(API, {
        method: type ? 'POST' : 'GET',
        headers: type ? { 'content-type': 'application/json' } : undefined,
        body: type ? JSON.stringify({ type, ...payload }) : undefined,
      });
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      if (!response.ok) throw new Error(data.error || t('请求失败（HTTP {n}）', { n: response.status }));
      return data;
    }

    function formatDate(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    function relativeTime(value) {
      if (!value) return '';
      const diff = Date.now() - new Date(value).getTime();
      if (Number.isNaN(diff)) return '';
      if (diff < 60000) return t('刚刚');
      if (diff < 3600000) return t('{n} 分钟前', { n: Math.floor(diff / 60000) });
      if (diff < 86400000) return t('{n} 小时前', { n: Math.floor(diff / 3600000) });
      if (diff < 2592000000) return t('{n} 天前', { n: Math.floor(diff / 86400000) });
      return formatDate(value);
    }

    function StatusDot({ status }) {
      const map = {
        ready: [t('已就绪'), 'ok'],
        downloading: [t('下载中'), 'busy'],
        queued: [t('排队中'), 'busy'],
        failed: [t('失败'), 'error'],
        blocked: [t('不可访问'), 'error'],
        missing: [t('文件缺失'), 'error'],
      };
      const entry = map[status] || [t('未知'), ''];
      return h('span', { className: 'xal-dot ' + entry[1], title: entry[0] });
    }

    function Icon({ active }) {
      return h(
        'div',
        {
          className: 'xal-icon',
          style: {
            width: 24,
            height: 24,
            borderRadius: 7,
            display: 'grid',
            placeItems: 'center',
            background: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-2)',
            color: active ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-label-secondary)',
          },
        },
        h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor' }, h('path', { d: 'M4 3.5h11.6a2.4 2.4 0 0 1 2.4 2.4V14a2.4 2.4 0 0 1-2.4 2.4H10l-4.2 3.1a.6.6 0 0 1-.96-.48V16.4H4A2.4 2.4 0 0 1 1.6 14V5.9A2.4 2.4 0 0 1 4 3.5Z' })),
      );
    }

    // 线性图标集：统一 24 视框、currentColor 描边，避免各处 emoji 字体不一致。
    const ICONS = {
      all: 'M4 5.5h16M4 12h16M4 18.5h10',
      unread: 'M4 6.2h16v11.6H4zM4 7l8 6 8-6',
      star: 'M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z',
      warn: 'M12 4.2l8.2 14.2H3.8zM12 9.6v4.2M12 16.4v.1',
      folder: 'M3.6 7.2h5.2l1.6 2h9.9v9.2H3.6zM3.6 7.2V5.6h5.2l1.6 1.6',
      folderOpen: 'M3.6 7.2h5.2l1.6 2h9.9v1.6M3.9 18.6l2.1-7.8h15l-2.1 7.8z',
      plus: 'M12 5v14M5 12h14',
      refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4.4h-4.4',
      external: 'M14 4.6h5.4V10M19.4 4.6l-8 8M18 14.2v4.8H9.6V5.6h4.6',
      settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 12a7.4 7.4 0 0 0-.1-1.2l2-1.5-1.9-3.3-2.4.8a7.4 7.4 0 0 0-2-1.2l-.4-2.5h-3.8l-.4 2.5a7.4 7.4 0 0 0-2 1.2l-2.4-.8-1.9 3.3 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 1.9 3.3 2.4-.8a7.4 7.4 0 0 0 2 1.2l.4 2.5h3.8l.4-2.5a7.4 7.4 0 0 0 2-1.2l2.4.8 1.9-3.3-2-1.5c.06-.4.1-.8.1-1.2z',
      scan: 'M4.6 8.4V4.6h3.8M19.4 8.4V4.6h-3.8M4.6 15.6v3.8h3.8M19.4 15.6v3.8h-3.8M4.6 12h14.8',
      trash: 'M5.4 7.4h13.2M9.2 7.4V5.2h5.6v2.2M6.8 7.4l.9 12h8.6l.9-12M10.4 10.8v5.6M13.6 10.8v5.6',
      close: 'M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6',
      check: 'M5 12.6l4.6 4.4L19 7.4',
      chevronUp: 'M6.4 14.4L12 8.8l5.6 5.6',
      author: 'M12 12.4a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6zM4.8 20.4a7.2 7.2 0 0 1 14.4 0',
      spark: 'M12 3.8l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8zM18.6 15.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
      send: 'M4.6 12l14.8-7.4-4.2 14.8-3.9-6.1zM15.2 19.4l-3.9-6.1',
      // 字号：大 A 小 A，用于正文字号控件两端。
      fontLarger: 'M3.4 19l4.6-13.4L12.6 19M4.9 15.2h6.2M14.6 19l2.9-8.2L20.4 19M15.5 16.6h3.9',
      fontSmaller: 'M3.4 19l4.6-13.4L12.6 19M4.9 15.2h6.2M20.4 15.2h-5.2',
      // 阅读模式：一本翻开的书。
      book: 'M12 6.4C9.8 5 7.2 4.8 4.4 5.6v12c2.8-.8 5.4-.6 7.6.8 2.2-1.4 4.8-1.6 7.6-.8v-12C16.8 4.8 14.2 5 12 6.4zM12 6.4v12',
    };

    /** 渲染一个线性图标。size 默认 14。 */
    function Glyph({ name, size }) {
      const d = ICONS[name] || ICONS.all;
      return h(
        'svg',
        {
          width: size || 14,
          height: size || 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          style: { flex: 'none' },
        },
        h('path', { d }),
      );
    }

    /**
     * 通用右键菜单。
     * 定位用 fixed + 点击坐标，并在打开时夹到视口内，避免靠边溢出。
     */
    function ContextMenu({ menu, onClose }) {
      const items = menu.items || [];
      // Esc 关闭：菜单是临时浮层，键盘用户也要能退出。
      useEffect(() => {
        const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
      }, [onClose]);
      return h(
        'div',
        {
          className: 'xal-ctx-overlay',
          onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); },
          onContextMenu: (event) => { event.preventDefault(); onClose(); },
        },
        h(
          'div',
          {
            className: 'xal-ctx',
            onContextMenu: (event) => event.preventDefault(),
            style: {
              left: Math.max(8, Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240)),
              top: Math.max(8, Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - (items.length * 34 + 20))),
            },
          },
          menu.title ? h('div', { className: 'xal-ctx-title' }, menu.title) : null,
          ...items.map((item, index) => (item.separator
            ? h('div', { key: 'sep-' + index, className: 'xal-ctx-sep' })
            : h(
                'button',
                {
                  key: item.label + index,
                  className: 'xal-ctx-item' + (item.danger ? ' danger' : '') + (item.checked ? ' checked' : ''),
                  onClick: () => { onClose(); item.onClick(); },
                },
                h('span', { className: 'xal-ctx-icon' }, item.checked ? h(Glyph, { name: 'check', size: 12 }) : null),
                h('span', null, item.label),
              ))),
        ),
      );
    }

    /** 勾选式收藏夹选择框：右键「调整收藏夹」用。 */
    function CollectionPicker({ article, collections, onClose, onSave }) {
      const [selected, setSelected] = useState([...(article.collectionIds || [])]);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');

      function toggle(id) {
        setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
      }

      async function save() {
        setBusy(true);
        try {
          await onSave(selected);
          onClose();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }

      return h(
        'div',
        { className: 'xal-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h(
          'div',
          { className: 'xal-dialog', style: { maxWidth: 440 } },
          h('h2', null, t('调整所属收藏夹')),
          h('div', { className: 'xal-hint', style: { marginBottom: 10 } }, article.title || t('帖子 {n}', { n: article.postId })),
          collections.length
            ? h('div', { className: 'xal-picker-list' },
                ...collections.map((collection) => {
                  const checked = selected.includes(collection.id);
                  return h(
                    'button',
                    {
                      key: collection.id,
                      className: 'xal-picker-item' + (checked ? ' checked' : ''),
                      onClick: () => toggle(collection.id),
                    },
                    h('span', { className: 'xal-picker-box' }, checked ? h(Glyph, { name: 'check', size: 11 }) : null),
                    collection.color ? h('span', { className: 'xal-dot-mark', style: { background: collection.color } }) : null,
                    h('span', null, collection.name),
                  );
                }))
            : h('div', { className: 'xal-hint' }, t('还没有收藏夹，先在左栏建一个。')),
          error ? h('div', { className: 'xal-banner' }, error) : null,
          h('div', { className: 'xal-row', style: { justifyContent: 'flex-end', marginTop: 14 } },
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, t('取消'))),
            h('button', { className: 'xal-btn primary', onClick: save, disabled: busy }, h(Glyph, { name: 'check' }), h('span', null, busy ? t('保存中…') : t('保存')))),
        ),
      );
    }


    /** 问 AI 侧栏：首轮自动总结，之后可连续追问。
     * 打开时若还没有对话就自动跑一次总结，省得用户再点一下。
     */
    function AiPanel({ article, onClose, onError }) {
      const [messages, setMessages] = useState([]);
      const [input, setInput] = useState('');
      const [busy, setBusy] = useState(false);
      const [info, setInfo] = useState(null);
      const [localError, setLocalError] = useState('');
      const bodyRef = useRef(null);
      const startedRef = useRef(false);

      const scrollToBottom = () => {
        const node = bodyRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      };

      const send = useCallback(async (question) => {
        setBusy(true);
        setLocalError('');
        try {
          const history = question ? messages : [];
          const result = await call('ask', {
            postId: article.postId,
            question: question || '',
            history,
          });
          setInfo({ model: result.model });
          setMessages((prev) => [
            ...prev,
            ...(question ? [{ role: 'user', content: question }] : []),
            { role: 'assistant', content: result.answer },
          ]);
        } catch (err) {
          setLocalError(err.message);
          if (onError) onError(err.message);
        } finally {
          setBusy(false);
          setTimeout(scrollToBottom, 30);
        }
      }, [article.postId, messages, onError]);

      // 首次打开自动总结一次。
      useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        send('');
      }, [send]);

      useEffect(scrollToBottom, [messages]);

      async function submit() {
        const question = input.trim();
        if (!question || busy) return;
        setInput('');
        await send(question);
      }

      return h(
        'aside',
        { className: 'xal-ai' },
        h(
          'div',
          { className: 'xal-ai-head' },
          h('span', { className: 'xal-ai-title' }, h(Glyph, { name: 'spark' }), h('span', null, t('问 AI'))),
          info?.model ? h('span', { className: 'xal-ai-model', title: t('当前使用的模型') }, info.model) : null,
          h('button', { className: 'xal-icon-btn', onClick: onClose, title: t('关闭') }, h(Glyph, { name: 'close' })),
        ),
        h(
          'div',
          { className: 'xal-ai-body', ref: bodyRef },
          messages.length
            ? messages.map((message, index) => h(
                'div',
                { key: index, className: 'xal-ai-msg ' + message.role },
                message.role === 'assistant'
                  ? h('div', { className: 'xal-ai-md', dangerouslySetInnerHTML: { __html: renderMarkdown(message.content, 'ai-' + article.postId + '-' + index) } })
                  : h('div', { className: 'xal-ai-plain' }, message.content),
              ))
            : busy
              ? h('div', { className: 'xal-ai-hint' }, t('正在读这篇文章…'))
              : h('div', { className: 'xal-ai-hint' }, t('还没有内容')),
          busy && messages.length ? h('div', { className: 'xal-ai-hint' }, t('思考中…')) : null,
          localError ? h('div', { className: 'xal-banner' }, localError) : null,
        ),
        h(
          'div',
          { className: 'xal-ai-foot' },
          h('input', {
            className: 'xal-input',
            value: input,
            placeholder: t('就这篇文章提问…'),
            disabled: busy,
            spellCheck: false,
            onChange: (event) => setInput(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } },
          }),
          h('button', { className: 'xal-btn primary', onClick: submit, disabled: busy || !input.trim() },
            h(Glyph, { name: busy ? 'refresh' : 'send' }),
            h('span', null, busy ? '…' : t('发送'))),
        ),
      );
    }


    function PromptDialog({ title, label, value, placeholder, onClose, onSubmit }) {
      const [text, setText] = useState(value || '');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');

      async function submit() {
        const next = text.trim();
        if (!next) { setError(t('不能为空')); return; }
        if (next === value) { onClose(); return; }
        setBusy(true);
        try {
          await onSubmit(next);
          onClose();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }

      return h(
        'div',
        { className: 'xal-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h(
          'div',
          { className: 'xal-dialog', style: { maxWidth: 420 } },
          h('h2', null, title),
          h('div', { className: 'xal-field' },
            label ? h('label', null, label) : null,
            h('input', {
              className: 'xal-input',
              autoFocus: true,
              value: text,
              placeholder,
              spellCheck: false,
              onChange: (event) => setText(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') submit();
                if (event.key === 'Escape') onClose();
              },
            })),
          error ? h('div', { className: 'xal-banner' }, error) : null,
          h('div', { className: 'xal-row', style: { justifyContent: 'flex-end', marginTop: 14 } },
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, t('取消'))),
            h('button', { className: 'xal-btn primary', onClick: submit, disabled: busy }, h(Glyph, { name: 'check' }), h('span', null, busy ? t('保存中…') : t('保存')))),
        ),
      );
    }


    const CSS = [
      '.xal-root{display:grid;grid-template-columns:minmax(190px,236px) minmax(260px,360px) minmax(0,1fr);height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;container-type:inline-size}',
      // AI 侧栏打开时多一列；窄容器里改窄一点，避免正文被挤没。
      '.xal-root.ai-open{grid-template-columns:minmax(190px,236px) minmax(260px,340px) minmax(0,1fr) minmax(260px,340px)}',
      // 阅读模式：整窗只留正文，隐藏导航、列表与工具栏，正文适当加宽居中。
      '.xal-root.focus{grid-template-columns:minmax(0,1fr)}',
      '.xal-root.focus .xal-nav,.xal-root.focus .xal-list-col{display:none}',
      '.xal-root.focus .xal-reader-body{padding:34px 6vw 90px}',
      '.xal-root.focus .xal-reader-inner{max-width:820px}',
      '.xal-root.focus .xal-tools{display:none}',
      // 模式 chip：常在面板顶部，显示当前「阅读模式」，hover 出关闭图标、点击退出（参考 bot 模式）。
      '.xal-mode-chip{position:absolute;top:12px;right:18px;z-index:30;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:11.5px;font-family:inherit;line-height:1.4;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.16);transition:background-color .12s,color .12s}',
      '.xal-mode-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.xal-mode-chip .rest-glyph{display:inline-flex}',
      '.xal-mode-chip .exit-glyph{display:none}',
      '.xal-mode-chip:hover .rest-glyph{display:none}',
      '.xal-mode-chip:hover .exit-glyph{display:inline-flex}',
      '.xal-mode-chip.busy{opacity:.6;cursor:default}',
      '@container (max-width: 1100px){.xal-root.ai-open{grid-template-columns:minmax(170px,200px) minmax(220px,280px) minmax(0,1fr) minmax(230px,300px)}}',
      '.xal-col{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}',
      '.xal-nav{border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);padding:12px 8px;gap:2px;overflow-y:auto}',
      '.xal-list-col{border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}',
      '.xal-reader{background:var(--dsw-alias-bg-base)}',
      '.xal-nav-title{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-caption);margin:14px 10px 6px;font-weight:600}',
      '.xal-nav-title:first-child{margin-top:2px}',
      '.xal-nav-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;font-size:13px;font-family:inherit}',
      '.xal-nav-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.xal-nav-item.active{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}',
      '.xal-nav-item .xal-count{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums}',
      '.xal-nav-item.active .xal-count{color:var(--dsw-alias-label-primary-foreground);opacity:.8}',
      '.xal-nav-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xal-dot-mark{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-label-caption)}',
      '.xal-nav-add{display:flex;gap:6px;padding:6px 10px 2px;align-items:center}',
      '.xal-nav-add input{flex:1;min-width:0}',
      '.xal-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);min-height:52px;box-sizing:border-box}',
      '.xal-head h1{margin:0;font-size:15px;font-weight:650;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xal-search{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.xal-search input{flex:1;min-width:0}',
      'input.xal-input,select.xal-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:12px;font-family:inherit}',
      'input.xal-input:focus,select.xal-input:focus,textarea.xal-input:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px}',
      'textarea.xal-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:8px;font-size:12px;font-family:inherit;resize:vertical;min-height:88px;line-height:1.55}',
      '.xal-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:6px;line-height:1.2}',
      '.xal-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.xal-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.xal-btn.primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}',
      '.xal-btn.ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}',
      '.xal-btn.ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.xal-btn.danger{color:var(--dsw-alias-state-error-primary)}',
      '.xal-items{flex:1;overflow-y:auto;padding:6px}',
      '.xal-item{position:relative;display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:9px;background:transparent;padding:9px 10px;cursor:pointer;color:inherit;font-family:inherit}',
      '.xal-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.xal-item.active{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}',
      '.xal-item-top{display:flex;align-items:center;gap:6px;margin-bottom:3px}',
      '.xal-item-title{flex:1;font-weight:600;font-size:13px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
      '.xal-item-excerpt{font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
      '.xal-item-meta{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11px;color:var(--dsw-alias-label-caption);flex-wrap:wrap}',
      '.xal-tag{padding:1px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-size:10.5px;color:var(--dsw-alias-label-secondary)}',
      // 已读/未读标签：未读用品牌色强调，已读淡化，和标题同一行。
      '.xal-readtag{flex:none;padding:1px 5px;border-radius:4px;font-size:10px;line-height:1.5;font-weight:500;white-space:nowrap}',
      '.xal-readtag.unread{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.xal-readtag.reading{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.xal-readtag.read{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-caption)}',
      '.xal-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-border-l3)}',
      '.xal-dot.ok{background:var(--dsw-alias-state-success-primary)}',
      '.xal-dot.busy{background:var(--dsw-alias-state-warn-primary);animation:xal-pulse 1.2s ease-in-out infinite}',
      '.xal-dot.error{background:var(--dsw-alias-state-error-primary)}',
      '@keyframes xal-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '.xal-reader-body{flex:1;overflow-y:auto;padding:18px 26px 60px}',
      '.xal-reader-inner{max-width:720px;margin:0 auto;font-size:var(--xal-reader-font-size,14px);position:relative}',
      // 工具栏吸顶：滚动正文时功能按钮固定在阅读区顶部，背景遮住下方文字。
      '.xal-tools{position:sticky;top:0;z-index:10;background:var(--dsw-alias-bg-base);padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      // 上次读到的位置：正文内一条红线，仅「未读完」时显示。
      '.xal-reading-mark{position:absolute;left:-8px;right:-8px;height:2px;background:var(--dsw-alias-state-error-primary);pointer-events:none;z-index:5}',
      '.xal-reading-mark::after{content:"上次读到这里";position:absolute;right:0;top:-10px;background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base);font-size:10px;line-height:1.5;padding:1px 6px;border-radius:4px;white-space:nowrap}',
      '.xal-reader h1.xal-title{font-size:1.5714em;line-height:1.35;margin:14px 0 8px;font-weight:700;word-break:break-word}',
      '.xal-reader-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary);padding-bottom:12px;margin-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.xal-md{line-height:1.72;word-break:break-word}',
      // 划线与评论：黄底高亮，带评论的右上角显示小气泡。
      '.xal-md mark.xal-mark{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 30%,transparent);color:inherit;border-bottom:2px solid var(--dsw-alias-state-warn-primary);border-radius:2px;cursor:help}',
      // 评论徽章：明显的小圆标，悬浮/点击显示完整评论。
      '.xal-md mark.xal-mark.has-comment{border-bottom-style:dashed}',
      '.xal-md .xal-mark-note{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:3px;border-radius:50%;background:var(--dsw-alias-state-warn-primary);font-size:10px;line-height:1;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,.25)}',
      // 选中文字后浮出的划线/评论工具条。
      '.xal-selbar{position:fixed;z-index:90;transform:translateX(-50%);display:flex;gap:5px;align-items:center;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px rgba(0,0,0,.3)}',
      // 评论悬浮卡片：正常字号、自动换行、可读的最大宽度。
      '.xal-comment-peek{position:fixed;z-index:95;transform:translateX(-50%);max-width:min(360px,80vw);padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;box-shadow:0 8px 24px rgba(0,0,0,.32);pointer-events:none}',
      // 粘贴链接确认框里的链接列表。
      '.xal-paste-links{max-height:160px;overflow-y:auto;margin:4px 0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2)}',
      '.xal-paste-link{padding:6px 9px;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.xal-paste-link:last-child{border-bottom:0}',
      '.xal-md p{margin:0 0 12px}',
      '.xal-md h1,.xal-md h2,.xal-md h3,.xal-md h4,.xal-md h5,.xal-md h6{margin:22px 0 10px;line-height:1.35;font-weight:650}',
      '.xal-md h1{font-size:1.4286em}.xal-md h2{font-size:1.2857em}.xal-md h3{font-size:1.1429em}.xal-md h4{font-size:1.0714em}.xal-md h5,.xal-md h6{font-size:1em;color:var(--dsw-alias-label-secondary)}',
      '.xal-md a{color:var(--dsw-alias-brand-primary);text-decoration:none}',
      '.xal-md a:hover{text-decoration:underline}',
      '.xal-md ul,.xal-md ol{margin:0 0 12px;padding-left:22px}',
      '.xal-md li{margin:3px 0}',
      '.xal-md blockquote{margin:0 0 12px;padding:6px 14px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-radius:0 6px 6px 0}',
      '.xal-md code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em;background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:4px}',
      '.xal-md pre.xal-code{margin:0 0 14px;padding:12px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow-x:auto;border:1px solid var(--dsw-alias-border-l1)}',
      '.xal-md pre.xal-code code{background:none;padding:0;font-size:.8929em;line-height:1.55}',
      '.xal-md hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:20px 0}',
      '.xal-md .xal-figure{margin:0 0 16px;text-align:center}',
      '.xal-md .xal-figure img{max-width:100%;height:auto;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.xal-md .xal-figure figcaption{font-size:11.5px;color:var(--dsw-alias-label-caption);margin-top:6px}',
      '.xal-md .xal-table-wrap{margin:0 0 14px;overflow-x:auto}',
      '.xal-md table{border-collapse:collapse;font-size:.8929em;min-width:100%}',
      '.xal-md th,.xal-md td{border:1px solid var(--dsw-alias-border-l1);padding:6px 10px;text-align:left}',
      '.xal-md th{background:var(--dsw-alias-bg-layer-2);font-weight:600}',
      // 正文字号控件：拖动即时生效，松手保存。
      '.xal-fontctl{display:flex;align-items:center;gap:6px;padding:0 8px;height:26px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);box-sizing:border-box}',
      '.xal-fontctl span.xal-fontval{font-size:11px;min-width:30px;text-align:center;font-variant-numeric:tabular-nums}',
      '.xal-fontctl input[type=range]{width:74px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}',
      '.xal-fontctl input[type=range]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.xal-empty{display:grid;place-items:center;gap:10px;height:100%;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;padding:30px;box-sizing:border-box}',
      '.xal-empty b{font-size:15px;color:var(--dsw-alias-label-primary)}',
      '.xal-banner{margin:10px 12px;padding:8px 10px;border-radius:7px;font-size:12px;line-height:1.5;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent)}',
      '.xal-banner.info{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l1)}',
      '.xal-overlay{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.42);display:grid;place-items:center;padding:20px;box-sizing:border-box}',
      '.xal-dialog{width:min(560px,100%);max-height:min(80vh,720px);overflow-y:auto;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:18px;box-sizing:border-box;box-shadow:0 18px 48px rgba(0,0,0,.32)}',
      '.xal-ctx-overlay{position:fixed;inset:0;z-index:80;background:transparent}',      '.xal-ctx{position:fixed;min-width:200px;max-width:260px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:5px;box-shadow:0 12px 32px rgba(0,0,0,.34);box-sizing:border-box}',
      '.xal-ctx-title{font-size:11px;color:var(--dsw-alias-label-caption);padding:5px 9px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xal-ctx-item{display:flex;align-items:center;gap:6px;width:100%;text-align:left;border:0;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;padding:7px 9px;border-radius:6px;cursor:pointer}',
      '.xal-ctx-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.xal-ctx-item.danger{color:var(--dsw-alias-state-error-primary)}',
      '.xal-ctx-icon{display:inline-flex;width:12px;justify-content:center;color:var(--dsw-alias-brand-primary)}',
      '.xal-ctx-sep{height:1px;background:var(--dsw-alias-border-l1);margin:4px 6px}',
      '.xal-picker-list{display:flex;flex-direction:column;gap:3px;max-height:min(46vh,340px);overflow-y:auto;padding:3px}',
      '.xal-picker-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;padding:7px 9px;border-radius:6px;cursor:pointer}',
      '.xal-picker-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.xal-picker-item.checked{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}',
      '.xal-picker-box{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:3px;flex:none;color:var(--dsw-alias-brand-primary)}',
      '.xal-picker-item.checked .xal-picker-box{border-color:var(--dsw-alias-brand-primary)}',
      '.xal-ai{display:flex;flex-direction:column;min-width:0;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);max-height:100%;overflow:hidden}',
      '.xal-ai-head{display:flex;align-items:center;gap:6px;padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}',
      '.xal-ai-title{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);min-width:0}',
      '.xal-ai-model{margin-left:auto;font-size:10px;color:var(--dsw-alias-label-caption);max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xal-ai-body{flex:1;min-height:0;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:9px}',
      '.xal-ai-msg{font-size:12px;line-height:1.62;color:var(--dsw-alias-label-primary);max-width:100%;word-break:break-word}',
      '.xal-ai-msg.user{align-self:flex-end;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 9px;max-width:88%}',
      '.xal-ai-plain{white-space:pre-wrap}',
      '.xal-ai-md>*:first-child{margin-top:0}',
      '.xal-ai-md>*:last-child{margin-bottom:0}',
      '.xal-ai-md p{margin:0 0 7px}',
      '.xal-ai-md ul,.xal-ai-md ol{margin:0 0 7px;padding-left:18px}',
      '.xal-ai-md li{margin:2px 0}',
      '.xal-ai-md code{background:var(--dsw-alias-bg-layer-2);padding:1px 4px;border-radius:3px;font-size:11px}',
      '.xal-ai-hint{font-size:11px;color:var(--dsw-alias-label-caption)}',
      '.xal-ai-foot{flex:none;display:flex;gap:6px;padding:8px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.xal-ai-foot .xal-input{flex:1;min-width:0}',
      '.xal-icon-btn{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:3px;border-radius:5px}',
      '.xal-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.xal-dialog h2{margin:0 0 4px;font-size:16px;font-weight:650}',
      '.xal-dialog .xal-hint{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin:0 0 12px;line-height:1.55}',
      '.xal-field{display:grid;gap:5px;margin-bottom:11px}',
      '.xal-field > label{font-size:11.5px;color:var(--dsw-alias-label-secondary);font-weight:500}',
      '.xal-row{display:flex;gap:8px;align-items:center}',
      '.xal-row > *{flex:none}',
      '.xal-row > .xal-grow{flex:1;min-width:0}',
      '.xal-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}',
      '.xal-browse{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}',
      '.xal-browse-path{display:flex;align-items:center;gap:6px;padding:7px 9px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:11.5px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.xal-browse-list{max-height:180px;overflow-y:auto;padding:4px}',
      '.xal-browse-item{display:flex;align-items:center;gap:6px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font-family:inherit;font-size:12px;padding:5px 8px;border-radius:5px;cursor:pointer}',
      '.xal-browse-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.xal-spin{display:inline-block;width:11px;height:11px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:xal-rotate .8s linear infinite;vertical-align:-1px}',
      '@keyframes xal-rotate{to{transform:rotate(360deg)}}',
      '.xal-progress{height:3px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;margin-top:6px}',
      '.xal-progress > i{display:block;height:100%;background:var(--dsw-alias-brand-primary);transition:width .3s ease}',
      '@container (max-width:1040px){.xal-root{grid-template-columns:minmax(170px,200px) minmax(230px,300px) minmax(0,1fr)}.xal-reader-body{padding:16px 18px 48px}}',
      // 窄容器下 AI 侧栏改成浮在右侧，否则正文会被挤到看不见。
      '@container (max-width:1040px){.xal-root.ai-open{grid-template-columns:minmax(170px,200px) minmax(230px,300px) minmax(0,1fr)}.xal-ai{position:absolute;top:0;right:0;bottom:0;width:min(340px,86%);z-index:20;box-shadow:-8px 0 28px rgba(0,0,0,.28)}}',
      '@container (max-width:820px){.xal-root{grid-template-columns:minmax(0,1fr)}.xal-nav,.xal-list-col{display:none}}',
    ].join('\n');

    function Styles() {
      return h('style', null, CSS);
    }

    // ===== 添加链接对话框 =====
    function AddDialog({ state, onClose, onDone, onError }) {
      const [links, setLinks] = useState('');
      const [threadMode, setThreadMode] = useState(state.settings.defaultThreadMode || 'full');
      const [duplicatePolicy, setDuplicatePolicy] = useState(state.settings.duplicatePolicy || 'skip');
      const [tags, setTags] = useState('');
      const [collectionId, setCollectionId] = useState(state.settings.defaultCollectionId || '');
      const [busy, setBusy] = useState(false);
      const [report, setReport] = useState(null);

      const detected = useMemo(() => {
        const ids = String(links).match(/(?:status(?:es)?\/)?(\d{1,25})/g) || [];
        return [...new Set(ids.map((item) => item.replace(/^status(?:es)?\//, '')))];
      }, [links]);

      async function submit() {
        if (!links.trim()) return;
        setBusy(true);
        try {
          const result = await call('import', {
            links,
            threadMode,
            duplicatePolicy,
            tags: tags.split(/[,\s]+/).filter(Boolean),
            collectionIds: collectionId ? [collectionId] : [],
          });
          setReport({ created: result.created.length, skipped: result.skipped.length, invalid: result.invalid.length });
          onDone(result.state);
          if (!result.created.length && !result.skipped.length) onError(t('没有可导入的链接，请检查地址是否为公开帖子'));
        } catch (error) {
          onError(error.message);
        } finally {
          setBusy(false);
        }
      }

      return h(
        'div',
        { className: 'xal-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h(
          'div',
          { className: 'xal-dialog' },
          h('h2', null, t('添加 X 文章')),
          h('p', { className: 'xal-hint' }, t('粘贴公开的 X 帖子或长文链接，支持一次多条。只支持公开内容；私密、受保护或已删除的帖子无法下载。')),
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, t('链接')),
            h('textarea', {
              className: 'xal-input',
              value: links,
              placeholder: t('https://x.com/username/status/1234567890123456789\n每行一个，或直接粘贴多条'),
              onChange: (event) => setLinks(event.target.value),
              spellCheck: false,
            }),
            detected.length ? h('div', { className: 'xal-hint' }, t('已识别 {n} 个帖子', { n: detected.length })) : null,
          ),
          h(
            'div',
            { className: 'xal-row', style: { alignItems: 'flex-start', gap: 12 } },
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, t('内容范围')),
              h(
                'select',
                { className: 'xal-input', value: threadMode, onChange: (event) => setThreadMode(event.target.value) },
                h('option', { value: 'full' }, t('包含作者自线程（长文完整）')),
                h('option', { value: 'single' }, t('只取单条帖子')),
              ),
            ),
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, t('重复链接')),
              h(
                'select',
                { className: 'xal-input', value: duplicatePolicy, onChange: (event) => setDuplicatePolicy(event.target.value) },
                h('option', { value: 'skip' }, t('跳过已存在的')),
                h('option', { value: 'overwrite' }, t('重新下载并覆盖')),
              ),
            ),
          ),
          state.collections.length
            ? h(
                'div',
                { className: 'xal-field' },
                h('label', null, t('归入收藏夹')),
                h(
                  'select',
                  { className: 'xal-input', value: collectionId, onChange: (event) => setCollectionId(event.target.value) },
                  h('option', { value: '' }, t('不归类')),
                  ...state.collections.map((item) => h('option', { key: item.id, value: item.id }, item.name)),
                ),
              )
            : null,
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, t('标签（可选，空格或逗号分隔）')),
            h('input', { className: 'xal-input', value: tags, onChange: (event) => setTags(event.target.value), placeholder: t('如 设计 长文') }),
          ),
          report
            ? h(
                'div',
                { className: 'xal-banner info' },
                t('新增 {created} 篇，跳过 {skipped} 篇', { created: report.created, skipped: report.skipped })
                  + (report.invalid ? t('，无法识别 {invalid} 条', { invalid: report.invalid }) : '')
                  + t('。下载在后台进行，完成后会自动出现在列表中。'),
              )
            : null,
          h(
            'div',
            { className: 'xal-dialog-actions' },
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, report ? t('关闭') : t('取消'))),
            h(
              'button',
              { className: 'xal-btn primary', onClick: submit, disabled: busy || !detected.length },
              busy ? h('span', null, h('span', { className: 'xal-spin' }), ' 导入中…') : t('开始导入'),
            ),
          ),
        ),
      );
    }

    // ===== 设置对话框 =====
    function SettingsDialog({ state, onClose, onSaved, onError }) {
      const [root, setRoot] = useState(state.settings.storageRoot || '');
      const [browse, setBrowse] = useState(null);
      const [cacheImages, setCacheImages] = useState(Boolean(state.settings.cacheImages));
      const [concurrency, setConcurrency] = useState(Number(state.settings.downloadConcurrency) || 2);
      const [language, setLanguage] = useState(state.settings.language || 'zh');
      const [busy, setBusy] = useState(false);
      const [scanReport, setScanReport] = useState(null);

      async function openBrowse(target) {
        try {
          setBrowse(await call('browse', { path: target || root || undefined }));
        } catch (error) {
          onError(error.message);
        }
      }

      async function save() {
        setBusy(true);
        try {
          const result = await call('settings', { patch: { storageRoot: root, cacheImages, downloadConcurrency: concurrency, language } });
          setLang(language);
          onSaved(result.state);
          onClose();
        } catch (error) {
          onError(error.message);
        } finally {
          setBusy(false);
        }
      }

      async function runScan() {
        setBusy(true);
        try {
          const result = await call('scan');
          setScanReport(result.report);
          onSaved(result.state);
        } catch (error) {
          onError(error.message);
        } finally {
          setBusy(false);
        }
      }

      /** 在系统文件管理器中打开当前填写的目录（未填则打开已保存的目录）。 */
      async function openFolderHere() {
        try {
          await call('openFolder', { path: root || undefined });
        } catch (error) {
          onError(error.message);
        }
      }

      /**
       * 浏览目录：宿主有 native 后端就弹系统文件夹选择框，
       * 否则退回应用内目录列表。两种都叫「浏览」，所以不提示错误。
       */
      async function pickNativeFolder() {
        if (busy) return;
        setBusy(true);
        try {
          const result = await call('pickFolder', {});
          if (result.kind === 'picked') {
            setRoot(result.path);
            setBrowse(null);
          } else if (result.kind === 'unsupported') {
            openBrowse(root);
          }
          // kind === 'cancelled'：用户自己关掉的，什么都不做
        } catch (error) {
          onError(error.message);
        } finally {
          setBusy(false);
        }
      }

      return h(
        'div',
        { className: 'xal-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h(
          'div',
          { className: 'xal-dialog' },
          h('h2', null, t('设置')),
          h('p', { className: 'xal-hint' }, t('文章以 Markdown 保存在你选定的目录下，每篇文章一个文件夹，包含 article.md、metadata.json 与本地图片。分类信息只存在索引里，改变分类不会移动文件。')),
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, t('存储位置')),
            h(
              'div',
              { className: 'xal-row' },
              h('input', { className: 'xal-input xal-grow', value: root, onChange: (event) => setRoot(event.target.value), spellCheck: false }),
              h('button', { className: 'xal-btn', onClick: pickNativeFolder, disabled: busy, title: t('打开系统文件夹选择框') }, h(Glyph, { name: 'folder' }), h('span', null, busy ? t('选择中…') : t('浏览…'))),
              h('button', { className: 'xal-btn', onClick: openFolderHere, disabled: busy, title: t('在系统资源管理器中打开该目录') }, h(Glyph, { name: 'folderOpen' }), h('span', null, t('打开'))),
            ),
            h('div', { className: 'xal-hint' }, t('默认：{n}', { n: state.defaultStorageRoot })),
            h('div', { className: 'xal-hint' }, t('点「浏览…」会弹出系统文件夹选择框；若当前环境没有桌面显示，会自动退回应用内目录列表。已经是相对路径的写法会被拒绝。')),
          ),
          browse
            ? h(
                'div',
                { className: 'xal-browse' },
                h(
                  'div',
                  { className: 'xal-browse-path' },
                  h('button', { className: 'xal-btn ghost', onClick: () => setBrowse(null) }, h(Glyph, { name: 'chevronUp' }), h('span', null, t('收起'))),
                  h('span', null, browse.path),
                ),
                h(
                  'div',
                  { className: 'xal-browse-list' },
                  browse.parent
                    ? h('button', { className: 'xal-browse-item', onClick: () => openBrowse(browse.parent) }, h(Glyph, { name: 'chevronUp' }), h('span', null, t('上级目录')))
                    : null,
                  ...browse.entries.map((entry) => h('button', { key: entry.path, className: 'xal-browse-item', onClick: () => openBrowse(entry.path) }, h(Glyph, { name: 'folder' }), h('span', null, entry.name))),
                  browse.entries.length ? null : h('div', { className: 'xal-hint', style: { padding: '6px 9px' } }, t('这个目录下没有子目录')),
                ),
                h(
                  'div',
                  { className: 'xal-browse-path', style: { borderTop: '1px solid var(--dsw-alias-border-l1)', borderBottom: 0, flexWrap: 'wrap' } },
                  h('button', { className: 'xal-btn primary', onClick: () => { setRoot(browse.path); setBrowse(null); } }, h(Glyph, { name: 'check' }), h('span', null, t('使用这个目录'))),
                  ...browse.shortcuts.map((item) => h('button', { key: item.path, className: 'xal-btn ghost', onClick: () => openBrowse(item.path) }, item.label)),
                ),
              )
            : null,
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, t('语言')),
            h(
              'select',
              { className: 'xal-input', value: language, onChange: (event) => setLanguage(event.target.value) },
              h('option', { value: 'zh' }, t('中文')),
              h('option', { value: 'en' }, t('English')),
            ),
          ),
          h(
            'div',
            { className: 'xal-row', style: { marginTop: 12, alignItems: 'flex-start' } },
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, t('同时下载数')),
              h(
                'select',
                { className: 'xal-input', value: String(concurrency), onChange: (event) => setConcurrency(Number(event.target.value)) },
                h('option', { value: '1' }, t('1（最稳）')),
                h('option', { value: '2' }, t('2（推荐）')),
                h('option', { value: '3' }, '3'),
                h('option', { value: '4' }, t('4（最快）')),
              ),
            ),
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, t('图片')),
              h(
                'select',
                { className: 'xal-input', value: cacheImages ? 'on' : 'off', onChange: (event) => setCacheImages(event.target.value === 'on') },
                h('option', { value: 'on' }, t('下载到本地（离线可看）')),
                h('option', { value: 'off' }, t('保留远程链接')),
              ),
            ),
          ),
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, t('维护')),
            h(
              'div',
              { className: 'xal-row' },
              h('button', { className: 'xal-btn', onClick: runScan, disabled: busy }, h(Glyph, { name: 'scan' }), h('span', null, busy ? t('扫描中…') : t('扫描存储目录'))),
              h('span', { className: 'xal-hint', style: { margin: 0 } }, t('用于找回被手工放进目录的文章')),
            ),
            scanReport
              ? h('div', { className: 'xal-banner info', style: { margin: '8px 0 0' } }, t('扫描 {scanned} 个目录，新增 {imported}，更新 {updated}，缺失 {missing}。', { scanned: scanReport.scanned, imported: scanReport.imported, updated: scanReport.updated, missing: scanReport.missing }))
              : null,
          ),
          h(
            'div',
            { className: 'xal-dialog-actions' },
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, t('取消'))),
            h('button', { className: 'xal-btn primary', onClick: save, disabled: busy }, h(Glyph, { name: 'check' }), h('span', null, busy ? t('保存中…') : t('保存设置'))),
          ),
        ),
      );
    }

    // ===== 主面板 =====
    function Library() {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(true);
      const [view, setView] = useState({ kind: 'all', value: '' });
      const [query, setQuery] = useState('');
      // 粘贴 X 链接后的确认弹窗 { links }——从 X 分享复制链接后在面板粘贴即可触发。
      const [pasteLinks, setPasteLinks] = useState(null);
      const [notice, setNotice] = useState('');
      const [selectedId, setSelectedId] = useState('');
      const [content, setContent] = useState(null);
      const [contentLoading, setContentLoading] = useState(false);
      const [dialog, setDialog] = useState('');
      const [newCollection, setNewCollection] = useState('');
      const [showAddCollection, setShowAddCollection] = useState(false);
      const [contextMenu, setContextMenu] = useState(null);
      const [prompt, setPrompt] = useState(null);
      const [picker, setPicker] = useState(null);
      const [aiOpen, setAiOpen] = useState(false);
      // 阅读模式：隐藏导航/列表与工具栏，只留正文，沉浸式阅读。
      // null 表示还没从服务端设置初始化。
      const [focusMode, setFocusMode] = useState(null);
      // 正文字号：先本地即时反馈，松手才写回设置，避免拖动时频繁落盘。
      const [fontSize, setFontSize] = useState(null);
      // 上次读到的位置（正文内像素偏移），由阅读进度换算，仅未读完时显示红线。
      const [markTop, setMarkTop] = useState(null);
      const [markPercent, setMarkPercent] = useState(0);
      // 划线评论：选中正文文字后浮出的工具条状态。
      const [selection, setSelection] = useState(null); // { text, occurrence, x, y }
      const [commentPrompt, setCommentPrompt] = useState(null); // 评论输入弹窗参数
      const [commentPeek, setCommentPeek] = useState(null); // 悬浮查看评论 { text, x, y }
      const mdRef = useRef(null);
      const readerRef = useRef(null);
      const innerRef = useRef(null);
      // 每篇文章只自动定位一次，避免进度上报/尺寸变化反复把视图拉回红线。
      const autoScrolledRef = useRef('');

      const load = useCallback(async () => {
        try {
          const data = await call('');
          setState(data);
          setLang(data && data.settings && data.settings.language);
          // 阅读模式只在首次加载时跟随已保存的设置，之后尊重用户当前选择。
          setFocusMode((current) => (current === null ? Boolean(data && data.settings && data.settings.readerFocusMode) : current));
          setError('');
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        load();
      }, [load]);

      // 有下载在进行时加快轮询，空闲时降频。
      useEffect(() => {
        if (!state) return undefined;
        const busy = state.queue.active.length > 0 || state.queue.pending.length > 0
          || state.articles.some((item) => item.downloadStatus === 'downloading' || item.downloadStatus === 'queued');
        const timer = setInterval(load, busy ? 1500 : 30000);
        return () => clearInterval(timer);
      }, [state, load]);

      const articles = (state && state.articles) || [];
      const collections = (state && state.collections) || [];
      const stats = (state && state.stats) || { total: 0, unread: 0, starred: 0, failed: 0, authors: [] };

      // 字号范围与默认值：14px 是设计基准，12–22px 覆盖从密排到易读。
      const FONT_MIN = 12;
      const FONT_MAX = 22;
      const FONT_DEFAULT = 14;
      const clampFont = (value) => Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number(value) || FONT_DEFAULT)));
      // 已保存的缩放比例（服务端存 readerFontScale，1 = 14px）。
      const savedFont = clampFont((Number(state && state.settings && state.settings.readerFontScale) || 1) * FONT_DEFAULT);
      const activeFont = fontSize === null ? savedFont : fontSize;

      const saveFont = useCallback(async (value) => {
        const next = clampFont(value);
        try {
          const result = await call('settings', { patch: { readerFontScale: next / FONT_DEFAULT } });
          if (result && result.state) setState(result.state);
        } catch (err) {
          setError(err.message);
        }
      }, []);

      // 切换阅读模式：改状态并记住选择；进入时收起 AI，正文不被挤占。
      const setFocus = useCallback(async (on) => {
        setFocusMode(Boolean(on));
        if (on) setAiOpen(false);
        try {
          const result = await call('settings', { patch: { readerFocusMode: Boolean(on) } });
          if (result && result.state) setState(result.state);
        } catch (err) {
          setError(err.message);
        }
      }, []);

      // 面板内粘贴 X 分享链接：拦截并弹确认，确认后直接导入。
      // 正则覆盖多种分享格式：带用户名、/i/web/、甚至没有用户名的 /status/123。
      const X_LINK_RE = /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^\s]*?(?:status|statuses)\/\d{1,25}/gi;
      function extractXLinks(text) {
        return [...new Set((String(text || '').match(X_LINK_RE) || []).map((item) => item.replace(/[),.;]+$/, '')))];
      }
      function onSearchPaste(event) {
        const text = String((event.clipboardData && event.clipboardData.getData('text/plain')) || '');
        const links = extractXLinks(text);
        if (!links.length) return; // 不是 X 链接，交给搜索框正常粘贴
        event.preventDefault();
        setPasteLinks(links);
        setQuery('');
      }

      // 「粘贴链接」按钮：在用户手势里读剪贴板，成功率高；失败则回退提示用 Ctrl+V。
      async function onPasteButton() {
        let text = '';
        try {
          text = await navigator.clipboard.readText();
        } catch {
          setError(t('无法读取剪贴板，请在搜索框按 Ctrl+V 粘贴'));
          return;
        }
        const links = extractXLinks(text);
        if (!links.length) {
          setError(t('剪贴板中没有 X 链接'));
          return;
        }
        setPasteLinks(links);
      }

      async function confirmPaste() {
        if (!pasteLinks) return;
        try {
          const result = await call('import', {
            links: pasteLinks.join('\n'),
            threadMode: state.settings.defaultThreadMode || 'full',
            duplicatePolicy: state.settings.duplicatePolicy || 'skip',
            tags: [],
            collectionIds: state.settings.defaultCollectionId ? [state.settings.defaultCollectionId] : [],
          });
          setState(result.state);
          const added = result.created.length;
          const skipped = result.skipped.length;
          setNotice(t('已添加 {n} 篇', { n: added }) + (skipped ? t('，跳过 {n} 篇', { n: skipped }) : ''));
        } catch (err) {
          setError(err.message);
        } finally {
          setPasteLinks(null);
        }
      }

      const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return articles.filter((item) => {
          if (view.kind === 'collection' && !(item.collectionIds || []).includes(view.value)) return false;
          if (view.kind === 'author' && (item.authorUsername || item.authorName) !== view.value) return false;
          if (view.kind === 'unread' && !['unread', 'reading'].includes(item.readState || 'unread')) return false;
          if (view.kind === 'starred' && !item.starred) return false;
          if (view.kind === 'failed' && !['failed', 'blocked', 'missing'].includes(item.downloadStatus)) return false;
          if (!keyword) return true;
          return [item.title, item.excerpt, item.authorName, item.authorUsername, ...(item.tags || [])]
            .filter(Boolean)
            .some((text) => String(text).toLowerCase().includes(keyword));
        });
      }, [articles, view, query]);

      const selected = articles.find((item) => item.postId === selectedId) || null;

      const openArticle = useCallback(async (postId) => {
        setSelectedId(postId);
        setContent(null);
        setContentLoading(true);
        // 换了文章就收起 AI 侧栏；阅读模式是持久模式，切文章时保留。
        setAiOpen(false);
        try {
          const data = await call('read', { postId });
          setContent(data);
          // 打开即视为「未读完」；只有真的滚到底才转成「已读」，保留原有进度。
          const patch = { readState: 'reading' };
          if (data && data.readingProgress) patch.readingProgress = data.readingProgress;
          await call('update', { postId, patch });
        } catch (err) {
          setError(err.message);
        } finally {
          setContentLoading(false);
        }
      }, []);

      // 首次进入时自动打开第一篇可读文章。
      useEffect(() => {
        if (!state || selectedId) return;
        const first = articles.find((item) => item.downloadStatus === 'ready');
        if (first) openArticle(first.postId);
      }, [state, articles, selectedId, openArticle]);

      useEffect(() => {
        if (readerRef.current) readerRef.current.scrollTop = 0;
      }, [selectedId]);

      // 滚动上报阅读进度：>=95% 视为读完，期间保持「未读完」。
      // 用 lastSent 做节流，避免每帧都写盘；换文章时重置。
      useEffect(() => {
        const node = readerRef.current;
        if (!node || !selectedId || !content) return undefined;
        let lastSent = -1;
        let timer = null;
        const report = () => {
          const max = node.scrollHeight - node.clientHeight;
          // 内容短到无需滚动，直接算读完。
          if (max <= 8) {
            if (lastSent !== 1) {
              lastSent = 1;
              call('update', { postId: selectedId, patch: { readingProgress: 1, readState: 'read' } })
                .then((result) => { if (result && result.state) setState(result.state); })
                .catch(() => {});
            }
            return;
          }
          const ratio = Math.min(1, Math.max(0, node.scrollTop / max));
          const finished = ratio >= 0.95;
          const value = finished ? 1 : ratio;
          // 读完只上报一次；未读完时进度变化超过 5% 才写。
          if (finished && lastSent === 1) return;
          if (!finished && lastSent >= 0 && Math.abs(value - lastSent) < 0.05) return;
          lastSent = value;
          call('update', {
            postId: selectedId,
            patch: { readingProgress: value, readState: finished ? 'read' : 'reading' },
          }).then((result) => {
            if (result && result.state) setState(result.state);
          }).catch(() => {});
        };
        const onScroll = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(report, 250);
        };
        node.addEventListener('scroll', onScroll, { passive: true });
        return () => {
          if (timer) clearTimeout(timer);
          node.removeEventListener('scroll', onScroll);
        };
      }, [selectedId, content]);

      // 根据保存的阅读进度，在正文里算出「上次读到这里」的红线位置。
      // 用 ResizeObserver 跟进图片加载与字号变化导致的高度变化。
      useEffect(() => {
        const inner = innerRef.current;
        if (!inner || !content || !selectedId) { setMarkTop(null); return undefined; }
        // 读 state 里的最新进度，而不是打开时的快照——否则滚动上报后红线数据不更新。
        const current = articles.find((item) => item.postId === selectedId) || {};
        const progress = Number(current.readingProgress) || 0;
        const readState = current.readState;
        // 只有未读完才画线；已读/未读都不画。
        if (readState !== 'reading' || progress <= 0 || progress >= 1) { setMarkTop(null); return undefined; }
        setMarkPercent(Math.round(progress * 100));
        const measure = () => {
          const height = inner.scrollHeight;
          const top = Math.max(0, Math.min(height, height * progress));
          setMarkTop(top);
          // 打开未读完的文章时，自动滚到上次读到的位置，让红线就在眼前。
          // 只在首次且内容并非本次滚动引起时执行一次。
          if (autoScrolledRef.current !== selectedId) {
            autoScrolledRef.current = selectedId;
            const scroller = readerRef.current;
            if (scroller && height > 0) {
              // 红线落在视口偏上位置，方便接着往下读。
              const target = Math.max(0, top - scroller.clientHeight * 0.3);
              scroller.scrollTop = target;
            }
          }
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(inner);
        return () => observer.disconnect();
      }, [content, selectedId, activeFont, articles]);

      // 阅读模式下按 Esc 退出，避免被沉浸式界面困住。
      useEffect(() => {
        if (!focusMode) return undefined;
        const onKey = (event) => {
          if (event.key === 'Escape') setFocus(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [focusMode, setFocus]);

      // 划线评论：正文里选中文字后浮出工具条。
      // 用「文本 + 第几次出现」定位回 Markdown，避免依赖 DOM 到源码的精确映射。
      function onMarkdownMouseUp(event) {
        const sel = window.getSelection && window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const raw = String(sel.toString() || '').trim();
        if (!raw || raw.length > 400) return;
        const container = mdRef.current;
        if (!container || !container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) return;
        // 数一下这段正文里相同文字出现几次，判断这是第几次（供服务端消歧）。
        const bodyText = container.textContent || '';
        let occurrence = 0;
        let from = 0;
        while (true) {
          const at = bodyText.indexOf(raw, from);
          if (at < 0) break;
          if (at <= (sel.anchorOffset || 0)) occurrence++;
          from = at + raw.length;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setSelection({
          text: raw,
          occurrence: Math.max(0, occurrence),
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }

      // 悬浮评论徽章时显示完整评论（比原生 title 更大更清楚）。
      function onMarkdownOver(event) {
        const mark = event.target && event.target.closest && event.target.closest('mark.xal-mark.has-comment');
        if (!mark) { setCommentPeek(null); return; }
        const text = mark.getAttribute('data-comment') || '';
        if (!text) { setCommentPeek(null); return; }
        const rect = mark.getBoundingClientRect();
        setCommentPeek({ text, x: rect.left + rect.width / 2, y: rect.bottom });
      }

      function onMarkdownOut(event) {
        const next = event.relatedTarget;
        if (next && next.closest && next.closest('mark.xal-mark.has-comment')) return;
        setCommentPeek(null);
      }

      async function submitAnnotation(comment, selOverride) {
        const sel = selOverride || selection;
        if (!sel || !selectedId) return;
        try {
          await call('annotate', {
            postId: selectedId,
            text: sel.text,
            occurrence: sel.occurrence,
            comment: comment || '',
          });
          // 重新读取正文让划线立即显示。
          setContent(await call('read', { postId: selectedId }));
          window.getSelection && window.getSelection().removeAllRanges();
          setSelection(null);
        } catch (err) {
          setError(err.message);
        }
      }

      const refresh = async (next) => {
        if (next) setState(next);
        else await load();
      };

      async function addCollection() {
        const name = newCollection.trim();
        if (!name) return;
        try {
          const result = await call('createCollection', { name });
          setNewCollection('');
          setShowAddCollection(false);
          setView({ kind: 'collection', value: result.collection.id });
          await refresh(result.state);
        } catch (err) {
          setError(err.message);
        }
      }

      async function toggleStar(item) {
        try {
          const result = await call('update', { postId: item.postId, patch: { starred: !item.starred } });
          await refresh(result.state);
        } catch (err) {
          setError(err.message);
        }
      }

      async function removeArticle(item, deleteFiles) {
        try {
          const result = await call('remove', { postId: item.postId, deleteFiles });
          if (selectedId === item.postId) {
            setSelectedId('');
            setContent(null);
          }
          await refresh(result.state);
        } catch (err) {
          setError(err.message);
        }
      }

      // ===== 右键菜单 =====

      /** 文章卡片右键：改标题、改收藏夹、收藏、定位、移除。 */
      function openArticleMenu(event, item) {
        event.preventDefault();
        const position = { x: event.clientX, y: event.clientY };
        const items = [
          {
            label: t('重命名标题…'),
            onClick: () => setPrompt({
              title: t('重命名文章'),
              label: t('标题'),
              value: item.title || '',
              onSubmit: async (next) => {
                const result = await call('update', { postId: item.postId, patch: { title: next } });
                await refresh(result.state);
                if (item.postId === selectedId) setContent((prev) => (prev ? { ...prev, title: next } : prev));
              },
            }),
          },
          {
            label: item.starred ? t('取消收藏') : t('加入收藏'),
            onClick: () => toggleStar(item),
          },
          {
            label: t('调整所属收藏夹…'),
            onClick: () => setPicker({
              article: item,
              collections,
              onSave: async (ids) => {
                const result = await call('update', { postId: item.postId, patch: { collectionIds: ids } });
                await refresh(result.state);
              },
            }),
          },
          { separator: true },
        ];

        if (item.downloadStatus === 'ready') {
          items.push({ label: t('打开所在位置'), onClick: () => revealArticle(item) });
        }
        items.push({ label: t('从库中移除'), danger: true, onClick: () => removeArticle(item, false) });
        items.push({ label: t('删除含文件'), danger: true, onClick: () => removeArticle(item, true) });

        setContextMenu({ ...position, title: item.title || t('帖子 {n}', { n: item.postId }), items });
      }

      /** 收藏夹右键：重命名、删除。 */
      function openCollectionMenu(event, collection) {
        event.preventDefault();
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          title: collection.name,
          items: [
            {
              label: t('重命名收藏夹…'),
              onClick: () => setPrompt({
                title: t('重命名收藏夹'),
                label: t('名称'),
                value: collection.name,
                onSubmit: async (next) => {
                  const result = await call('updateCollection', { id: collection.id, patch: { name: next } });
                  await refresh(result.state);
                },
              }),
            },
            {
              label: t('删除收藏夹'),
              danger: true,
              onClick: async () => {
                try {
                  const result = await call('deleteCollection', { id: collection.id });
                  if (view.kind === 'collection' && view.value === collection.id) setView({ kind: 'all', value: '' });
                  await refresh(result.state);
                } catch (err) {
                  setError(err.message);
                }
              },
            },
          ],
        });
      }


      /** 在系统资源管理器中定位这篇的 Markdown 文件。 */
      async function revealArticle(item) {
        try {
          await call('reveal', { postId: item.postId });
        } catch (err) {
          setError(err.message);
        }
      }

      /** 打开存储根目录（不选中具体文件）。 */
      async function openStorageFolder() {
        try {
          await call('openFolder', { path: state.settings.storageRoot });
        } catch (err) {
          setError(err.message);
        }
      }

      async function removeCollection(id) {
        try {
          const result = await call('deleteCollection', { id });
          if (view.kind === 'collection' && view.value === id) setView({ kind: 'all', value: '' });
          await refresh(result.state);
        } catch (err) {
          setError(err.message);
        }
      }

      async function retryAll() {
        try {
          const ids = articles.filter((item) => ['failed', 'missing'].includes(item.downloadStatus)).map((item) => item.postId);
          if (!ids.length) return;
          const result = await call('download', { postIds: ids });
          await refresh(result.state);
        } catch (err) {
          setError(err.message);
        }
      }

      if (loading && !state) {
        return h('div', { className: 'xal-root', style: { gridTemplateColumns: '1fr' } }, h(Styles), h('div', { className: 'xal-empty' }, h('span', { className: 'xal-spin' }), t('正在载入文章库…')));
      }

      if (!state) {
        return h('div', { className: 'xal-root', style: { gridTemplateColumns: '1fr' } }, h(Styles), h('div', { className: 'xal-empty' }, h('b', null, t('文章库暂不可用')), h('div', null, error || t('未知错误'))));
      }

      const viewLabel = view.kind === 'all' ? t('全部文章')
        : view.kind === 'unread' ? t('未读')
          : view.kind === 'starred' ? t('收藏')
            : view.kind === 'failed' ? t('需要处理')
              : view.kind === 'collection' ? ((collections.find((item) => item.id === view.value) || {}).name || t('收藏夹'))
                : (view.value || t('作者'));

      const navItem = (key, label, count, onClick, active, extra, iconName) => h(
        'button',
        { key, className: 'xal-nav-item' + (active ? ' active' : ''), onClick },
        extra || (iconName ? h(Glyph, { name: iconName }) : null),
        h('span', { className: 'xal-nav-label' }, label),
        count !== undefined ? h('span', { className: 'xal-count' }, String(count)) : null,
      );

      return h(
        'div',
        { className: 'xal-root' + (aiOpen && selected && selected.downloadStatus === 'ready' && content ? ' ai-open' : '') + (focusMode && selected && selected.downloadStatus === 'ready' && content ? ' focus' : ''), style: { position: 'relative' } },
        h(Styles),

        // 左栏：资料库导航
        h(
          'nav',
          { className: 'xal-col xal-nav' },
          h('div', { className: 'xal-nav-title' }, t('资料库')),
          navItem('all', t('全部文章'), stats.total, () => setView({ kind: 'all', value: '' }), view.kind === 'all', null, 'all'),
          navItem('unread', t('未读'), stats.unread, () => setView({ kind: 'unread', value: '' }), view.kind === 'unread', null, 'unread'),
          navItem('starred', t('收藏'), stats.starred, () => setView({ kind: 'starred', value: '' }), view.kind === 'starred', null, 'star'),
          stats.failed ? navItem('failed', t('需要处理'), stats.failed, () => setView({ kind: 'failed', value: '' }), view.kind === 'failed', null, 'warn') : null,

          h('div', { className: 'xal-nav-title' }, t('收藏夹')),
          ...collections.map((item) => h(
            'div',
            { key: item.id, style: { display: 'flex', alignItems: 'center', gap: 2 } },
            h(
              'button',
              {
                className: 'xal-nav-item' + (view.kind === 'collection' && view.value === item.id ? ' active' : ''),
                onClick: () => setView({ kind: 'collection', value: item.id }),
                onContextMenu: (event) => openCollectionMenu(event, item),
                style: { flex: 1, minWidth: 0 },
              },
              h('span', { className: 'xal-dot-mark', style: item.color ? { background: item.color } : undefined }),
              h('span', { className: 'xal-nav-label' }, item.name),
              h('span', { className: 'xal-count' }, String(articles.filter((article) => (article.collectionIds || []).includes(item.id)).length)),
            ),
            h(
              'button',
              {
                className: 'xal-btn ghost',
                title: t('删除收藏夹'),
                style: { padding: '2px 6px', fontSize: 12 },
                onClick: () => removeCollection(item.id),
              },
              '×',
            ),
          )),
          showAddCollection
            ? h(
                'div',
                { className: 'xal-nav-add' },
                h('input', {
                  className: 'xal-input',
                  autoFocus: true,
                  value: newCollection,
                  placeholder: t('收藏夹名称'),
                  onChange: (event) => setNewCollection(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') addCollection();
                    if (event.key === 'Escape') { setShowAddCollection(false); setNewCollection(''); }
                  },
                }),
                h('button', { className: 'xal-btn', onClick: addCollection, title: t('创建') }, h(Glyph, { name: 'check' })),
              )
            : h('div', { className: 'xal-nav-add' }, h('button', { className: 'xal-btn ghost', onClick: () => setShowAddCollection(true) }, h(Glyph, { name: 'plus' }), h('span', null, t('新建收藏夹')))),

          stats.authors.length ? h('div', { className: 'xal-nav-title' }, t('博主')) : null,
          ...stats.authors.slice(0, 30).map((author) => navItem(
            'author-' + (author.username || author.name),
            author.name || author.username,
            author.count,
            () => setView({ kind: 'author', value: author.username || author.name }),
            view.kind === 'author' && view.value === (author.username || author.name),
            null,
            'author',
          )),

          h('div', { style: { marginTop: 'auto', paddingTop: 12 } },
            h('button', { className: 'xal-nav-item', onClick: () => setDialog('settings') }, h(Glyph, { name: 'settings' }), h('span', { className: 'xal-nav-label' }, t('设置')))),
        ),

        // 中栏：文章列表
        h(
          'section',
          { className: 'xal-col xal-list-col' },
          h(
            'div',
            { className: 'xal-head' },
            h('h1', { title: viewLabel }, viewLabel),
            h('button', { className: 'xal-btn primary', onClick: () => setDialog('add'), title: t('添加 X 链接') }, h(Glyph, { name: 'plus' }), h('span', null, t('添加'))),
          ),
          h(
            'div',
            { className: 'xal-search' },
            h('input', {
              className: 'xal-input',
              value: query,
              placeholder: t('搜索标题、作者、标签…或粘贴 X 链接'),
              onChange: (event) => setQuery(event.target.value),
              onPaste: onSearchPaste,
              spellCheck: false,
            }),
            h('button', { className: 'xal-btn', onClick: onPasteButton, title: t('从剪贴板粘贴 X 链接') }, h(Glyph, { name: 'plus' }), h('span', null, t('粘贴链接'))),
            stats.failed ? h('button', { className: 'xal-btn', onClick: retryAll, title: t('重试所有失败的下载') }, h(Glyph, { name: 'refresh' }), h('span', null, t('重试'))) : null,
          ),
          error ? h('div', { className: 'xal-banner' }, error) : null,
          notice ? h('div', { className: 'xal-banner info' }, notice) : null,
          h(
            'div',
            { className: 'xal-items' },
            filtered.length
              ? filtered.map((item) => h(
                  'button',
                  {
                    key: item.postId,
                    className: 'xal-item' + (item.postId === selectedId ? ' active' : ''),
                    onClick: () => (item.downloadStatus === 'ready' ? openArticle(item.postId) : setSelectedId(item.postId)),
                    onContextMenu: (event) => openArticleMenu(event, item),
                  },
                  h(
                    'div',
                    { className: 'xal-item-top' },
                    h(StatusDot, { status: item.downloadStatus }),
                    h('span', { className: 'xal-item-title' }, item.title || (item.downloadStatus === 'ready' ? t('（无标题）') : '帖子 ' + item.postId)),
                    h('span', {
                      className: 'xal-readtag ' + (item.readState === 'read' ? 'read' : item.readState === 'reading' ? 'reading' : 'unread'),
                      title: item.readState === 'read' ? t('已读') : item.readState === 'reading' ? t('未读完') : t('未读'),
                    }, item.readState === 'read' ? t('已读') : item.readState === 'reading' ? t('未读完') : t('未读')),
                    item.starred ? h('span', { style: { color: 'var(--dsw-alias-state-warn-primary)', display: 'inline-flex' }, title: t('已收藏') }, h(Glyph, { name: 'star', size: 11 })) : null,
                  ),
                  item.excerpt ? h('div', { className: 'xal-item-excerpt' }, item.excerpt) : null,
                  h(
                    'div',
                    { className: 'xal-item-meta' },
                    h('span', null, item.authorName || t('未知作者')),
                    h('span', null, '·'),
                    h('span', null, item.publishedAt ? formatDate(item.publishedAt) : relativeTime(item.addedAt)),
                    item.imageCount ? h('span', { className: 'xal-tag' }, t('图 {n}', { n: item.imageCount })) : null,
                    ...(item.tags || []).slice(0, 2).map((tag) => h('span', { key: tag, className: 'xal-tag' }, tag)),
                  ),
                  item.downloadStatus === 'downloading'
                    ? h('div', { className: 'xal-progress' }, h('i', { style: { width: '45%' } }))
                    : null,
                  item.lastError ? h('div', { className: 'xal-item-meta', style: { color: 'var(--dsw-alias-state-error-primary)' } }, item.lastError) : null,
                ))
              : h('div', { className: 'xal-empty', style: { height: 'auto', padding: '36px 16px' } },
                  h('b', null, articles.length ? t('没有匹配的文章') : t('还没有文章')),
                  h('div', null, articles.length ? t('换个关键词或分类试试') : t('点击上方「+ 添加」，粘贴公开的 X 链接')),
                ),
          ),
        ),

        // 右栏：阅读器
        h(
          'main',
          { className: 'xal-col xal-reader' },
          selected && selected.downloadStatus === 'ready' && content
            ? h(
                'div',
                { className: 'xal-reader-body', ref: readerRef, style: { '--xal-reader-font-size': activeFont + 'px' } },
                h(
                  'div',
                  { className: 'xal-reader-inner', ref: innerRef },
                  h(
                    'div',
                    { className: 'xal-tools', style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                    h('button', { className: 'xal-btn primary', onClick: () => setFocus(true), title: t('进入阅读模式（Esc 退出）') }, h(Glyph, { name: 'book' }), h('span', null, t('阅读模式'))),
                    h('button', { className: 'xal-btn', onClick: () => setAiOpen(true), title: t('用 AI 总结这篇文章，可继续追问') }, h(Glyph, { name: 'spark' }), h('span', null, t('问 AI'))),
                    h('button', { className: 'xal-btn', onClick: () => toggleStar(selected), title: selected.starred ? t('取消收藏') : t('收藏按钮') },
                      h(Glyph, { name: 'star' }),
                      h('span', null, selected.starred ? t('已收藏') : t('收藏按钮'))),
                    // 字号调节：拖动即时生效，松手写回设置。
                    h(
                      'div',
                      { className: 'xal-fontctl', title: t('拖动调整正文字号（{min}–{max}px）', { min: FONT_MIN, max: FONT_MAX }) },
                      h(Glyph, { name: 'fontSmaller', size: 12 }),
                      h('input', {
                        type: 'range',
                        min: FONT_MIN,
                        max: FONT_MAX,
                        step: 1,
                        value: activeFont,
                        'aria-label': t('正文字号'),
                        onChange: (event) => setFontSize(clampFont(event.target.value)),
                        onMouseUp: () => { if (fontSize !== null) saveFont(fontSize); },
                        onTouchEnd: () => { if (fontSize !== null) saveFont(fontSize); },
                        onKeyUp: () => { if (fontSize !== null) saveFont(fontSize); },
                      }),
                      h('span', { className: 'xal-fontval' }, activeFont + 'px'),
                    ),
                    h('button', { className: 'xal-btn', onClick: () => revealArticle(selected), title: t('在资源管理器中显示该文件') }, h(Glyph, { name: 'folderOpen' }), h('span', null, t('打开所在位置'))),
                    h('a', { className: 'xal-btn', href: selected.normalizedUrl, target: '_blank', rel: 'noreferrer noopener' }, h(Glyph, { name: 'external' }), h('span', null, t('打开原帖'))),
                    h('button', { className: 'xal-btn danger', onClick: () => removeArticle(selected, false), title: t('只移除索引，保留磁盘文件') }, h(Glyph, { name: 'close' }), h('span', null, t('从库中移除'))),
                    h('button', { className: 'xal-btn danger', onClick: () => removeArticle(selected, true), title: t('同时删除磁盘上的文件') }, h(Glyph, { name: 'trash' }), h('span', null, t('删除含文件'))),
                  ),
                  h('h1', { className: 'xal-title' }, content.title || selected.title),
                  h(
                    'div',
                    { className: 'xal-reader-meta' },
                    h('span', null, content.authorName || selected.authorName),
                    content.authorUsername ? h('span', null, '@' + content.authorUsername) : null,
                    content.publishedAt ? h('span', null, formatDate(content.publishedAt)) : null,
                    h('span', null, t('{n} 张图片', { n: content.imageCount })),
                  ),
                  h('div', {
                  className: 'xal-md',
                  ref: mdRef,
                  onMouseUp: onMarkdownMouseUp,
                  onMouseOver: onMarkdownOver,
                  onMouseOut: onMarkdownOut,
                  dangerouslySetInnerHTML: { __html: renderMarkdown(content.body, content.postId) },
                }),
                  markTop !== null
                    ? h('div', {
                        className: 'xal-reading-mark',
                        style: { top: markTop + 'px' },
                        title: t('上次读到的位置（{n}%）', { n: markPercent }),
                      })
                    : null,
                ),
              )
            : h(                'div',
                { className: 'xal-empty' },
                contentLoading
                  ? h('span', null, h('span', { className: 'xal-spin' }), t(' 正在读取…'))
                  : selected
                    ? h('div', null,
                        h('b', null, selected.title || t('帖子 {n}', { n: selected.postId })),
                        h('div', { style: { marginTop: 8 } },
                          selected.downloadStatus === 'downloading' || selected.downloadStatus === 'queued'
                            ? t('正在下载，稍候会自动出现')
                            : (selected.lastError || t('这篇文章还没有可读内容'))),
                        h('div', { style: { marginTop: 10 } },
                          h('button', { className: 'xal-btn', onClick: () => call('download', { postIds: [selected.postId] }).then((result) => refresh(result.state)).catch((err) => setError(err.message)) }, h(Glyph, { name: 'refresh' }), h('span', null, t('重新下载'))),
                        ),
                      )
                    : h('div', null,
                        h('b', null, stats.total ? t('选择一篇开始阅读') : t('X 文章库')),
                        h('div', { style: { marginTop: 8, maxWidth: 420, lineHeight: 1.6 } },
                          stats.total
                            ? t('在左侧选一篇已下载的文章，正文会显示在这里。')
                            : t('把公开的 X 帖子或长文链接贴进来，会自动转成可离线阅读的 Markdown，并按收藏夹和博主归类。')),
                        h('div', { style: { marginTop: 14 } },
                          h('button', { className: 'xal-btn primary', onClick: () => setDialog('add') }, h(Glyph, { name: 'plus' }), h('span', null, t('添加链接'))),
                          h('button', { className: 'xal-btn', style: { marginLeft: 8 }, onClick: openStorageFolder, title: t('在资源管理器中打开存储目录') }, h(Glyph, { name: 'folderOpen' }), h('span', null, t('打开存储目录'))),
                        ),
                      ),
              ),
        ),

        // 模式 chip：常驻显示当前模式，点击退出（hover 图标变关闭），参考 bot 模式。
        focusMode && selected && selected.downloadStatus === 'ready' && content
          ? h('button', {
              className: 'xal-mode-chip',
              onClick: () => setFocus(false),
              title: t('点击退出阅读模式（Esc）'),
              'aria-label': t('阅读模式已开启，点击退出'),
            },
            h('span', { className: 'rest-glyph' }, h(Glyph, { name: 'book', size: 13 })),
            h('span', { className: 'exit-glyph' }, h(Glyph, { name: 'close', size: 13 })),
            h('span', null, t('阅读模式')))
          : null,

        // 划线工具条：选中正文文字后浮出，可只划线或附加评论。
        selection
          ? h(
              'div',
              {
                className: 'xal-selbar',
                style: { left: Math.round(selection.x) + 'px', top: Math.round(selection.y - 48) + 'px' },
                onMouseDown: (event) => event.preventDefault(),
              },
              h('button', { className: 'xal-btn primary', onClick: () => submitAnnotation('') }, t('划线')),
              h('button', { className: 'xal-btn', onClick: () => setCommentPrompt({ selection }) }, t('评论')),
              h('button', { className: 'xal-btn ghost', onClick: () => setSelection(null), title: t('取消') }, h(Glyph, { name: 'close', size: 12 })),
            )
          : null,

        // 评论悬浮卡片：显示完整评论文字。
        commentPeek
          ? h('div', {
              className: 'xal-comment-peek',
              style: { left: Math.round(commentPeek.x) + 'px', top: Math.round(commentPeek.y + 8) + 'px' },
            }, commentPeek.text)
          : null,

        // 评论输入弹窗：原生 prompt 在 Electron 下不可用，改用插件内对话框。
        commentPrompt
          ? h(PromptDialog, {
              key: 'comment-' + (commentPrompt.selection && commentPrompt.selection.text),
              title: t('写评论'),
              label: t('评论内容'),
              value: '',
              placeholder: t('写下你的想法…'),
              onClose: () => { setCommentPrompt(null); setSelection(null); },
              onSubmit: (next) => {
                const sel = commentPrompt.selection;
                setCommentPrompt(null);
                return submitAnnotation(next, sel);
              },
            })
          : null,

        // 问 AI 侧栏：只在打开且文章可读时出现，作为阅读器的右侧补充栏。
        aiOpen && selected && selected.downloadStatus === 'ready' && content
          ? h(AiPanel, {
              key: content.postId,
              article: { postId: content.postId, title: content.title },
              onClose: () => setAiOpen(false),
              onError: setError,
            })
          : null,

        dialog === 'add' ? h(AddDialog, { state, onClose: () => setDialog(''), onDone: (next) => refresh(next), onError: setError }) : null,
        dialog === 'settings' ? h(SettingsDialog, { state, onClose: () => setDialog(''), onSaved: (next) => refresh(next), onError: setError }) : null,

        // 粘贴 X 链接后的确认框。
        pasteLinks
          ? h(
              'div',
              { className: 'xal-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) setPasteLinks(null); } },
              h(
                'div',
                { className: 'xal-dialog', style: { maxWidth: 460 } },
                h('h2', null, t('添加到 X 文章')),
                h('p', { className: 'xal-hint' }, t('检测到剪贴板中的 X 链接，是否添加到文章库？')),
                h('div', { className: 'xal-paste-links' }, pasteLinks.map((link) => h('div', { key: link, className: 'xal-paste-link', title: link }, link))),
                h(
                  'div',
                  { className: 'xal-dialog-actions' },
                  h('button', { className: 'xal-btn ghost', onClick: () => setPasteLinks(null) }, t('取消')),
                  h('button', { className: 'xal-btn primary', onClick: confirmPaste }, t('添加 {n} 篇', { n: pasteLinks.length })),
                ),
              ),
            )
          : null,

        contextMenu ? h(ContextMenu, { menu: contextMenu, onClose: () => setContextMenu(null) }) : null,
        prompt ? h(PromptDialog, {
          title: prompt.title,
          label: prompt.label,
          value: prompt.value,
          onClose: () => setPrompt(null),
          onSubmit: prompt.onSubmit,
        }) : null,
        picker ? h(CollectionPicker, {
          article: picker.article,
          collections: picker.collections,
          onClose: () => setPicker(null),
          onSave: picker.onSave,
        }) : null,
      );
    }

    return {
      inject: ['slots', 'layout'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'x-article-library',
          order: 27,
          label: t('X 文章'),
        }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'x-article-library' }, Library));
      },
    };
  },
});
