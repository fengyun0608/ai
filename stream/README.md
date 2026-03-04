# MCP 工具开发指南

本文档介绍如何在 `stream` 目录下开发自定义 MCP 工具。

## 目录结构

```
plugins/ai-plugin/
├── stream/
│   ├── better-chat.js      # 主工作流（内置）
│   ├── my-tool.js          # 自定义工具示例
│   └── tool-template.js    # 工具模板
└── index.js                # 自动加载所有工作流
```

## 快速开始

### 1. 复制模板

```bash
cp stream/tool-template.js stream/my-tool.js
```

### 2. 修改配置

```javascript
export default class MyToolStream extends AIStream {
  constructor() {
    super({
      name: 'my-tool',           // 工具名称（唯一标识）
      description: '我的自定义工具',
      version: '1.0.0',
      author: 'your-name',
      priority: 5,               // 优先级
      config: {
        enabled: true,
        temperature: 0.85,
      }
    });
  }
}
```

### 3. 注册工具

```javascript
registerTools() {
  this.registerTool('myTool.example', {
    description: '工具描述',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: '参数1' }
      },
      required: ['param1']
    },
    handler: async (args, context) => {
      const { e } = context;
      // 工具逻辑
      return { success: true, result: '执行成功' };
    }
  });
}
```

## 工具命名规范

工具名格式：`类别.功能`

| 类别 | 示例 |
|------|------|
| 群管理 | `group.ban`, `group.kick` |
| 消息 | `message.reply`, `message.at` |
| 娱乐 | `music.play`, `game.guess` |
| 系统 | `system.status`, `system.config` |

## 权限控制

```javascript
handler: async (args, context) => {
  const { e } = context;
  
  // 权限检查
  const permissionCheck = await permissionManager.checkToolPermission(e, 'toolName', args);
  if (!permissionCheck.allowed) {
    await e.reply(`⚠️ ${permissionCheck.reason}`);
    return { success: false, error: permissionCheck.reason };
  }
  
  // 执行操作
  return { success: true };
}
```

## 系统提示词

```javascript
buildSystemPrompt(context) {
  return `你是工具助手。

【工具列表】
1. myTool.example - 工具描述
   参数: param1(参数说明)

【示例】
用户: 执行某操作
回复: {"tool":"myTool.example","args":{"param1":"值"}}`;
}
```

## 可用上下文

```javascript
handler: async (args, context) => {
  const { e, question, apiConfig } = context;
  
  // e - Yunzai 事件对象
  // e.user_id - 用户QQ
  // e.group_id - 群号
  // e.reply() - 发送消息
  // e.group - 群对象
  // e.bot - 机器人对象
  
  // question - 用户问题
  // apiConfig - API配置
}
```

## 常用操作

### 发送消息
```javascript
await e.reply('消息内容');
await e.reply([segment.at(userId), ' 消息内容']);
```

### 获取群成员
```javascript
const memberMap = await e.group.getMemberMap();
const members = Array.from(memberMap.values());
```

### 调用 API
```javascript
await e.bot.sendApi('api_name', { param: value });
```

## 调试

工具加载时会显示日志：
```
【风云AI】正在加载工作流工具: better-chat.js, my-tool.js
【风云AI】工作流工具加载成功：my-tool.js
```

如果加载失败会显示错误信息。

## 完整示例

```javascript
import AIStream from '../../../lib/aistream/aistream.js';

export default class MusicToolStream extends AIStream {
  constructor() {
    super({
      name: 'music-tool',
      description: '音乐播放工具',
      version: '1.0.0',
      author: 'developer',
      priority: 5,
    });
  }

  registerTools() {
    this.registerTool('music.play', {
      description: '播放音乐',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '歌名' }
        },
        required: ['keyword']
      },
      handler: async (args, context) => {
        const { e } = context;
        const keyword = args.keyword;
        
        // 搜索并播放音乐
        await e.reply(`正在播放: ${keyword}`);
        return { success: true, result: '播放成功' };
      }
    });
  }

  buildSystemPrompt(context) {
    return `你是音乐助手。

【工具】
music.play - 播放音乐
参数: keyword(歌名)

【示例】
用户: 我想听水手
回复: {"tool":"music.play","args":{"keyword":"水手"}}`;
  }
}
```

## 注意事项

1. 工具名必须唯一，不能与已有工具重名
2. 返回值必须是 `{ success: boolean, result?: string, error?: string }`
3. 错误处理要完善，避免崩溃
4. 权限敏感操作要检查权限
