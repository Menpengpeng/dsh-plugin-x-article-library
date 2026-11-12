# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-11-12

首个公开版本。

### 新增

- 粘贴公开 X 链接保存为 Markdown，支持一次多条、自动去重与纯数字 ID。
- 三栏阅读器：资料库导航、文章列表、Markdown 阅读区。
- 收藏夹与标签管理，分类变化不移动磁盘文件。
- 正文图片本地化到 `assets/` 并改写为相对路径。
- 索引存储（`index.json`）与「扫描存储目录」反向重建。
- 下载队列：同帖去重、并发可调（1–4）、重启后中断任务标记为可重试。
- 零依赖 HTTP 客户端，支持 CONNECT 代理、gzip/deflate/br 解压与重定向。
- `x_article_library` AI 工具：add / list / read / retry / settings。
- 受限 Markdown 渲染器：禁用原生 HTML、iframe 与危险协议，属性全转义。
- 中英文文案。

### 安全

- 所有文件路径经 `isInside` 校验，必须落在存储根目录内。
- 图片仅接受 jpeg/png/webp/gif/avif，拒绝 SVG。
- HTTP 接口强制 Harness 认证、`application/json` 与 64 KiB 请求体上限。
