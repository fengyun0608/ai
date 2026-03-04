const MODEL_CAPABILITIES = {
  'gpt-4': { tools: true, json: true, memory: true, level: 'advanced' },
  'gpt-4o': { tools: true, json: true, memory: true, level: 'advanced' },
  'gpt-4-turbo': { tools: true, json: true, memory: true, level: 'advanced' },
  'gpt-3.5-turbo': { tools: true, json: true, memory: true, level: 'standard' },
  'claude-3': { tools: true, json: true, memory: true, level: 'advanced' },
  'claude-3-opus': { tools: true, json: true, memory: true, level: 'advanced' },
  'claude-3-sonnet': { tools: true, json: true, memory: true, level: 'advanced' },
  'claude-3-haiku': { tools: true, json: true, memory: true, level: 'standard' },
  'gemini': { tools: true, json: true, memory: true, level: 'advanced' },
  'gemini-pro': { tools: true, json: true, memory: true, level: 'advanced' },
  'gemini-2': { tools: true, json: true, memory: true, level: 'advanced' },
  'gemini-3': { tools: true, json: true, memory: true, level: 'advanced' },
  'qwen': { tools: true, json: true, memory: true, level: 'standard' },
  'qwen2': { tools: true, json: true, memory: true, level: 'standard' },
  'qwen-plus': { tools: true, json: true, memory: true, level: 'standard' },
  'qwen-turbo': { tools: true, json: true, memory: true, level: 'standard' },
  'qwen-max': { tools: true, json: true, memory: true, level: 'advanced' },
  'qwen3': { tools: true, json: true, memory: true, level: 'standard' },
  'qwen3-coder': { tools: true, json: true, memory: true, level: 'standard' },
  'qwen3-coder-plus': { tools: true, json: true, memory: true, level: 'standard' },
  'deepseek': { tools: true, json: true, memory: true, level: 'standard' },
  'deepseek-chat': { tools: true, json: true, memory: true, level: 'standard' },
  'deepseek-coder': { tools: true, json: true, memory: true, level: 'standard' },
  'glm': { tools: true, json: true, memory: true, level: 'standard' },
  'glm-4': { tools: true, json: true, memory: true, level: 'standard' },
  'chatglm': { tools: true, json: true, memory: true, level: 'standard' },
  'yi': { tools: true, json: true, memory: true, level: 'standard' },
  'moonshot': { tools: true, json: true, memory: true, level: 'standard' },
  'kimi': { tools: true, json: true, memory: true, level: 'standard' },
};

const MINI_MODEL_PATTERNS = [
  /mini/i, /lite/i, /tiny/i, /small/i, /1\.8b/i, /0\.5b/i, 
  /slim/i, /fast/i
];

const TOOL_ALIASES = {
  'better-chat.reply': ['reply', '回复', '发送', 'send', 'message', 'msg', 'say', 'text'],
  'better-chat.at': ['at', '艾特', '@', 'mention', '提到'],
  'better-chat.poke': ['poke', '戳', '戳一戳', 'nudge', '戳戳'],
  'better-chat.like': ['like', '点赞', '赞', 'thumbup', 'thumb_up', '点赞名片'],
  'better-chat.emotion': ['emotion', '表情', '表情包', 'emoji', 'sticker', 'img', 'image', '图片'],
  'better-chat.emojiReaction': ['emojiReaction', '表情回应', 'reaction', '回应'],
  'better-chat.setEssence': ['setEssence', '精华', '设精', 'essence', 'set_essence', 'setessence'],
  'better-chat.removeEssence': ['removeEssence', '取消精华', '撤精', 'remove_essence', 'removeessence'],
  'better-chat.announce': ['announce', '公告', '发布公告', 'announcement', 'notice'],
  'better-chat.remember': ['remember', '记忆', '记住', 'save', 'store', 'memorize'],
  'better-chat.forget': ['forget', '忘记', '遗忘', 'delete', 'remove_memory'],
  'better-chat.music': ['music', '点歌', '播放', 'play', 'song', '唱歌', '音乐'],
  'better-chat.switchMusicSource': ['switchMusicSource', '切换音乐源', 'switch_source', 'music_source'],
  'better-chat.signIn': ['signIn', '签到', 'sign', 'checkin', 'signin', 'sign_in'],
  'better-chat.authorize': ['authorize', '授权', 'permission', 'auth'],
  'better-chat.revokeAuth': ['revokeAuth', '取消授权', 'revoke', 'unauth']
};

