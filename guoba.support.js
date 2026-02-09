import path from 'path';
import fs from 'fs';
import configManager from './model/config.js';

export function supportGuoba() {
  return {
    pluginInfo: {
      name: '风云-AI助手',
      title: '风云-AI助手',
      author: '@fengyun',
      authorLink: 'https://github.com/fengyun',
      link: 'https://github.com/fengyun/ai-plugin',
      isV3: true,
      isV2: false,
      description: '智能AI助手，支持群管理、识图、语义检索、网页管理端配置',
      icon: 'chat-bubble-outline',
      iconColor: '#00c4b4',
    },
    configInfo: {
      schemas: [
        {
          field: 'apiConfig.baseUrl',
          label: '聊天接口地址',
          bottomHelpText: 'AI 聊天的 API 基础地址',
          type: 'input',
          def: 'https://api.gptgod.online/v1'
        },
        {
          field: 'apiConfig.apiKey',
          label: '聊天 API 密钥',
          bottomHelpText: '用于聊天的 API Key',
          type: 'password',
          def: ''
        },
        {
          field: 'apiConfig.chatModel',
          label: '聊天模型',
          bottomHelpText: '使用的聊天模型名称',
          type: 'input',
          def: 'gemini-3-pro'
        },
        {
          field: 'visionConfig.enabled',
          label: '启用识图',
          bottomHelpText: '是否开启图片识别功能',
          type: 'switch',
          def: true
        },
        {
          field: 'visionConfig.apiKey',
          label: '识图 API 密钥',
          bottomHelpText: '用于识图的 API Key（通常与聊天相同）',
          type: 'password',
          def: ''
        },
        {
          field: 'visionConfig.model',
          label: '识图模型',
          bottomHelpText: '使用的识图模型名称',
          type: 'input',
          def: 'claude-3-sonnet-20240229'
        },
        {
          field: 'triggerConfig.prefix',
          label: '触发前缀',
          bottomHelpText: '触发 AI 的前缀，为空则仅 @ 触发',
          type: 'input',
          def: '白子'
        },
        {
          field: 'triggerConfig.globalAIChance',
          label: '全局触发概率',
          bottomHelpText: '群内随机触发的概率 (0-1)',
          type: 'number',
          def: 0.8
        },
        {
          field: 'securityConfig.webAdminPort',
          label: '网页管理端口',
          bottomHelpText: 'Web 管理端的端口号',
          type: 'number',
          def: 54188
        }
      ],
      getConfigData() {
        return configManager.config;
      },
      setConfigData(data, { e }) {
        let config = configManager.config;
        for (let key in data) {
          if (data[key] !== config[key]) {
            configManager.updateConfig(key, data[key]);
          }
        }
        return { result: 'OK' };
      }
    }
  };
}
