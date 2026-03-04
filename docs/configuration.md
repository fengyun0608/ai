# 配置说明文档

## 配置文件位置

```
data/ai/config.json
```

## 完整配置结构

```json
{
  "apiConfig": { ... },
  "whitelist": { ... },
  "blacklist": { ... },
  "visionConfig": { ... },
  "triggerConfig": { ... },
  "persona": "...",
  "embeddingConfig": { ... },
  "securityConfig": { ... }
}
```

---

## API 配置 (apiConfig)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| baseUrl | string | `https://api.gptgod.online/v1` | LLM API 地址 |
| apiKey | string | - | API 密钥（必填） |
| chatModel | string | `gemini-3-pro` | 对话模型名称 |
| temperature | number | `1.3` | 温度参数 (0-2) |
| max_tokens | number | `6000` | 最大输出 Token |
| top_p | number | `0.9` | Top-P 采样 (0-1) |
| presence_penalty | number | `0.6` | 存在惩罚 (0-2) |
| frequency_penalty | number | `0.6` | 频率惩罚 (0-2) |
| timeout | number | `30000` | 超时时间（毫秒） |

**示例：**
```json
{
  "apiConfig": {
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "sk-xxxxxxxx",
    "chatModel": "deepseek-chat",
    "temperature": 0.85,
    "max_tokens": 6000,
    "top_p": 0.9,
    "presence_penalty": 0.6,
    "frequency_penalty": 0.6,
    "timeout": 30000
  }
}
```

**参数说明：**

| 参数 | 作用 |
|------|------|
| temperature | 值越高回复越有创意，值越低越稳定 |
| max_tokens | 限制 AI 回复的最大长度 |
| top_p | 控制采样范围，值越低越确定 |
| presence_penalty | 惩罚新话题的出现，值越高越不容易跑题 |
| frequency_penalty | 惩罚重复内容，值越高越不容易重复 |

---

## 白名单配置 (whitelist)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| groups | number[] | `[]` | 触发白名单群号 |
| users | number[] | `[]` | 触发白名单用户 |
| globalGroups | number[] | `[]` | 全局 AI 群号 |

**示例：**
```json
{
  "whitelist": {
    "groups": [123456789, 987654321],
    "users": [111111111, 222222222],
    "globalGroups": [123456789]
  }
}
```

**配置说明：**

| 配置项 | 作用 |
|------|------|
| groups | 在这些群中，@机器人或使用前缀可触发 AI |
| users | 这些用户可以私聊触发 AI |
| globalGroups | 在这些群中，AI 会主动参与对话（无需触发） |

---

## 黑名单配置 (blacklist)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| users | number[] | `[]` | 黑名单用户 |

**示例：**
```json
{
  "blacklist": {
    "users": [111111111, 222222222]
  }
}
```

**注意：** 黑名单优先级高于白名单。

---

## 识图配置 (visionConfig)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | boolean | `true` | 是否启用识图 |
| apiBaseUrl | string | `https://api.gptgod.online/v1` | 识图 API 地址 |
| apiKey | string | - | 识图 API 密钥 |
| model | string | `claude-3-sonnet-20240229` | 识图模型 |
| uploadEnabled | boolean | `true` | 是否启用上传 |
| uploadUrl | string | `https://api.gptgod.online/v1/file` | 上传地址 |
| temperature | number | `1.0` | 识图温度 |
| max_tokens | number | `2000` | 最大输出 Token |
| timeout | number | `30000` | 超时时间 |
| systemPrompt | string | 见下方 | 识图提示词 |

**默认识图提示词：**
```
请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节
```

**示例：**
```json
{
  "visionConfig": {
    "enabled": true,
    "apiBaseUrl": "https://api.gptgod.online/v1",
    "apiKey": "sk-xxxxxxxx",
    "model": "gpt-4-vision-preview",
    "uploadEnabled": true,
    "uploadUrl": "https://api.gptgod.online/v1/file",
    "temperature": 1.0,
    "max_tokens": 2000,
    "timeout": 30000,
    "systemPrompt": "请详细描述这张图片的内容"
  }
}
```

---

## 触发配置 (triggerConfig)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| prefix | string | `白子` | 触发前缀 |
| globalAICooldown | number | `3` | 全局 AI 冷却时间（秒） |
| globalAIChance | number | `0.8` | 全局 AI 触发概率 (0-1) |

