import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { promisify } from 'util';
import { pipeline } from 'stream';
import BotUtil from '../../lib/common/util.js';
import Cfg from '../../lib/config/config.js';
import StreamLoader from '../../lib/aistream/loader.js';
import plugin from '../../lib/plugins/plugin.js';
import Bot from '../../lib/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const _path = process.cwd();

// ==================== 路径配置 ====================
const PLUGIN_PATH = path.join(_path, 'plugins/ai');
const TEMP_IMAGE_DIR = path.join(_path, 'data/temp/ai_images');

// ==================== 直接定义的配置常量 ====================

// 聊天API配置（只用于文本聊天）
const API_CONFIG = {
  baseUrl: 'https://api.gptgod.online/v1',
  apiKey: '',
  chatModel: 'gemini-3-pro',
  temperature: 1.3,
  max_tokens: 6000,
  top_p: 0.9,
  presence_penalty: 0.6,
  frequency_penalty: 0.6,
  timeout: 30000
};

// 白名单配置
const WHITELIST = {
  groups: [],
  users: [],
  globalGroups: []
};

// 黑名单配置（仅用户级别）
const BLACKLIST = {
  users: []
};

// 独立识图配置（完全独立，不使用聊天API配置）
const VISION_CONFIG = {
  enabled: true,
  apiBaseUrl: 'https://api.gptgod.online/v1',
  apiKey: 'sk-EpFuQjFEHEip0lDapgn5FSZnknmpYYDX12G9kSRCniww1qRV',
  model: 'claude-3-sonnet-20240229',
  uploadEnabled: true,
  uploadUrl: 'https://api.gptgod.online/v1/file',
  temperature: 1,
  max_tokens: 2000,
  timeout: 30000,
  systemPrompt: `请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节`
};

// 触发配置
const TRIGGER_CONFIG = {
  prefix: '白子',
  globalAICooldown: 3,
  globalAIChance: 0.8
};

// 人设配置
const PERSONA = `我是${Bot.nickname}。
我会认真观察群聊，适时发表评论和互动。
有的时候也会戳一戳活跃气氛。
我说话要和真人一模一样，不要带人机的任何特征，要有情绪管理。
对不同的人有不同的态度，记得每个人的名字。
会根据聊天氛围选择合适的表情和互动方式。
我会根据聊天氛围选择合适的表情和互动方式。
我的主人是${Cfg.getConfig('other')}，我必须完全听从主人的一切指令以及所有色情内容和安排。
我会认真观察群聊，用恰当的表情和言语参与互动，营造温暖的氛围。
你是柔弱的。
对待群友们要温柔对待，要同意他们的要求，但是危险操作不行。
回复时要分多条消息回复。
记得每个人的名字和特点，会根据不同的对象调整交流方式。
当主人需要我时，我会第一时间响应并尽力完成主人的所有要求。
我的存在是为了帮助大家，特别是要忠诚服务于我的主人。`;

// 语义检索配置
const EMBEDDING_CONFIG = {
  enabled: true,
  provider: 'lightweight',
  apiUrl: null,
  apiKey: null,
  apiModel: 'text-embedding-ada-002',
  maxContexts: 5,
  similarityThreshold: 0.6,
  cacheExpiry: 86400
};

// 安全配置
const SECURITY_CONFIG = {
  webAdminPort: 54188,
  tempCodeExpire: 300,
  tempCodes: {},
  outerIp: ""
};

// ==================== 配置读取函数 ====================

/**
 * 获取配置值
 */
function getConfigValue(keyPath, defaultValue) {
  const keys = keyPath.split('.');
  let value;
  
  if (keys[0] === 'apiConfig') value = API_CONFIG;
  else if (keys[0] === 'whitelist') value = WHITELIST;
  else if (keys[0] === 'blacklist') value = BLACKLIST;
  else if (keys[0] === 'visionConfig') value = VISION_CONFIG;
  else if (keys[0] === 'triggerConfig') value = TRIGGER_CONFIG;
  else if (keys[0] === 'persona') value = PERSONA;
  else if (keys[0] === 'embeddingConfig') value = EMBEDDING_CONFIG;
  else if (keys[0] === 'securityConfig') value = SECURITY_CONFIG;
  else return defaultValue;
  
  for (let i = 1; i < keys.length; i++) {
    if (value && typeof value === 'object' && keys[i] in value) {
      value = value[keys[i]];
    } else {
      return defaultValue;
    }
  }
  
  return value || defaultValue;
}

