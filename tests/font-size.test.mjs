// 端到端验证字号持久化：写入 readerFontScale 后重新加载，值应保持且被夹在合法区间。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xal-font-'));
process.env.DSH_HOME = home;

const { LibraryService } = await import('../lib/library.js');

const dataDir = path.join(home, 'data');
const storageRoot = path.join(home, 'store');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(storageRoot, { recursive: true });

const service = new LibraryService({ dataDir, defaultStorageRoot: storageRoot });
await service.init();

const assert = (condition, message) => {
  if (!condition) throw new Error('断言失败：' + message);
  console.log('OK  ' + message);
};

// 默认值应为 1（即 14px），升级后观感不变。
assert(service.settings.readerFontScale === 1, '默认 readerFontScale = 1');

// 存 19px -> 比例 19/14
await service.updateSettings({ readerFontScale: 19 / 14 });
const saved = service.settings.readerFontScale;
assert(Math.abs(saved - 19 / 14) < 1e-9, '保存 19px 后比例正确，实际 ' + saved.toFixed(4));

// 重新加载，值应还在。
const reloaded = new LibraryService({ dataDir, defaultStorageRoot: storageRoot });
await reloaded.init();
assert(Math.abs(reloaded.settings.readerFontScale - 19 / 14) < 1e-9, '重启后字号保持');

// 越界要被夹紧：0.1 -> 0.8，5 -> 1.6
await reloaded.updateSettings({ readerFontScale: 0.1 });
assert(reloaded.settings.readerFontScale === 0.8, '过小被夹到 0.8，实际 ' + reloaded.settings.readerFontScale);
await reloaded.updateSettings({ readerFontScale: 5 });
assert(reloaded.settings.readerFontScale === 1.6, '过大被夹到 1.6，实际 ' + reloaded.settings.readerFontScale);

// 非法值回落到 1。
await reloaded.updateSettings({ readerFontScale: 'abc' });
assert(reloaded.settings.readerFontScale === 1, '非法值回落到 1，实际 ' + reloaded.settings.readerFontScale);

// 0.8 * 14 = 11.2 -> 夹到 12；1.6 * 14 = 22.4 -> 夹到 22，都落在滑杆区间内。
const clampFont = (value) => Math.min(22, Math.max(12, Math.round(Number(value) || 14)));
await reloaded.updateSettings({ readerFontScale: 0.8 });
assert(clampFont(reloaded.settings.readerFontScale * 14) === 12, '0.8 比例落到滑杆最小值 12px');
await reloaded.updateSettings({ readerFontScale: 1.6 });
assert(clampFont(reloaded.settings.readerFontScale * 14) === 22, '1.6 比例落到滑杆最大值 22px');

// 阅读模式持久化（方案 A 的 setFocus 依赖它）。
await service.updateSettings({ readerFocusMode: true });
assert(service.settings.readerFocusMode === true, '阅读模式可保存为开启');
await service.updateSettings({ readerFocusMode: false });
assert(service.settings.readerFocusMode === false, '阅读模式可保存为关闭');
await service.updateSettings({ readerFocusMode: 'yes' });
assert(service.settings.readerFocusMode === true, '非布尔值按 truthy 处理');
const reloadMode = new LibraryService({ dataDir, defaultStorageRoot: storageRoot });
await reloadMode.init();
assert(reloadMode.settings.readerFocusMode === true, '重启后阅读模式保持');

fs.rmSync(home, { recursive: true, force: true });
console.log('\n字号与阅读模式持久化端到端验证全部通过。');
