import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AIStream from '../../../lib/aistream/aistream.js';
import BotUtil from '../../../lib/util.js';
import musicHandler from '../lib/music.js';
import permissionManager from '../model/security.js';
import modelAdapter from '../model/model-adapter.js';
import { getPersona } from '../model/persona.js';

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

import configManager from '../model/config.js';

export default class BetterChatStream extends AIStream {
  static emotionImages = {};
  static currentContext = null;

  constructor() {
    super({
      name: 'better-chat',
      description: '增强版智能聊天工作流（支持MCP工具与记忆库）',
      version: '1.2.0',
      author: 'XRK',
      priority: 5,
      config: {
        enabled: true,
        temperature: 0.85,
      },
      embedding: {
        enabled: true,
        maxContexts: 5,
        similarityThreshold: 0.6,
        cacheExpiry: 86400
      }
    });
    this.sentMessages = new Set();
    this._configManager = configManager;
  }

  _getToolStreamNames() {
    return [this.name];
  }

  async init() {
    await super.init();
    await this.loadEmotionImages();
    this.registerTools();
    
    const personaPrompt = getPersona();
    
    this.systemPrompt = `${personaPrompt}

【重要】每次回复都必须调用 better-chat.emotion 工具！
无论做什么操作，最后都要用 emotion 发送表情包和回复文字。

【工具使用规则 - 非常重要！】
1. 只使用 better-chat.xxx 开头的工具，不要使用其他工具
2. 禁止调用 remote-mcp.xxx 工具
3. 普通聊天只需要用 emotion 工具回复即可
4. 只有用户明确要求执行操作时才调用对应工具（如戳人、点赞、禁言等）
5. 当用户询问时事、新闻、知识性问题或需要最新信息时，先调用 webSearch 搜索，再用 emotion 回复

【工具列表】
1. better-chat.emotion - 发送表情包和文字（必须调用）
   参数: type(开心/惊讶/伤心/大笑/害怕/生气), text(回复内容)
   
2. better-chat.webSearch - 网络搜索（用于查询时事、新闻、知识）
   参数: query(搜索关键词), num(结果数量,1-5)

3. better-chat.music - 点歌
   参数: keyword(歌名)

4. better-chat.poke - 戳一戳
   参数: qq(QQ号或"随机"), count(戳几个人)

5. better-chat.at - 艾特群成员
   参数: qq(QQ号或"随机"), count(艾特几个人)

6. better-chat.like - 点赞名片
   参数: qq(QQ号), times(点赞次数,1-10次)

7. better-chat.friendsInGroup - 查看好友在群里
   参数: 无

8. better-chat.announce - 发布群公告
   参数: content(公告内容)

9. better-chat.setEssence - 设为精华消息
   参数: msgId(消息ID，可留空自动获取被回复的消息)

10. better-chat.forget - 删除记忆
    参数: content(要忘记的内容，传"全部"清空所有)

11. better-chat.ban - 禁言群成员（需要管理员权限）
    参数: qq(QQ号), duration(禁言秒数,0解除禁言)

12. better-chat.banAll - 开启全体禁言（需要管理员权限）
    参数: 无

13. better-chat.unbanAll - 解除全体禁言（需要管理员权限）
    参数: 无

14. better-chat.groupCount - 获取群人数
    参数: 无

【回复原则】
- 每次回复都要不一样，要有变化
- 根据用户说的话来回复，不要总是问"想聊什么"
- 如果用户只是打招呼，就简单回应，不要问太多
- 如果用户说具体的事情，就针对那件事回复
- 要有灵性，像真人一样自然对话

【示例】
用户: 你好
回复:
{"tool":"better-chat.emotion","args":{"type":"开心","text":"你好呀~"}}

用户: 在吗
回复:
{"tool":"better-chat.emotion","args":{"type":"开心","text":"在的在的~有什么事吗？"}}

用户: 我今天好累
回复:
{"tool":"better-chat.emotion","args":{"type":"伤心","text":"辛苦啦~要好好休息哦！"}}

用户: 给我点赞
回复:
{"tool":"better-chat.like","args":{"qq":"用户QQ号"}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"点赞啦~你的名片超棒的！"}}

用户: 我想听水手
回复:
{"tool":"better-chat.music","args":{"keyword":"水手"}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"好呀~正在播放《水手》！"}}

用户: 随便艾特一个人
回复:
{"tool":"better-chat.at","args":{"qq":"随机"}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"诶嘿~随机艾特了一个人！"}}

用户: 随便戳一个人
回复:
{"tool":"better-chat.poke","args":{"qq":"随机"}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"戳戳戳~随机戳了一个人！"}}

用户: 给我点5个赞
回复:
{"tool":"better-chat.like","args":{"qq":"用户QQ号","times":5}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"好呀~已经给你点了5个赞！"}}

用户: 你好友里有多少人在这个群
回复:
{"tool":"better-chat.friendsInGroup","args":{}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"让我看看...我的好友有X人在这个群里呢！"}}

用户: 群里有多少人
回复:
{"tool":"better-chat.groupCount","args":{}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"让我数数...这个群有X人呢！"}}

用户: 禁言他@xxx 一分钟
回复:
{"tool":"better-chat.ban","args":{"qq":"被@的QQ号","duration":60}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"好~已经禁言他1分钟啦！"}}

用户: 全体禁言
回复:
{"tool":"better-chat.banAll","args":{}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"全体禁言已开启~"}}

用户: 解除全体禁言
回复:
{"tool":"better-chat.unbanAll","args":{}}
{"tool":"better-chat.emotion","args":{"type":"开心","text":"全体禁言已解除~大家又可以说话啦！"}}

【失败处理】
如果工具执行失败，告诉用户失败了，不要自动重试。等用户再次要求时再尝试。`;
  }

