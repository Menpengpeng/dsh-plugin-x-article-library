// 轻量 HTTP 客户端：零外部依赖，支持系统代理、重定向与常见压缩格式。
// 说明：本机访问外网需要经由系统代理，Node 原生 fetch 不会自动读取它，故在此实现。

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

let proxyCache;

/** 解析代理地址：优先环境变量，其次 Windows 系统代理设置。 */
export async function resolveProxy() {
  if (proxyCache !== undefined) return proxyCache;
  const fromEnv = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (fromEnv) {
    proxyCache = normalizeProxy(fromEnv);
    return proxyCache;
  }
  if (process.platform === 'win32') {
    try {
      const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
      const { stdout } = await execFileAsync('reg.exe', ['query', key], { timeout: 4000, windowsHide: true });
      const enabled = /ProxyEnable\s+REG_DWORD\s+0x1\b/i.test(stdout);
      if (enabled) {
        const raw = stdout.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim();
        if (raw) {
          if (raw.includes('=')) {
            const httpsEntry = raw.match(/(?:^|;)https=([^;]+)/i)?.[1];
            proxyCache = normalizeProxy(httpsEntry || raw.match(/(?:^|;)http=([^;]+)/i)?.[1] || '');
          } else {
            proxyCache = normalizeProxy(raw);
          }
          return proxyCache;
        }
      }
    } catch {
      // 未配置系统代理时保持直连。
    }
  }
  proxyCache = null;
  return proxyCache;
}

function normalizeProxy(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.port) url.port = '80';
    return { host: url.hostname, port: Number(url.port), auth: url.username ? `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password || '')}` : null };
  } catch {
    return null;
  }
}

/** 通过 HTTP CONNECT 建立到目标主机的隧道。 */
function openTunnel(proxy, hostname, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: proxy.host, port: proxy.port }, () => {
      const auth = proxy.auth ? `Proxy-Authorization: Basic ${Buffer.from(proxy.auth).toString('base64')}\r\n` : '';
      socket.write(`CONNECT ${hostname}:${port} HTTP/1.1\r\nHost: ${hostname}:${port}\r\n${auth}\r\n`);
    });
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('代理连接超时'));
    }, timeoutMs);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const boundary = buffer.indexOf('\r\n\r\n');
      if (boundary < 0) {
        if (buffer.length > 16384) {
          clearTimeout(timer);
          socket.destroy();
          reject(new Error('代理响应异常'));
        }
        return;
      }
      socket.removeListener('data', onData);
      clearTimeout(timer);
      const head = buffer.subarray(0, boundary).toString('latin1');
      const rest = buffer.subarray(boundary + 4);
      if (!/^HTTP\/1\.[01] 200/.test(head)) {
        socket.destroy();
        reject(new Error(`代理隧道建立失败：${head.split('\r\n')[0]}`));
        return;
      }
      if (rest.length) socket.unshift(rest);
      resolve(socket);
    };
    socket.on('data', onData);
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function decompress(buffer, encoding) {
  try {
    if (encoding === 'gzip') return zlib.gunzipSync(buffer);
    if (encoding === 'deflate') return zlib.inflateSync(buffer);
    if (encoding === 'br') return zlib.brotliDecompressSync(buffer);
  } catch {
    return buffer;
  }
  return buffer;
}

function rawRequest(target, { method = 'GET', headers = {}, proxy, timeoutMs = 30000, maxBytes = 40 * 1024 * 1024, signal } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };

    const url = new URL(target);
    const isHttps = url.protocol === 'https:';
    const port = Number(url.port || (isHttps ? 443 : 80));
    const requestPath = `${url.pathname || '/'}${url.search}`;
    const baseHeaders = {
      host: url.host,
      'user-agent': USER_AGENT,
      accept: '*/*',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9',
      ...headers,
    };

    const send = (createConnection, usingProxyAbsoluteForm) => {
      const options = {
        method,
        host: usingProxyAbsoluteForm ? proxy.host : url.hostname,
        port: usingProxyAbsoluteForm ? proxy.port : port,
        path: usingProxyAbsoluteForm ? target : requestPath,
        headers: baseHeaders,
        createConnection,
        timeout: timeoutMs,
      };
      const client = isHttps && !usingProxyAbsoluteForm ? https : http;
      const request = client.request(options, (response) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(new Error('响应超过大小上限'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const body = decompress(Buffer.concat(chunks), String(response.headers['content-encoding'] || '').toLowerCase());
          finish(null, { status: response.statusCode || 0, headers: response.headers, body });
        });
        response.on('error', (error) => finish(error));
      });
      request.on('timeout', () => request.destroy(new Error('请求超时')));
      request.on('error', (error) => finish(error));
      if (signal) {
        if (signal.aborted) {
          request.destroy(new Error('已取消'));
          return;
        }
        signal.addEventListener('abort', () => request.destroy(new Error('已取消')), { once: true });
      }
      request.end();
    };

    const run = async () => {
      try {
        if (!proxy) {
          send(undefined, false);
          return;
        }
        if (isHttps) {
          const tunnel = await openTunnel(proxy, url.hostname, port, Math.min(timeoutMs, 15000));
          send(() => tls.connect({ socket: tunnel, servername: url.hostname }), false);
        } else {
          send(undefined, true);
        }
      } catch (error) {
        finish(error);
      }
    };
    void run();
  });
}

/**
 * 发起 HTTP 请求并自动跟随重定向。
 * @returns {Promise<{status:number, headers:Record<string,string>, body:Buffer, url:string}>}
 */
export async function request(target, options = {}) {
  const proxy = options.proxy === undefined ? await resolveProxy() : options.proxy;
  let current = target;
  const limit = options.redirects ?? 5;
  for (let hop = 0; hop <= limit; hop += 1) {
    const response = await rawRequest(current, { ...options, proxy });
    const location = response.headers?.location;
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(String(location), current).toString();
      continue;
    }
    return { ...response, url: current };
  }
  throw new Error('重定向次数过多');
}

/** 请求文本内容。 */
export async function requestText(target, options = {}) {
  const response = await request(target, options);
  return { ...response, text: response.body.toString('utf8') };
}

/** 请求 JSON 内容。 */
export async function requestJson(target, options = {}) {
  const response = await requestText(target, options);
  if (response.status < 200 || response.status >= 300) {
    throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, body: response.text });
  }
  try {
    return { ...response, json: JSON.parse(response.text) };
  } catch {
    throw Object.assign(new Error('响应不是合法 JSON'), { status: response.status, body: response.text });
  }
}
