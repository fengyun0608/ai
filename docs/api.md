# API 文档

## 概述

风云 AI 提供以下 API 接口：

| API | 路由 | 方法 | 说明 |
|-----|------|------|------|
| 生成验证码 | `/generate-code` | GET | 生成 Web 登录验证码 |
| 验证验证码 | `/verify-code` | POST | 验证验证码并登录 |
| 获取配置 | `/get-config` | GET | 获取当前配置 |
| 保存配置 | `/save-config` | POST | 保存配置 |
| 更新配置 | `/api/update-config` | POST | 更新配置 |

---

## 1. 生成验证码

### 请求

```
GET /generate-code
```

### 响应

**成功：**
```json
{
  "success": true,
  "message": "验证码已生成，请查看服务器终端"
}
```

**失败：**
```json
{
  "success": false,
  "message": "生成验证码失败"
}
```

### 说明

- 验证码为 6 位数字
- 有效期由 `securityConfig.tempCodeExpire` 控制（默认 300 秒）
- 验证码会在服务器终端打印

---

## 2. 验证验证码

### 请求

```
POST /verify-code
Content-Type: application/json
```

**请求体：**
```json
{
  "code": "123456"
}
```

### 响应

**成功：**
```json
{
  "success": true,
  "redirect": "/new-config.html"
}
```

**失败：**
```json
{
  "success": false,
  "message": "验证码不存在或已过期"
}
```

### 错误码

| 错误信息 | 说明 |
|---------|------|
| 无效的验证码格式 | 验证码格式不正确 |
| 验证码不存在或已过期 | 验证码无效或已过期 |
| 验证码已被使用 | 验证码已被使用 |

---

## 3. 获取配置

### 请求

```
GET /get-config
```

**权限：** 需要登录

### 响应

```json
{
  "apiConfig": {
    "baseUrl": "https://api.gptgod.online/v1",
    "apiKey": "",
    "chatModel": "gemini-3-pro",
    "temperature": 1.3,
    "max_tokens": 6000,
    "top_p": 0.9,
    "presence_penalty": 0.6,
    "frequency_penalty": 0.6,
    "timeout": 30000
  },
  "whitelist": {
    "groups": [],
    "users": [],
    "globalGroups": []
  },
  "blacklist": {
    "users": []
  },
  "visionConfig": {
    "enabled": true,
    "apiBaseUrl": "https://api.gptgod.online/v1",
    "apiKey": "",
    "model": "claude-3-sonnet-20240229",
    "uploadEnabled": true,
    "uploadUrl": "https://api.gptgod.online/v1/file",
    "temperature": 1.0,
    "max_tokens": 2000,
    "timeout": 30000,
    "systemPrompt": "请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节"
  },
  "triggerConfig": {
    "prefix": "白子",
    "globalAICooldown": 3,
    "globalAIChance": 0.8
  },
  "persona": "...",
  "embeddingConfig": {
    "enabled": true,
    "provider": "lightweight",
    "apiUrl": null,
    "apiKey": null,
    "apiModel": "text-embedding-ada-002",
    "maxContexts": 5,
    "similarityThreshold": 0.6,
    "cacheExpiry": 86400
  },
  "securityConfig": {
    "webAdminPort": 54188,
    "tempCodeExpire": 300,
    "tempCodes": {},
    "outerIp": ""
  }
}
```

---

## 4. 保存配置

### 请求

```
POST /save-config
Content-Type: application/json
```

**请求体：** 完整配置对象（同获取配置响应）

### 响应

**成功：**
```json
{
  "success": true,
  "message": "配置保存成功"
}
```

**失败：**
```json
{
  "success": false,
  "message": "配置保存失败"
}
```

### 说明

- 配置保存到 `data/ai/config.json`
- 保存后 AI 会重新加载配置
- 无需重启机器人

---

## 5. 更新配置

### 请求

```
POST /api/update-config
Content-Type: application/json
```

**请求体：**
```json
{
  "apiConfig": { ... },
  "whitelist": { ... }
}
```

### 响应

```json
{
  "success": true,
  "message": "配置更新成功"
}
```

---

## 认证机制

### Session 管理

- 使用 `express-session` 进行会话管理
- 支持 Redis 持久化存储
- Session 过期时间：30 分钟

### 登录流程

```
1. 用户访问 /new-login.html
2. 点击"生成新验证码"调用 /generate-code
3. 服务器在终端打印验证码
4. 用户输入验证码调用 /verify-code
5. 验证成功后创建 Session
6. 重定向到 /new-config.html
```

### Session 结构

```javascript
{
  isLoggedIn: true,
  loginTime: 1234567890000
}
```

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（未登录） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述"
}
```

---

## 速率限制

| API | 限制 |
|-----|------|
| /generate-code | 无限制 |
| /verify-code | 无限制 |
| /get-config | Session 有效期内无限制 |
| /save-config | Session 有效期内无限制 |

---

## 安全建议

1. **修改默认端口**：修改 `securityConfig.webAdminPort`
2. **设置验证码有效期**：根据需求调整 `tempCodeExpire`
3. **启用 HTTPS**：生产环境建议使用 HTTPS
4. **限制访问 IP**：通过防火墙限制访问来源
5. **定期更换验证码**：避免验证码泄露

---

## 示例代码

### JavaScript (Fetch)

```javascript
// 生成验证码
fetch('/generate-code')
  .then(res => res.json())
  .then(data => console.log(data));

// 验证验证码
fetch('/verify-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: '123456' })
})
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      window.location.href = data.redirect;
    }
  });

// 获取配置
fetch('/get-config')
  .then(res => res.json())
  .then(config => console.log(config));

// 保存配置
fetch('/save-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
})
  .then(res => res.json())
  .then(data => console.log(data));
```

### cURL

```bash
# 生成验证码
curl http://localhost:54188/generate-code

# 验证验证码
curl -X POST http://localhost:54188/verify-code \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'

# 获取配置（需要先登录获取 Cookie）
curl http://localhost:54188/get-config \
  -H "Cookie: connect.sid=..."

# 保存配置
curl -X POST http://localhost:54188/save-config \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d @config.json
```

---

## WebSocket 支持

当前版本不支持 WebSocket，所有通信通过 HTTP/HTTPS 进行。

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-04 | 初始版本 |
