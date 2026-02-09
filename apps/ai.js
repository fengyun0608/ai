import plugin from '../../../lib/plugins/plugin.js';
import Bot from '../../../lib/bot.js';
import BotUtil from '../../../lib/common/util.js';
import StreamLoader from '../../../lib/aistream/loader.js';
import configManager from '../model/config.js';
import aiLogic, { cleanInvalidCharacters } from '../model/ai-logic.js';
import { loadWebAdmin, getWebAdminState, getOuterIp, generateRandomCode } from '../model/web-admin.js';
import { getPersona } from '../model/persona.js';

export class XRKAIAssistant extends plugin {
  constructor() {
    super({
      name: '风云-AI助手',
      dsc: '智能AI助手，支持群管理、识图、语义检索、网页管理端配置',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: /^#ai菜单$/, fnc: 'showMenu', log: true },
        { reg: /^#ai配置(登陆|登录)$/, fnc: 'sendConfigUrl', log: true },
        { reg: /^#ai状态$/, fnc: 'showStatus', log: true },
        { reg: /^#ai配置查看$/, fnc: 'showConfig', log: true },
        { reg: /^#加入本群ai$/, fnc: 'addGroupToWhitelist', event: 'message.group', log: true },
        { reg: /^#关闭本群ai$/, fnc: 'removeGroupFromWhitelist', event: 'message.group', log: true },
        { reg: /^#开启全局ai$/, fnc: 'enableGlobalAI', event: 'message.group', log: true },
        { reg: /^#关闭全局ai$/, fnc: 'disableGlobalAI', event: 'message.group', log: true },
        { reg: /^#ai拉黑 @/, fnc: 'blacklistUser', event: 'message.group', log: true },
        { reg: /^#ai拉白 @/, fnc: 'whitelistUser', event: 'message.group', log: true },
        { reg: /^#配置ai接口(.*)$/, fnc: 'setAIInterface', log: true },
        { reg: /^#配置ai密钥(.*)$/, fnc: 'setAIKey', log: true },
        { reg: /^#设置ai模型(.*)$/, fnc: 'setAIModel', log: true },
        { reg: '.*', fnc: 'handleMessage', log: false }
      ]
    });
    this.globalAIState = new Map();
  }

  async sendConfigUrl(e) {
    if (!e.isMaster) {
      await e.reply('❌ 只有主人才能触发该指令哦！');
      return true;
    }

    const state = getWebAdminState();
    if (!state.webAdminLoaded) {
      await e.reply('⚠️ 网页管理端未加载，正在尝试重新加载...');
      const reloadSuccess = await loadWebAdmin();
      if (!reloadSuccess) {
        await e.reply(`❌ 网页管理端加载失败: ${state.webAdminError || '未知错误'}`);
        return true;
      }
    }

    const securityConfig = configManager.getConfigValue('securityConfig');
    const tempCode = generateRandomCode();
    const expireTime = Date.now() + (securityConfig?.tempCodeExpire || 300) * 1000;
    
    securityConfig.tempCodes = securityConfig.tempCodes || {};
    securityConfig.tempCodes[tempCode] = { used: false, expire: expireTime, type: 'access' };
    configManager.updateConfig('securityConfig.tempCodes', securityConfig.tempCodes);
    
    const outerIp = securityConfig?.outerIp || await getOuterIp();
    const webAdminPort = securityConfig?.webAdminPort || 54188;
    const configUrl = `http://${outerIp}:${webAdminPort}/?code=${tempCode}`;

    const senderQQ = e.user_id.toString().trim();
    const instanceNote = state.isAnotherInstanceRunning ? '\n⚠️ 注意：检测到服务已在另一处运行' : '';
    
    const msgContent = [
      `【风云AI配置地址】`,
      `⚠️ 临时登陆地址（5分钟内有效）：`,
      `${configUrl}`,
      `💡 复制后浏览器打开即可进入配置页`,
      `📌 外网IP: ${outerIp}`,
      `📌 端口: ${webAdminPort}`,
      instanceNote,
      `📌 若无法访问，请检查服务器${webAdminPort}端口是否开放`
    ].join('\n');

    try {
      let sent = false;
      if (e.bot?.pickFriend) {
        const friend = e.bot.pickFriend(senderQQ);
        if (friend?.sendMsg) {
          await friend.sendMsg(msgContent);
          sent = true;
        }
      }
      if (!sent && Bot?.sendFriendMsg) {
        const botId = Bot.uin?.[0] || e.self_id;
        await Bot.sendFriendMsg(botId, senderQQ, msgContent);
        sent = true;
      }

      if (sent) {
        await e.reply('ai配置地址已经发到主人私信了~❤️');
      } else {
        await e.reply(`【风云AI配置地址】\nhttp://127.0.0.1:${webAdminPort}/?code=${tempCode}\n💡 仅限本地访问`);
      }
    } catch (error) {
      await e.reply(`❌ 发送失败: ${error.message}`);
    }
    return true;
  }

  async showStatus(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能查看状态！');
    
    const apiConfig = configManager.getConfigValue('apiConfig');
    const visionConfig = configManager.getConfigValue('visionConfig');
    const whitelist = configManager.getConfigValue('whitelist');
    const blacklist = configManager.getConfigValue('blacklist');
    const triggerConfig = configManager.getConfigValue('triggerConfig');
    const embeddingConfig = configManager.getConfigValue('embeddingConfig');
    const securityConfig = configManager.getConfigValue('securityConfig');
    const state = getWebAdminState();

    let webAdminStatus = state.webAdminLoaded ? `✅ 已加载 (端口: ${securityConfig?.webAdminPort || 54188})` : '❌ 未加载';
    if (state.isAnotherInstanceRunning) webAdminStatus = `✅ 已由另一处运行 (端口: ${securityConfig?.webAdminPort || 54188})`;

    const statusMsg = [
      '🤖 风云AI助手状态',
      '━━━━━━━━━━━━━━━━━━━━━━',
      `🔑 聊天API: ${apiConfig.apiKey ? '✅' : '❌'}`,
      `🔑 识图API: ${visionConfig.apiKey ? '✅' : '❌'}`,
      `🤖 聊天模型: ${apiConfig.chatModel || '未配置'}`,
      `👁️ 识图模型: ${visionConfig.model || '未配置'}`,
      `📸 识图功能: ${visionConfig.enabled ? '✅' : '❌'}`,
      `🌐 白名单群: ${whitelist.groups?.length || 0}个`,
      `👥 全局AI群: ${whitelist.globalGroups?.length || 0}个`,
      `🚫 黑名单用户: ${blacklist.users?.length || 0}个`,
      `💬 触发前缀: "${triggerConfig.prefix || '无'}"`,
      `🔍 语义检索: ${embeddingConfig.enabled ? '✅' : '❌'}`,
      `🌐 网页管理: ${webAdminStatus}`,
      `⏱️ 最后更新: ${new Date().toLocaleString('zh-CN')}`,
      '━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');
    
    await e.reply(statusMsg);
    return true;
  }

  async showMenu(e) {
    const triggerConfig = configManager.getConfigValue('triggerConfig');
    const menuMsg = [
      '🤖 风云AI助手 - 指令菜单',
      '━━━━━━━━━━━━━━━━━━━━━━',
      '📋 基础指令: #ai菜单, #ai状态, #ai配置查看, #ai配置登陆',
      '📊 群管理: #加入本群ai, #关闭本群ai, #开启全局ai, #关闭全局ai',
      '👥 用户管理: #ai拉黑 @用户, #ai拉白 @用户',
      '⚙️ 配置: #配置ai接口, #配置ai密钥, #设置ai模型',
      '━━━━━━━━━━━━━━━━━━━━━━',
      `📌 当前触发前缀: "${triggerConfig.prefix || '无'}"`
    ].join('\n');
    await e.reply(menuMsg);
    return true;
  }

  async showConfig(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能查看配置！');
    const apiConfig = configManager.getConfigValue('apiConfig');
    const visionConfig = configManager.getConfigValue('visionConfig');
    const triggerConfig = configManager.getConfigValue('triggerConfig');
    const embeddingConfig = configManager.getConfigValue('embeddingConfig');
    
    const configMsg = [
      '⚙️ 风云AI助手 - 当前配置',
      '━━━━━━━━━━━━━━━━━━━━━━',
      '📡 聊天API',
      `地址: ${apiConfig.baseUrl}`,
      `模型: ${apiConfig.chatModel}`,
      '',
      '👁️ 识图配置',
      `地址: ${visionConfig.apiBaseUrl}`,
      `模型: ${visionConfig.model}`,
      `启用: ${visionConfig.enabled ? '✅' : '❌'}`,
      '',
      '💬 触发配置',
      `前缀: "${triggerConfig.prefix}"`,
      `冷却: ${triggerConfig.globalAICooldown}秒`,
      `概率: ${triggerConfig.globalAIChance * 100}%`,
      '',
      '🔍 语义检索',
      `启用: ${embeddingConfig.enabled ? '✅' : '❌'}`
    ].join('\n');
    await e.reply(configMsg);
    return true;
  }

  async addGroupToWhitelist(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    const groups = configManager.getConfigValue('whitelist.groups') || [];
    const groupId = Number(e.group_id);
    if (groups.includes(groupId)) return e.reply('✅ 本群已在白名单中！');
    groups.push(groupId);
    configManager.updateConfig('whitelist.groups', groups);
    await e.reply('✅ 已将本群添加到AI白名单！');
    return true;
  }

  async removeGroupFromWhitelist(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    let groups = configManager.getConfigValue('whitelist.groups') || [];
    const groupId = Number(e.group_id);
    if (!groups.includes(groupId)) return e.reply('✅ 本群不在白名单中！');
    groups = groups.filter(id => id !== groupId);
    configManager.updateConfig('whitelist.groups', groups);
    await e.reply('✅ 已将本群从AI白名单移除！');
    return true;
  }

  async enableGlobalAI(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    const globalGroups = configManager.getConfigValue('whitelist.globalGroups') || [];
    const groupId = Number(e.group_id);
    if (globalGroups.includes(groupId)) return e.reply('✅ 本群已开启全局AI！');
    globalGroups.push(groupId);
    configManager.updateConfig('whitelist.globalGroups', globalGroups);
    await e.reply('✅ 已为本群开启全局AI！');
    return true;
  }

  async disableGlobalAI(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    let globalGroups = configManager.getConfigValue('whitelist.globalGroups') || [];
    const groupId = Number(e.group_id);
    if (!globalGroups.includes(groupId)) return e.reply('✅ 本群未开启全局AI！');
    globalGroups = globalGroups.filter(id => id !== groupId);
    configManager.updateConfig('whitelist.globalGroups', globalGroups);
    await e.reply('✅ 已为本群关闭全局AI！');
    return true;
  }

  async blacklistUser(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    if (!e.at) return e.reply('❌ 请@要拉黑的用户！');
    const blacklist = configManager.getConfigValue('blacklist.users') || [];
    const userId = Number(e.at);
    if (blacklist.includes(userId)) return e.reply('✅ 该用户已在黑名单中！');
    blacklist.push(userId);
    configManager.updateConfig('blacklist.users', blacklist);
    await e.reply('✅ 已将该用户添加到AI黑名单！');
    return true;
  }

  async whitelistUser(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    if (!e.at) return e.reply('❌ 请@要拉白的用户！');
    let blacklist = configManager.getConfigValue('blacklist.users') || [];
    const userId = Number(e.at);
    if (!blacklist.includes(userId)) return e.reply('✅ 该用户不在黑名单中！');
    blacklist = blacklist.filter(id => id !== userId);
    configManager.updateConfig('blacklist.users', blacklist);
    await e.reply('✅ 已将该用户从AI黑名单移除！');
    return true;
  }

  async setAIInterface(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    const apiUrl = e.msg.replace(/^#配置ai接口/, '').trim();
    if (!apiUrl) return e.reply('❌ 请输入接口地址！');
    configManager.updateConfig('apiConfig.baseUrl', apiUrl);
    configManager.updateConfig('visionConfig.apiBaseUrl', apiUrl);
    configManager.updateConfig('visionConfig.uploadUrl', `${apiUrl}/file`);
    await e.reply(`✅ AI接口已配置为：${apiUrl}`);
    return true;
  }

  async setAIKey(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    const apiKey = e.msg.replace(/^#配置ai密钥/, '').trim();
    if (!apiKey) return e.reply('❌ 请输入密钥！');
    configManager.updateConfig('apiConfig.apiKey', apiKey);
    configManager.updateConfig('visionConfig.apiKey', apiKey);
    await e.reply('✅ AI密钥已配置成功！');
    return true;
  }

  async setAIModel(e) {
    if (!e.isMaster) return e.reply('❌ 只有主人才能操作！');
    const model = e.msg.replace(/^#设置ai模型/, '').trim();
    if (!model) return e.reply('❌ 请输入模型名称！');
    configManager.updateConfig('apiConfig.chatModel', model);
    await e.reply(`✅ AI模型已设置为：${model}`);
    return true;
  }

  async handleMessage(e) {
    const chatStream = StreamLoader.getStream('chat');
    if (chatStream) chatStream.recordMessage(e);

    const shouldTrigger = await this.shouldTriggerAI(e);
    if (shouldTrigger) {
      return await this.processAI(e);
    }
    return false;
  }

  async shouldTriggerAI(e) {
    const blacklist = configManager.getConfigValue('blacklist.users') || [];
    if (blacklist.includes(Number(e.user_id))) {
      console.log(`\x1b[33m【风云AI】用户 ${e.user_id} 在黑名单中，跳过\x1b[0m`);
      return false;
    }

    const whitelist = configManager.getConfigValue('whitelist');
    const isInWhitelist = () => {
      if (e.isMaster) return true; // 主人默认白名单
      if (e.isGroup) {
        const result = (whitelist.groups || []).includes(Number(e.group_id));
        if (!result) console.log(`\x1b[33m【风云AI】群 ${e.group_id} 不在白名单中\x1b[0m`);
        return result;
      }
      // 私聊默认允许，除非在黑名单（前面已检查黑名单）
      const result = (whitelist.users || []).includes(Number(e.user_id));
      if (!result && whitelist.users?.length > 0) {
        console.log(`\x1b[33m【风云AI】用户 ${e.user_id} 不在白名单中\x1b[0m`);
        return result;
      }
      return true; // 如果白名单为空，私聊默认通过
    };

    const triggerConfig = configManager.getConfigValue('triggerConfig');
    
    // 私聊默认触发 (只要不是黑名单且符合白名单逻辑)
    if (!e.isGroup) {
      // 如果私聊设置了必须前缀
      if (triggerConfig.prefix && e.msg?.startsWith(triggerConfig.prefix)) {
        console.log(`\x1b[36m【风云AI】私聊前缀触发: ${triggerConfig.prefix}\x1b[0m`);
        return isInWhitelist();
      }
      // 如果没有前缀，或者消息不带前缀，但我们希望私聊总是响应
      if (!triggerConfig.prefix || !e.msg?.startsWith(triggerConfig.prefix)) {
         // 只有当消息不是以 # 开头（避免冲突）时才自动触发，或者是主人
         if (e.isMaster || !e.msg?.startsWith('#')) {
           console.log(`\x1b[36m【风云AI】私聊自动触发\x1b[0m`);
           return isInWhitelist();
         }
      }
    }

    // AT 触发
    if (e.atBot) {
      console.log(`\x1b[36m【风云AI】检测到 AT 触发\x1b[0m`);
      return isInWhitelist();
    }
    
    // 前缀触发
    if (triggerConfig.prefix && e.msg?.startsWith(triggerConfig.prefix)) {
      console.log(`\x1b[36m【风云AI】检测到前缀触发: ${triggerConfig.prefix}\x1b[0m`);
      return isInWhitelist();
    }

    // 全局/随机触发 (仅限群聊)
    if (e.isGroup) {
      const globalGroups = whitelist.globalGroups || [];
      if (globalGroups.includes(Number(e.group_id))) {
        const state = this.globalAIState.get(e.group_id) || { lastTrigger: 0 };
        const now = Date.now();
        const cooldown = (triggerConfig.globalAICooldown || 3) * 1000;
        
        if (now - state.lastTrigger > cooldown) {
          if (Math.random() < (triggerConfig.globalAIChance || 0.3)) {
            console.log(`\x1b[36m【风云AI】群 ${e.group_id} 命中全局随机触发\x1b[0m`);
            state.lastTrigger = now;
            this.globalAIState.set(e.group_id, state);
            return true;
          }
        }
      }
    }
    return false;
  }

  async processAI(e) {
    try {
      const chatStream = StreamLoader.getStream('chat');
      if (!chatStream) {
        console.log('\x1b[31m【风云AI】未找到 chat 工作流，请检查 plugins/stream/chat.js 是否正常加载\x1b[0m');
        return false;
      }

      const triggerConfig = configManager.getConfigValue('triggerConfig');
      const isGlobalTrigger = !e.atBot && (!triggerConfig.prefix || !e.msg?.startsWith(triggerConfig.prefix));

      console.log(`\x1b[36m【风云AI】正在处理 AI 请求 (全局触发: ${isGlobalTrigger})\x1b[0m`);
      
      const question = await aiLogic.processMessageContent(e, chatStream);
      if (!isGlobalTrigger && !question.content && !question.imageDescriptions?.length) {
        console.log('\x1b[33m【风云AI】消息内容为空，且不是全局触发，回复默认提示\x1b[0m');
        await e.reply('有什么需要帮助的吗？');
        return true;
      }

      const questionObj = {
        ...question,
        persona: getPersona(),
        isGlobalTrigger
      };

      const apiConfig = configManager.getConfigValue('apiConfig');
      if (!apiConfig.apiKey) {
        console.log('\x1b[31m【风云AI】未配置 API Key，请使用 #配置ai密钥 [key] 进行配置\x1b[0m');
        if (!isGlobalTrigger) await e.reply('❌ 未配置 AI 密钥，请联系管理员配置。');
        return true;
      }

      console.log(`\x1b[36m【风云AI】调用 AI 接口: ${apiConfig.chatModel}\x1b[0m`);
      let result;
      for (let i = 0; i < 3; i++) {
        try {
          result = await chatStream.execute(e, questionObj, apiConfig);
          if (result) break;
        } catch (err) {
          console.error(`\x1b[31m【风云AI】第 ${i + 1} 次尝试失败: ${err.message}\x1b[0m`);
          if (i === 2) throw err;
          await BotUtil.sleep(1000 * (i + 1));
        }
      }

      if (result) {
        console.log(`\x1b[32m【风云AI】AI 响应成功，正在发送消息\x1b[0m`);
        const cleanResult = cleanInvalidCharacters(result);
        await chatStream.sendMessages(e, cleanResult);
      } else {
        console.log('\x1b[33m【风云AI】AI 未返回有效结果\x1b[0m');
      }
      return true;
    } catch (error) {
      console.error(`\x1b[31m【风云AI】AI 处理失败: ${error.message}\x1b[0m`);
      console.error(error.stack);
      return false;
    }
  }
}