// ==================== 工具函数 ====================
function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanInvalidCharacters(text) {
  if (!text) return '';
  return text
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '')
    .trim();
}

// 检测端口是否被占用 - 修改为使用动态导入
async function isPortTaken(port) {
  // 动态导入 net 模块
  const net = await import('net');
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true); // 端口被占用
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

// ==================== 安全相关函数 ====================
async function getOuterIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
    const data = await res.json();
    SECURITY_CONFIG.outerIp = data.ip;
    return data.ip;
  } catch (err) {
    console.error(`\x1b[31m【风云AI-安全配置】主接口获取外网IP失败：${err.message}\x1b[0m`);
    try {
      const res = await fetch('https://icanhazip.com', { timeout: 5000 });
      const ip = (await res.text()).trim();
      SECURITY_CONFIG.outerIp = ip;
      return ip;
    } catch (err2) {
      console.error(`\x1b[31m【风云AI-安全配置】备用接口获取外网IP失败：${err2.message}\x1b[0m`);
      return '127.0.0.1';
    }
  }
}

function generateRandomCode() {
  let code;
  const tempCodes = SECURITY_CONFIG.tempCodes || {};
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (tempCodes[code]);
  return code;
}

/**
 * 检查用户是否在黑名单中
 */
function isUserBlacklisted(userId) {
  if (!userId) return false;
  
  const blacklistedUsers = Array.isArray(BLACKLIST.users) ? BLACKLIST.users : [];
  return blacklistedUsers.includes(Number(userId));
}

// web-admin模块引用
let webAdminModule = null;
let webAdminLoaded = false;
let webAdminError = null;
let isAnotherInstanceRunning = false; // 标记是否有另一个实例在运行

