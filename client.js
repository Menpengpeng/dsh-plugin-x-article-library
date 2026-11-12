window.__ModuleLoader__.load({
  id: '@menpengpeng/dsh-plugin-x-article-library',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const API = '/api/x-article-library';

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
      let out = escapeHtml(text);
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
      if (!response.ok) throw new Error(data.error || '请求失败（HTTP ' + response.status + '）');
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
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
      if (diff < 2592000000) return Math.floor(diff / 86400000) + ' 天前';
      return formatDate(value);
    }

    function StatusDot({ status }) {
      const map = {
        ready: ['已就绪', 'ok'],
        downloading: ['下载中', 'busy'],
        queued: ['排队中', 'busy'],
        failed: ['失败', 'error'],
        blocked: ['不可访问', 'error'],
        missing: ['文件缺失', 'error'],
      };
      const entry = map[status] || ['未知', ''];
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
          h('h2', null, '调整所属收藏夹'),
          h('div', { className: 'xal-hint', style: { marginBottom: 10 } }, article.title || '帖子 ' + article.postId),
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
            : h('div', { className: 'xal-hint' }, '还没有收藏夹，先在左栏建一个。'),
          error ? h('div', { className: 'xal-banner' }, error) : null,
          h('div', { className: 'xal-row', style: { justifyContent: 'flex-end', marginTop: 14 } },
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, '取消')),
            h('button', { className: 'xal-btn primary', onClick: save, disabled: busy }, h(Glyph, { name: 'check' }), h('span', null, busy ? '保存中…' : '保存'))),
        ),
      );
    }


    /** 单行输入对话框：给「重命名文章 / 收藏夹」用。 */
    function PromptDialog({ title, label, value, placeholder, onClose, onSubmit }) {
      const [text, setText] = useState(value || '');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');

      async function submit() {
        const next = text.trim();
        if (!next) { setError('不能为空'); return; }
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
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, '取消')),
            h('button', { className: 'xal-btn primary', onClick: submit, disabled: busy }, h(Glyph, { name: 'check' }), h('span', null, busy ? '保存中…' : '保存'))),
        ),
      );
    }


    const CSS = [
      '.xal-root{display:grid;grid-template-columns:minmax(190px,236px) minmax(260px,360px) minmax(0,1fr);height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;container-type:inline-size}',
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
      '.xal-item{display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:9px;background:transparent;padding:9px 10px;cursor:pointer;color:inherit;font-family:inherit}',
      '.xal-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.xal-item.active{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}',
      '.xal-item-top{display:flex;align-items:center;gap:6px;margin-bottom:3px}',
      '.xal-item-title{flex:1;font-weight:600;font-size:13px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
      '.xal-item-excerpt{font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
      '.xal-item-meta{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11px;color:var(--dsw-alias-label-caption);flex-wrap:wrap}',
      '.xal-tag{padding:1px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-size:10.5px;color:var(--dsw-alias-label-secondary)}',
      '.xal-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-border-l3)}',
      '.xal-dot.ok{background:var(--dsw-alias-state-success-primary)}',
      '.xal-dot.busy{background:var(--dsw-alias-state-warn-primary);animation:xal-pulse 1.2s ease-in-out infinite}',
      '.xal-dot.error{background:var(--dsw-alias-state-error-primary)}',
      '@keyframes xal-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '.xal-reader-body{flex:1;overflow-y:auto;padding:18px 26px 60px}',
      '.xal-reader-inner{max-width:720px;margin:0 auto}',
      '.xal-reader h1.xal-title{font-size:22px;line-height:1.35;margin:0 0 8px;font-weight:700;word-break:break-word}',
      '.xal-reader-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary);padding-bottom:12px;margin-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.xal-md{line-height:1.72;font-size:14px;word-break:break-word}',
      '.xal-md p{margin:0 0 12px}',
      '.xal-md h1,.xal-md h2,.xal-md h3,.xal-md h4,.xal-md h5,.xal-md h6{margin:22px 0 10px;line-height:1.35;font-weight:650}',
      '.xal-md h1{font-size:20px}.xal-md h2{font-size:18px}.xal-md h3{font-size:16px}.xal-md h4{font-size:15px}.xal-md h5,.xal-md h6{font-size:14px;color:var(--dsw-alias-label-secondary)}',
      '.xal-md a{color:var(--dsw-alias-brand-primary);text-decoration:none}',
      '.xal-md a:hover{text-decoration:underline}',
      '.xal-md ul,.xal-md ol{margin:0 0 12px;padding-left:22px}',
      '.xal-md li{margin:3px 0}',
      '.xal-md blockquote{margin:0 0 12px;padding:6px 14px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-radius:0 6px 6px 0}',
      '.xal-md code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em;background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:4px}',
      '.xal-md pre.xal-code{margin:0 0 14px;padding:12px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow-x:auto;border:1px solid var(--dsw-alias-border-l1)}',
      '.xal-md pre.xal-code code{background:none;padding:0;font-size:12.5px;line-height:1.55}',
      '.xal-md hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:20px 0}',
      '.xal-md .xal-figure{margin:0 0 16px;text-align:center}',
      '.xal-md .xal-figure img{max-width:100%;height:auto;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.xal-md .xal-figure figcaption{font-size:11.5px;color:var(--dsw-alias-label-caption);margin-top:6px}',
      '.xal-md .xal-table-wrap{margin:0 0 14px;overflow-x:auto}',
      '.xal-md table{border-collapse:collapse;font-size:12.5px;min-width:100%}',
      '.xal-md th,.xal-md td{border:1px solid var(--dsw-alias-border-l1);padding:6px 10px;text-align:left}',
      '.xal-md th{background:var(--dsw-alias-bg-layer-2);font-weight:600}',
      '.xal-empty{display:grid;place-items:center;gap:10px;height:100%;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;padding:30px;box-sizing:border-box}',
      '.xal-empty b{font-size:15px;color:var(--dsw-alias-label-primary)}',
      '.xal-banner{margin:10px 12px;padding:8px 10px;border-radius:7px;font-size:12px;line-height:1.5;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent)}',
      '.xal-banner.info{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l1)}',
      '.xal-overlay{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.42);display:grid;place-items:center;padding:20px;box-sizing:border-box}',
      '.xal-dialog{width:min(560px,100%);max-height:min(80vh,720px);overflow-y:auto;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:18px;box-sizing:border-box;box-shadow:0 18px 48px rgba(0,0,0,.32)}',
      '.xal-ctx-overlay{position:fixed;inset:0;z-index:80;background:transparent}',
      '.xal-ctx{position:fixed;min-width:200px;max-width:260px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:5px;box-shadow:0 12px 32px rgba(0,0,0,.34);box-sizing:border-box}',
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
      '.xal-item{position:relative}',
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
          if (!result.created.length && !result.skipped.length) onError('没有可导入的链接，请检查地址是否为公开帖子');
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
          h('h2', null, '添加 X 文章'),
          h('p', { className: 'xal-hint' }, '粘贴公开的 X 帖子或长文链接，支持一次多条。只支持公开内容；私密、受保护或已删除的帖子无法下载。'),
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, '链接'),
            h('textarea', {
              className: 'xal-input',
              value: links,
              placeholder: 'https://x.com/username/status/1234567890123456789\n每行一个，或直接粘贴多条',
              onChange: (event) => setLinks(event.target.value),
              spellCheck: false,
            }),
            detected.length ? h('div', { className: 'xal-hint' }, '已识别 ' + detected.length + ' 个帖子') : null,
          ),
          h(
            'div',
            { className: 'xal-row', style: { alignItems: 'flex-start', gap: 12 } },
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, '内容范围'),
              h(
                'select',
                { className: 'xal-input', value: threadMode, onChange: (event) => setThreadMode(event.target.value) },
                h('option', { value: 'full' }, '包含作者自线程（长文完整）'),
                h('option', { value: 'single' }, '只取单条帖子'),
              ),
            ),
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, '重复链接'),
              h(
                'select',
                { className: 'xal-input', value: duplicatePolicy, onChange: (event) => setDuplicatePolicy(event.target.value) },
                h('option', { value: 'skip' }, '跳过已存在的'),
                h('option', { value: 'overwrite' }, '重新下载并覆盖'),
              ),
            ),
          ),
          state.collections.length
            ? h(
                'div',
                { className: 'xal-field' },
                h('label', null, '归入收藏夹'),
                h(
                  'select',
                  { className: 'xal-input', value: collectionId, onChange: (event) => setCollectionId(event.target.value) },
                  h('option', { value: '' }, '不归类'),
                  ...state.collections.map((item) => h('option', { key: item.id, value: item.id }, item.name)),
                ),
              )
            : null,
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, '标签（可选，空格或逗号分隔）'),
            h('input', { className: 'xal-input', value: tags, onChange: (event) => setTags(event.target.value), placeholder: '如 设计 长文' }),
          ),
          report
            ? h(
                'div',
                { className: 'xal-banner info' },
                '新增 ' + report.created + ' 篇，跳过 ' + report.skipped + ' 篇' + (report.invalid ? '，无法识别 ' + report.invalid + ' 条' : '') + '。下载在后台进行，完成后会自动出现在列表中。',
              )
            : null,
          h(
            'div',
            { className: 'xal-dialog-actions' },
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, report ? '关闭' : '取消')),
            h(
              'button',
              { className: 'xal-btn primary', onClick: submit, disabled: busy || !detected.length },
              busy ? h('span', null, h('span', { className: 'xal-spin' }), ' 导入中…') : '开始导入',
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
          const result = await call('settings', { patch: { storageRoot: root, cacheImages, downloadConcurrency: concurrency } });
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
          h('h2', null, '设置'),
          h('p', { className: 'xal-hint' }, '文章以 Markdown 保存在你选定的目录下，每篇文章一个文件夹，包含 article.md、metadata.json 与本地图片。分类信息只存在索引里，改变分类不会移动文件。'),
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, '存储位置'),
            h(
              'div',
              { className: 'xal-row' },
              h('input', { className: 'xal-input xal-grow', value: root, onChange: (event) => setRoot(event.target.value), spellCheck: false }),
              h('button', { className: 'xal-btn', onClick: pickNativeFolder, disabled: busy, title: '打开系统文件夹选择框' }, h(Glyph, { name: 'folder' }), h('span', null, busy ? '选择中…' : '浏览…')),
              h('button', { className: 'xal-btn', onClick: openFolderHere, disabled: busy, title: '在系统资源管理器中打开该目录' }, h(Glyph, { name: 'folderOpen' }), h('span', null, '打开')),
            ),
            h('div', { className: 'xal-hint' }, '默认：' + state.defaultStorageRoot),
            h('div', { className: 'xal-hint' }, '点「浏览…」会弹出系统文件夹选择框；若当前环境没有桌面显示，会自动退回应用内目录列表。已经是相对路径的写法会被拒绝。'),
          ),
          browse
            ? h(
                'div',
                { className: 'xal-browse' },
                h(
                  'div',
                  { className: 'xal-browse-path' },
                  h('button', { className: 'xal-btn ghost', onClick: () => setBrowse(null) }, h(Glyph, { name: 'chevronUp' }), h('span', null, '收起')),
                  h('span', null, browse.path),
                ),
                h(
                  'div',
                  { className: 'xal-browse-list' },
                  browse.parent
                    ? h('button', { className: 'xal-browse-item', onClick: () => openBrowse(browse.parent) }, h(Glyph, { name: 'chevronUp' }), h('span', null, '上级目录'))
                    : null,
                  ...browse.entries.map((entry) => h('button', { key: entry.path, className: 'xal-browse-item', onClick: () => openBrowse(entry.path) }, h(Glyph, { name: 'folder' }), h('span', null, entry.name))),
                  browse.entries.length ? null : h('div', { className: 'xal-hint', style: { padding: '6px 9px' } }, '这个目录下没有子目录'),
                ),
                h(
                  'div',
                  { className: 'xal-browse-path', style: { borderTop: '1px solid var(--dsw-alias-border-l1)', borderBottom: 0, flexWrap: 'wrap' } },
                  h('button', { className: 'xal-btn primary', onClick: () => { setRoot(browse.path); setBrowse(null); } }, h(Glyph, { name: 'check' }), h('span', null, '使用这个目录')),
                  ...browse.shortcuts.map((item) => h('button', { key: item.path, className: 'xal-btn ghost', onClick: () => openBrowse(item.path) }, item.label)),
                ),
              )
            : null,
          h(
            'div',
            { className: 'xal-row', style: { marginTop: 12, alignItems: 'flex-start' } },
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, '同时下载数'),
              h(
                'select',
                { className: 'xal-input', value: String(concurrency), onChange: (event) => setConcurrency(Number(event.target.value)) },
                h('option', { value: '1' }, '1（最稳）'),
                h('option', { value: '2' }, '2（推荐）'),
                h('option', { value: '3' }, '3'),
                h('option', { value: '4' }, '4（最快）'),
              ),
            ),
            h(
              'div',
              { className: 'xal-field xal-grow' },
              h('label', null, '图片'),
              h(
                'select',
                { className: 'xal-input', value: cacheImages ? 'on' : 'off', onChange: (event) => setCacheImages(event.target.value === 'on') },
                h('option', { value: 'on' }, '下载到本地（离线可看）'),
                h('option', { value: 'off' }, '保留远程链接'),
              ),
            ),
          ),
          h(
            'div',
            { className: 'xal-field' },
            h('label', null, '维护'),
            h(
              'div',
              { className: 'xal-row' },
              h('button', { className: 'xal-btn', onClick: runScan, disabled: busy }, h(Glyph, { name: 'scan' }), h('span', null, busy ? '扫描中…' : '扫描存储目录')),
              h('span', { className: 'xal-hint', style: { margin: 0 } }, '用于找回被手工放进目录的文章'),
            ),
            scanReport
              ? h('div', { className: 'xal-banner info', style: { margin: '8px 0 0' } }, '扫描 ' + scanReport.scanned + ' 个目录，新增 ' + scanReport.imported + '，更新 ' + scanReport.updated + '，缺失 ' + scanReport.missing + '。')
              : null,
          ),
          h(
            'div',
            { className: 'xal-dialog-actions' },
            h('button', { className: 'xal-btn ghost', onClick: onClose, disabled: busy }, h(Glyph, { name: 'close' }), h('span', null, '取消')),
            h('button', { className: 'xal-btn primary', onClick: save, disabled: busy }, h(Glyph, { name: 'check' }), h('span', null, busy ? '保存中…' : '保存设置')),
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
      const [selectedId, setSelectedId] = useState('');
      const [content, setContent] = useState(null);
      const [contentLoading, setContentLoading] = useState(false);
      const [dialog, setDialog] = useState('');
      const [newCollection, setNewCollection] = useState('');
      const [showAddCollection, setShowAddCollection] = useState(false);
      const [contextMenu, setContextMenu] = useState(null);
      const [prompt, setPrompt] = useState(null);
      const [picker, setPicker] = useState(null);
      const readerRef = useRef(null);

      const load = useCallback(async () => {
        try {
          const data = await call('');
          setState(data);
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

      const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return articles.filter((item) => {
          if (view.kind === 'collection' && !(item.collectionIds || []).includes(view.value)) return false;
          if (view.kind === 'author' && (item.authorUsername || item.authorName) !== view.value) return false;
          if (view.kind === 'unread' && item.readState !== 'unread') return false;
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
        try {
          setContent(await call('read', { postId }));
          await call('update', { postId, patch: { readState: 'read' } });
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
            label: '重命名标题…',
            onClick: () => setPrompt({
              title: '重命名文章',
              label: '标题',
              value: item.title || '',
              onSubmit: async (next) => {
                const result = await call('update', { postId: item.postId, patch: { title: next } });
                await refresh(result.state);
                if (item.postId === selectedId) setContent((prev) => (prev ? { ...prev, title: next } : prev));
              },
            }),
          },
          {
            label: item.starred ? '取消收藏' : '加入收藏',
            onClick: () => toggleStar(item),
          },
          {
            label: '调整所属收藏夹…',
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
          items.push({ label: '打开所在位置', onClick: () => revealArticle(item) });
        }
        items.push({ label: '从库中移除', danger: true, onClick: () => removeArticle(item, false) });
        items.push({ label: '删除含文件', danger: true, onClick: () => removeArticle(item, true) });

        setContextMenu({ ...position, title: item.title || '帖子 ' + item.postId, items });
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
              label: '重命名收藏夹…',
              onClick: () => setPrompt({
                title: '重命名收藏夹',
                label: '名称',
                value: collection.name,
                onSubmit: async (next) => {
                  const result = await call('updateCollection', { id: collection.id, patch: { name: next } });
                  await refresh(result.state);
                },
              }),
            },
            {
              label: '删除收藏夹',
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
        return h('div', { className: 'xal-root', style: { gridTemplateColumns: '1fr' } }, h(Styles), h('div', { className: 'xal-empty' }, h('span', { className: 'xal-spin' }), '正在载入文章库…'));
      }

      if (!state) {
        return h('div', { className: 'xal-root', style: { gridTemplateColumns: '1fr' } }, h(Styles), h('div', { className: 'xal-empty' }, h('b', null, '文章库暂不可用'), h('div', null, error || '未知错误')));
      }

      const viewLabel = view.kind === 'all' ? '全部文章'
        : view.kind === 'unread' ? '未读'
          : view.kind === 'starred' ? '收藏'
            : view.kind === 'failed' ? '需要处理'
              : view.kind === 'collection' ? ((collections.find((item) => item.id === view.value) || {}).name || '收藏夹')
                : (view.value || '作者');

      const navItem = (key, label, count, onClick, active, extra, iconName) => h(
        'button',
        { key, className: 'xal-nav-item' + (active ? ' active' : ''), onClick },
        extra || (iconName ? h(Glyph, { name: iconName }) : null),
        h('span', { className: 'xal-nav-label' }, label),
        count !== undefined ? h('span', { className: 'xal-count' }, String(count)) : null,
      );

      return h(
        'div',
        { className: 'xal-root' },
        h(Styles),

        // 左栏：资料库导航
        h(
          'nav',
          { className: 'xal-col xal-nav' },
          h('div', { className: 'xal-nav-title' }, '资料库'),
          navItem('all', '全部文章', stats.total, () => setView({ kind: 'all', value: '' }), view.kind === 'all', null, 'all'),
          navItem('unread', '未读', stats.unread, () => setView({ kind: 'unread', value: '' }), view.kind === 'unread', null, 'unread'),
          navItem('starred', '收藏', stats.starred, () => setView({ kind: 'starred', value: '' }), view.kind === 'starred', null, 'star'),
          stats.failed ? navItem('failed', '需要处理', stats.failed, () => setView({ kind: 'failed', value: '' }), view.kind === 'failed', null, 'warn') : null,

          h('div', { className: 'xal-nav-title' }, '收藏夹'),
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
                title: '删除收藏夹',
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
                  placeholder: '收藏夹名称',
                  onChange: (event) => setNewCollection(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') addCollection();
                    if (event.key === 'Escape') { setShowAddCollection(false); setNewCollection(''); }
                  },
                }),
                h('button', { className: 'xal-btn', onClick: addCollection, title: '创建' }, h(Glyph, { name: 'check' })),
              )
            : h('div', { className: 'xal-nav-add' }, h('button', { className: 'xal-btn ghost', onClick: () => setShowAddCollection(true) }, h(Glyph, { name: 'plus' }), h('span', null, '新建收藏夹'))),

          stats.authors.length ? h('div', { className: 'xal-nav-title' }, '博主') : null,
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
            h('button', { className: 'xal-nav-item', onClick: () => setDialog('settings') }, h(Glyph, { name: 'settings' }), h('span', { className: 'xal-nav-label' }, '设置'))),
        ),

        // 中栏：文章列表
        h(
          'section',
          { className: 'xal-col xal-list-col' },
          h(
            'div',
            { className: 'xal-head' },
            h('h1', { title: viewLabel }, viewLabel),
            h('button', { className: 'xal-btn primary', onClick: () => setDialog('add'), title: '添加 X 链接' }, h(Glyph, { name: 'plus' }), h('span', null, '添加')),
          ),
          h(
            'div',
            { className: 'xal-search' },
            h('input', {
              className: 'xal-input',
              value: query,
              placeholder: '搜索标题、作者、标签…',
              onChange: (event) => setQuery(event.target.value),
              spellCheck: false,
            }),
            stats.failed ? h('button', { className: 'xal-btn', onClick: retryAll, title: '重试所有失败的下载' }, h(Glyph, { name: 'refresh' }), h('span', null, '重试')) : null,
          ),
          error ? h('div', { className: 'xal-banner' }, error) : null,
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
                    h('span', { className: 'xal-item-title' }, item.title || (item.downloadStatus === 'ready' ? '（无标题）' : '帖子 ' + item.postId)),
                    item.starred ? h('span', { style: { color: 'var(--dsw-alias-state-warn-primary)', display: 'inline-flex' }, title: '已收藏' }, h(Glyph, { name: 'star', size: 11 })) : null,
                  ),
                  item.excerpt ? h('div', { className: 'xal-item-excerpt' }, item.excerpt) : null,
                  h(
                    'div',
                    { className: 'xal-item-meta' },
                    h('span', null, item.authorName || '未知作者'),
                    h('span', null, '·'),
                    h('span', null, item.publishedAt ? formatDate(item.publishedAt) : relativeTime(item.addedAt)),
                    item.imageCount ? h('span', { className: 'xal-tag' }, '图 ' + item.imageCount) : null,
                    ...(item.tags || []).slice(0, 2).map((tag) => h('span', { key: tag, className: 'xal-tag' }, tag)),
                  ),
                  item.downloadStatus === 'downloading'
                    ? h('div', { className: 'xal-progress' }, h('i', { style: { width: '45%' } }))
                    : null,
                  item.lastError ? h('div', { className: 'xal-item-meta', style: { color: 'var(--dsw-alias-state-error-primary)' } }, item.lastError) : null,
                ))
              : h('div', { className: 'xal-empty', style: { height: 'auto', padding: '36px 16px' } },
                  h('b', null, articles.length ? '没有匹配的文章' : '还没有文章'),
                  h('div', null, articles.length ? '换个关键词或分类试试' : '点击上方「+ 添加」，粘贴公开的 X 链接'),
                ),
          ),
        ),

        // 右栏：阅读器
        h(
          'main',
          { className: 'xal-col xal-reader', ref: readerRef },
          selected && selected.downloadStatus === 'ready' && content
            ? h(
                'div',
                { className: 'xal-reader-body' },
                h(
                  'div',
                  { className: 'xal-reader-inner' },
                  h(
                    'div',
                    { style: { display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' } },
                    h('button', { className: 'xal-btn', onClick: () => toggleStar(selected), title: selected.starred ? '取消收藏' : '收藏' },
                      h(Glyph, { name: 'star' }),
                      h('span', null, selected.starred ? '已收藏' : '收藏')),
                    h('button', { className: 'xal-btn', onClick: () => revealArticle(selected), title: '在资源管理器中显示该文件' }, h(Glyph, { name: 'folderOpen' }), h('span', null, '打开所在位置')),
                    h('a', { className: 'xal-btn', href: selected.normalizedUrl, target: '_blank', rel: 'noreferrer noopener' }, h(Glyph, { name: 'external' }), h('span', null, '打开原帖')),
                    h('button', { className: 'xal-btn danger', onClick: () => removeArticle(selected, false), title: '只移除索引，保留磁盘文件' }, h(Glyph, { name: 'close' }), h('span', null, '从库中移除')),
                    h('button', { className: 'xal-btn danger', onClick: () => removeArticle(selected, true), title: '同时删除磁盘上的文件' }, h(Glyph, { name: 'trash' }), h('span', null, '删除含文件')),
                  ),
                  h('h1', { className: 'xal-title' }, content.title || selected.title),
                  h(
                    'div',
                    { className: 'xal-reader-meta' },
                    h('span', null, content.authorName || selected.authorName),
                    content.authorUsername ? h('span', null, '@' + content.authorUsername) : null,
                    content.publishedAt ? h('span', null, formatDate(content.publishedAt)) : null,
                    h('span', null, content.imageCount + ' 张图片'),
                  ),
                  h('div', { className: 'xal-md', dangerouslySetInnerHTML: { __html: renderMarkdown(content.body, content.postId) } }),
                ),
              )
            : h(
                'div',
                { className: 'xal-empty' },
                contentLoading
                  ? h('span', null, h('span', { className: 'xal-spin' }), ' 正在读取…')
                  : selected
                    ? h('div', null,
                        h('b', null, selected.title || '帖子 ' + selected.postId),
                        h('div', { style: { marginTop: 8 } },
                          selected.downloadStatus === 'downloading' || selected.downloadStatus === 'queued'
                            ? '正在下载，稍候会自动出现'
                            : (selected.lastError || '这篇文章还没有可读内容')),
                        h('div', { style: { marginTop: 10 } },
                          h('button', { className: 'xal-btn', onClick: () => call('download', { postIds: [selected.postId] }).then((result) => refresh(result.state)).catch((err) => setError(err.message)) }, h(Glyph, { name: 'refresh' }), h('span', null, '重新下载')),
                        ),
                      )
                    : h('div', null,
                        h('b', null, stats.total ? '选择一篇开始阅读' : 'X 文章库'),
                        h('div', { style: { marginTop: 8, maxWidth: 420, lineHeight: 1.6 } },
                          stats.total
                            ? '在左侧选一篇已下载的文章，正文会显示在这里。'
                            : '把公开的 X 帖子或长文链接贴进来，会自动转成可离线阅读的 Markdown，并按收藏夹和博主归类。'),
                        h('div', { style: { marginTop: 14 } },
                          h('button', { className: 'xal-btn primary', onClick: () => setDialog('add') }, h(Glyph, { name: 'plus' }), h('span', null, '添加链接')),
                          h('button', { className: 'xal-btn', style: { marginLeft: 8 }, onClick: openStorageFolder, title: '在资源管理器中打开存储目录' }, h(Glyph, { name: 'folderOpen' }), h('span', null, '打开存储目录')),
                        ),
                      ),
              ),
        ),

        dialog === 'add' ? h(AddDialog, { state, onClose: () => setDialog(''), onDone: (next) => refresh(next), onError: setError }) : null,
        dialog === 'settings' ? h(SettingsDialog, { state, onClose: () => setDialog(''), onSaved: (next) => refresh(next), onError: setError }) : null,

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
          label: 'X 文章',
        }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'x-article-library' }, Library));
      },
    };
  },
});
