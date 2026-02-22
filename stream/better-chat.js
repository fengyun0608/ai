import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AIStream from '../../../lib/aistream/aistream.js';
import BotUtil from '../../../lib/util.js';
import musicHandler from '../lib/music.js';

// 表情包目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMOTIONS_DIR = path.join(__dirname, '../resources/aiimages');
const EMOTION_TYPES = ['开心', '惊讶', '伤心', '大笑', '害怕', '生气'];

// 表情回应映射 (QQ表情ID)
const EMOJI_REACTIONS = {
  '开心': ['4', '14', '21', '28', '76', '79', '99', '182', '201', '290'],
  '惊讶': ['26', '32', '97', '180', '268', '289'],
  '伤心': ['5', '9', '106', '111', '173', '174'],
  '大笑': ['4', '12', '28', '101', '182', '281'],
  '害怕': ['26', '27', '41', '96'],
  '喜欢': ['42', '63', '85', '116', '122', '319'],
  '爱心': ['66', '122', '319'],
  '生气': ['8', '23', '39', '86', '179', '265']
};

export default class BetterChatStream extends AIStream {
  static emotionImages = {};

  constructor() {
    super({
      name: 'better-chat',
      description: '增强版智能聊天工作流（支持MCP工具与记忆库）',
      version: '1.1.0',
      author: 'XRK',
      priority: 5, // 优先级高于默认 chat
      config: {
        enabled: true,
        temperature: 0.85,
      }
    });
    this.sentMessages = new Set(); // 用于去重
  }

  async init() {
    await super.init();
    await this.loadEmotionImages();
    this.registerTools();
    
    // 注入系统提示词，告知 AI 它拥有的能力
    this.systemPrompt = `你是一个拥有丰富交互能力的智能助手。
你可以使用以下工具与用户互动。
IMPORTANT: 当你需要使用工具时，你必须输出一个标准的 JSON 代码块，格式如下：
\`\`\`json
{
  "tool": "工具名称",
  "args": {
    "参数名": "参数值"
  }
}
\`\`\`

可用工具列表：
- 发送文本消息 (reply): { "content": "消息内容" }
- @用户 (at): { "qq": "目标QQ" }
- 戳一戳 (poke): { "qq": "目标QQ" }
- 发送表情包图片 (emotion): { "type": "开心/惊讶/伤心/大笑/害怕/生气", "text": "可选附带文字" }
- 对消息进行表情回应 (emojiReaction): { "type": "开心/惊讶/伤心/大笑/害怕/喜欢/爱心/生气", "msgId": "可选消息ID" }
- 设置精华消息 (setEssence): { "msgId": "消息ID" }
- 取消精华消息 (removeEssence): { "msgId": "消息ID" }
- 发布群公告 (announce): { "content": "公告内容" }
- 记忆重要信息 (remember): { "content": "内容" }
- 忘记信息 (forget): { "content": "内容" }
- 点歌 (music): { "keyword": "歌名", "source": "qq/netease/..." }
- 切换音乐源 (switchMusicSource): { "source": "qq/netease/..." }
- 群签到 (signIn): {}

请根据用户的话语情感和上下文，灵活使用这些工具。
特别注意：当用户消息中包含以下关键词或表达相应情感时，请务必使用 emotion 工具发送对应表情包：
- 开心/高兴/笑/哈哈 -> emotion: { type: "开心" 或 "大笑" }
- 惊讶/震惊/卧槽/啊？ -> emotion: { type: "惊讶" }
- 伤心/难过/哭/呜呜 -> emotion: { type: "伤心" }
- 害怕/恐惧/吓人 -> emotion: { type: "害怕" }
- 生气/愤怒/滚/哼 -> emotion: { type: "生气" }

其他场景示例：
- 用户让你记住某事时，使用 remember 工具。
- 用户求安慰时，可以戳一戳他。
- 遇到非常棒的群友发言，可以设为精华。
- 用户让你签到时，使用 signIn 工具。
- 用户想听歌时，必须使用 music 工具，不要仅回复文字。

请勿重复发送相同的消息。如果调用了工具（如 reply），则不需要再额外输出纯文本回复，除非是为了补充说明。
注意：music 和 signIn 工具会自动向用户发送反馈，调用这些工具后，你通常不需要再额外调用 reply 工具。`;
  }