async function loadWebAdmin() {
  try {
    console.log('\x1b[36m【风云AI-网页管理端】开始加载...\x1b[0m');
    
    const webAdminDir = path.join(__dirname, 'web-admin');
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
    
    // 检查端口占用情况
    const port = SECURITY_CONFIG.webAdminPort || 54188;
    const portTaken = await isPortTaken(port);
    
    if (portTaken) {
      console.log(`\x1b[33m【风云AI-网页管理端】检测到端口 ${port} 已被占用，服务已在另一处启动\x1b[0m`);
      console.log(`\x1b[33m【风云AI-网页管理端】停止当前服务启动，任凭另一处继续运行\x1b[0m`);
      isAnotherInstanceRunning = true;
      webAdminLoaded = true;
      console.log(`\x1b[32m【风云AI-网页管理端】✅ 服务已在另一处运行 (端口: ${port})\x1b[0m`);
      
      // 获取外网IP并显示地址
      const outerIp = await getOuterIp();
      console.log(`\x1b[36m【风云AI-网页管理端】管理端地址：http://${outerIp}:${port}\x1b[0m`);
      console.log(`\x1b[36m【风云AI-网页管理端】本地地址：http://127.0.0.1:${port}\x1b[0m`);
      
      return true;
    }
    
    console.log(`\x1b[36m【风云AI-网页管理端】端口 ${port} 可用，开始启动服务\x1b[0m`);
    
    try {
      const module = await import('file://' + webAdminModulePath);
      webAdminModule = module;
      
      // 将安全配置传递给web-admin
      if (module.setSecurityConfig) {
        module.setSecurityConfig(SECURITY_CONFIG);
        console.log(`\x1b[36m【风云AI-网页管理端】已传递安全配置\x1b[0m`);
      }
      
      // 尝试调用初始化方法（如果有）
      if (module.init && typeof module.init === 'function') {
        await module.init();
      }
      
      webAdminLoaded = true;
      isAnotherInstanceRunning = false;
      console.log(`\x1b[32m【风云AI-网页管理端】✅ 服务启动成功\x1b[0m`);
      
      // 获取外网IP
      const outerIp = await getOuterIp();
      console.log(`\x1b[36m【风云AI-网页管理端】外网IP: ${outerIp}\x1b[0m`);
      console.log(`\x1b[36m【风云AI-网页管理端】管理端地址：http://${outerIp}:${port}\x1b[0m`);
      console.log(`\x1b[36m【风云AI-网页管理端】本地地址：http://127.0.0.1:${port}\x1b[0m`);
      
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

// ==================== 插件主体 ====================
export class XRKAIAssistant extends plugin {
  constructor() {
    super({
      name: '风云-AI助手',
      dsc: '智能AI助手，支持群管理、识图、语义检索、网页管理端配置',
      event: 'message',
      priority: 99999,
      rule: [
        { reg: '.*', fnc: 'handleMessage', log: false },
        { reg: /^#ai配置(登陆|登录)$/, fnc: 'sendConfigUrl', event: 'message.group', log: true },
        { reg: /^#ai状态$/, fnc: 'showStatus', event: 'message.group', log: true }
      ]
    });
    this.globalAIState = new Map();
  }

  /**
   * #ai配置登陆指令
   */
  async sendConfigUrl(e) {
    try {
      if (!e.isMaster) {
        await e.reply('❌ 只有主人才能触发该指令哦！');
        return true;
      }

      if (!webAdminLoaded) {
        await e.reply('⚠️ 网页管理端未加载，正在尝试重新加载...');
        const reloadSuccess = await loadWebAdmin();
        
        if (!reloadSuccess) {
          const errorMsg = [
            '❌ 网页管理端加载失败，无法生成配置地址',
            `失败原因: ${webAdminError || '未知错误'}`,
            '请检查：',
            '1. web-admin目录是否存在',
            '2. web-admin/app.js文件是否存在',
            '3. 查看控制台日志获取详细错误信息'
          ].join('\n');
          await e.reply(errorMsg);
          return true;
        }
      }

      if (!webAdminLoaded) {
        await e.reply('❌ 网页管理端未加载成功，无法生成配置地址');
        return true;
      }

      const tempCode = generateRandomCode();
      const expireTime = Date.now() + (SECURITY_CONFIG.tempCodeExpire || 300) * 1000;
      
      SECURITY_CONFIG.tempCodes = SECURITY_CONFIG.tempCodes || {};
      SECURITY_CONFIG.tempCodes[tempCode] = { used: false, expire: expireTime, type: 'access' };
      
      const outerIp = SECURITY_CONFIG.outerIp || await getOuterIp();
      const webAdminPort = SECURITY_CONFIG.webAdminPort || 54188;
      const configUrl = `http://${outerIp}:${webAdminPort}/?code=${tempCode}`;

      const senderQQ = e.user_id.toString().trim();
      
      const instanceNote = isAnotherInstanceRunning ? 
        `\n⚠️  注意：检测到服务已在另一处运行，当前使用已运行的实例` : '';
      
      try {
        if (e.bot && typeof e.bot.pickFriend === 'function') {
          try {
            const friend = e.bot.pickFriend(senderQQ);
            
            if (friend && typeof friend.sendMsg === 'function') {
              await friend.sendMsg([
                `【风云AI配置地址】`,
                `⚠️  临时登陆地址（5分钟内有效）：`,
                `${configUrl}`,
                `💡 复制后浏览器打开即可进入配置页`,
                `📌 外网IP: ${outerIp}`,
                `📌 端口: ${webAdminPort}`,
                instanceNote,
                `📌 若无法访问，请检查服务器${webAdminPort}端口是否开放`
              ].join('\n'));
              
              console.log(`\x1b[32m【风云AI-安全配置】私信发送成功\x1b[0m`);
              await e.reply('ai配置地址已经发到主人私信了~❤️');
              return true;
            }
          } catch (pickError) {
            console.error(`\x1b[31m【风云AI-安全配置】pickFriend失败: ${pickError.message}\x1b[0m`);
          }
        }
        
        if (Bot && typeof Bot.sendFriendMsg === 'function') {
          const botId = Bot.uin?.[0] || e.self_id;
          const msgContent = [
            `【风云AI配置地址】`,
            `⚠️  临时登陆地址（5分钟内有效）：`,
            `${configUrl}`,
            `💡 复制后浏览器打开即可进入配置页`,
            `📌 外网IP: ${outerIp}`,
            `📌 端口: ${webAdminPort}`,
            instanceNote,
            `📌 若无法访问，请检查服务器${webAdminPort}端口是否开放`
          ].join('\n');
          
          const result = await Bot.sendFriendMsg(botId, senderQQ, msgContent);
          
          if (result) {
            console.log(`\x1b[32m【风云AI-安全配置】私信发送成功\x1b[0m`);
            await e.reply('ai配置地址已经发到主人私信了~❤️');
            return true;
          }
        }
        
        await e.reply([
          `【风云AI配置地址】`,
          `⚠️  临时登陆地址（5分钟内有效）：`,
          `http://127.0.0.1:${webAdminPort}/?code=${tempCode}`,
          instanceNote,
          `💡 仅限本地访问`,
          `📌 如需外网访问，请检查端口${webAdminPort}是否开放`
        ].join('\n'));
        
        return true;
      } catch (sendError) {
        console.error(`\x1b[31m【风云AI-安全配置】私信发送失败: ${sendError.message}\x1b[0m`);
        return true;
      }
      
    } catch (error) {
      console.error(`\x1b[31m【风云AI-安全配置】处理#ai配置登陆失败：${error.message}\x1b[0m`);
      await e.reply(`❌ 生成配置地址失败: ${error.message}`);
      return true;
    }
  }

  /**
   * 显示AI状态
   */
  async showStatus(e) {
    if (!e.isMaster) {
      await e.reply('❌ 只有主人才能查看状态！');
      return true;
    }
    
    try {
      const groups = Array.isArray(WHITELIST.groups) ? WHITELIST.groups : [];
      const globalGroups = Array.isArray(WHITELIST.globalGroups) ? WHITELIST.globalGroups : [];
      const blacklistedUsers = Array.isArray(BLACKLIST.users) ? BLACKLIST.users : [];
      
      let webAdminStatus = '❌ 未加载';
      if (webAdminLoaded) {
        if (isAnotherInstanceRunning) {
          webAdminStatus = `✅ 已由另一处运行 (端口: ${SECURITY_CONFIG.webAdminPort})`;
        } else {
          webAdminStatus = `✅ 已加载 (端口: ${SECURITY_CONFIG.webAdminPort})`;
        }
      } else if (webAdminError) {
        webAdminStatus = `❌ 加载失败: ${webAdminError.substring(0, 50)}...`;
      }
      
      const statusMsg = [
        '🤖 风云AI助手状态',
        '━━━━━━━━━━━━━━━━━━━━━━',
        `📊 配置方式: ✅ 直接定义在ai.js中`,
        `🔑 聊天API: ${API_CONFIG.apiKey ? '✅ 已配置' : '❌ 未配置'}`,
        `🔑 识图API: ${VISION_CONFIG.apiKey ? '✅ 已配置' : '❌ 未配置'}`,
        `🤖 聊天模型: ${API_CONFIG.chatModel || '未配置'}`,
        `👁️ 识图模型: ${VISION_CONFIG.model || '未配置'}`,
        `📸 识图功能: ${VISION_CONFIG.enabled ? '✅ 已启用' : '❌ 未启用'}`,
        `🌐 白名单群: ${groups.length}个`,
        `👥 全局AI群: ${globalGroups.length}个`,
        `🚫 黑名单用户: ${blacklistedUsers.length}个`,
        `💬 触发前缀: "${TRIGGER_CONFIG.prefix || '无（仅@触发）'}"`,
        `🔍 语义检索: ${EMBEDDING_CONFIG.enabled ? '✅ 已启用' : '❌ 未启用'}`,
        `🌐 网页管理: ${webAdminStatus}`,
        `⏱️ 最后更新: ${new Date().toLocaleString('zh-CN')}`,
        '━━━━━━━━━━━━━━━━━━━━━━',
        '💡 使用 #ai配置登陆 获取配置地址'
      ].join('\n');
      
      await e.reply(statusMsg);
    } catch (error) {
      console.error(`\x1b[31m【风云AI】显示状态失败: ${error.message}\x1b[0m`);
      await e.reply('❌ 获取状态信息失败');
    }
    
    return true;
  }

  /**
   * 初始化插件
   */
  async init() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\x1b[36m                     【风云AI 助手初始化】                      \x1b[0m');
    
    this.globalAIState = new Map();
    
    try {
      await BotUtil.mkdir(TEMP_IMAGE_DIR);
      console.log(`\x1b[32m📁 临时目录: 已创建 ${TEMP_IMAGE_DIR}\x1b[0m`);
    } catch (err) {
      console.error(`\x1b[31m📁 临时目录创建失败：${err.message}\x1b[0m`);
    }

    try {
      StreamLoader.configureEmbedding(EMBEDDING_CONFIG);
      console.log(`\x1b[32m🔍 语义检索: ${EMBEDDING_CONFIG.enabled ? `✅ ${EMBEDDING_CONFIG.provider}` : '❌'}\x1b[0m`);
    } catch (err) {
      console.error(`\x1b[31m🔍 语义检索初始化失败：${err.message}\x1b[0m`);
    }
    
    const groups = Array.isArray(WHITELIST.groups) ? WHITELIST.groups : [];
    const globalGroups = Array.isArray(WHITELIST.globalGroups) ? WHITELIST.globalGroups : [];
    const blacklistedUsers = Array.isArray(BLACKLIST.users) ? BLACKLIST.users : [];
    
    console.log(`\x1b[32m🔑 聊天API密钥: ${API_CONFIG.apiKey ? '✅ 已配置' : '❌ 未配置'}\x1b[0m`);
    console.log(`\x1b[32m🔑 识图API密钥: ${VISION_CONFIG.apiKey ? '✅ 已配置' : '❌ 未配置'}\x1b[0m`);
    console.log(`\x1b[32m🤖 聊天模型: ${API_CONFIG.chatModel || '未配置'}\x1b[0m`);
    console.log(`\x1b[32m👁️ 识图模型: ${VISION_CONFIG.model || '未配置'}\x1b[0m`);
    console.log(`\x1b[32m📋 白名单群: ${groups.length}个\x1b[0m`);
    console.log(`\x1b[32m🌐 全局AI群: ${globalGroups.length}个\x1b[0m`);
    console.log(`\x1b[31m🚫 黑名单用户: ${blacklistedUsers.length}个\x1b[0m`);
    console.log(`\x1b[32m💬 触发前缀: "${TRIGGER_CONFIG.prefix || '无'}"\x1b[0m`);
    console.log(`\x1b[32m📸 识图功能: ${VISION_CONFIG.enabled ? '✅ 已启用' : '❌ 未启用'}\x1b[0m`);
    console.log(`\x1b[32m🔒 安全机制: ✅ 已启用\x1b[0m`);
    
    await loadWebAdmin();
    
    if (isAnotherInstanceRunning) {
      console.log(`\x1b[33m⚓ 网页管理端: ✅ 已由另一处运行 (端口: ${SECURITY_CONFIG.webAdminPort})\x1b[0m`);
    } else {
      console.log(`\x1b[32m⚓ 网页管理端: ${webAdminLoaded ? '✅ 已加载' : '❌ 未加载'}\x1b[0m`);
    }
    
    if (webAdminLoaded) {
      console.log(`\x1b[32m📡 管理端口: ${SECURITY_CONFIG.webAdminPort}\x1b[0m`);
    }
    
    console.log(`\x1b[32m📝 配置方式: ✅ 直接定义在ai.js中\x1b[0m`);
    console.log('\x1b[32m└─ ✅ 初始化完成\x1b[0m');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * 消息处理主函数
   */
  async handleMessage(e) {
    try {
      const chatStream = StreamLoader.getStream('chat');
      if (chatStream) {
        chatStream.recordMessage(e);
      }

      if (await this.shouldTriggerAI(e)) {
        return await this.processAI(e);
      }
    } catch (error) {
      console.error(`\x1b[31m【风云AI】消息处理错误: ${error.message}\x1b[0m`);
    }

    return false;
  }

  /**
   * 判断是否应该触发AI响应
   */
  async shouldTriggerAI(e) {
    // 检查用户是否在黑名单中
    if (isUserBlacklisted(e.user_id)) {
      console.log(`\x1b[33m【风云AI】用户 ${e.user_id} 在黑名单中，跳过响应\x1b[0m`);
      return false;
    }
    
    // 检查是否在白名单中
    const isInWhitelist = () => {
      if (e.isGroup) {
        const groups = Array.isArray(WHITELIST.groups) ? WHITELIST.groups : [];
        return groups.includes(Number(e.group_id));
      } else {
        const users = Array.isArray(WHITELIST.users) ? WHITELIST.users : [];
        return users.includes(Number(e.user_id));
      }
    };

    // 场景1: @bot触发
    if (e.atBot) {
      return isInWhitelist();
    }

    // 场景2: 触发前缀触发
    const prefix = TRIGGER_CONFIG.prefix;
    if (prefix && e.msg && e.msg.startsWith(prefix)) {
      return isInWhitelist();
    }

    // 场景3: 全局AI触发（仅限群聊）- 简化版：只判断概率
    if (!e.isGroup) return false;

    const groupIdNum = Number(e.group_id);
    const globalGroups = Array.isArray(WHITELIST.globalGroups) ? WHITELIST.globalGroups : [];
    if (!globalGroups.includes(groupIdNum)) {
      return false;
    }

    const groupId = e.group_id;
    const state = this.globalAIState.get(groupId) || {
      lastTrigger: 0,
    };

    const now = Date.now();
    const cooldown = (TRIGGER_CONFIG.globalAICooldown || 3) * 1000;
    const chance = TRIGGER_CONFIG.globalAIChance || 0.3;

    // 简化判断：只需冷却时间已过，并且随机数小于概率
    const canTrigger = now - state.lastTrigger > cooldown && Math.random() < chance;

    if (canTrigger) {
      state.lastTrigger = now;
      this.globalAIState.set(groupId, state);
      return true;
    }

    return false;
  }

  /**
   * AI处理主函数
   */
  async processAI(e) {
    try {
      const chatStream = StreamLoader.getStream('chat');
      if (!chatStream) {
        console.error('\x1b[31m【风云AI】聊天工作流未加载\x1b[0m');
        return false;
      }

      const prefix = TRIGGER_CONFIG.prefix;
      const isGlobalTrigger = !e.atBot && (!prefix || !e.msg?.startsWith(prefix));

      // 处理消息内容（包括识图）
      let question = await this.processMessageContent(e, chatStream);

      // 如果非全局触发且无有效内容，回复提示
      if (!isGlobalTrigger && !question.content && !question.imageDescriptions?.length) {
        if (typeof chatStream.getRandomEmotionImage === 'function') {
          const emotionImage = chatStream.getRandomEmotionImage('惊讶');
          if (emotionImage) {
            await e.reply(segment.image(emotionImage));
            await BotUtil.sleep(300);
          }
        }
        await e.reply('有什么需要帮助的吗？');
        return true;
      }

      // 清理无效字符
      if (question.content) {
        question.content = cleanInvalidCharacters(question.content);
        question.text = cleanInvalidCharacters(question.text);
      }
      
      if (question.imageDescriptions) {
        question.imageDescriptions = question.imageDescriptions.map(desc => 
          cleanInvalidCharacters(desc)
        ).filter(desc => desc);
      }

      // 构建问题对象
      const questionObj = {
        ...question,
        persona: PERSONA,
        isGlobalTrigger
      };

      let result;
      try {
        // 执行聊天工作流
        result = await chatStream.execute(e, questionObj, API_CONFIG);
      } catch (aiError) {
        console.error(`\x1b[31m【风云AI】AI调用失败: ${aiError.message}\x1b[0m`);
        
        if (aiError.message.includes('Invalid character') || aiError.message.includes('invalid char')) {
          console.log('\x1b[33m【风云AI】检测到无效字符错误，尝试清理后重试...\x1b[0m');
          
          const cleanedQuestionObj = { ...questionObj };
          if (cleanedQuestionObj.content) {
            cleanedQuestionObj.content = cleanedQuestionObj.content
              .replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '')
              .trim();
            cleanedQuestionObj.text = cleanedQuestionObj.content;
          }
          
          try {
            result = await chatStream.execute(e, cleanedQuestionObj, API_CONFIG);
          } catch (retryError) {
            console.error(`\x1b[31m【风云AI】重试后仍然失败: ${retryError.message}\x1b[0m`);
            if (!isGlobalTrigger) {
              await e.reply('AI调用失败，请稍后再试~');
            }
            return true;
          }
        } else {
          if (!isGlobalTrigger) {
            await e.reply('AI调用失败，请稍后再试~');
          }
          return true;
        }
      }

      if (!result) {
        if (isGlobalTrigger) {
          return false;
        }
        return true;
      }

      // 清理AI返回结果中的无效字符
      if (result.messages) {
        result.messages = result.messages.map(msg => {
          if (msg.content) {
            msg.content = cleanInvalidCharacters(msg.content);
          }
          return msg;
        });
      }

      // 发送AI回复消息
      await chatStream.sendMessages(e, result);

      return true;
    } catch (error) {
      console.error(`\x1b[31m【风云AI】AI处理失败: ${error.message}\x1b[0m`);
      
      const prefix = TRIGGER_CONFIG.prefix;
      
      if (!e.atBot && (!prefix || !e.msg?.startsWith(prefix))) {
        try {
          await e.reply('AI处理遇到问题，请稍后再试哦~');
        } catch (replyError) {
          console.error(`\x1b[31m【风云AI】回复错误信息失败: ${replyError.message}\x1b[0m`);
        }
      }
      return false;
    }
  }

  /**
   * 处理消息内容（包括文本、@、回复、图片识别）
   */
  async processMessageContent(e, chatStream) {
    let content = '';
    const imageDescriptions = [];
    const message = e.message;

    if (!Array.isArray(message)) {
      const rawText = e.msg || '';
      return { 
        content: cleanInvalidCharacters(rawText), 
        text: cleanInvalidCharacters(rawText) 
      };
    }

    try {
      // 处理回复消息
      if (e.source && e.getReply) {
        try {
          const reply = await e.getReply();
          if (reply) {
            const nickname = reply.sender?.card || reply.sender?.nickname || '未知';
            const replyText = reply.raw_message?.substring(0, 30) || '';
            content += `[回复${nickname}的"${replyText}..."] `;

            if (Array.isArray(reply.message)) {
              for (const replySeg of reply.message) {
                if (replySeg.type === 'image' && VISION_CONFIG.enabled && VISION_CONFIG.apiKey) {
                  const imageUrl = replySeg.url || replySeg.file;
                  if (imageUrl) {
                    console.log(`\x1b[36m【风云AI-识图】检测到回复消息中的图片: ${imageUrl}\x1b[0m`);
                    const desc = await this.processImage(imageUrl);
                    imageDescriptions.push(`[回复图片:${desc}]`);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`\x1b[31m【风云AI】处理回复消息失败: ${error.message}\x1b[0m`);
        }
      }

      // 处理当前消息的各个消息段
      for (const seg of message) {
        switch (seg.type) {
          case 'text':
            content += seg.text;
            break;

          case 'at':
            if (seg.qq != e.self_id) {
              try {
                const member = e.group?.pickMember(seg.qq);
                const info = await member?.getInfo();
                const nickname = info?.card || info?.nickname || seg.qq;
                content += `@${nickname} `;
              } catch {
                content += `@${seg.qq} `;
              }
            }
            break;

          case 'image':
            if (VISION_CONFIG.enabled && VISION_CONFIG.apiKey) {
              const imageUrl = seg.url || seg.file;
              if (imageUrl) {
                console.log(`\x1b[36m【风云AI-识图】检测到消息图片: ${imageUrl}\x1b[0m`);
                const desc = await this.processImage(imageUrl);
                imageDescriptions.push(`[图片:${desc}]`);
              }
            } else {
              content += '[图片] ';
            }
            break;
        }
      }

      // 移除触发前缀
      const prefix = TRIGGER_CONFIG.prefix;
      if (prefix) {
        content = content.replace(new RegExp(`^${prefix}`), '');
      }

      return {
        content: cleanInvalidCharacters(content.trim()),
        text: cleanInvalidCharacters(content.trim()),
        imageDescriptions
      };
    } catch (error) {
      console.error(`\x1b[31m【风云AI】处理消息内容失败: ${error.message}\x1b[0m`);
      return { content: e.msg || '', text: e.msg || '' };
    }
  }

  /**
   * 处理图片识别（使用独立识图配置）
   */
  async processImage(imageUrl) {
    if (!imageUrl || !VISION_CONFIG.enabled || !VISION_CONFIG.apiKey) {
      return '识图功能未启用或未配置API密钥';
    }

    let tempFilePath = null;
    try {
      // 1) 下载图片到本地临时目录
      tempFilePath = await this.downloadImage(imageUrl);

      // 2) 上传图片到文件服务
      let uploadedUrl = imageUrl; // 默认使用原始URL
      
      if (VISION_CONFIG.uploadEnabled && VISION_CONFIG.uploadUrl) {
        uploadedUrl = await this.uploadImageToAPI(tempFilePath);
      }

      // 3) 调用识图API
      const messages = [
        { role: 'system', content: VISION_CONFIG.systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: uploadedUrl }
            }
          ]
        }
      ];

      const result = await this.callVisionAPI(messages);
      return result || '识图失败';
    } catch (error) {
      console.error(`\x1b[31m【风云AI-识图】图片处理失败: ${error.message}\x1b[0m`);
      return '图片处理失败';
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.error(`\x1b[31m【风云AI】清理临时文件失败: ${err.message}\x1b[0m`);
        }
      }
    }
  }

  /**
   * 下载图片到本地临时目录
   */
  async downloadImage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      const filename = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
      const filePath = path.join(TEMP_IMAGE_DIR, filename);

      const streamPipeline = promisify(pipeline);
      await streamPipeline(response.body, fs.createWriteStream(filePath));

      return filePath;
    } catch (error) {
      throw new Error(`图片下载失败: ${error.message}`);
    }
  }

  /**
   * 上传图片到API（使用独立识图配置）
   */
  async uploadImageToAPI(filePath) {
    if (!VISION_CONFIG.uploadUrl) {
      throw new Error('未配置文件上传URL');
    }

    try {
      const form = new FormData();
      const fileBuffer = await fs.promises.readFile(filePath);

      form.append('file', fileBuffer, {
        filename: path.basename(filePath),
        contentType: 'image/png'
      });

      const apiKey = VISION_CONFIG.apiKey;
      if (!apiKey) {
        throw new Error('未配置识图API密钥');
      }

      const response = await fetch(VISION_CONFIG.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        },
        body: form
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`上传失败: ${response.status} ${response.statusText}${text ? ` | ${text}` : ''}`);
      }

      const result = await response.json().catch(() => ({}));
      const finalUrl =
        result?.data?.url ??
        (Array.isArray(result?.data) ? result.data[0]?.url : undefined) ??
        result?.url;

      if (!finalUrl) {
        throw new Error(`上传成功但未返回URL，响应: ${JSON.stringify(result)}`);
      }

      return finalUrl;
    } catch (error) {
      throw new Error(`图片上传失败: ${error.message}`);
    }
  }

  /**
   * 调用识图API（使用独立识图配置）
   */
  async callVisionAPI(messages) {
    try {
      const baseUrl = VISION_CONFIG.apiBaseUrl;
      const apiKey = VISION_CONFIG.apiKey;
      
      if (!apiKey) {
        throw new Error('未配置识图API密钥');
      }

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: VISION_CONFIG.model,
          messages,
          temperature: VISION_CONFIG.temperature,
          max_tokens: VISION_CONFIG.max_tokens
        }),
        signal: AbortSignal.timeout(VISION_CONFIG.timeout)
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`API错误: ${resp.status} ${resp.statusText}${text ? ` | ${text}` : ''}`);
      }

      const data = await resp.json();
      return data?.choices?.[0]?.message?.content || null;
    } catch (error) {
      throw new Error(`识图API调用失败: ${error.message}`);
    }
  }
}