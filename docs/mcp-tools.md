# MCP 工具协议文档

## 概述

风云 AI 实现了完整的 MCP (Model Context Protocol) 工具协议，允许 AI 自主判断并调用工具执行操作。

## 工具调用格式

AI 通过以下 JSON 格式输出工具调用请求：

```json
```json
{
  "tool": "工具名称",
  "args": {
    "参数名": "参数值"
  }
}
```
```

## 工具列表

### 1. reply - 发送文本消息

发送文本消息到当前会话。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 消息内容 |

**示例：**
```json
{
  "tool": "reply",
  "args": {
    "content": "你好，我是风云 AI！"
  }
}
```

**注意事项：**
- 内置去重机制，3秒内相同内容不会重复发送
- 调用此工具后无需额外输出文本回复

---

### 2. at - @群成员

在群聊中 @ 指定用户。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| qq | string | 是 | 目标 QQ 号，或 "随机" |
| count | number | 否 | @ 几个人（随机时有效，默认1） |

**示例：**
```json
{
  "tool": "at",
  "args": {
    "qq": "123456789"
  }
}
```

**随机艾特示例：**
```json
{
  "tool": "at",
  "args": {
    "qq": "随机",
    "count": 3
  }
}
```

**权限要求：** 仅群聊可用

---

### 3. poke - 戳一戳

戳一戳指定用户。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| qq | string | 是 | 目标 QQ 号，或 "随机" |
| count | number | 否 | 戳几个人（随机时有效，默认1） |

**示例：**
```json
{
  "tool": "poke",
  "args": {
    "qq": "123456789"
  }
}
```

**随机戳示例：**
```json
{
  "tool": "poke",
  "args": {
    "qq": "随机",
    "count": 5
  }
}
```

---

### 4. emotion - 发送表情包

发送情绪表情包图片。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| type | string | 是 | 表情类型 |
| text | string | 否 | 附带文字 |

**type 可选值：**

| 值 | 描述 |
|----|------|
| 开心 | 开心/高兴/笑 |
| 惊讶 | 惊讶/震惊 |
| 伤心 | 伤心/难过 |
| 大笑 | 大笑/狂笑 |
| 害怕 | 害怕/恐惧 |
| 生气 | 生气/愤怒 |

**示例：**
```json
{
  "tool": "emotion",
  "args": {
    "type": "开心",
    "text": "太棒了！"
  }
}
```

---

### 5. emojiReaction - 表情回应

对消息进行 Emoji 表情回应。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| type | string | 是 | 表情类型 |
| msgId | string | 否 | 消息 ID（默认当前消息） |

**type 可选值：**

| 值 | 描述 |
|----|------|
| 开心 | 开心表情 |
| 惊讶 | 惊讶表情 |
| 伤心 | 伤心表情 |
| 大笑 | 大笑表情 |
| 害怕 | 害怕表情 |
| 喜欢 | 喜欢表情 |
| 爱心 | 爱心表情 |
| 生气 | 生气表情 |

**示例：**
```json
{
  "tool": "emojiReaction",
  "args": {
    "type": "喜欢",
    "msgId": "1234567890"
  }
}
```

**权限要求：** 仅群聊可用

---

### 6. setEssence - 设置精华消息

将指定消息设为精华。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| msgId | string | 是 | 消息 ID |

**示例：**
```json
{
  "tool": "setEssence",
  "args": {
    "msgId": "1234567890"
  }
}
```

**权限要求：** 群管理员

---

### 7. removeEssence - 取消精华消息

取消指定消息的精华状态。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| msgId | string | 是 | 消息 ID |

**示例：**
```json
{
  "tool": "removeEssence",
  "args": {
    "msgId": "1234567890"
  }
}
```

**权限要求：** 群管理员

---

### 8. announce - 发布群公告

发布群公告。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 公告内容 |

**示例：**
```json
{
  "tool": "announce",
  "args": {
    "content": "今晚 8 点有活动，请大家准时参加！"
  }
}
```

**权限要求：** 群管理员

---

### 9. remember - 记忆信息

将重要信息存入记忆库。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 要记住的内容 |

**示例：**
```json
{
  "tool": "remember",
  "args": {
    "content": "用户小明喜欢喝咖啡"
  }
}
```

**记忆层级：** 长期记忆 (72小时)

---

### 10. forget - 忘记信息

从记忆库中删除相关信息。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 要忘记的内容关键词 |

**示例：**
```json
{
  "tool": "forget",
  "args": {
    "content": "咖啡"
  }
}
```