**示例：**
```json
{
  "triggerConfig": {
    "prefix": "风云",
    "globalAICooldown": 3,
    "globalAIChance": 0.3
  }
}
```

**触发方式：**

| 方式 | 条件 |
|------|------|
| @机器人 | 群号在 `groups` 或 `globalGroups` 中 |
| 前缀触发 | 消息以 `prefix` 开头，群号在 `groups` 中 |
| 私聊 | 用户 QQ 在 `users` 中 |
| 全局 AI | 群号在 `globalGroups` 中，按概率触发 |

---

## 人设配置 (persona)

AI 的人设描述，支持变量替换：

| 变量 | 替换为 |
|------|--------|
| `{Master}` | 机器人管理员名称 |

**示例：**
```json
{
  "persona": "我是风云。我会认真观察群聊，适时发表评论和互动。我的管理员是{Master}，我必须完全听从管理员的一切指令和安排。"
}
```

---

## 语义检索配置 (embeddingConfig)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | boolean | `true` | 是否启用 |
| provider | string | `lightweight` | 提供商 |
| apiUrl | string | - | API 地址（provider=api 时） |
| apiKey | string | - | API 密钥（provider=api 时） |
| apiModel | string | `text-embedding-ada-002` | API 模型 |
| maxContexts | number | `5` | 最大检索上下文数 |
| similarityThreshold | number | `0.6` | 相似度阈值 (0-1) |
| cacheExpiry | number | `86400` | 缓存过期时间（秒） |

**provider 可选值：**

| 值 | 说明 |
|----|------|
| lightweight | 轻量级本地模型（BM25） |
| onnx | ONNX 本地推理 |
| hf | HuggingFace 模型 |
| fasttext | FastText |
| api | 外部 API |

**示例：**
```json
{
  "embeddingConfig": {
    "enabled": true,
    "provider": "lightweight",
    "maxContexts": 5,
    "similarityThreshold": 0.6,
    "cacheExpiry": 86400
  }
}
```

---

## 安全配置 (securityConfig)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| webAdminPort | number | `54188` | Web 管理端端口 |
| tempCodeExpire | number | `300` | 验证码有效期（秒） |
| outerIp | string | - | 外网 IP |

---

## Web 管理端配置

访问地址：`http://localhost:54188`

### 登录流程

1. 发送指令 `#ai配置登陆` 获取验证码
2. 在 Web 页面输入验证码登录
3. 配置修改后点击保存

### 配置标签页

| 标签 | 内容 |
|------|------|
| API 配置 | LLM 参数设置 |
| 白名单配置 | 群组/用户白名单 |
| 黑名单配置 | 用户黑名单 |
| 识图设置 | 视觉模型配置 |
| 触发配置 | 前缀/概率设置 |
| 人设配置 | AI 人设描述 |
| 语义检索配置 | Embedding 设置 |
| 导入导出 | 配置备份恢复 |

---

## 配置优先级

```
1. 黑名单 (最高)
   ↓
2. 白名单
   ↓
3. 全局 AI 群组
   ↓
4. 默认行为 (最低)
```

---

## 常见配置场景

### 场景 1：仅管理员可用

```json
{
  "whitelist": {
    "groups": [],
    "users": [管理员QQ],
    "globalGroups": []
  }
}
```

### 场景 2：全员可用

```json
{
  "whitelist": {
    "groups": [所有群号],
    "users": [],
    "globalGroups": []
  }
}
```

### 场景 3：AI 主动聊天

```json
{
  "whitelist": {
    "groups": [],
    "users": [],
    "globalGroups": [目标群号]
  },
  "triggerConfig": {
    "globalAIChance": 0.5
  }
}
```

### 场景 4：高创意模式

```json
{
  "apiConfig": {
    "temperature": 1.5,
    "top_p": 0.95,
    "presence_penalty": 0.3,
    "frequency_penalty": 0.3
  }
}
```

### 场景 5：稳定输出模式

```json
{
  "apiConfig": {
    "temperature": 0.5,
    "top_p": 0.8,
    "presence_penalty": 0.8,
    "frequency_penalty": 0.8
  }
}
```
