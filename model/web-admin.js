import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import configManager from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const _path = process.cwd();

let webAdminModule = null;
let webAdminLoaded = false;
let webAdminError = null;
let isAnotherInstanceRunning = false;

async function isPortTaken(port) {
  const net = await import('net');
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port, '127.0.0.1');
  });
}

export async function getOuterIp() {
  const SECURITY_CONFIG = configManager.getConfigValue('securityConfig');
  try {
    const res = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
    const data = await res.json();
    if (SECURITY_CONFIG) {
      SECURITY_CONFIG.outerIp = data.ip;
    }
    return data.ip;
  } catch (err) {
    console.error(`\x1b[31m【风云AI-安全配置】主接口获取外网IP失败：${err.message}\x1b[0m`);
    try {
      const res = await fetch('https://icanhazip.com', { timeout: 5000 });
      const ip = (await res.text()).trim();
      if (SECURITY_CONFIG) {
        SECURITY_CONFIG.outerIp = ip;
      }
      return ip;
    } catch (err2) {
      console.error(`\x1b[31m【风云AI-安全配置】备用接口获取外网IP失败：${err2.message}\x1b[0m`);
      return '127.0.0.1';
    }
  }
}

export function generateRandomCode() {
  let code;
  const SECURITY_CONFIG = configManager.getConfigValue('securityConfig');
  const tempCodes = (SECURITY_CONFIG?.tempCodes) || {};
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (tempCodes[code]);
  return code;
}

export async function loadWebAdmin() {
  try {
    console.log('\x1b[36m【风云AI-网页管理端】开始加载...\x1b[0m');
    
    // web-admin 目录在插件根目录下
    const webAdminDir = path.join(_path, 'plugins/ai-plugin/web-admin');
    const webAdminModulePath = path.join(webAdminDir, 'app.js');
    
    if (!fs.existsSync(webAdminDir)) {
      webAdminError = `web-admin目录不存在: ${webAdminDir}`;
      console.error(`\x1b[31m【风云AI-网页管理端】${webAdminError}\x1b[0m`);
      return false;
    }
    
    if (!fs.existsSync(webAdminModulePath)) {
      webAdminError = `web-admin模块文件不存在: ${webAdminModulePath}`;
      console.error(`\x1b[31m【风云AI-网页管理端】${webAdminError}\x1b[0m`);
      return false;
    }
    
    const SECURITY_CONFIG = configManager.getConfigValue('securityConfig');
    const port = (SECURITY_CONFIG?.webAdminPort) || 54188;
    const portTaken = await isPortTaken(port);
    
    if (portTaken) {
      console.log(`\x1b[33m【风云AI-网页管理端】检测到端口 ${port} 已被占用，服务已在另一处启动\x1b[0m`);
      isAnotherInstanceRunning = true;
      webAdminLoaded = true;
      const outerIp = await getOuterIp();
      console.log(`\x1b[36m【风云AI-网页管理端】管理端地址：http://${outerIp}:${port}\x1b[0m`);
      return true;
    }
    
    try {
      const module = await import('file://' + webAdminModulePath);
      webAdminModule = module;
      
      if (module.setSecurityConfig) {
        module.setSecurityConfig(SECURITY_CONFIG);
      }
      
      if (module.init && typeof module.init === 'function') {
        await module.init();
      }
      
      webAdminLoaded = true;
      isAnotherInstanceRunning = false;
      const outerIp = await getOuterIp();
      console.log(`\x1b[32m【风云AI-网页管理端】✅ 服务启动成功\x1b[0m`);
      console.log(`\x1b[36m【风云AI-网页管理端】管理端地址：http://${outerIp}:${port}\x1b[0m`);
      
      return true;
    } catch (importError) {
      webAdminError = `导入模块失败: ${importError.message}`;
      console.error(`\x1b[31m【风云AI-网页管理端】${webAdminError}\x1b[0m`);
      return false;
    }
  } catch (error) {
    webAdminError = `加载异常: ${error.message}`;
    console.error(`\x1b[31m【风云AI-网页管理端】${webAdminError}\x1b[0m`);
    return false;
  }
}

export function getWebAdminState() {
  return {
    webAdminLoaded,
    webAdminError,
    isAnotherInstanceRunning,
    webAdminModule
  };
}
