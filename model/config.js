import fs from 'fs';
import path from 'path';

const _path = process.cwd();

export const defaultConfig = {
  // 聊天API配置（只用于文本聊天）
  apiConfig: {
    baseUrl: 'https://api.gptgod.online/v1',
    apiKey: '',
    chatModel: 'gemini-3-pro',
    temperature: 1.3,
    max_tokens: 6000,
    top_p: 0.9,
    presence_penalty: 0.6,
    frequency_penalty: 0.6,
    timeout: 30000
  },
  // 白名单配置
  whitelist: {
    groups: [],
    users: [],
    globalGroups: []
  },
  // 黑名单配置（仅用户级别）
  blacklist: {
    users: []
  },
  // 独立识图配置（完全独立，不使用聊天API配置）
  visionConfig: {
    enabled: true,
    apiBaseUrl: 'https://api.gptgod.online/v1',
    apiKey: '',
    model: 'claude-3-sonnet-20240229',
    uploadEnabled: true,
    uploadUrl: 'https://api.gptgod.online/v1/file',
    temperature: 1,
    max_tokens: 2000,
    timeout: 30000,
    systemPrompt: `请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节`
  },
  // 触发配置
  triggerConfig: {
    prefix: '白子',
    globalAICooldown: 3,
    globalAIChance: 0.8
  },
  // 语义检索配置
  embeddingConfig: {
    enabled: true,
    provider: 'lightweight',
    apiUrl: null,
    apiKey: null,
    apiModel: 'text-embedding-ada-002',
    maxContexts: 5,
    similarityThreshold: 0.6,
    cacheExpiry: 86400
  },
  // 安全权限配置
  permissionConfig: {
    enabled: true,
    masterOnlyMode: false,
    protectedActions: ['setEssence', 'removeEssence', 'announce', 'signIn'],
    protectedActionPermission: 'admin',
    protectedUsers: [],
    cantTouchMaster: true
  },
  // 安全配置
  securityConfig: {
    webAdminPort: 54188,
    tempCodeExpire: 300,
    tempCodes: {},
    outerIp: ""
  }
};

class ConfigManager {
  constructor() {
    this.configFile = path.join(_path, 'data', 'ai', 'config.json');
    this.config = this.loadConfig();
  }

  // 加载配置
  loadConfig() {
    try {
      if (!fs.existsSync(path.dirname(this.configFile))) {
        fs.mkdirSync(path.dirname(this.configFile), { recursive: true });
      }
      if (fs.existsSync(this.configFile)) {
        const content = fs.readFileSync(this.configFile, 'utf8');
        return { ...defaultConfig, ...JSON.parse(content) };
      }
    } catch (error) {
      console.error(`\x1b[31m【风云AI】加载配置失败: ${error.message}\x1b[0m`);
    }
    // 使用默认配置并保存
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  // 保存配置
  saveConfig(config) {
    try {
      if (!fs.existsSync(path.dirname(this.configFile))) {
        fs.mkdirSync(path.dirname(this.configFile), { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`\x1b[31m【风云AI】保存配置失败: ${error.message}\x1b[0m`);
      return false;
    }
  }

  // 更新配置
  updateConfig(keyPath, value) {
    const keys = keyPath.split('.');
    let config = this.config;
    
    // 遍历到最后一个key的父对象
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!config[key]) {
        config[key] = {};
      }
      config = config[key];
    }
    
    // 设置值
    config[keys[keys.length - 1]] = value;
    return this.saveConfig(this.config);
  }

  // 获取配置值
  getConfigValue(keyPath) {
    const keys = keyPath.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (!value || typeof value !== 'object' || !(key in value)) {
        return undefined;
      }
      value = value[key];
    }
    return value;
  }
}

const configManager = new ConfigManager();
export default configManager;