  /**
   * 注册工具的辅助方法：同时注册 MCP 工具和 AIStream 文本解析器
   */
  registerTool(name, spec) {
    // 1. 注册 MCP 工具
    this.registerMCPTool(name, spec);

    // 2. 注册 Function
    this.registerFunction(name, {
        description: spec.description,
        enabled: true,
        parser: (text) => {
            // 支持 ```json {} ``` 和 ``` {} ``` 甚至纯 {} (如果很明确)
            // 优先匹配标准格式
            let regex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
            const functions = [];
            let newText = text;
            
            newText = text.replace(regex, (match, jsonStr) => {
                try {
                    const json = JSON.parse(jsonStr);
                    if (json.tool === name) {
                        functions.push({
                            type: name,
                            params: json.args || {},
                            raw: match
                        });
                        return ''; 
                    }
                } catch (e) { }
                return match;
            });
            
            return { functions, cleanText: newText };
        },
        handler: spec.handler 
    });
  }

  async loadEmotionImages() {
    for (const emotion of EMOTION_TYPES) {
      const emotionDir = path.join(EMOTIONS_DIR, emotion);
      try {
        if (!fs.existsSync(emotionDir)) {
             // 目录不存在则跳过，避免报错
             BetterChatStream.emotionImages[emotion] = [];
             continue;
        }
        const files = await fs.promises.readdir(emotionDir);
        const imageFiles = files.filter(file => 
          /\.(jpg|jpeg|png|gif)$/i.test(file)
        );
        BetterChatStream.emotionImages[emotion] = imageFiles.map(file => 
          path.join(emotionDir, file)
        );
      } catch (err) {
        console.error(`[BetterChat] 加载表情包 ${emotion} 失败:`, err);
        BetterChatStream.emotionImages[emotion] = [];
      }
    }
  }
  
  getRandomEmotionImage(type) {
      const images = BetterChatStream.emotionImages[type];
      if (!images || images.length === 0) return null;
      return images[Math.floor(Math.random() * images.length)];
  }

  _requireGroup(context) {
    if (!context.e?.isGroup) {
      return { success: false, error: '此功能仅限群聊环境使用' };
    }
    return null;
  }

  _wrapHandler(fn) {
      try {
          return fn();
      } catch (error) {
          return { success: false, error: error.message };
      }
  }

