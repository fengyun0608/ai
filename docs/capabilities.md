# 风云 AI 插件能力概述

## 插件信息

| 属性 | 值 |
|------|-----|
| 名称 | fengyun-ai-plugin |
| 版本 | 1.0.0 |
| 类型 | ES Module |
| 作者 | fengyun |
| 许可证 | MIT |

## 核心能力矩阵

### 1. 智能对话系统

| 能力 | 描述 | 实现位置 |
|------|------|---------|
| 流式响应 | 打字机效果输出，提升用户体验 | `stream/better-chat.js` |
| 上下文记忆 | BM25 语义检索，支持历史对话关联 | `lib/aistream/aistream.js` |
| 多模型支持 | 支持 DeepSeek、GPT、Claude 等主流模型 | `lib/factory/llm/LLMFactory.js` |
| 重试机制 | 指数退避重试，保障服务稳定性 | `lib/aistream/aistream.js` |

### 2. MCP 工具协议

风云 AI 实现了完整的 MCP (Model Context Protocol) 工具协议，赋予 AI 真实的执行力：

| 工具名称 | 功能 | 权限要求 |
|---------|------|---------|
| `reply` | 发送文本消息 | 无 |
| `at` | @群成员（支持随机） | 群聊 |
| `poke` | 戳一戳用户（支持随机） | 无 |
| `like` | 点赞名片 | 无 |
| `emotion` | 发送表情包图片 | 无 |
| `emojiReaction` | 表情回应 | 群聊 |
| `setEssence` | 设置精华消息 | 群管理 |
| `removeEssence` | 取消精华消息 | 群管理 |
| `announce` | 发布群公告 | 群管理 |
| `remember` | 记忆重要信息 | 无 |
| `forget` | 忘记信息 | 无 |
| `music` | 点歌 | 无 |
| `switchMusicSource` | 切换音乐源 | 无 |
| `signIn` | 群签到 | 群聊 |
| `friendsInGroup` | 查看好友在群 | 群聊 |
| `ban` | 禁言群成员 | 群管理 |
| `banAll` | 开启全体禁言 | 群管理 |
| `unbanAll` | 解除全体禁言 | 群管理 |
| `groupCount` | 获取群人数 | 群聊 |
| `webSearch` | 网络搜索 | 无 |

### 3. 多模态交互

| 模态 | 能力 | 配置项 |
|------|------|--------|
| 文本 | 智能对话、上下文理解 | `apiConfig.*` |
| 图像 | 图片内容识别与描述 | `visionConfig.*` |
| 表情 | 6 种情绪类型表情包 | `resources/aiimages/` |
| 音频 | 背景音乐播放 | `web-admin/*.mp3` |

### 4. 记忆系统

```javascript
// 记忆层级
{
  short: {  // 短期记忆
    ttl: '24h',
    scope: 'session'
  },
  long: {   // 长期记忆
    ttl: '72h',
    scope: 'cross-session'
  }
}
```

| 特性 | 说明 |
|------|------|
| 场景隔离 | 群组与私聊记忆独立存储 |
| 语义检索 | BM25 算法相似度匹配 |
| 自动清理 | 过期记忆自动回收 |
| 管理员特权 | 管理员可查看所有记忆 |

### 5. 权限控制

```
权限层级：
├── master (管理员) - 最高权限
├── admin (群管理) - 群管理权限
├── whitelist (白名单) - 触发权限
└── blacklist (黑名单) - 拒绝服务
```

| 配置项 | 作用 |
|--------|------|
| `whitelist.groups` | @/前缀触发的群组 |
| `whitelist.users` | 私聊触发权限用户 |
| `whitelist.globalGroups` | 全局 AI 群组（无需触发） |
| `blacklist.users` | 禁止服务用户 |

### 6. Web 管理端

| 功能 | 路由 | 说明 |
|------|------|------|
| 登录 | `/new-login.html` | 验证码登录 |
| 配置 | `/new-config.html` | 可视化配置管理 |
| API | `/get-config` | 获取配置 |
| API | `/save-config` | 保存配置 |
| API | `/generate-code` | 生成验证码 |

## 技术架构

```
ai-plugin/
├── index.js              # 插件入口
├── apps/
│   └── ai.js             # 指令处理
├── stream/
│   └── better-chat.js    # 增强版聊天工作流
├── model/
│   ├── ai-logic.js       # AI 逻辑处理
│   ├── config.js         # 配置管理
│   ├── persona.js        # 人设管理
│   └── web-admin.js      # Web 管理端
├── lib/
│   └── music.js          # 音乐源管理
├── web-admin/
│   ├── app.js            # Express 服务
│   ├── new-login.html    # 登录页
│   ├── new-config.html   # 配置页
│   └── *.mp3             # 背景音乐
├── resources/
│   └── aiimages/         # 表情包资源
│       ├── 开心/
│       ├── 惊讶/
│       ├── 伤心/
│       ├── 大笑/
│       ├── 害怕/
│       └── 生气/
├── guoba.support.js      # Guoba 配置支持
└── docs/                 # 文档目录
```

## 依赖关系

```json
{
  "dependencies": {
    "node-fetch": "^3.3.2",
    "form-data": "^4.0.0",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "connect-redis": "^7.1.0",
    "redis": "^4.6.10"
  }
}
```

## 与核心库的集成

| 核心库 | 用途 |
|--------|------|
| `lib/aistream/aistream.js` | AI 工作流基类 |
| `lib/aistream/loader.js` | 工作流加载器 |
| `lib/aistream/memory.js` | 记忆系统 |
| `lib/factory/llm/LLMFactory.js` | LLM 工厂 |
| `lib/util.js` | 工具函数 |

## 性能指标

| 指标 | 数值 |
|------|------|
| 工作流优先级 | 5 (高优先级) |
| 默认温度 | 0.85 |
| 最大 Token | 6000 |
| 超时时间 | 30s |
| 重试次数 | 3 |
| 记忆上限 | 60条/用户 |
