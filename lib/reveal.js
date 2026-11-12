// 在系统文件管理器中定位文件：Windows 用 Explorer /select，macOS 用 Finder 揭示，
// Linux 打开父目录。不依赖宿主内部包，因此插件单独安装也能工作。

import { execFile } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * 把 Windows 路径编码成 Explorer 能完整接收的目标。
 *
 * Explorer 自己解析命令行，会在逗号和等号处截断参数；不转义会静默打开成别的路径。
 * 其余字符不能做百分号编码：Explorer 会拒绝含百分号编码非 ASCII 的文件 URI 并打开
 * 文档目录，所以把非 ASCII 的编码还原成字面字符，只保留 ASCII 转义。
 */
export function explorerTarget(windowsPath) {
  return pathToFileURL(windowsPath, { windows: true })
    .href.replace(/(?:%[89A-F][0-9A-F])+/gi, (escaped) => decodeURIComponent(escaped))
    .replaceAll(',', '%2C')
    .replaceAll('=', '%3D');
}

/** 执行系统命令，不经过 shell。 */
function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15000, windowsHide: false }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Explorer 把请求交给已在运行的桌面进程后以退出码 1 结束。
 * 因此退出码 1 表示「已交接」，不是失败；只有其他退出码才算失败。
 */
async function runExplorer(args) {
  try {
    await run('explorer.exe', args);
  } catch (error) {
    if (error?.code !== 1) throw error;
  }
}

/**
 * 在文件管理器中定位一个已存在的路径。
 * @param {string} target 绝对路径（文件或目录，调用方负责校验可访问性）
 * @param {string} [platform] 便于测试注入
 * @returns {Promise<{revealed: true, target: string, mode: string}>}
 */
export async function revealPath(target, platform = process.platform) {
  if (platform === 'win32') {
    await runExplorer(['/select,', explorerTarget(target)]);
    return { revealed: true, target, mode: 'select' };
  }
  if (platform === 'darwin') {
    await run('open', ['-R', target]);
    return { revealed: true, target, mode: 'select' };
  }
  if (platform === 'linux') {
    // Linux 没有统一的「选中文件」协议，打开父目录是各文件管理器都能接受的做法。
    await run('xdg-open', [path.dirname(target)]);
    return { revealed: true, target, mode: 'parent' };
  }
  throw Object.assign(new Error(`当前平台不支持定位文件：${platform}`), { code: 'unsupported' });
}

/** 打开一个目录本身（不选中文件）。 */
export async function openDirectory(target, platform = process.platform) {
  if (platform === 'win32') {
    await runExplorer([explorerTarget(target)]);
    return { opened: true, target };
  }
  if (platform === 'darwin') {
    await run('open', [target]);
    return { opened: true, target };
  }
  if (platform === 'linux') {
    await run('xdg-open', [target]);
    return { opened: true, target };
  }
  throw Object.assign(new Error(`当前平台不支持打开目录：${platform}`), { code: 'unsupported' });
}