---

### 11. music - 点歌

为用户点歌。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| keyword | string | 是 | 歌曲名或关键词 |
| source | string | 否 | 音乐源 |

**source 可选值：**

| 值 | 描述 |
|----|------|
| qq | QQ 音乐 |
| netease | 网易云音乐 |
| kugou | 酷狗音乐 |
| kuwo | 酷我音乐 |
| bilibili | 哔哩哔哩 |

**示例：**
```json
{
  "tool": "music",
  "args": {
    "keyword": "稻香",
    "source": "netease"
  }
}
```

**依赖：** 需要 xiaofei-plugin 点歌插件

---

### 12. switchMusicSource - 切换音乐源

切换默认音乐源。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| source | string | 是 | 音乐源 |

**示例：**
```json
{
  "tool": "switchMusicSource",
  "args": {
    "source": "qq"
  }
}
```

---

### 13. signIn - 群签到

执行群签到。

**参数：** 无

**示例：**
```json
{
  "tool": "signIn",
  "args": {}
}
```

**权限要求：** 仅群聊可用

---

### 14. like - 点赞名片

点赞用户名片。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| qq | string | 是 | 目标 QQ 号 |
| times | number | 否 | 点赞次数（1-10，默认1） |

**示例：**
```json
{
  "tool": "like",
  "args": {
    "qq": "123456789",
    "times": 5
  }
}
```

---

### 15. friendsInGroup - 查看好友在群

查看机器人的好友中有多少人在当前群。

**参数：** 无

**示例：**
```json
{
  "tool": "friendsInGroup",
  "args": {}
}
```

**权限要求：** 仅群聊可用

---

### 16. ban - 禁言群成员

禁言指定群成员。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| qq | string | 是 | 目标 QQ 号 |
| duration | number | 是 | 禁言秒数（0 表示解除禁言） |

**示例：**
```json
{
  "tool": "ban",
  "args": {
    "qq": "123456789",
    "duration": 60
  }
}
```

**权限要求：** 群管理员

---

### 17. banAll - 开启全体禁言

开启群全体禁言。

**参数：** 无

**示例：**
```json
{
  "tool": "banAll",
  "args": {}
}
```

**权限要求：** 群管理员

---

### 18. unbanAll - 解除全体禁言

解除群全体禁言。

**参数：** 无

**示例：**
```json
{
  "tool": "unbanAll",
  "args": {}
}
```

**权限要求：** 群管理员

---

### 19. groupCount - 获取群人数

获取当前群的成员数量。

**参数：** 无

**示例：**
```json
{
  "tool": "groupCount",
  "args": {}
}
```

**权限要求：** 仅群聊可用

---

### 20. webSearch - 网络搜索

搜索网络获取信息，用于查询时事、新闻、知识性问题。

**参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| query | string | 是 | 搜索关键词 |
| num | number | 否 | 返回结果数量（1-5，默认3） |

**示例：**
```json
{
  "tool": "webSearch",
  "args": {
    "query": "今天天气",
    "num": 3
  }
}
```

**返回格式：**
```
搜索"今天天气"的结果：

1. 摘要
   今天全国大部分地区天气晴朗...

2. 相关新闻
   气象台发布天气预报...
```

**使用场景：**
- 用户询问时事新闻
- 用户询问知识性问题
- 用户需要最新信息

---

## 工具开发指南

### 注册新工具

在 `stream/better-chat.js` 中使用 `registerTool` 方法：

```javascript
this.registerTool('myTool', {
  description: '工具描述',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '参数描述' }
    },
    required: ['param1']
  },
  handler: async (args, context) => {
    const { param1 } = args;
    const { e } = context;
    
    // 工具逻辑
    
    return { success: true, result: '执行结果' };
  }
});
```

### 返回值规范

**成功：**
```javascript
return { success: true, result: '结果描述' };
```

**失败：**
```javascript
return { success: false, error: '错误描述' };
```

### 权限检查

```javascript
handler: async (args, context) => {
  // 检查群聊权限
  if (this._requireGroup(context)) {
    return { success: false, error: '仅群聊可用' };
  }
  
  // 工具逻辑...
}
```

## 工具调用流程

```
用户消息 → AI 分析 → 判断是否需要工具
                         ↓ 是
                    输出 JSON 工具调用
                         ↓
                    AIStream 解析 JSON
                         ↓
                    执行工具 handler
                         ↓
                    返回结果给 AI
                         ↓
                    AI 生成最终回复
```
