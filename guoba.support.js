import configManager from './model/config.js';

export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'ai-plugin',
      title: '风云-AI助手',
      author: '@fengyun',
      authorLink: 'https://github.com/fengyun0608',
      link: 'https://github.com/fengyun0608/ai',
      isV3: true,
      isV2: false,
      description: '智能AI助手，支持群管理、识图、语义检索、网页管理端配置',
      iconPath: 'https://q.qlogo.cn/g?b=qq&s=0&nk=3669962171'
    },
    configInfo: {
      schemas: [
        {
          component: 'SOFT_GROUP_BEGIN',
          label: '聊天API配置'
        },
        {
          field: 'apiConfig.baseUrl',
          label: 'API地址',
          bottomHelpMessage: 'GPTGod API基础地址',
          component: 'Input',
          required: true
        },
        {
          field: 'apiConfig.apiKey',
          label: 'API密钥',
          bottomHelpMessage: '用于文本聊天的API密钥',
          component: 'Input',
          componentProps: {
            type: 'password'
          },
          required: true
        },
        {
          field: 'apiConfig.chatModel',
          label: '聊天模型',
          bottomHelpMessage: '文本聊天使用的模型名称',
          component: 'Input'
        },
        {
          field: 'apiConfig.temperature',
          label: '温度 (0-2)',
          bottomHelpMessage: '值越高创意越强，值越低越稳定',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            max: 2,
            step: 0.1
          }
        },
        {
          field: 'apiConfig.max_tokens',
          label: '最大Token',
          bottomHelpMessage: 'AI回复的最大字符数',
          component: 'InputNumber',
          componentProps: {
            min: 100,
            step: 100
          }
        },
        {
          field: 'apiConfig.top_p',
          label: 'Top-P采样 (0-1)',
          bottomHelpMessage: '核采样参数',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            max: 1,
            step: 0.1
          }
        },
        {
          field: 'apiConfig.presence_penalty',
          label: '存在惩罚 (0-2)',
          bottomHelpMessage: '存在惩罚参数',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            max: 2,
            step: 0.1
          }
        },
        {
          field: 'apiConfig.frequency_penalty',
          label: '频率惩罚 (0-2)',
          bottomHelpMessage: '频率惩罚参数',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            max: 2,
            step: 0.1
          }
        },
        {
          field: 'apiConfig.timeout',
          label: '超时时间 (毫秒)',
          bottomHelpMessage: 'API请求超时时间',
          component: 'InputNumber',
          componentProps: {
            min: 5000,
            step: 5000
          }
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '白名单配置'
        },
        {
          field: 'whitelist.groups',
          label: '触发白名单群号',
          bottomHelpMessage: '多个群号用英文逗号分隔，@或前缀触发需要在此名单中',
          component: 'Input'
        },
        {
          field: 'whitelist.users',
          label: '触发白名单用户',
          bottomHelpMessage: '多个QQ号用英文逗号分隔，私聊触发需要在此名单中',
          component: 'Input'
        },
        {
          field: 'whitelist.globalGroups',
          label: '全局AI群号',
          bottomHelpMessage: '多个群号用英文逗号分隔，无需@即可主动参与聊天',
          component: 'Input'
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '黑名单配置'
        },
        {
          field: 'blacklist.users',
          label: '黑名单用户',
          bottomHelpMessage: '多个QQ号用英文逗号分隔，黑名单用户的消息将被忽略',
          component: 'Input'
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '识图设置'
        },
        {
          field: 'visionConfig.enabled',
          label: '启用识图功能',
          bottomHelpMessage: '是否开启图片识别功能',
          component: 'Switch'
        },
        {
          field: 'visionConfig.apiBaseUrl',
          label: '识图API地址',
          bottomHelpMessage: '识图API基础地址，可与聊天API不同',
          component: 'Input'
        },
        {
          field: 'visionConfig.apiKey',
          label: '识图API密钥',
          bottomHelpMessage: '独立于聊天API的密钥，提高安全性',
          component: 'Input',
          componentProps: {
            type: 'password'
          }
        },
        {
          field: 'visionConfig.model',
          label: '识图模型',
          bottomHelpMessage: '专门用于图片识别的模型',
          component: 'Input'
        },
        {
          field: 'visionConfig.uploadEnabled',
          label: '启用文件上传',
          bottomHelpMessage: '是否启用图片文件上传功能',
          component: 'Switch'
        },
        {
          field: 'visionConfig.uploadUrl',
          label: '文件上传地址',
          bottomHelpMessage: '图片上传API地址，可为空（直接使用图片链接）',
          component: 'Input'
        },
        {
          field: 'visionConfig.temperature',
          label: '识图温度 (0-2)',
          bottomHelpMessage: '识图的温度参数',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            max: 2,
            step: 0.1
          }
        },
        {
          field: 'visionConfig.max_tokens',
          label: '识图最大Token',
          bottomHelpMessage: '识图回复的最大字符数',
          component: 'InputNumber',
          componentProps: {
            min: 100,
            step: 100
          }
        },
        {
          field: 'visionConfig.timeout',
          label: '识图超时时间 (毫秒)',
          bottomHelpMessage: '识图API请求超时时间',
          component: 'InputNumber',
          componentProps: {
            min: 5000,
            step: 5000
          }
        },
        {
          field: 'visionConfig.systemPrompt',
          label: '识图系统提示词',
          bottomHelpMessage: '控制AI如何描述图片，可自定义提示词',
          component: 'InputTextArea',
          componentProps: {
            rows: 4
          }
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '触发配置'
        },
        {
          field: 'triggerConfig.prefix',
          label: '触发前缀',
          bottomHelpMessage: '留空则仅@触发，如设置为"风云"，则"风云你好"会触发',
          component: 'Input'
        },
        {
          field: 'triggerConfig.globalAICooldown',
          label: '全局AI冷却时间 (秒)',
          bottomHelpMessage: '全局AI两次触发之间的最小间隔时间',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            step: 1
          }
        },
        {
          field: 'triggerConfig.globalAIChance',
          label: '全局AI触发概率 (0-1)',
          bottomHelpMessage: '满足条件时AI主动参与聊天的概率',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            max: 1,
            step: 0.1
          }
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '人设配置'
        },
        {
          field: 'persona',
          label: 'AI人设描述',
          bottomHelpMessage: '{Master}会自动替换为配置的管理员名字，建议详细描述性格、语气、行为习惯等',
          component: 'InputTextArea',
          componentProps: {
            rows: 10
          }
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '语义检索配置'
        },
        {
          field: 'embeddingConfig.enabled',
          label: '启用语义检索',
          bottomHelpMessage: '是否启用语义检索功能',
          component: 'Switch'
        },
        {
          field: 'embeddingConfig.provider',
          label: '提供商',
          bottomHelpMessage: '语义检索的提供商',
          component: 'Select',
          componentProps: {
            options: [
              { label: 'lightweight (轻量级本地模型)', value: 'lightweight' },
              { label: 'onnx (本地推理)', value: 'onnx' },
              { label: 'hf (HuggingFace模型)', value: 'hf' },
              { label: 'fasttext (快速文本)', value: 'fasttext' },
              { label: 'api (外部API)', value: 'api' }
            ]
          }
        },
        {
          field: 'embeddingConfig.apiUrl',
          label: 'API地址',
          bottomHelpMessage: '仅provider=api时需要',
          component: 'Input'
        },
        {
          field: 'embeddingConfig.apiKey',
          label: 'API密钥',
          bottomHelpMessage: '仅provider=api时需要',
          component: 'Input',
          componentProps: {
            type: 'password'
          }
        },
        {
          field: 'embeddingConfig.apiModel',
          label: 'API模型',
          bottomHelpMessage: '仅provider=api时需要，如：text-embedding-ada-002',
          component: 'Input'
        },
        {
          field: 'embeddingConfig.maxContexts',
          label: '最大检索上下文数',
          bottomHelpMessage: '语义检索返回的最大上下文数量',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            max: 20,
            step: 1
          }
        },
        {
          field: 'embeddingConfig.similarityThreshold',
          label: '相似度阈值 (0-1)',
          bottomHelpMessage: '语义检索的相似度阈值',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            max: 1,
            step: 0.1
          }
        },
        {
          field: 'embeddingConfig.cacheExpiry',
          label: '缓存过期时间 (秒)',
          bottomHelpMessage: '语义检索缓存的过期时间',
          component: 'InputNumber',
          componentProps: {
            min: 3600,
            step: 3600
          }
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '安全权限配置'
        },
        {
          field: 'permissionConfig.enabled',
          label: '启用权限控制',
          bottomHelpMessage: '是否启用权限控制功能',
          component: 'Switch'
        },
        {
          field: 'permissionConfig.masterOnlyMode',
          label: '仅管理员模式',
          bottomHelpMessage: '开启后只有管理员可以使用AI',
          component: 'Switch'
        },
        {
          field: 'permissionConfig.protectedActions',
          label: '受保护的操作',
          bottomHelpMessage: '需要特定权限才能执行的操作，多个用英文逗号分隔',
          component: 'Input'
        },
        {
          field: 'permissionConfig.protectedActionPermission',
          label: '受保护操作权限级别',
          bottomHelpMessage: '执行受保护操作所需的权限级别',
          component: 'Select',
          componentProps: {
            options: [
              { label: '管理员', value: 'admin' },
              { label: '群主', value: 'owner' },
              { label: '任何人', value: 'anyone' }
            ]
          }
        },
        {
          field: 'permissionConfig.protectedUsers',
          label: '受保护用户',
          bottomHelpMessage: '受保护的用户QQ号，多个用英文逗号分隔',
          component: 'Input'
        },
        {
          field: 'permissionConfig.cantTouchMaster',
          label: '禁止操作管理员',
          bottomHelpMessage: '是否禁止AI对管理员执行敏感操作',
          component: 'Switch'
        },

        {
          component: 'SOFT_GROUP_BEGIN',
          label: '安全配置'
        },
        {
          field: 'securityConfig.webAdminPort',
          label: '网页管理端口',
          bottomHelpMessage: 'Web管理端的端口号',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            max: 65535,
            step: 1
          }
        },
        {
          field: 'securityConfig.tempCodeExpire',
          label: '临时码过期时间 (秒)',
          bottomHelpMessage: '登录临时码的有效时间',
          component: 'InputNumber',
          componentProps: {
            min: 60,
            step: 60
          }
        },
        {
          field: 'securityConfig.outerIp',
          label: '外网IP',
          bottomHelpMessage: '用于外网访问的IP地址',
          component: 'Input'
        }
      ],
      getConfigData() {
        const config = configManager.config;
        return {
          apiConfig: {
            baseUrl: config.apiConfig?.baseUrl || 'https://api.gptgod.online/v1',
            apiKey: config.apiConfig?.apiKey || '',
            chatModel: config.apiConfig?.chatModel || 'gemini-3-pro',
            temperature: config.apiConfig?.temperature ?? 1.3,
            max_tokens: config.apiConfig?.max_tokens ?? 6000,
            top_p: config.apiConfig?.top_p ?? 0.9,
            presence_penalty: config.apiConfig?.presence_penalty ?? 0.6,
            frequency_penalty: config.apiConfig?.frequency_penalty ?? 0.6,
            timeout: config.apiConfig?.timeout ?? 30000
          },
          whitelist: {
            groups: arrayToString(config.whitelist?.groups || []),
            users: arrayToString(config.whitelist?.users || []),
            globalGroups: arrayToString(config.whitelist?.globalGroups || [])
          },
          blacklist: {
            users: arrayToString(config.blacklist?.users || [])
          },
          visionConfig: {
            enabled: config.visionConfig?.enabled ?? true,
            apiBaseUrl: config.visionConfig?.apiBaseUrl || 'https://api.gptgod.online/v1',
            apiKey: config.visionConfig?.apiKey || '',
            model: config.visionConfig?.model || 'claude-3-sonnet-20240229',
            uploadEnabled: config.visionConfig?.uploadEnabled ?? true,
            uploadUrl: config.visionConfig?.uploadUrl || 'https://api.gptgod.online/v1/file',
            temperature: config.visionConfig?.temperature ?? 1.0,
            max_tokens: config.visionConfig?.max_tokens ?? 2000,
            timeout: config.visionConfig?.timeout ?? 30000,
            systemPrompt: config.visionConfig?.systemPrompt || '请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节'
          },
          triggerConfig: {
            prefix: config.triggerConfig?.prefix || '白子',
            globalAICooldown: config.triggerConfig?.globalAICooldown ?? 3,
            globalAIChance: config.triggerConfig?.globalAIChance ?? 0.8
          },
          persona: config.persona || '',
          embeddingConfig: {
            enabled: config.embeddingConfig?.enabled ?? true,
            provider: config.embeddingConfig?.provider || 'lightweight',
            apiUrl: config.embeddingConfig?.apiUrl || '',
            apiKey: config.embeddingConfig?.apiKey || '',
            apiModel: config.embeddingConfig?.apiModel || 'text-embedding-ada-002',
            maxContexts: config.embeddingConfig?.maxContexts ?? 5,
            similarityThreshold: config.embeddingConfig?.similarityThreshold ?? 0.6,
            cacheExpiry: config.embeddingConfig?.cacheExpiry ?? 86400
          },
          permissionConfig: {
            enabled: config.permissionConfig?.enabled ?? true,
            masterOnlyMode: config.permissionConfig?.masterOnlyMode ?? false,
            protectedActions: arrayToString(config.permissionConfig?.protectedActions || []),
            protectedActionPermission: config.permissionConfig?.protectedActionPermission || 'admin',
            protectedUsers: arrayToString(config.permissionConfig?.protectedUsers || []),
            cantTouchMaster: config.permissionConfig?.cantTouchMaster ?? true
          },
          securityConfig: {
            webAdminPort: config.securityConfig?.webAdminPort ?? 54188,
            tempCodeExpire: config.securityConfig?.tempCodeExpire ?? 300,
            outerIp: config.securityConfig?.outerIp || ''
          }
        };
      },
      setConfigData(data, { Result }) {
        const config = configManager.config;

        if (data['apiConfig.baseUrl'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.baseUrl = data['apiConfig.baseUrl'];
        }
        if (data['apiConfig.apiKey'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.apiKey = data['apiConfig.apiKey'];
        }
        if (data['apiConfig.chatModel'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.chatModel = data['apiConfig.chatModel'];
        }
        if (data['apiConfig.temperature'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.temperature = data['apiConfig.temperature'];
        }
        if (data['apiConfig.max_tokens'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.max_tokens = data['apiConfig.max_tokens'];
        }
        if (data['apiConfig.top_p'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.top_p = data['apiConfig.top_p'];
        }
        if (data['apiConfig.presence_penalty'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.presence_penalty = data['apiConfig.presence_penalty'];
        }
        if (data['apiConfig.frequency_penalty'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.frequency_penalty = data['apiConfig.frequency_penalty'];
        }
        if (data['apiConfig.timeout'] !== undefined) {
          config.apiConfig = config.apiConfig || {};
          config.apiConfig.timeout = data['apiConfig.timeout'];
        }

        if (data['whitelist.groups'] !== undefined) {
          config.whitelist = config.whitelist || {};
          config.whitelist.groups = stringToArray(data['whitelist.groups']);
        }
        if (data['whitelist.users'] !== undefined) {
          config.whitelist = config.whitelist || {};
          config.whitelist.users = stringToArray(data['whitelist.users']);
        }
        if (data['whitelist.globalGroups'] !== undefined) {
          config.whitelist = config.whitelist || {};
          config.whitelist.globalGroups = stringToArray(data['whitelist.globalGroups']);
        }

        if (data['blacklist.users'] !== undefined) {
          config.blacklist = config.blacklist || {};
          config.blacklist.users = stringToArray(data['blacklist.users']);
        }

        if (data['visionConfig.enabled'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.enabled = data['visionConfig.enabled'];
        }
        if (data['visionConfig.apiBaseUrl'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.apiBaseUrl = data['visionConfig.apiBaseUrl'];
        }
        if (data['visionConfig.apiKey'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.apiKey = data['visionConfig.apiKey'];
        }
        if (data['visionConfig.model'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.model = data['visionConfig.model'];
        }
        if (data['visionConfig.uploadEnabled'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.uploadEnabled = data['visionConfig.uploadEnabled'];
        }
        if (data['visionConfig.uploadUrl'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.uploadUrl = data['visionConfig.uploadUrl'];
        }
        if (data['visionConfig.temperature'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.temperature = data['visionConfig.temperature'];
        }
        if (data['visionConfig.max_tokens'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.max_tokens = data['visionConfig.max_tokens'];
        }
        if (data['visionConfig.timeout'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.timeout = data['visionConfig.timeout'];
        }
        if (data['visionConfig.systemPrompt'] !== undefined) {
          config.visionConfig = config.visionConfig || {};
          config.visionConfig.systemPrompt = data['visionConfig.systemPrompt'];
        }

        if (data['triggerConfig.prefix'] !== undefined) {
          config.triggerConfig = config.triggerConfig || {};
          config.triggerConfig.prefix = data['triggerConfig.prefix'];
        }
        if (data['triggerConfig.globalAICooldown'] !== undefined) {
          config.triggerConfig = config.triggerConfig || {};
          config.triggerConfig.globalAICooldown = data['triggerConfig.globalAICooldown'];
        }
        if (data['triggerConfig.globalAIChance'] !== undefined) {
          config.triggerConfig = config.triggerConfig || {};
          config.triggerConfig.globalAIChance = data['triggerConfig.globalAIChance'];
        }

        if (data['persona'] !== undefined) {
          config.persona = data['persona'];
        }

        if (data['embeddingConfig.enabled'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.enabled = data['embeddingConfig.enabled'];
        }
        if (data['embeddingConfig.provider'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.provider = data['embeddingConfig.provider'];
        }
        if (data['embeddingConfig.apiUrl'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.apiUrl = data['embeddingConfig.apiUrl'] || null;
        }
        if (data['embeddingConfig.apiKey'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.apiKey = data['embeddingConfig.apiKey'] || null;
        }
        if (data['embeddingConfig.apiModel'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.apiModel = data['embeddingConfig.apiModel'];
        }
        if (data['embeddingConfig.maxContexts'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.maxContexts = data['embeddingConfig.maxContexts'];
        }
        if (data['embeddingConfig.similarityThreshold'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.similarityThreshold = data['embeddingConfig.similarityThreshold'];
        }
        if (data['embeddingConfig.cacheExpiry'] !== undefined) {
          config.embeddingConfig = config.embeddingConfig || {};
          config.embeddingConfig.cacheExpiry = data['embeddingConfig.cacheExpiry'];
        }

        if (data['permissionConfig.enabled'] !== undefined) {
          config.permissionConfig = config.permissionConfig || {};
          config.permissionConfig.enabled = data['permissionConfig.enabled'];
        }
        if (data['permissionConfig.masterOnlyMode'] !== undefined) {
          config.permissionConfig = config.permissionConfig || {};
          config.permissionConfig.masterOnlyMode = data['permissionConfig.masterOnlyMode'];
        }
        if (data['permissionConfig.protectedActions'] !== undefined) {
          config.permissionConfig = config.permissionConfig || {};
          config.permissionConfig.protectedActions = stringToArray(data['permissionConfig.protectedActions']);
        }
        if (data['permissionConfig.protectedActionPermission'] !== undefined) {
          config.permissionConfig = config.permissionConfig || {};
          config.permissionConfig.protectedActionPermission = data['permissionConfig.protectedActionPermission'];
        }
        if (data['permissionConfig.protectedUsers'] !== undefined) {
          config.permissionConfig = config.permissionConfig || {};
          config.permissionConfig.protectedUsers = stringToArray(data['permissionConfig.protectedUsers']);
        }
        if (data['permissionConfig.cantTouchMaster'] !== undefined) {
          config.permissionConfig = config.permissionConfig || {};
          config.permissionConfig.cantTouchMaster = data['permissionConfig.cantTouchMaster'];
        }

        if (data['securityConfig.webAdminPort'] !== undefined) {
          config.securityConfig = config.securityConfig || {};
          config.securityConfig.webAdminPort = data['securityConfig.webAdminPort'];
        }
        if (data['securityConfig.tempCodeExpire'] !== undefined) {
          config.securityConfig = config.securityConfig || {};
          config.securityConfig.tempCodeExpire = data['securityConfig.tempCodeExpire'];
        }
        if (data['securityConfig.outerIp'] !== undefined) {
          config.securityConfig = config.securityConfig || {};
          config.securityConfig.outerIp = data['securityConfig.outerIp'];
        }

        configManager.saveConfig(config);
        return Result.ok({}, '配置保存成功！');
      }
    }
  };
}

function stringToArray(str) {
  if (!str || str.trim() === '') return [];
  return str.split(',')
    .map(item => {
      const trimmed = item.trim();
      const num = parseInt(trimmed, 10);
      return isNaN(num) ? trimmed : num;
    })
    .filter(item => item !== '');
}

function arrayToString(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.join(', ');
}
