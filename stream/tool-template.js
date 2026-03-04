/**
 * MCP 工具模板
 * 
 * 将此文件复制到 stream 目录下，重命名为你的工具名.js
 * 工具会自动被插件加载
 * 
 * 注意：工具类必须继承 AIStream
 */

import AIStream from '../../../lib/aistream/aistream.js';
import permissionManager from '../model/security.js';

export default class MyToolStream extends AIStream {
  constructor() {
    super({
      name: 'my-tool',           // 工具名称（唯一标识）
      description: '我的自定义工具', // 工具描述
      version: '1.0.0',          // 版本号
      author: 'your-name',       // 作者
      priority: 5,               // 优先级（数字越小越优先）
      config: {
        enabled: true,           // 是否启用
        temperature: 0.85,       // 温度参数
      }
    });
  }

  /**
   * 注册工具
   * 在这里定义所有工具
   */
  registerTools() {
    // 示例工具 1：简单回复
    this.registerTool('myTool.hello', {
      description: '打招呼工具',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '用户名' }
        },
        required: ['name']
      },
      handler: async (args, context) => {
        const { e } = context;
        const name = args.name;
        
        await e.reply(`你好，${name}！`);
        return { success: true, result: '已打招呼' };
      }
    });

    // 示例工具 2：需要权限的工具
    this.registerTool('myTool.admin', {
      description: '管理员专用工具',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', description: '操作类型' }
        },
        required: ['action']
      },
      handler: async (args, context) => {
        const { e } = context;
        
        // 权限检查
        const permissionCheck = await permissionManager.checkToolPermission(e, 'myTool.admin', args);
        if (!permissionCheck.allowed) {
          await e.reply(`⚠️ ${permissionCheck.reason}`);
          return { success: false, error: permissionCheck.reason };
        }
        
        // 执行操作
        await e.reply(`执行管理员操作: ${args.action}`);
        return { success: true, result: '操作完成' };
      }
    });
  }

  /**
   * 构建系统提示词
   * 告诉 AI 它拥有的能力
   */
  buildSystemPrompt(context) {
    return `你是一个自定义工具助手。

【工具列表】
1. myTool.hello - 打招呼
   参数: name(用户名)

2. myTool.admin - 管理员操作
   参数: action(操作类型)

【示例】
用户: 跟小明打个招呼
回复: {"tool":"myTool.hello","args":{"name":"小明"}}`;
  }
}
