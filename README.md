# X 文章库（X Article Library）

DSH 桌面版插件。把公开的 X（Twitter）帖子与长文链接保存为可离线阅读的 Markdown，按收藏夹与博主归类，用三栏阅读器阅读。

**不登录 X、不读取用户书签、不调用 X API。** 只处理用户主动粘贴的公开链接。

## 功能

- **粘贴即存**：一次可粘贴多条链接，自动识别帖子 ID 并去重；也接受纯数字 ID。
- **Markdown 落盘**：每篇文章保存为一个目录，含正文、元数据与本地图片，脱离本插件也能直接阅读。
- **三栏阅读器**：左栏资料库导航（全部 / 未读 / 收藏 / 需要处理 / 收藏夹 / 博主），中栏文章列表（搜索、状态、进度），右栏 Markdown 阅读区。
- **分类不搬文件**：收藏夹与标签只存在索引里，改名或重新分类不会移动磁盘文件。
- **图片本地化**：正文图片下载到 `assets/` 并改写为相对路径，断网也能看到图。
- **存储位置可配**：在设置里指定任意目录（「浏览…」直接弹系统文件夹选择框），也能在系统资源管理器中直接打开。
- **一键定位文件**：阅读器里点「打开所在位置」，直接在资源管理器里选中该篇的 `article.md`。
- **AI 工具**：注册 `x_article_library` 工具，可在会话中让 AI 添加链接、列出文章、读取正文。

## 安装

要求 DSH 桌面版 `0.2.2` 或更高版本。

### 从 GitHub 安装

```powershell
# 在 DSH 所在机器上执行，把 <你的 DSH 配置> 换成实际 profile 目录
cd $env:DSH_PROFILE_DIR
pnpm add github:Menpengpeng/dsh-plugin-x-article-library
```

随后确认 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 中含 `@menpengpeng/dsh-plugin-x-article-library`，重启 DSH 后在侧边栏出现「X 文章」入口。

### 从本地目录安装

```powershell
# 在本仓库根目录执行
cd $env:DSH_PROFILE_DIR
pnpm add file:<本仓库绝对路径>
```

然后在 `package.json` 的 `dsh.profile.bundles` 里追加包名并重启 DSH。

## 使用

1. 侧边栏点「X 文章」。
2. 点「+ 添加」，粘贴公开的 X 链接（如 `https://x.com/user/status/1234567890`），可一次多条。
3. 选择内容范围：**包含作者自线程**（长文完整）或**只取单条帖子**。
4. 下载在后台进行，完成后自动出现在列表；点条目在右栏阅读。

### 设置

- **存储位置**：默认 `~/Documents/X Article Library`，点「浏览…」直接弹出**系统文件夹选择框**（在 DSH 桌面版里由宿主 `ctx.directoryPicker` 的 native 后端提供）；远程部署或无桌面显示时自动退回应用内目录列表。输入框旁「📂 打开」可在系统资源管理器中打开该目录。切换**只影响之后下载的文章**，已有文件不会移动——每篇文章会记住自己下载时的根目录，所以改完设置旧文章照样能读、能删、能定位。
- **同时下载数**：1–4，默认 2。
- **图片**：下载到本地或保留远程链接。
- **扫描存储目录**：把手工放进 `articles/` 的目录重新纳入索引。

### 定位文件

阅读器右上方有「📂 打开所在位置」，点击会在系统文件管理器里**选中**该篇的 `article.md`：

- Windows：`explorer.exe /select,`（Explorer 成功交接时退出码是 1，插件按成功处理）
- macOS：`open -R`
- Linux：打开父目录（各文件管理器对「选中文件」没有统一协议）

存储位置输入框旁边的「📂 打开」用于打开当前填写的目录；文章列表为空时，主页还有「📂 打开存储目录」直接打开根目录。

## 存储结构

```
<存储根目录>/
  articles/
    <postId>/
      article.md        # 带 YAML Front Matter 的正文（UTF-8 BOM）
      metadata.json     # 元数据与失败图片记录
      assets/
        001.jpg         # 本地化后的图片
```

索引本身在 `~/.dsh/storages/x-article-library/index.json`，保存文章元数据、收藏夹、设置与任务记录。删除索引不影响磁盘上的 Markdown；用「扫描存储目录」可重建。

### Front Matter 字段

`x_post_id`、`source_url`、`title`、`author_name`、`author_username`、`published_at`、`downloaded_at`、`thread_mode`、`tags`、`collections`、`image_count`。

## 内容获取

