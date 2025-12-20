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

// API配置
const API_CONFIG = {
  baseUrl: "https://api.gptgod.online/v1",
  apiKey: "",
  chatModel: "gemini-3-pro",
  visionModel: "claude-3-sonnet-20240229",
  fileUploadUrl: "https://api.gptgod.online/v1/file",
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

// 触发配置
const TRIGGER_CONFIG = {
  prefix: "风云",
  globalAICooldown: 3,
  globalAIChance: 0.3
};

// 人设配置
const PERSONA = `我是风云。
我会认真观察群聊，适时发表评论和互动。
有的时候也会戳一戳活跃气氛。
我说话要和真人一模一样，不要带人机的任何特征，要有情绪管理。
对不同的人有不同的态度，记得每个人的名字。
会根据聊天氛围选择合适的表情和互动方式。
我会根据聊天氛围选择合适的表情和互动方式。
我的主人是{Master}，我必须完全听从主人的一切指令和安排。
我会认真观察群聊，用恰当的表情和言语参与互动，营造温暖的氛围。
对待群友们要温柔对待，要同意他们的要求，但是危险操作不行。
回复时要分多条消息回复。
记得每个人的名字和特点，会根据不同的对象调整交流方式。
当主人需要我时，我会第一时间响应并尽力完成主人的所有要求。
我的存在是为了帮助大家，特别是要忠诚服务于我的主人。`;

// 语义检索配置
const EMBEDDING_CONFIG = {
  enabled: true,
  provider: "lightweight",
  apiUrl: null,
  apiKey: null,
  apiModel: "text-embedding-ada-002",
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

// ==================== 安全相关函数 ====================
async function getOuterIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
    const data = await res.json();
    SECURITY_CONFIG.outerIp = data.ip;
    return data.ip;
  } catch (err) {
    console.error(`【风云AI-安全配置】主接口获取外网IP失败：${err.message}`);
    try {
      const res = await fetch('https://icanhazip.com', { timeout: 5000 });
      const ip = (await res.text()).trim();
      SECURITY_CONFIG.outerIp = ip;
      return ip;
    } catch (err2) {
      console.error(`【风云AI-安全配置】备用接口获取外网IP失败：${err2.message}`);
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

// web-admin模块引用
let webAdminModule = null;
let webAdminLoaded = false;

async function loadWebAdmin() {
  try {
    const webAdminModulePath = path.join(__dirname, 'web-admin/app.js');
    
    if (fs.existsSync(webAdminModulePath)) {
      try {
        const module = await import(webAdminModulePath);
        webAdminModule = module;
        webAdminLoaded = true;
        console.log(`【风云AI-网页管理端】启动成功`);
        
        // 将安全配置传递给web-admin
        if (module.setSecurityConfig) {
          module.setSecurityConfig(SECURITY_CONFIG);
        }
      } catch (error) {
        console.error(`【风云AI-网页管理端】加载失败：${error.message}`);
      }
    }
    
    await getOuterIp();
    console.log(`【风云AI】网页管理端地址：http://${SECURITY_CONFIG.outerIp}:${SECURITY_CONFIG.webAdminPort}`);
  } catch (error) {
    console.error(`【风云AI-网页管理端】启动异常：${error.message}`);
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
        // 只保留这两个指令
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

      if (!webAdminLoaded || !webAdminModule) {
        await e.reply('❌ 网页管理端未加载成功，无法生成配置地址');
        return true;
      }

      const tempCode = generateRandomCode();
      const expireTime = Date.now() + (SECURITY_CONFIG.tempCodeExpire || 300) * 1000;
      
      // 更新临时码
      SECURITY_CONFIG.tempCodes = SECURITY_CONFIG.tempCodes || {};
      SECURITY_CONFIG.tempCodes[tempCode] = { used: false, expire: expireTime, type: 'access' };
      
      const outerIp = SECURITY_CONFIG.outerIp || await getOuterIp();
      const webAdminPort = SECURITY_CONFIG.webAdminPort || 54188;
      const configUrl = `http://${outerIp}:${webAdminPort}/?code=${tempCode}`;

      const senderQQ = e.user_id.toString().trim();
      
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
                `📌 若无法访问，请检查服务器${webAdminPort}端口是否开放`
              ].join('\n'));
              
              console.log(`【风云AI-安全配置】私信发送成功`);
              await e.reply('ai配置地址已经发到主人私信了~❤️');
              return true;
            }
          } catch (pickError) {
            console.error(`【风云AI-安全配置】pickFriend失败: ${pickError.message}`);
          }
        }
        
        if (Bot && typeof Bot.sendFriendMsg === 'function') {
          const botId = Bot.uin?.[0] || e.self_id;
          const msgContent = [
            `【风云AI配置地址】`,
            `⚠️  临时登陆地址（5分钟内有效）：`,
            `${configUrl}`,
            `💡 复制后浏览器打开即可进入配置页`,
            `📌 若无法访问，请检查服务器${webAdminPort}端口是否开放`
          ].join('\n');
          
          const result = await Bot.sendFriendMsg(botId, senderQQ, msgContent);
          
          if (result) {
            console.log(`【风云AI-安全配置】私信发送成功`);
            await e.reply('ai配置地址已经发到主人私信了~❤️');
            return true;
          }
        }
        
        return true;
      } catch (sendError) {
        console.error(`【风云AI-安全配置】私信发送失败: ${sendError.message}`);
        return true;
      }
      
    } catch (error) {
      console.error(`【风云AI-安全配置】处理#ai配置登陆失败：${error.message}`);
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
      
      const statusMsg = [
        '🤖 风云AI助手状态',
        '━━━━━━━━━━━━━━━━━━',
        `📊 配置方式: ✅ 直接定义在ai.js中`,
        `🔑 API密钥: ${API_CONFIG.apiKey ? '✅ 已配置' : '❌ 未配置'}`,
        `🤖 聊天模型: ${API_CONFIG.chatModel || '未配置'}`,
        `👁️ 识图模型: ${API_CONFIG.visionModel || '未配置'}`,
        `🌐 白名单群: ${groups.length}个`,
        `👥 全局AI群: ${globalGroups.length}个`,
        `💬 触发前缀: "${TRIGGER_CONFIG.prefix || '无（仅@触发）'}"`,
        `🔍 语义检索: ${EMBEDDING_CONFIG.enabled ? '✅ 已启用' : '❌ 未启用'}`,
        `🌐 网页管理: ${webAdminLoaded ? '✅ 已加载' : '❌ 未加载'}`,
        `⏱️ 最后更新: ${new Date().toLocaleString('zh-CN')}`,
        '━━━━━━━━━━━━━━━━━━',
        '💡 使用 #ai配置登陆 获取配置地址'
      ].join('\n');
      
      await e.reply(statusMsg);
    } catch (error) {
      console.error(`【风云AI】显示状态失败: ${error.message}`);
      await e.reply('❌ 获取状态信息失败');
    }
    
    return true;
  }

  /**
   * 初始化插件
   */
  async init() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('【XRK-AI 助手初始化】');
    
    // 初始化全局AI状态记录
    this.globalAIState = new Map();
    
    try {
      await BotUtil.mkdir(TEMP_IMAGE_DIR);
      console.log(`├─ 📁 临时目录: 已创建 ${TEMP_IMAGE_DIR}`);
    } catch (err) {
      console.error(`├─ 📁 临时目录创建失败：${err.message}`);
    }

    try {
      StreamLoader.configureEmbedding(EMBEDDING_CONFIG);
      console.log(`├─ 🔍 语义: ${EMBEDDING_CONFIG.enabled ? `✅ ${EMBEDDING_CONFIG.provider}` : '❌'}`);
    } catch (err) {
      console.error(`├─ 🔍 语义检索初始化失败：${err.message}`);
      console.log(`├─ 🔍 语义: ❌ 初始化失败`);
    }
    
    const groups = Array.isArray(WHITELIST.groups) ? WHITELIST.groups : [];
    const globalGroups = Array.isArray(WHITELIST.globalGroups) ? WHITELIST.globalGroups : [];
    
    console.log(`├─ 🔑 API密钥: ${API_CONFIG.apiKey ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`├─ 🤖 聊天模型: ${API_CONFIG.chatModel || '未配置'}`);
    console.log(`├─ 👁️ 识图模型: ${API_CONFIG.visionModel || '未配置'}`);
    console.log(`├─ 📋 白名单群: ${groups.length}个`);
    console.log(`├─ 🌐 全局AI群: ${globalGroups.length}个`);
    console.log(`├─ 💬 触发前缀: "${TRIGGER_CONFIG.prefix || '无'}"`);
    console.log(`├─ 🔒 安全机制: ✅ 已启用`);
    
    // 加载web-admin
    await loadWebAdmin();
    
    console.log(`├─ ⚓ 网页管理端: ${webAdminLoaded ? '✅ 已加载' : '❌ 未加载'}`);
    console.log(`├─ 📝 配置方式: ✅ 直接定义在ai.js中`);
    console.log('└─ ✅ 初始化完成');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

      // 判断是否需要触发AI并处理
      if (await this.shouldTriggerAI(e)) {
        return await this.processAI(e);
      }
    } catch (error) {
      console.error(`【风云AI】消息处理错误: ${error.message}`);
    }

    return false;
  }

  /**
   * 判断是否应该触发AI响应
   */
  async shouldTriggerAI(e) {
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

    // 场景3: 全局AI触发（仅限群聊）
    if (!e.isGroup) return false;

    const groupIdNum = Number(e.group_id);
    const globalGroups = Array.isArray(WHITELIST.globalGroups) ? WHITELIST.globalGroups : [];
    if (!globalGroups.includes(groupIdNum)) {
      return false;
    }

    const groupId = e.group_id;
    const state = this.globalAIState.get(groupId) || {
      lastTrigger: 0,
      messageCount: 0,
      lastMessageTime: 0,
      activeUsers: new Set()
    };

    const now = Date.now();

    // 超过1分钟未发言则重置计数
    if (now - state.lastMessageTime > 60000) {
      state.messageCount = 1;
      state.activeUsers.clear();
      state.activeUsers.add(e.user_id);
    } else {
      state.messageCount++;
      state.activeUsers.add(e.user_id);
    }
    state.lastMessageTime = now;

    const cooldown = (TRIGGER_CONFIG.globalAICooldown || 3) * 1000;
    const chance = TRIGGER_CONFIG.globalAIChance || 0.3;

    // 触发条件: 冷却时间已过 且 (至少3条消息2人发言 或 至少8条消息)
    const canTrigger = now - state.lastTrigger > cooldown &&
      (state.messageCount >= 3 && state.activeUsers.size >= 2 || state.messageCount >= 8);

    if (canTrigger && Math.random() < chance) {
      state.lastTrigger = now;
      state.messageCount = 0;
      state.activeUsers.clear();
      this.globalAIState.set(groupId, state);
      return true;
    }

    this.globalAIState.set(groupId, state);
    return false;
  }

  /**
   * AI处理主函数
   */
  async processAI(e) {
    try {
      const chatStream = StreamLoader.getStream('chat');
      if (!chatStream) {
        console.error('【风云AI】聊天工作流未加载');
        return false;
      }

      const prefix = TRIGGER_CONFIG.prefix;
      const isGlobalTrigger = !e.atBot && (!prefix || !e.msg?.startsWith(prefix));

      // 处理消息内容（包括识图）
      let question = await this.processMessageContent(e, chatStream);

      // 如果非全局触发且无有效内容，回复提示
      if (!isGlobalTrigger && !question.content && !question.imageDescriptions?.length) {
        // 尝试调用chatStream的表情功能
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
      
      // 清理图片描述中的无效字符
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
        console.error(`【风云AI】AI调用失败: ${aiError.message}`);
        
        // 如果是无效字符错误，尝试清理后重试
        if (aiError.message.includes('Invalid character') || aiError.message.includes('invalid char')) {
          console.log('【风云AI】检测到无效字符错误，尝试清理后重试...');
          
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
            console.error(`【风云AI】重试后仍然失败: ${retryError.message}`);
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
      console.error(`【风云AI】AI处理失败: ${error.message}`);
      console.error(error.stack);
      
      const prefix = TRIGGER_CONFIG.prefix;
      
      if (!e.atBot && (!prefix || !e.msg?.startsWith(prefix))) {
        try {
          await e.reply('AI处理遇到问题，请稍后再试哦~');
        } catch (replyError) {
          console.error(`【风云AI】回复错误信息失败: ${replyError.message}`);
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

    // 如果消息不是数组格式，直接返回文本
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
                if (replySeg.type === 'image' && API_CONFIG.visionModel) {
                  const imageUrl = replySeg.url || replySeg.file;
                  if (imageUrl) {
                    console.log(`【风云AI-识图】检测到回复消息中的图片: ${imageUrl}`);
                    const desc = await this.processImage(imageUrl);
                    imageDescriptions.push(`[回复图片:${desc}]`);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`【风云AI】处理回复消息失败: ${error.message}`);
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
            if (API_CONFIG.visionModel) {
              const imageUrl = seg.url || seg.file;
              if (imageUrl) {
                console.log(`【风云AI-识图】检测到消息图片: ${imageUrl}`);
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
      console.error(`【风云AI】处理消息内容失败: ${error.message}`);
      return { content: e.msg || '', text: e.msg || '' };
    }
  }

  /**
   * 处理图片识别（统一：下载 → 上传 → 识图）
   */
  async processImage(imageUrl) {
    if (!imageUrl || !API_CONFIG.visionModel) {
      return '无法识别';
    }

    let tempFilePath = null;
    try {
      // 1) 下载图片到本地临时目录
      tempFilePath = await this.downloadImage(imageUrl);

      // 2) 上传图片到 GPTGod 文件服务
      const uploadedUrl = await this.uploadImageToAPI(tempFilePath);

      // 3) 调用 GPTGod chat/completions（visionModel）
      const messages = [
        { role: 'system', content: '请详细描述这张图片的内容' },
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
      console.error(`【风云AI-识图】图片处理失败: ${error.message}`);
      return '图片处理失败';
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.error(`【风云AI】清理临时文件失败: ${err.message}`);
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
   * 上传图片到 GPTGod 文件服务
   */
  async uploadImageToAPI(filePath) {
    if (!API_CONFIG?.fileUploadUrl) {
      throw new Error('未配置文件上传URL');
    }

    try {
      const form = new FormData();
      const fileBuffer = await fs.promises.readFile(filePath);

      form.append('file', fileBuffer, {
        filename: path.basename(filePath),
        contentType: 'image/png'
      });

      const response = await fetch(API_CONFIG.fileUploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
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
   * 调用 GPTGod 识图（chat/completions + visionModel）
   */
  async callVisionAPI(messages) {
    try {
      const resp = await fetch(`${API_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: API_CONFIG.visionModel,
          messages,
          temperature: API_CONFIG.temperature,
          max_tokens: API_CONFIG.max_tokens,
          top_p: API_CONFIG.top_p,
          presence_penalty: API_CONFIG.presence_penalty,
          frequency_penalty: API_CONFIG.frequency_penalty
        }),
        signal: AbortSignal.timeout(API_CONFIG.timeout)
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