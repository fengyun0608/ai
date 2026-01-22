# 风云AI助手插件

## 功能介绍

风云AI助手是一个功能丰富的云崽机器人插件，支持文本聊天、图片识别、语义检索等功能。

### 核心功能

- 🤖 **智能聊天**：支持多种AI模型，可通过@或触发前缀唤醒
- 👁️ **图片识别**：支持图片内容识别和描述
- 🔍 **语义检索**：智能检索上下文，提供更准确的回复
- 🌐 **多群管理**：支持群白名单和全局AI模式
- 🚫 **安全机制**：支持用户黑名单功能
- 📊 **网页管理**：提供网页管理端，方便配置

## 安装说明

1. 确保已安装Node.js v20+和pnpm
2. 将插件放入云崽机器人的`plugins`目录下
3. 运行`pnpm install -w`安装依赖
4. 重启云崽机器人

## 配置方法

### 1. 命令行配置

支持以下命令配置AI插件：

| 指令 | 功能 | 权限 |
|------|------|------|
| `#ai配置登陆` | 获取网页管理端地址 | 主人 |
| `#ai状态` | 查看AI助手状态 | 主人 |
| `#加入本群ai` | 将当前群添加到AI白名单 | 主人 |
| `#关闭本群ai` | 将当前群从AI白名单中移除 | 主人 |
| `#拉黑本群ai` | 将当前群添加到全局黑名单 | 主人 |
| `#拉白本群ai` | 将当前群从全局黑名单中移除 | 主人 |
| `#ai拉黑 @用户` | 将指定用户添加到黑名单 | 主人 |
| `#ai拉白 @用户` | 将指定用户从黑名单中移除 | 主人 |
| `#配置ai接口<接口地址>` | 配置AI接口地址 | 主人 |
| `#配置ai密钥<密钥>` | 配置AI密钥 | 主人 |
| `#设置ai模型<模型名称>` | 设置AI聊天模型 | 主人 |

### 2. 网页管理端配置

1. 发送`#ai配置登陆`获取管理地址
2. 在浏览器中打开管理地址
3. 进行各项配置

### 3. 配置文件

配置文件位于`data/ai/config.json`，可直接编辑该文件进行配置。

## 指令说明

### 触发方式

1. **@机器人**：在白名单群中@机器人即可触发
2. **触发前缀**：默认使用"白子"作为触发前缀
3. **全局AI模式**：在全局AI群中，机器人会根据配置的概率自动参与聊天

### 功能指令

- `@机器人 <消息>`：与AI进行聊天
- `白子 <消息>`：使用触发前缀与AI聊天
- `#ai状态`：查看AI助手状态
- `#ai配置登陆`：获取网页管理端地址

## 配置项说明

### 聊天API配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `apiConfig.baseUrl` | AI聊天接口地址 | `https://api.gptgod.online/v1` |
| `apiConfig.apiKey` | AI聊天API密钥 | `sk-pAXYJpRTEnUBI7ONQL5DQXeeGzSNzO3KwfQG34xZHuRoXNvI` |
| `apiConfig.chatModel` | 聊天模型名称 | `gemini-3-pro` |
| `apiConfig.temperature` | 生成温度 | `1.3` |
| `apiConfig.max_tokens` | 最大生成token数 | `6000` |
| `apiConfig.top_p` | 核采样参数 | `0.9` |
| `apiConfig.presence_penalty` | 存在惩罚 | `0.6` |
| `apiConfig.frequency_penalty` | 频率惩罚 | `0.6` |
| `apiConfig.timeout` | 超时时间(毫秒) | `30000` |

### 识图配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `visionConfig.enabled` | 是否启用识图功能 | `true` |
| `visionConfig.apiBaseUrl` | 识图API地址 | `https://api.gptgod.online/v1` |
| `visionConfig.apiKey` | 识图API密钥 | `sk-pAXYJpRTEnUBI7ONQL5DQXeeGzSNzO3KwfQG34xZHuRoXNvI` |
| `visionConfig.model` | 识图模型名称 | `claude-3-sonnet-20240229` |
| `visionConfig.uploadEnabled` | 是否启用图片上传 | `true` |
| `visionConfig.uploadUrl` | 图片上传地址 | `https://api.gptgod.online/v1/file` |
| `visionConfig.temperature` | 生成温度 | `1` |
| `visionConfig.max_tokens` | 最大生成token数 | `2000` |
| `visionConfig.timeout` | 超时时间(毫秒) | `30000` |
| `visionConfig.systemPrompt` | 识图系统提示 | 详细描述图片内容 |

### 白名单配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `whitelist.groups` | AI白名单群列表 | `[1077962374, 118235991, 206714616, 1076609498, 1073466988]` |
| `whitelist.users` | AI白名单用户列表 | `[]` |
| `whitelist.globalGroups` | 全局AI群列表 | `[]` |

### 黑名单配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `blacklist.users` | 黑名单用户列表 | `[]` |

### 触发配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `triggerConfig.prefix` | 触发前缀 | `白子` |
| `triggerConfig.globalAICooldown` | 全局AI冷却时间(秒) | `3` |
| `triggerConfig.globalAIChance` | 全局AI触发概率 | `0.8` |

### 语义检索配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `embeddingConfig.enabled` | 是否启用语义检索 | `true` |
| `embeddingConfig.provider` | 语义检索提供商 | `lightweight` |
| `embeddingConfig.apiUrl` | 语义检索API地址 | `null` |
| `embeddingConfig.apiKey` | 语义检索API密钥 | `null` |
| `embeddingConfig.apiModel` | 语义检索模型 | `text-embedding-ada-002` |
| `embeddingConfig.maxContexts` | 最大上下文数 | `5` |
| `embeddingConfig.similarityThreshold` | 相似度阈值 | `0.6` |
| `embeddingConfig.cacheExpiry` | 缓存过期时间(秒) | `86400` |

### 安全配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `securityConfig.webAdminPort` | 网页管理端端口 | `54188` |
| `securityConfig.tempCodeExpire` | 临时码过期时间(秒) | `300` |

## 最佳实践

1. **合理设置触发概率**：根据群活跃度调整全局AI触发概率
2. **配置合适的冷却时间**：避免AI频繁回复影响群聊体验
3. **使用白名单管理**：只在需要的群开启AI功能
4. **定期备份配置**：定期备份`data/ai/config.json`文件
5. **关注安全**：及时将恶意用户加入黑名单

## 常见问题

### Q: 为什么AI没有回复？

A: 请检查以下几点：
1. 当前群是否在AI白名单中
2. 用户是否在黑名单中
3. AI配置是否正确
4. 网络连接是否正常

### Q: 如何修改触发前缀？

A: 可以通过网页管理端修改，或直接编辑`config.json`文件中的`triggerConfig.prefix`字段。

### Q: 如何获取网页管理端地址？

A: 发送`#ai配置登陆`指令，机器人会将管理地址发送到私聊。

### Q: 如何更新AI模型？

A: 发送`#设置ai模型<模型名称>`指令，或通过网页管理端更新。

## 更新日志

### v1.0.0

- 初始版本发布
- 支持智能聊天功能
- 支持图片识别功能
- 支持语义检索功能
- 支持网页管理端
- 支持多群管理
- 支持用户黑名单

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

如有问题或建议，欢迎联系开发者。

---

**使用须知**：
- 本插件仅供学习和交流使用
- 请遵守相关法律法规，合理使用AI功能
- 请勿将本插件用于非法用途
- 使用过程中产生的任何问题，开发者不承担责任