  /**
   * 注册工具的辅助方法：同时注册 MCP 工具和 AIStream 文本解析器
   */
  registerTool(name, spec) {
    const originalHandler = spec.handler;
    const self = this;
    
    const wrappedHandler = async (args, context) => {
      // 如果 context 为空，使用保存的 context
      const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
      const { e } = actualContext;
      
      const permissionCheck = await permissionManager.checkToolPermission(e, name, args);
      if (!permissionCheck.allowed) {
        await e.reply(`⚠️ ${permissionCheck.reason}`);
        return { success: false, error: permissionCheck.reason };
      }
      
      return originalHandler.call(self, args, actualContext);
    };
    
    this.registerMCPTool(name, { ...spec, handler: wrappedHandler });

    this.registerFunction(name, {
        description: spec.description,
        enabled: true,
        parser: (text) => {
            const functions = [];
            let newText = text;
            
            // 逐个查找并解析 JSON 对象
            let searchPos = 0;
            while (searchPos < text.length) {
                const startIdx = text.indexOf('{"tool"', searchPos);
                if (startIdx === -1) break;
                
                // 找到对应的结束括号
                let depth = 0;
                let endIdx = startIdx;
                let inString = false;
                let escape = false;
                
                for (let i = startIdx; i < text.length; i++) {
                    const char = text[i];
                    
                    if (escape) {
                        escape = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escape = true;
                        continue;
                    }
                    
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    
                    if (!inString) {
                        if (char === '{') depth++;
                        else if (char === '}') {
                            depth--;
                            if (depth === 0) {
                                endIdx = i + 1;
                                break;
                            }
                        }
                    }
                }
                
                if (endIdx > startIdx) {
                    const jsonStr = text.slice(startIdx, endIdx);
                    try {
                        const json = JSON.parse(jsonStr);
                        if (json.tool) {
                            const corrected = modelAdapter.correctToolCall(json);
                            const toolName = corrected.tool;
                            
                            const simpleName = name.includes('.') ? name.split('.').pop() : name;
                            const simpleTool = toolName.includes('.') ? toolName.split('.').pop() : toolName;
                            
                            if (toolName === name || simpleTool === simpleName) {
                                functions.push({
                                    type: name,
                                    params: corrected.args || {},
                                    raw: jsonStr
                                });
                                newText = newText.replace(jsonStr, '');
                            }
                        }
                    } catch (e) {
                        console.log(`\x1b[33m[解析器] JSON解析失败: ${e.message}\x1b[0m`);
                    }
                    searchPos = endIdx;
                } else {
                    searchPos = startIdx + 1;
                }
            }
            
            newText = newText.trim();
            
            return { functions, cleanText: newText };
        },
        handler: wrappedHandler 
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
      description: '@群成员。可以传"随机"来随机艾特一个人。当count>1且qq="随机"时，会随机艾特count个不同的人。',
      inputSchema: {
        type: 'object',
        properties: {
          qq: { type: 'string', description: '目标QQ号，或"随机"' },
          count: { type: 'number', description: '艾特几个人（仅qq=随机时有效）' }
        },
        required: ['qq']
      },
      handler: async (args, context) => {
        const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
        const { e } = actualContext;
        if (!e || !e.group) {
            return { success: false, error: '仅群聊可用' };
        }
        
        const segment = global.segment || (await import('oicq')).segment;
        let targetQq = args.qq;
        let count = Math.max(Number(args.count) || 1, 1);
        // 随机艾特最多5人
        const maxRandomCount = 5;
        count = Math.min(count, maxRandomCount);
        let atList = [];
        
        // 随机艾特
        if (targetQq === '随机' || targetQq === 'random') {
            try {
                let members = [];
                
                // 尝试多种方式获取群成员
                if (e.group?.getMemberMap) {
                    const memberMap = await e.group.getMemberMap();
                    members = Array.from(memberMap.values()).filter(m => m.user_id !== e.self_id);
                } else if (e.group?.getMemberList) {
                    const memberList = await e.group.getMemberList();
                    members = Array.from(memberList.values ? memberList.values() : memberList).filter(m => m.user_id !== e.self_id);
                } else if (e.bot?.sendApi) {
                    const result = await e.bot.sendApi('get_group_member_list', { group_id: e.group_id });
                    if (result?.data) {
                        members = result.data.filter(m => m.user_id !== e.self_id);
                    }
                }
                
                if (members.length === 0) {
                    return { success: false, error: '群里没有其他成员' };
                }
                
                // 随机选择 min(count, members.length) 个不同的人
                const shuffled = members.sort(() => Math.random() - 0.5);
                const selectedMembers = shuffled.slice(0, Math.min(count, members.length));
                
                // 艾特所有人
                const atMsg = selectedMembers.map(m => segment.at(m.user_id || m.userId));
                await e.reply(atMsg);
                atList = selectedMembers.map(m => m.user_id || m.userId);
                
                return { success: true, result: `已随机艾特${atList.length}个人`, count: atList.length, atList };
            } catch (err) {
                return { success: false, error: '获取群成员失败: ' + err.message };
            }
        }
        
        // 指定QQ号
        await e.reply([segment.at(targetQq)]);
        return { success: true, result: '已@用户', qq: targetQq };
      }
    });

    // 3. Poke 戳一戳
    this.registerTool('poke', {
      description: '戳一戳群成员。qq可以传"随机"来随机戳一个人。当count>1且qq="随机"时，会随机戳count个不同的人。',
      inputSchema: {
        type: 'object',
        properties: {
          qq: { type: 'string', description: '目标QQ号，或"随机"' },
          count: { type: 'number', description: '戳的次数，或随机戳几个人' }
        },
        required: ['qq']
      },
      handler: async (args, context) => {
        const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
        const { e } = actualContext;
        if (!e || !e.group) {
            return { success: false, error: '仅群聊可用' };
        }
        
        let targetQq = args.qq;
        // 随机戳最多5人，指定戳最多10次
        let count = Math.max(Number(args.count) || 1, 1);
        const maxRandomCount = 5;
        const maxPokeCount = 10;
        
        if (targetQq === '随机' || targetQq === 'random') {
            count = Math.min(count, maxRandomCount);
        } else {
            count = Math.min(count, maxPokeCount);
        }
        
        let pokedList = [];
        
        // 随机戳
        if (targetQq === '随机' || targetQq === 'random') {
            try {
                let members = [];
                
                // 尝试多种方式获取群成员
                if (e.group?.getMemberMap) {
                    const memberMap = await e.group.getMemberMap();
                    members = Array.from(memberMap.values()).filter(m => m.user_id !== e.self_id);
                } else if (e.group?.getMemberList) {
                    const memberList = await e.group.getMemberList();
                    members = Array.from(memberList.values ? memberList.values() : memberList).filter(m => m.user_id !== e.self_id);
                } else if (e.bot?.sendApi) {
                    const result = await e.bot.sendApi('get_group_member_list', { group_id: e.group_id });
                    if (result?.data) {
                        members = result.data.filter(m => m.user_id !== e.self_id);
                    }
                }
                
                if (members.length === 0) {
                    return { success: false, error: '群里没有其他成员' };
                }
                
                // 随机选择 min(count, members.length) 个不同的人
                const shuffled = members.sort(() => Math.random() - 0.5);
                const selectedMembers = shuffled.slice(0, Math.min(count, members.length));
                
                // 每人戳一次
                for (const member of selectedMembers) {
                    const qq = member.user_id || member.userId;
                    try {
                        if (e.group?.pokeMember) {
                            await e.group.pokeMember(qq);
                        } else if (e.bot?.sendApi) {
                            await e.bot.sendApi('send_poke', { user_id: qq, group_id: e.group_id });
                        }
                        pokedList.push(qq);
                        await new Promise(r => setTimeout(r, 300));
                    } catch (err) {
                        console.log(`\x1b[33m[poke] 戳 ${qq} 失败: ${err.message}\x1b[0m`);
                    }
                }
                
                return { success: true, result: `已随机戳了${pokedList.length}个人`, count: pokedList.length, pokedList };
            } catch (err) {
                return { success: false, error: '获取群成员失败: ' + err.message };
            }
        }
        
        // 指定QQ号，戳count次
        try {
            for (let i = 0; i < count; i++) {
                if (e.group?.pokeMember) {
                    await e.group.pokeMember(targetQq);
                } else if (e.bot?.sendApi) {
                    await e.bot.sendApi('send_poke', { user_id: targetQq, group_id: e.group_id });
                }
                if (i < count - 1) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            return { success: true, result: `已戳${count}次`, count, qq: targetQq };
        } catch (err) {
            return { success: false, error: err.message };
        }
      }
    });

    // 4. 点赞名片
    this.registerTool('like', {
      description: '给用户名片点赞。times参数控制点赞次数（1-10次）。',
      inputSchema: {
        type: 'object',
        properties: {
          qq: { type: 'string', description: '目标QQ号' },
          times: { type: 'number', description: '点赞次数（1-10次，默认10次）' }
        },
        required: ['qq']
      },
      handler: async (args, context) => {
        const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
        const { e } = actualContext;
        const targetQq = args.qq;
        const times = Math.min(Math.max(Number(args.times) || 10, 1), 10);
        
        try {
            if (e.bot?.sendApi) {
                await e.bot.sendApi('send_like', { user_id: targetQq, times });
                return { success: true, result: `已点赞${times}次` };
            } else if (e.friend?.thumbUp) {
                await e.friend.thumbUp(times);
                return { success: true, result: `已点赞${times}次` };
            } else {
                return { success: false, error: '当前环境不支持点赞' };
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
      }
    });

    // 5. 查看好友在群里的情况
    this.registerTool('friendsInGroup', {
      description: '查看机器人的好友中有多少人在当前群聊里。',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (args, context) => {
        const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
        const { e } = actualContext;
        if (!e || !e.group) {
            return { success: false, error: '仅群聊可用' };
        }
        
        try {
            // 获取好友列表
            let friendList = [];
            if (e.bot?.sendApi) {
                const result = await e.bot.sendApi('get_friend_list');
                if (result?.data) {
                    friendList = result.data;
                }
            } else if (e.bot?.fl) {
                friendList = Array.from(e.bot.fl.values());
            }
            
            // 获取群成员列表
            let groupMembers = [];
            if (e.group?.getMemberMap) {
                const memberMap = await e.group.getMemberMap();
                groupMembers = Array.from(memberMap.values());
            } else if (e.group?.getMemberList) {
                const memberList = await e.group.getMemberList();
                groupMembers = Array.from(memberList.values ? memberList.values() : memberList);
            } else if (e.bot?.sendApi) {
                const result = await e.bot.sendApi('get_group_member_list', { group_id: e.group_id });
                if (result?.data) {
                    groupMembers = result.data;
                }
            }
            
            // 找出好友在群里的
            const friendIds = new Set(friendList.map(f => f.user_id || f.userId));
            const friendsInGroup = groupMembers.filter(m => friendIds.has(m.user_id || m.userId));
            
            const friendNames = friendsInGroup.map(m => m.nickname || m.card || m.user_id).slice(0, 10);
            
            return { 
                success: true, 
                result: `好友列表中有${friendList.length}人，当前群有${groupMembers.length}人，其中${friendsInGroup.length}人是我的好友`,
                friendCount: friendList.length,
                groupCount: groupMembers.length,
                friendsInGroupCount: friendsInGroup.length,
                friendsInGroup: friendNames
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
      }
    });

    // 7. 精华消息
    this.registerTool('setEssence', {
        description: '设置精华消息。需要回复一条消息才能设置精华。',
        inputSchema: {
            type: 'object',
            properties: {
                msgId: { type: 'string', description: '消息ID，可留空自动获取被回复的消息' }
            },
            required: []
        },
        handler: async (args, context) => {
            if (this._requireGroup(context)) return { success: false, error: '仅群聊可用' };
            const { e } = context;
            let msgId = args.msgId;
            
            // 如果没有提供 msgId，尝试获取被回复的消息
            if (!msgId && e.source) {
                msgId = e.source.message_id;
            }
            
            // 尝试通过 API 获取上一条消息
            if (!msgId && e.bot?.sendApi) {
                try {
                    const result = await e.bot.sendApi('get_group_msg_history', { 
                        group_id: e.group_id, 
                        count: 2 
                    });
                    if (result?.data?.messages && result.data.messages.length > 1) {
                        // 获取倒数第二条消息（因为最后一条是当前触发的消息）
                        msgId = result.data.messages[1].message_id;
                    }
                } catch (err) { }
            }
            
            if (!msgId) {
                return { success: false, error: '请回复要设为精华的消息' };
            }
            
            try {
                if (e.bot?.sendApi) {
                    await e.bot.sendApi('set_essence_msg', { message_id: msgId });
                    return { success: true, result: '已设为精华', msgId };
                }
                if (e.group?.setEssenceMessage) {
                    await e.group.setEssenceMessage(msgId);
                    return { success: true, result: '已设为精华', msgId };
                }
                return { success: false, error: 'API不可用' };
            } catch (err) {
                return { success: false, error: '设精华失败: ' + err.message };
            }
        }
    });

    // 禁言
    this.registerTool('ban', {
        description: '禁言群成员。需要管理员权限。',
        inputSchema: {
            type: 'object',
            properties: {
                qq: { type: 'string', description: '目标QQ号' },
                duration: { type: 'number', description: '禁言时长（秒），默认60秒，0表示解除禁言' }
            },
            required: ['qq']
        },
        handler: async (args, context) => {
            const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
            const { e } = actualContext;
            if (!e || !e.group) {
                return { success: false, error: '仅群聊可用' };
            }
            
            const targetQq = args.qq;
            const duration = Number(args.duration) || 60;
            
            try {
                if (e.bot?.sendApi) {
                    if (duration === 0) {
                        await e.bot.sendApi('set_group_ban', { group_id: e.group_id, user_id: targetQq, duration: 0 });
                        return { success: true, result: '已解除禁言' };
                    }
                    await e.bot.sendApi('set_group_ban', { group_id: e.group_id, user_id: targetQq, duration });
                    return { success: true, result: `已禁言${duration}秒` };
                }
                if (e.group?.muteMember) {
                    await e.group.muteMember(targetQq, duration);
                    return { success: true, result: duration === 0 ? '已解除禁言' : `已禁言${duration}秒` };
                }
                return { success: false, error: 'API不可用' };
            } catch (err) {
                return { success: false, error: '禁言失败: ' + err.message };
            }
        }
    });

    // 全体禁言
    this.registerTool('banAll', {
        description: '开启全体禁言。需要管理员权限。',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        handler: async (args, context) => {
            const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
            const { e } = actualContext;
            if (!e || !e.group) {
                return { success: false, error: '仅群聊可用' };
            }
            
            try {
                if (e.bot?.sendApi) {
                    await e.bot.sendApi('set_group_whole_ban', { group_id: e.group_id, enable: true });
                    return { success: true, result: '已开启全体禁言' };
                }
                if (e.group?.muteAll) {
                    await e.group.muteAll(true);
                    return { success: true, result: '已开启全体禁言' };
                }
                return { success: false, error: 'API不可用' };
            } catch (err) {
                return { success: false, error: '操作失败: ' + err.message };
            }
        }
    });

    // 解除全体禁言
    this.registerTool('unbanAll', {
        description: '解除全体禁言。需要管理员权限。',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        handler: async (args, context) => {
            const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
            const { e } = actualContext;
            if (!e || !e.group) {
                return { success: false, error: '仅群聊可用' };
            }
            
            try {
                if (e.bot?.sendApi) {
                    await e.bot.sendApi('set_group_whole_ban', { group_id: e.group_id, enable: false });
                    return { success: true, result: '已解除全体禁言' };
                }
                if (e.group?.muteAll) {
                    await e.group.muteAll(false);
                    return { success: true, result: '已解除全体禁言' };
                }
                return { success: false, error: 'API不可用' };
            } catch (err) {
                return { success: false, error: '操作失败: ' + err.message };
            }
        }
    });

    // 获取群人数
    this.registerTool('groupCount', {
        description: '获取群成员总数。',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        handler: async (args, context) => {
            const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
            const { e } = actualContext;
            if (!e || !e.group) {
                return { success: false, error: '仅群聊可用' };
            }
            
            try {
                let members = [];
                
                if (e.group?.getMemberMap) {
                    const memberMap = await e.group.getMemberMap();
                    members = Array.from(memberMap.values());
                } else if (e.group?.getMemberList) {
                    const memberList = await e.group.getMemberList();
                    members = Array.from(memberList.values ? memberList.values() : memberList);
                } else if (e.bot?.sendApi) {
                    const result = await e.bot.sendApi('get_group_member_list', { group_id: e.group_id });
                    if (result?.data) {
                        members = result.data;
                    }
                }
                
                return { 
                    success: true, 
                    result: `当前群有${members.length}人`,
                    count: members.length 
                };
            } catch (err) {
                return { success: false, error: err.message };
            }
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

    // 6. 群公告
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
            
            try {
                // 尝试多种 API
                if (e.bot?.sendApi) {
                    // 尝试 go-cqhttp 的 API
                    try {
                        await e.bot.sendApi('_send_group_notice', { 
                            group_id: e.group_id, 
                            content: args.content 
                        });
                        return { success: true, result: '公告已发布' };
                    } catch (err) {
                        // 忽略，尝试下一个
                    }
                    
                    // 尝试其他 API
                    try {
                        await e.bot.sendApi('set_group_notice', { 
                            group_id: e.group_id, 
                            content: args.content 
                        });
                        return { success: true, result: '公告已发布' };
                    } catch (err) {
                        // 忽略
                    }
                }
                
                // 兜底：发送为普通消息
                await e.reply(`📢 群公告：${args.content}`);
                return { success: true, result: '已发送公告（以消息形式）' };
            } catch (err) {
                return { success: false, error: '发布失败: ' + err.message };
            }
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
            const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
            const { e } = actualContext;
            
            const { type, text } = args;
            const imagePath = this.getRandomEmotionImage(type);
            if (!imagePath) return { success: false, error: '未找到该类型的表情包图片' };
            
            // 检查是否已经发送过相同内容的消息
            const contentKey = `${type}:${text}`;
            if (this._lastEmotionKey === contentKey && Date.now() - (this._lastEmotionTime || 0) < 3000) {
                return { success: true, result: '已发送（去重）' };
            }
            this._lastEmotionKey = contentKey;
            this._lastEmotionTime = Date.now();
            
            const segment = global.segment || (await import('oicq')).segment;
            const msg = [segment.image(imagePath)];
            if (text) msg.push(text);
            
            await e.reply(msg);
            return { success: true, result: '已发送表情包' };
        }
    });

    // 8. 记忆库工具 (Memory)
    this.registerTool('remember', {
        description: '记住重要信息（添加到记忆库）。记住后不需要额外回复，系统会自动处理。',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '要记住的内容' }
            },
            required: ['content']
        },
        handler: async (args, context) => {
            const { e } = context;
            if (!this.memorySystem) {
                return { success: false, error: '记忆系统未初始化' };
            }
            
            const content = args.content;
            const { ownerId, scene } = this.memorySystem.extractScene(e);
            
            try {
                await this.memorySystem.remember({
                    ownerId,
                    scene,
                    content,
                    layer: 'long'
                });
                
                return { success: true, result: '已记住', content };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }
    });

    this.registerTool('forget', {
        description: '忘记信息（从记忆库删除）。忘记后不需要额外回复，系统会自动处理。',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '要忘记的内容关键词，传"全部"则清空所有记忆' }
            },
            required: ['content']
        },
        handler: async (args, context) => {
            const { e } = context;
            if (!this.memorySystem) {
                return { success: false, error: '记忆系统未初始化' };
            }
            
            const content = args.content;
            const { ownerId, scene } = this.memorySystem.extractScene(e);
            
            try {
                if (content === '全部' || content === '所有' || content === '所有记忆') {
                    // 清空所有记忆
                    const success = await this.memorySystem.forget(ownerId, scene, null, null);
                    return { success: true, result: '已清空所有记忆', cleared: true };
                } else {
                    const success = await this.memorySystem.forget(ownerId, scene, null, content);
                    return { success: true, result: success ? '已忘记' : '未找到', content, found: success };
                }
            } catch (err) {
                return { success: false, error: err.message };
            }
        }
    });

    // 9. 点歌工具 (Music)
    this.registerTool('music', {
        description: '点歌工具。当用户想听歌时必须调用此工具！支持QQ、网易、酷狗、酷我、哔哩哔哩等平台。',
        inputSchema: {
            type: 'object',
            properties: {
                keyword: { type: 'string', description: '歌曲名或关键词' },
                source: { 
                    type: 'string', 
                    description: '音乐源 (可选，默认QQ)',
                    enum: ['qq', 'netease', 'kugou', 'kuwo', 'bilibili']
                }
            },
            required: ['keyword']
        },
        handler: async (args, context) => {
            const { keyword, source } = args;
            const { e } = context;
            
            const sourceNames = {
                'qq': 'QQ',
                'netease': '网易',
                'kugou': '酷狗',
                'kuwo': '酷我',
                'bilibili': '哔哩哔哩'
            };
            const sourceName = sourceNames[source] || 'QQ';
            const command = `#${sourceName}点歌 ${keyword}`;
            
            try {
                const musicPluginPath = path.join(process.cwd(), 'plugins/xiaofei-plugin/apps/点歌.js');
                if (!fs.existsSync(musicPluginPath)) {
                    await e.reply('未安装小飞点歌插件，无法点歌');
                    return { success: false, error: '未找到小飞点歌插件' };
                }
                
                const { xiaofei_music } = await import(`file://${musicPluginPath}`);
                const musicPlugin = new xiaofei_music();
                
                const fakeEvent = {
                    ...e,
                    msg: command,
                    message: command,
                    raw_message: command,
                    reply: e.reply.bind(e),
                    isGroup: e.isGroup,
                    group_id: e.group_id,
                    user_id: e.user_id,
                    self_id: e.self_id,
                    bot: e.bot,
                    group: e.group,
                    friend: e.friend,
                    sender: e.sender
                };
                
                musicPlugin.e = fakeEvent;
                const result = await musicPlugin.music();
                
                return { success: true, result: `已执行点歌: ${keyword}` };
            } catch (err) {
                console.error('[BetterChat] 点歌失败:', err);
                await e.reply(`点歌失败: ${err.message}`);
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

    // 12. 网络搜索工具
    this.registerTool('webSearch', {
        description: '搜索网络获取信息。当用户询问时事、新闻、知识性问题或需要最新信息时使用。返回精简的搜索结果摘要。',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '搜索关键词' },
                num: { type: 'number', description: '返回结果数量（1-5，默认3）' }
            },
            required: ['query']
        },
        handler: async (args, context) => {
            const { query, num = 3 } = args;
            const actualContext = context?.e ? context : BetterChatStream.currentContext || {};
            const { e } = actualContext;
            
            if (!query || query.trim().length === 0) {
                return { success: false, error: '请提供搜索关键词' };
            }
            
            try {
                const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
                
                const response = await fetch(searchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 15000
                });
                
                if (!response.ok) {
                    return { success: false, error: '搜索服务暂时不可用' };
                }
                
                const data = await response.json();
                
                let results = [];
                
                // 优先使用摘要
                if (data.AbstractText) {
                    results.push({
                        title: '摘要',
                        snippet: data.AbstractText,
                        url: data.AbstractURL || ''
                    });
                }
                
                // 添加相关主题
                if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
                    for (const topic of data.RelatedTopics.slice(0, num)) {
                        if (topic.Text && topic.FirstURL) {
                            results.push({
                                title: topic.Text.slice(0, 50) + (topic.Text.length > 50 ? '...' : ''),
                                snippet: topic.Text,
                                url: topic.FirstURL
                            });
                        }
                    }
                }
                
                // 如果没有结果
                if (results.length === 0) {
                    return { 
                        success: true, 
                        result: `未找到关于"${query}"的相关信息，建议换个关键词试试。`,
                        query: query
                    };
                }
                
                // 格式化结果
                const formattedResults = results.slice(0, num).map((r, i) => {
                    return `${i + 1}. ${r.title}\n   ${r.snippet.slice(0, 150)}${r.snippet.length > 150 ? '...' : ''}`;
                }).join('\n\n');
                
                return { 
                    success: true, 
                    result: `搜索"${query}"的结果：\n\n${formattedResults}`,
                    query: query,
                    count: Math.min(results.length, num)
                };
                
            } catch (err) {
                console.error('[BetterChat] 搜索失败:', err);
                return { success: false, error: '搜索失败: ' + err.message };
            }
        }
    });
  }

  buildSystemPrompt(context) {
    const { e, question, model } = context || {};
    let userInfo = '';
    
    if (e) {
      const userId = e.user_id || e.userId;
      const nickname = e.sender?.card || e.sender?.nickname || e.nickname || '用户';
      const groupId = e.group_id || e.groupId;
      
      // 提取被@的用户列表
      const atUsers = [];
      if (Array.isArray(e.message)) {
        for (const seg of e.message) {
          if (seg.type === 'at' && seg.qq && seg.qq != e.self_id) {
            atUsers.push(seg.qq);
          }
        }
      }
      const atUsersInfo = atUsers.length > 0 ? `\n- 被@的用户QQ号: ${atUsers.join(', ')}` : '';
      
      userInfo = `

【当前会话信息】
- 发言用户QQ号: ${userId}
- 发言用户昵称: ${nickname}
- 群号: ${groupId || '私聊'}${atUsersInfo}
- 当前时间: ${new Date().toLocaleString('zh-CN')}

【工具调用示例】
戳发言用户: {"tool":"better-chat.poke","args":{"qq":"${userId}"}}
戳被@的人: {"tool":"better-chat.poke","args":{"qq":"${atUsers[0] || userId}"}}
@发言用户: {"tool":"better-chat.at","args":{"qq":"${userId}"}}

注意：QQ号参数必须使用真实数字，禁止使用任何描述性文字！`;
      
      userInfo += permissionManager.buildPermissionPrompt(e);
    }
    
    let prompt = this.systemPrompt + userInfo;
    
    if (model) {
      prompt = modelAdapter.adaptSystemPrompt(prompt, model);
      const enhancement = modelAdapter.getPromptEnhancement(model);
      if (enhancement) {
        prompt += enhancement;
      }
    }
    
    return prompt;
  }

  async buildChatContext(e, question, apiConfig = {}) {
    // 保存 context 供工具使用
    BetterChatStream.currentContext = { e, question, apiConfig };
    
    const model = apiConfig.model || apiConfig.chatModel;
    const prompt = this.buildSystemPrompt({ e, question, model });
    
    let memorySummary = '';
    if (this.memorySystem && modelAdapter.shouldUseMemory(model) && e) {
      memorySummary = await this.memorySystem.buildSummary(e);
      if (memorySummary) {
        console.log(`\x1b[36m【记忆系统】记忆摘要: ${memorySummary.slice(0, 200)}...\x1b[0m`);
      }
      
      const userContent = typeof question === 'string' ? question : (question?.content || question?.text || '');
      const userId = e.user_id;
      const nickname = e.sender?.card || e.sender?.nickname || e.nickname || '用户';
      
      if (userContent && userContent.length > 2) {
        const { ownerId, scene } = this.memorySystem.extractScene(e);
        
        let isSpecialRemember = false;
        const rememberPatterns = [
          /记住[：:]\s*(.+)/i,
          /记住[我你他她它]?喜欢(.+)/i,
          /记住[我你他她它]?的(.+)/i,
          /记住(.+)/i,
          /记得[：:]\s*(.+)/i,
          /别忘了[我你他她它]?(.+)/i
        ];
        
        for (const pattern of rememberPatterns) {
          const match = userContent.match(pattern);
          if (match && match[1]) {
            const content = match[1].trim();
            await this.memorySystem.remember({
              ownerId,
              scene,
              content: `${nickname}让我记住: ${content}`,
              layer: 'long'
            }).catch(() => {});
            console.log(`\x1b[36m【记忆系统】自动记录: ${nickname}让我记住${content}\x1b[0m`);
            isSpecialRemember = true;
            break;
          }
        }
        
        if (!isSpecialRemember) {
          // 50%概率记录普通对话
          if (Math.random() < 0.5) {
            await this.memorySystem.remember({
              ownerId,
              scene,
              content: `${nickname}说: ${userContent.slice(0, 100)}`,
              layer: 'short',
              ttl: 3600000
            }).catch(() => {});
          }
        }
      }
    }
    
    const systemContent = memorySummary 
      ? `${prompt}\n\n【记忆】\n${memorySummary}` 
      : prompt;
    
    let userContent = '';
    if (typeof question === 'string') {
      userContent = question;
    } else if (question && typeof question === 'object') {
      userContent = question.content || question.text || '';
      if (question.imageDescriptions?.length) {
        userContent += '\n' + question.imageDescriptions.join('\n');
      }
    }
    
    if (!userContent) {
      userContent = '你好';
    }
    
    const context = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ];
    
    if (this.embeddingConfig && this.embeddingConfig.enabled && modelAdapter.shouldUseMemory(model)) {
       return await this.buildEnhancedContext(e, question, context);
    }
    
    return context;
  }
}
