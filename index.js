import { XRKAIAssistant } from './apps/ai.js';

export { XRKAIAssistant };

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { loadWebAdmin } from './model/web-admin.js';

console.log('-------------------------');
console.log('【风云AI】正在初始化...');
console.log('-------------------------');

const _path = process.cwd();
const pluginName = 'ai-plugin';
const pluginPath = path.join(_path, 'plugins', pluginName);

// 依赖检测与自动安装
async function checkDeps() {
  const pkgPath = path.join(pluginPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = Object.keys(pkg.dependencies || {});
  let missing = [];

  for (const dep of deps) {
    try {
      await import(dep);
    } catch (e) {
      missing.push(dep);
    }
  }

  if (missing.length > 0) {
    console.log(`\x1b[33m【风云AI】检测到缺少依赖: ${missing.join(', ')}，正在自动安装...\x1b[0m`);
    try {
      execSync(`npm install --no-save ${missing.join(' ')}`, {
        cwd: pluginPath,
        stdio: 'inherit'
      });
      console.log('\x1b[32m【风云AI】依赖安装完成，请重启Bot以生效。\x1b[0m');
    } catch (e) {
      console.error('\x1b[31m【风云AI】依赖安装失败，请手动运行 npm install\x1b[0m');
      console.error(e);
    }
  }
}

// 执行依赖检查
await checkDeps();

// 自动加载 apps 目录下的所有插件
const appsPath = path.join(pluginPath, 'apps');
const files = fs.readdirSync(appsPath).filter(file => file.endsWith('.js'));

console.log(`\x1b[36m【风云AI】正在加载插件: ${files.join(', ')}\x1b[0m`);

let ret = [];
files.forEach((file) => {
  ret.push(import(`./apps/${file}`));
});

ret = await Promise.allSettled(ret);

const apps = {};
for (let i in files) {
  let name = files[i].replace('.js', '');
  if (ret[i].status === 'fulfilled') {
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
  } else {
    console.error(`\x1b[31m【风云AI】加载插件错误：${files[i]}\x1b[0m`);
    console.error(ret[i].reason);
  }
}

// 初始化 Web Admin
loadWebAdmin().catch(err => {
  console.error(`\x1b[31m【风云AI】Web Admin 初始化失败: ${err.message}\x1b[0m`);
});

export { apps };