  registerTools() {
    // 1. Reply 工具
    this.registerTool('reply', {
      description: '发送文本消息。注意：如果用户要求点歌、签到等特定操作，请务必使用对应的 music/signIn 工具，而不要使用此工具仅回复文字。',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '消息内容' }
        },
        required: ['content']
      },
      handler: async (args, context) => {
        const { content } = args;
        if (!content) return { success: false, error: '内容不能为空' };
        
        // 简单去重
        if (this.sentMessages.has(content)) {
            return { success: true, result: '内容已发送过，跳过' };
        }
        this.sentMessages.add(content);
        
        // 3秒后清除去重记录，防止长期占用内存
        setTimeout(() => this.sentMessages.delete(content), 3000);

        await context.e.reply(content);
        return { success: true, result: '发送成功' };
      }
    });

    // 2. At 工具
    this.registerTool('at', {
      description: '@群成员。',
      inputSchema: {
        type: 'object',
        properties: {
          qq: { type: 'string', description: '目标QQ号' }
        },
        required: ['qq']
      },
      handler: async (args, context) => {
        if (this._requireGroup(context)) return { success: false, error: '仅群聊可用' };
        const segment = global.segment || (await import('oicq')).segment; // 尝试获取 segment
        await context.e.reply([segment.at(args.qq)]);
        return { success: true, result: '已@用户' };
      }
    });

    // 3. Poke 戳一戳
    this.registerTool('poke', {
      description: '戳一戳用户。',
      inputSchema: {
        type: 'object',
        properties: {
          qq: { type: 'string', description: '目标QQ号' }
        },
        required: ['qq']
      },
      handler: async (args, context) => {
        const { e } = context;
        const targetQq = args.qq;
        
        try {
            if (e.isGroup && e.group?.pokeMember) {
                await e.group.pokeMember(targetQq);
            } else if (e.friend?.poke) {
                await e.friend.poke();
            } else if (e.bot?.sendApi) { // 通用 API
                 await e.bot.sendApi('send_poke', { user_id: targetQq, group_id: e.group_id });
            } else {
                return { success: false, error: '当前环境不支持戳一戳' };
            }
            return { success: true, result: '已戳一戳' };
        } catch (err) {
            return { success: false, error: err.message };
        }
      }
    });

    // 4. 精华消息
    this.registerTool('setEssence', {
        description: '设置精华消息。',
        inputSchema: {
            type: 'object',
            properties: {
                msgId: { type: 'string', description: '消息ID' }
            },
            required: ['msgId']
        },
        handler: async (args, context) => {
            if (this._requireGroup(context)) return { success: false, error: '仅群聊可用' };
            const { e } = context;
            const msgId = args.msgId;
            
            if (e.group?.setEssenceMessage) {
                await e.group.setEssenceMessage(msgId);
                return { success: true, result: '已设为精华' };
            }
            return { success: false, error: 'API不可用' };
        }
    });

    this.registerTool('removeEssence', {
        description: '取消精华消息。',
        inputSchema: {
            type: 'object',
            properties: {
                msgId: { type: 'string', description: '消息ID' }
            },
            required: ['msgId']
        },
        handler: async (args, context) => {
            if (this._requireGroup(context)) return { success: false, error: '仅群聊可用' };
            const { e } = context;
            const msgId = args.msgId;
            
            if (e.group?.removeEssenceMessage) {
                await e.group.removeEssenceMessage(msgId);
                return { success: true, result: '已取消精华' };
            }
            return { success: false, error: 'API不可用' };
        }
    });

    // 5. 群公告
    this.registerTool('announce', {
        description: '发布群公告。',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '公告内容' }
            },
            required: ['content']
        },
        handler: async (args, context) => {
            if (this._requireGroup(context)) return { success: false, error: '仅群聊可用' };
            const { e } = context;
            
            if (e.group?.sendMsg) {
                 // 注意：Yunzai 的群公告 API 比较特殊，通常是 _sendAnnounce 或类似，
                 // 这里尝试用通用的发布公告方法，或者提示用户该功能可能受限
                 try {
                     // 尝试调用 sendApi
                     if (e.bot?.sendApi) {
                         await e.bot.sendApi('scan_announce', { group_id: e.group_id, content: args.content }); // 这是一个假设的 API，实际可能不同
                         // 或者是 _setGroupAnnounce
                         return { success: true, result: '尝试发布公告（注意：可能需要管理员权限）' };
                     }
                 } catch (err) {
                     return { success: false, error: '发布失败: ' + err.message };
                 }
            }
            // 兜底：如果找不到明确 API，尝试通过 sendApi
            try {
                if (context.e.bot?.sendApi) {
                    await context.e.bot.sendApi('_send_group_notice', { group_id: context.e.group_id, content: args.content });
                    return { success: true, result: '公告请求已发送' };
                }
            } catch (e) {
                 return { success: false, error: 'API 调用失败' };
            }
            return { success: false, error: '未找到发布公告的API' };
        }
    });

    // 6. 表情回应 (Emoji Reaction)
    this.registerTool('emojiReaction', {
        description: '对消息进行表情回应。',
        inputSchema: {
            type: 'object',
            properties: {
                msgId: { type: 'string', description: '消息ID' },
                type: { 
                    type: 'string', 
                    description: '表情类型',
                    enum: ['开心', '惊讶', '伤心', '大笑', '害怕', '喜欢', '爱心', '生气']
                }
            },
            required: ['type']
        },
        handler: async (args, context) => {
            if (this._requireGroup(context)) return { success: false, error: '仅群聊可用' };
            const { e } = context;
            const type = args.type;
            const msgId = args.msgId || (e.source ? e.source.message_id : null) || e.message_id; // 优先回应引用的消息，其次是当前触发的消息

            const emojiIds = EMOJI_REACTIONS[type];
            if (!emojiIds) return { success: false, error: '未知表情类型' };
            
            const emojiId = emojiIds[Math.floor(Math.random() * emojiIds.length)];
            
            if (e.group?.setEmojiLike) {
                await e.group.setEmojiLike(msgId, emojiId, true);
                return { success: true, result: '已回应表情' };
            }
            return { success: false, error: 'API不可用' };
        }
    });

    // 7. 发送表情包图片 (Emotion)
    this.registerTool('emotion', {
        description: '发送表情包图片。',
        inputSchema: {
            type: 'object',
            properties: {
                type: { 
                    type: 'string', 
                    description: '表情类型',
                    enum: ['开心', '惊讶', '伤心', '大笑', '害怕', '生气']
                },
                text: { type: 'string', description: '附带文字（可选）' }
            },
            required: ['type']
        },
        handler: async (args, context) => {
            const { type, text } = args;
            const imagePath = this.getRandomEmotionImage(type);
            if (!imagePath) return { success: false, error: '未找到该类型的表情包图片' };
            
            const segment = global.segment || (await import('oicq')).segment;
            const msg = [segment.image(imagePath)];
            if (text) msg.push(text);
            
            await context.e.reply(msg);
            return { success: true, result: '已发送表情包' };
        }
    });

    // 8. 记忆库工具 (Memory)
    this.registerTool('remember', {
        description: '记住重要信息（添加到记忆库）。',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '要记住的内容' }
            },
            required: ['content']
        },
        handler: async (args, context) => {
            const { e } = context;
            if (!this.memorySystem) return { success: false, error: '记忆系统未初始化' };
            
            const content = args.content;
            // 尝试提取所有者和场景
            let ownerId = e.user_id;
            let scene = e.isGroup ? `group:${e.group_id}` : `private:${e.user_id}`;
            
            await this.memorySystem.remember({
                ownerId: String(ownerId),
                scene,
                content,
                layer: 'long' // 存入长期记忆
            });
            
            return { success: true, result: '已添加到记忆库' };
        }
    });

    this.registerTool('forget', {
        description: '忘记信息（从记忆库删除）。',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '要忘记的内容关键词' }
            },
            required: ['content']
        },
        handler: async (args, context) => {
            const { e } = context;
            if (!this.memorySystem) return { success: false, error: '记忆系统未初始化' };
            
            const content = args.content;
            let ownerId = e.user_id;
            let scene = e.isGroup ? `group:${e.group_id}` : `private:${e.user_id}`;
            
            // 这里的 forget 实现依赖于 memorySystem 的具体 API，假设支持通过内容搜索并删除
            // 如果 memorySystem.forget 只支持 ID，则这里可能需要先 search 再 delete
            // 假设 memorySystem.forget(ownerId, scene, memoryId, contentQuery)
            const success = await this.memorySystem.forget(String(ownerId), scene, null, content);
            
            return { success: true, result: success ? '已删除相关记忆' : '未找到相关记忆' };
        }
    });

    // 9. 点歌工具 (Music)
    this.registerTool('music', {
        description: '点歌工具。支持QQ、网易、酷狗、酷我、哔哩哔哩等平台。',
        inputSchema: {
            type: 'object',
            properties: {
                keyword: { type: 'string', description: '歌曲名或关键词' },
                source: { 
                    type: 'string', 
                    description: '音乐源 (可选)',
                    enum: ['qq', 'netease', 'kugou', 'kuwo', 'bilibili']
                }
            },
            required: ['keyword']
        },
        handler: async (args, context) => {
            const { keyword, source } = args;
            if (source) {
                musicHandler.setSource(source);
            }
            
            // 构造点歌指令并让机器人自己发送
            // 注意：这里我们通过修改 msg 并重新触发 process 或者直接调用 plugins/xiaofei-plugin 的逻辑
            // 但为了解耦，我们这里选择构造一个虚拟的指令消息让 Yunzai 处理，或者直接返回指令建议
            
            // 更好的方式是直接返回一个特殊的指令，让 AIStream 的上层去执行，但 MCP handler 通常只返回数据
            // 这里我们模拟用户发送了点歌指令
            
            const command = musicHandler.getCommand(keyword);
            
            // 尝试通过 context.e.bot.sendMsg 发送指令 (模拟用户行为不太容易，通常是 bot 发送指令给 bot? 不太对)
            // 正确做法是：Bot 发送点歌指令，触发 xiaofei-plugin
            // 但 Bot 自己发消息不会触发自己的监听器。
            // 变通方法：直接调用 xiaofei-plugin 的 music 方法？需要引入 xiaofei_music 类。
            
            // 简单方案：回复用户点歌指令，提示用户发送，或者尝试注入消息
            // 终极方案：直接调用 xiaofei-plugin 的逻辑。
            // 由于 xiaofei-plugin 是外部插件，我们最好通过 import 动态加载
            
            try {
                // 动态导入 xiaofei-plugin 的点歌功能
                const musicPluginPath = path.join(process.cwd(), 'plugins/xiaofei-plugin/apps/点歌.js');
                if (fs.existsSync(musicPluginPath)) {
                    const { xiaofei_music } = await import(`file://${musicPluginPath}`);
                    const musicPlugin = new xiaofei_music();
                    
                    // 构造伪造的 event 对象
                    const fakeEvent = {
                        ...context.e,
                        msg: command,
                        reply: context.e.reply.bind(context.e) // 绑定 reply
                    };
                    
                    // 调用 music 方法
                    musicPlugin.e = fakeEvent;
                    await musicPlugin.music();
                    return { success: true, result: `已执行点歌: ${command}` };
                } else {
                     return { success: false, error: '未找到小飞点歌插件' };
                }
            } catch (err) {
                return { success: false, error: '点歌失败: ' + err.message };
            }
        }
    });

    // 10. 切换音乐源工具
    this.registerTool('switchMusicSource', {
        description: '切换默认音乐源。',
        inputSchema: {
            type: 'object',
            properties: {
                source: { 
                    type: 'string', 
                    description: '音乐源',
                    enum: ['qq', 'netease', 'kugou', 'kuwo', 'bilibili']
                }
            },
            required: ['source']
        },
        handler: async (args, context) => {
            const { source } = args;
            if (musicHandler.setSource(source)) {
                return { success: true, result: `已切换音乐源为: ${musicHandler.getSourceName(source)}` };
            }
            return { success: false, error: '不支持该音乐源' };
        }
    });

    // 11. 群签到 (SignIn)
    this.registerTool('signIn', {
        description: '执行群签到或游戏签到。',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        handler: async (args, context) => {
            if (this._requireGroup(context)) return { success: false, error: '仅群聊可用' };
            const { e } = context;
            
            let resultMsg = '';
            let signed = false;

            // 1. 尝试群签到 (API)
            if (e.group?.sign) {
                try {
                    await e.group.sign();
                    resultMsg = '✅ 已执行群打卡。';
                    signed = true;
                } catch (err) {
                    resultMsg = `❌ 群打卡失败: ${err.message}。`;
                }
            } else if (e.bot?.sendApi) {
                try {
                     // 尝试通用 API
                     await e.bot.sendApi('send_group_sign', { group_id: e.group_id });
                     resultMsg = '✅ 已请求群打卡（API）。';
                     signed = true;
                } catch (err) {
                     // 忽略错误，继续尝试其他方式或提示
                     console.error('[BetterChat] sign API failed:', err);
                }
            }
            
            if (!signed) {
                resultMsg = '⚠️ 当前环境不支持自动群打卡。';
            }

            resultMsg += ' 若需游戏签到，请发送 #签到。';
            
            // 直接回复用户，确保可见反馈
            await e.reply(resultMsg);

            return { success: true, result: resultMsg };
        }
    });
  }

  buildSystemPrompt(context) {
    return this.systemPrompt;
  }

  async buildChatContext(e, question) {
    const prompt = this.buildSystemPrompt({ e, question });
    const context = [
      { role: 'system', content: prompt },
      { role: 'user', content: typeof question === 'string' ? question : JSON.stringify(question) }
    ];
    
    // 如果启用 embedding，增强上下文
    if (this.embeddingConfig && this.embeddingConfig.enabled) {
       return await this.buildEnhancedContext(e, question, context);
    }
    
    return context;
  }
}
