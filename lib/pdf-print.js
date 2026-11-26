// 用 Chrome headless 把 HTML 打印成 PDF（临时 HTML 文件 + 显式输出路径）。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

/** 跑一次 Chrome 打印，返回 PDF 字节。 */
export function htmlToPdf(html, chromePath) {
  return new Promise((resolve, reject) => {
    (async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'xal-pdf-'));
      const htmlPath = path.join(tmp, 'article.html');
      const pdfPath = path.join(tmp, 'article.pdf');
      const profileDir = path.join(tmp, 'profile');
      await fs.writeFile(htmlPath, html, 'utf8');

      const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pdf-header-footer',
        '--user-data-dir=' + profileDir,
        '--print-to-pdf=' + pdfPath,
        'file:///' + htmlPath.replace(/\\/g, '/'),
      ];

      const child = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (err) => {
        fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
        reject(new Error('启动 Chrome 失败：' + err.message));
      });
      child.on('close', async (code) => {
        try {
          if (code !== 0) throw new Error('Chrome 退出码 ' + code + (stderr ? '：' + stderr.slice(0, 300) : ''));
          const bytes = await fs.readFile(pdfPath);
          resolve(bytes);
        } catch (err) {
          reject(err);
        } finally {
          await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
        }
      });
    })().catch(reject);
  });
}