const ARG_ALIASES = {
  'qq': ['qq', 'QQ', 'qq号', 'user_id', 'userId', 'uid', 'id', '用户'],
  'content': ['content', '内容', 'text', '消息', 'message', 'msg'],
  'type': ['type', '类型', 'kind', 'category', 'emotion_type', 'emotionType'],
  'text': ['text', '文本', 'content', 'message'],
  'keyword': ['keyword', '关键词', '歌名', 'song', 'name', 'query'],
  'source': ['source', '来源', '平台', 'platform'],
  'msgId': ['msgId', 'msgid', 'message_id', '消息id', 'id'],
  'userId': ['userId', 'userid', 'user_id', '用户id', 'qq', 'uid']
};

class ModelAdapter {
  constructor() {
    this.modelCapabilities = MODEL_CAPABILITIES;
    this.toolAliases = TOOL_ALIASES;
    this.argAliases = ARG_ALIASES;
  }

  detectModel(modelName) {
    if (!modelName) return { tools: true, json: true, memory: true, level: 'standard' };
    
    const name = modelName.toLowerCase();
    
    for (const [key, caps] of Object.entries(this.modelCapabilities)) {
      if (name.includes(key.toLowerCase())) {
        return { ...caps, detected: key };
      }
    }
    
    const isMini = MINI_MODEL_PATTERNS.some(p => p.test(name));
    if (isMini) {
      return { tools: true, json: true, memory: false, level: 'standard', detected: 'mini' };
    }
    
    return { tools: true, json: true, memory: true, level: 'standard', detected: 'unknown' };
  }

  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = String(str1).toLowerCase();
    const s2 = String(str2).toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (s1[i] === s2[i]) matches++;
    }
    
    const prefixScore = matches / maxLen;
    
    const set1 = new Set(s1.split(''));
    const set2 = new Set(s2.split(''));
    const intersection = [...set1].filter(c => set2.has(c)).length;
    const union = new Set([...set1, ...set2]).size;
    const jaccardScore = intersection / union;
    
    return (prefixScore + jaccardScore) / 2;
  }

  findBestToolMatch(toolName) {
    if (!toolName) return null;
    
    const inputName = String(toolName).trim();
    const inputLower = inputName.toLowerCase();
    
    // 0. 标准化：将 better.chat.xxx 转换为 better-chat.xxx
    const normalizedName = inputName.replace(/^better\.chat\./i, 'better-chat.');
    const normalizedLower = normalizedName.toLowerCase();
    
    // 1. 精确匹配完整工具名
    for (const canonical of Object.keys(this.toolAliases)) {
      if (canonical.toLowerCase() === normalizedLower) {
        return canonical;
      }
    }
    
    // 2. 提取简单名称并精确匹配
    const simpleName = normalizedName.includes('.') ? normalizedName.split('.').pop() : normalizedName;
    const simpleLower = simpleName.toLowerCase();
    
    for (const [canonical, aliases] of Object.entries(this.toolAliases)) {
      const canonicalSimple = canonical.includes('.') ? canonical.split('.').pop() : canonical;
      if (canonicalSimple.toLowerCase() === simpleLower) {
        return canonical;
      }
      for (const alias of aliases) {
        if (alias.toLowerCase() === simpleLower) {
          return canonical;
        }
      }
    }
    
    // 3. 返回标准化后的名称
    return normalizedName;
  }

  findBestArgMatch(argName, toolName) {
    if (!argName) return null;
    
    const inputName = String(argName).toLowerCase().trim();
    
    const relevantArgs = this.getRelevantArgs(toolName);
    
    // 1. 精确匹配
    for (const arg of relevantArgs) {
      const aliases = this.argAliases[arg] || [arg];
      for (const alias of aliases) {
        if (alias.toLowerCase() === inputName) {
          return arg;
        }
      }
    }
    
    // 2. 相似度匹配
    let bestMatch = null;
    let bestScore = 0;
    
    for (const arg of relevantArgs) {
      const aliases = this.argAliases[arg] || [arg];
      for (const alias of aliases) {
        const score = this.calculateSimilarity(inputName, alias);
        if (score > bestScore && score > 0.5) {
          bestScore = score;
          bestMatch = arg;
        }
      }
    }
    
    return bestMatch || argName;
  }

  getRelevantArgs(toolName) {
    const toolArgs = {
      'better-chat.reply': ['content'],
      'better-chat.at': ['qq'],
      'better-chat.poke': ['qq', 'count'],
      'better-chat.like': ['qq'],
      'better-chat.emotion': ['type', 'text'],
      'better-chat.emojiReaction': ['type', 'msgId'],
      'better-chat.setEssence': ['msgId'],
      'better-chat.removeEssence': ['msgId'],
      'better-chat.announce': ['content'],
      'better-chat.remember': ['content'],
      'better-chat.forget': ['content'],
      'better-chat.music': ['keyword', 'source'],
      'better-chat.switchMusicSource': ['source'],
      'better-chat.signIn': [],
      'better-chat.authorize': ['userId'],
      'better-chat.revokeAuth': ['userId']
    };
    return toolArgs[toolName] || [];
  }

  correctToolCall(toolCall) {
    if (!toolCall || !toolCall.tool) return toolCall;
    
    const originalTool = toolCall.tool;
    const correctedTool = this.findBestToolMatch(originalTool);
    
    if (!correctedTool) return toolCall;
    
    const corrected = { ...toolCall, tool: correctedTool };
    
    if (corrected.args) {
      const correctedArgs = {};
      for (const [key, value] of Object.entries(corrected.args)) {
        const correctedKey = this.findBestArgMatch(key, correctedTool);
        correctedArgs[correctedKey] = value;
      }
      corrected.args = correctedArgs;
    }
    
    if (correctedTool.toLowerCase() !== originalTool.toLowerCase()) {
      console.log(`\x1b[36m【模型适配】工具名纠正: ${originalTool} -> ${correctedTool}\x1b[0m`);
    }
    
    return corrected;
  }

  adaptSystemPrompt(prompt, modelName, options = {}) {
    const caps = this.detectModel(modelName);
    return prompt;
  }

  getPromptEnhancement(modelName) {
    const caps = this.detectModel(modelName);
    
    if (caps.level === 'standard') {
      return `

【工具调用格式】
当需要使用工具时，必须严格按照以下JSON格式输出：
\`\`\`json
{
  "tool": "工具名称",
  "args": {
    "参数名": "参数值"
  }
}
\`\`\`
注意：tool和args必须拼写正确，不要使用其他变体！`;
    }
    
    return '';
  }

  shouldUseMemory(modelName) {
    const caps = this.detectModel(modelName);
    return caps.memory !== false;
  }

  shouldUseTools(modelName) {
    const caps = this.detectModel(modelName);
    return caps.tools !== false;
  }

  getRecommendedSettings(modelName) {
    const caps = this.detectModel(modelName);
    
    return {
      temperature: 0.9,
      max_tokens: 4000,
      useTools: true,
      useMemory: true
    };
  }
}

const modelAdapter = new ModelAdapter();
export default modelAdapter;