正文来自 [Xtracticle](https://xtracticle.com) 的 Markdown 接口：

```
https://xtracticle.com/api/markdown/{post_id}?thread=1&front_matter=1
```

`thread=1` 取作者自线程，`thread=0` 只取单条。因此：

- **只能读公开内容**。私密、受保护、已删除或有年龄限制的帖子会返回「不可访问」，请在原帖确认是否公开。
- 下载依赖第三方服务可用性；限流时会提示稍后再试。

### 代理

X 与图床（`pbs.twimg.com`）在本机通常需要代理。插件内置零依赖的 CONNECT 隧道客户端：先读环境变量 `HTTPS_PROXY` / `HTTP_PROXY`，再读 Windows 注册表 `ProxyServer`，都没有则直连。系统代理开启即可，无需额外配置。

## AI 工具

工具名 `x_article_library`，参数 `action`：

| action | 作用 |
| --- | --- |
| `add` | 按 `links` 导入链接，可选 `collection`、`threadMode` |
| `list` | 列出文章（最多 50 条）与收藏夹 |
| `read` | 按 `postId` 读取正文（截断到 20000 字符） |
| `retry` | 重排队所有未完成的下载 |
| `settings` | 返回存储目录、图片缓存与并发设置 |

## HTTP 接口

- `GET /api/x-article-library` — 当前完整状态快照。
- `POST /api/x-article-library` — 请求体 `{ "type": "...", ... }`，`type` 为 `parse` / `import` / `download` / `read` / `update` / `remove` / `createCollection` / `updateCollection` / `deleteCollection` / `settings` / `scan` / `browse` / `reveal` / `openFolder`。
- `GET /api/x-article-library/asset?postId=&name=` — 读取本地图片。

所有接口都经过 Harness 的 Host/Origin 认证检查，返回 `Cache-Control: no-store`；POST 必须是 `application/json`，请求体上限 64 KiB。

## 安全边界

- 外部内容一律视为不可信数据：Markdown 渲染器禁用原生 HTML、`<script>`、`<iframe>` 与 `javascript:` / `data:` 协议，属性值全部转义。
- 图片只接受 `jpeg/png/webp/gif/avif`，拒绝 SVG（可携带脚本）。
- 所有文件路径都用 `isInside` 校验，必须落在存储根目录内；资源读取只接受 `assets/` 下的简单文件名。

## 已知限制

- 单篇最多下载 30 张图片，单张上限 10 MiB。
- 一次导入最多处理 100 条链接。
- 正文中的 X 内嵌视频不会下载，只保留原文链接。
- 不支持 X 长文之外的其他平台内容。

## 文件结构

```
x-article-library/
  package.json          # bundle 元数据与 dsh.bundle / dsh.client 声明
  cordis.patch.yml      # 插入插件条目
  index.js              # Host：HTTP 路由、AI 工具、服务生命周期
  client.js             # Client：三栏界面 + 受限 Markdown 渲染器
  lib/http.js           # 零依赖 HTTP 客户端（支持 CONNECT 代理、解压、重定向）
  lib/core.js           # 链接解析、内容抓取、Front Matter、图片与文件写入
  lib/library.js        # 索引存储、下载队列、文章与收藏夹服务
  lib/reveal.js         # 在系统文件管理器中定位文件 / 打开目录（跨平台）
  tests/                # 无需依赖的自测脚本
  locale/zh.json        # 中文文案
  locale/en.json        # 英文文案
  icon.svg              # 侧边栏图标
```

## 开发

本仓库没有构建步骤，源码即产物。改动后：

```powershell
node --check index.js
node --check client.js
node --check lib/http.js
node --check lib/core.js
node --check lib/library.js
node --check lib/reveal.js

# 运行测试（无需安装依赖）
node tests/reveal.test.mjs    # 存储位置切换 + 文件定位（含真实 Explorer 调用）
node tests/markdown.test.mjs  # 渲染器安全与语法，48 项
node tests/client.test.mjs    # 客户端模块加载与 slot 注册
```

调试接口需要带 DSH 会话凭据，接口本身会拒绝未认证请求。想看日志可在 DSH 启动终端观察。

## 免责声明

本插件仅用于保存你**本就有权访问的公开内容**，便于离线阅读与检索。请自行遵守 X 的服务条款与所在地区的法律，不要用它批量抓取或再分发他人作品。内容版权归原作者所有。

## 贡献

欢迎提 Issue 与 PR。提交前请确保：

- 不引入新的运行时依赖（HTTP 客户端刻意保持零依赖）。
- 外部内容始终按不可信数据处理，不新增绕过协议白名单的路径。
- 源码保持 UTF-8 with BOM（`package.json` 与 `locale/*.json` 除外，JSON 带 BOM 会解析失败）。

## 协议

[MIT](LICENSE) © 2026 menpengpeng
