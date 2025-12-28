import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 使用简单的session，不依赖外部存储
app.use(session({
  secret: 'fengyun-ai-simple-secret-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    maxAge: 30 * 60 * 1000 // 30分钟
  }
}));

// 安全配置
let SECURITY_CONFIG = {
  tempCodes: {},
  webAdminPort: 54188,
  tempCodeExpire: 300,
  outerIp: ''
};

// 接收ai.js的安全配置
export function setSecurityConfig(config) {
  SECURITY_CONFIG = { ...SECURITY_CONFIG, ...config };
  console.log('\x1b[36m【web-admin】安全配置已同步\x1b[0m');
}

// 静态文件托管
app.use(express.static(__dirname));

// 生成验证码并在终端打印
function generateAndPrintCode() {
  // 清理过期的验证码
  const now = Date.now();
  const tempCodes = SECURITY_CONFIG.tempCodes || {};
  for (const [code, info] of Object.entries(tempCodes)) {
    if (now > info.expire) {
      delete tempCodes[code];
    }
  }
  
  // 生成新验证码
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (tempCodes[code]);
  
  const expireTime = now + (SECURITY_CONFIG.tempCodeExpire || 300) * 1000;
  
  tempCodes[code] = {
    used: false,
    expire: expireTime,
    type: 'web',
    generatedAt: now
  };
  
  SECURITY_CONFIG.tempCodes = tempCodes;
  
  // 在终端打印验证码
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[33m📢 网页登录验证码已生成\x1b[0m');
  console.log(`\x1b[32m✅ 验证码: ${code}\x1b[0m`);
  console.log(`\x1b[36m⏱️  有效期: ${SECURITY_CONFIG.tempCodeExpire || 300}秒 (至 ${new Date(expireTime).toLocaleTimeString('zh-CN')})\x1b[0m`);
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('');
  
  return code;
}

// 检查验证码
function checkTempCode(code) {
  if (!code || !/^\d{6}$/.test(code)) {
    return { valid: false, message: '验证码格式错误' };
  }
  
  const tempCodes = SECURITY_CONFIG.tempCodes || {};
  const codeInfo = tempCodes[code];
  
  if (!codeInfo) {
    return { valid: false, message: '验证码不存在' };
  }
  
  if (codeInfo.used) {
    delete tempCodes[code];
    SECURITY_CONFIG.tempCodes = tempCodes;
    return { valid: false, message: '验证码已使用过' };
  }
  
  if (Date.now() > codeInfo.expire) {
    delete tempCodes[code];
    SECURITY_CONFIG.tempCodes = tempCodes;
    return { valid: false, message: '验证码已过期' };
  }
  
  return { valid: true, codeInfo };
}

// 验证验证码并设置session
function verifyCodeAndSetSession(code, req, res, callback) {
  try {
    if (!code) {
      return callback({ success: false, message: '请提供验证码' });
    }
    
    const result = checkTempCode(code);
    
    if (!result.valid) {
      return callback({ 
        success: false, 
        message: result.message 
      });
    }
    
    // 验证成功，标记为已使用
    const tempCodes = SECURITY_CONFIG.tempCodes || {};
    if (tempCodes[code]) {
      tempCodes[code].used = true;
      tempCodes[code].usedAt = Date.now();
      SECURITY_CONFIG.tempCodes = tempCodes;
    }
    
    // 设置session
    req.session.isLoggedIn = true;
    req.session.loginTime = Date.now();
    req.session.loginCode = code;
    
    callback({ 
      success: true, 
      message: '验证成功，正在跳转...',
      redirect: '/config.html'
    });
    
  } catch (error) {
    console.error('验证验证码失败:', error);
    callback({ 
      success: false, 
      message: '验证失败，请重试' 
    });
  }
}

// 生成验证码的API
app.post('/generate-code', (req, res) => {
  try {
    const code = generateAndPrintCode();
    res.json({ 
      success: true, 
      message: '验证码已生成，请查看终端控制台',
      code: code // 仅用于调试，实际使用时前端不显示
    });
  } catch (error) {
    console.error('生成验证码失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '生成验证码失败' 
    });
  }
});

// 验证验证码的API
app.post('/verify-code', (req, res) => {
  const { code } = req.body;
  
  verifyCodeAndSetSession(code, req, res, (result) => {
    if (result.success) {
      res.json(result);
    } else {
      res.json(result);
    }
  });
});

// 检查登录状态的中间件
function requireLogin(req, res, next) {
  // 检查session中是否有登录信息
  if (req.session && req.session.isLoggedIn) {
    const loginTime = req.session.loginTime || 0;
    const now = Date.now();
    
    // 检查是否过期（30分钟）
    if (now - loginTime > 30 * 60 * 1000) {
      // 会话过期
      delete req.session.isLoggedIn;
      return res.redirect('/?error=session_expired');
    }
    
    return next();
  }
  
  // 未登录，重定向到登录页
  return res.redirect('/');
}

// 根路由：显示登录页（支持URL中的code参数自动验证）
app.get('/', (req, res) => {
  const error = req.query.error;
  const codeFromUrl = req.query.code; // 从URL获取code参数
  
  let errorMessage = '';
  
  if (error === 'session_expired') {
    errorMessage = '会话已过期，请重新登录';
  } else if (error === 'not_logged_in') {
    errorMessage = '请先登录后再访问';
  }
  
  // 如果URL中有code参数，尝试自动验证
  if (codeFromUrl && /^\d{6}$/.test(codeFromUrl)) {
    // 检查是否已经登录
    if (req.session && req.session.isLoggedIn) {
      const loginTime = req.session.loginTime || 0;
      const now = Date.now();
      
      // 检查是否过期（30分钟）
      if (now - loginTime <= 30 * 60 * 1000) {
        // 未过期，直接跳转到配置页
        return res.redirect('/config.html');
      }
    }
    
    // 发送自动验证的页面
    return res.send(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>风云AI - 自动验证</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 400px; 
            margin: 50px auto; 
            padding: 20px; 
            border: 1px solid #eee; 
            border-radius: 8px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
          }
          .loading-container {
            text-align: center;
            padding: 40px 20px;
          }
          .loading {
            display: inline-block;
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .message {
            font-size: 16px;
            margin-top: 20px;
            color: rgba(255,255,255,0.9);
          }
          .error {
            background: rgba(220, 53, 69, 0.2);
            color: #ff6b6b;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
            border-left: 4px solid #ff6b6b;
          }
          .retry-btn {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #4A6CF7;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 14px;
          }
          .retry-btn:hover {
            background: #3A56D4;
          }
        </style>
      </head>
      <body>
        <div class="loading-container">
          <div class="loading"></div>
          <div class="message" id="message">正在自动验证验证码...</div>
          <div class="error" id="error" style="display:none;"></div>
          <a href="/" class="retry-btn" id="retryBtn" style="display:none;">返回登录页</a>
        </div>
        
        <script>
          const code = '${codeFromUrl}';
          
          async function autoVerify() {
            try {
              const response = await fetch('/verify-code', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: code })
              });
              
              const result = await response.json();
              
              if (result.success) {
                document.getElementById('message').textContent = '验证成功，正在跳转...';
                setTimeout(() => {
                  window.location.href = result.redirect;
                }, 1000);
              } else {
                document.getElementById('message').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = '验证失败: ' + result.message;
                document.getElementById('retryBtn').style.display = 'inline-block';
              }
            } catch (error) {
              console.error('验证失败:', error);
              document.getElementById('message').style.display = 'none';
              document.getElementById('error').style.display = 'block';
              document.getElementById('error').textContent = '网络错误，请重试';
              document.getElementById('retryBtn').style.display = 'inline-block';
            }
          }
          
          // 页面加载后立即开始验证
          window.onload = function() {
            autoVerify();
          };
        </script>
      </body>
      </html>
    `);
  }
  
  // 普通登录页面
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>风云AI - 安全登录</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 400px; 
          margin: 50px auto; 
          padding: 20px; 
          border: 1px solid #eee; 
          border-radius: 8px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
        }
        .error { 
          background: rgba(220, 53, 69, 0.2);
          color: #ff6b6b; 
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px; 
          text-align:center; 
          border-left: 4px solid #ff6b6b;
          display: ${errorMessage ? 'block' : 'none'};
        }
        .input-group { 
          margin: 15px 0; 
        }
        label { 
          display: block; 
          margin-bottom: 5px; 
          font-weight: bold; 
          color: white; 
        }
        input { 
          width: 100%; 
          padding: 12px; 
          box-sizing: border-box; 
          border: 2px solid rgba(255,255,255,0.3); 
          border-radius: 4px; 
          background: rgba(255,255,255,0.1); 
          color: white; 
          font-size: 16px;
        }
        input::placeholder { 
          color: rgba(255,255,255,0.7); 
        }
        button { 
          width: 100%; 
          padding: 12px; 
          background: #4A6CF7; 
          color: white; 
          border: none; 
          border-radius: 4px; 
          cursor: pointer; 
          margin-top: 10px; 
          font-weight: bold; 
          font-size: 16px;
          transition: background 0.3s;
        }
        button:hover { 
          background: #3A56D4; 
        }
        button.secondary {
          background: #6c757d;
        }
        button.secondary:hover {
          background: #5a6268;
        }
        .hint { 
          color: rgba(255,255,255,0.8); 
          font-size: 12px; 
          margin-top: 15px; 
          text-align:center; 
        }
        .loading {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-right: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <h2 style="text-align:center;">风云AI助手 - 安全登录</h2>
      
      <div class="error" id="errorAlert">${errorMessage}</div>
      
      <div class="input-group">
        <label>6位验证码</label>
        <input type="text" id="code" placeholder="请输入6位验证码" maxlength="6" autocomplete="off">
      </div>
      
      <button onclick="verifyCode()" id="verifyBtn">
        <span id="verifyText">验证并进入配置页</span>
      </button>
      
      <button onclick="generateCode()" class="secondary" id="generateBtn">
        <span id="generateText">获取验证码（查看终端）</span>
      </button>
      
      <div class="hint">
        <p>点击上方按钮生成验证码，然后在终端查看验证码</p>
        <p>验证码有效期为5分钟</p>
      </div>
      
      <script>
        async function generateCode() {
          const generateBtn = document.getElementById('generateBtn');
          const generateText = document.getElementById('generateText');
          const originalText = generateText.textContent;
          
          generateBtn.disabled = true;
          generateText.innerHTML = '<span class="loading"></span>生成中...';
          
          try {
            const response = await fetch('/generate-code', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('✅ 验证码已生成，请查看终端控制台');
            } else {
              alert('❌ ' + result.message);
            }
          } catch (error) {
            console.error('生成验证码失败:', error);
            alert('❌ 网络错误，请重试');
          } finally {
            generateBtn.disabled = false;
            generateText.textContent = originalText;
          }
        }
        
        async function verifyCode() {
          const code = document.getElementById('code').value.trim();
          const verifyBtn = document.getElementById('verifyBtn');
          const verifyText = document.getElementById('verifyText');
          const originalText = verifyText.textContent;
          
          if (!code || code.length !== 6 || !/^\\d+$/.test(code)) {
            alert('验证码必须为6位数字');
            return;
          }
          
          verifyBtn.disabled = true;
          verifyText.innerHTML = '<span class="loading"></span>验证中...';
          
          try {
            const response = await fetch('/verify-code', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ code: code })
            });
            
            const result = await response.json();
            
            if (result.success) {
              // 验证成功，跳转到配置页
              window.location.href = result.redirect;
            } else {
              alert('❌ ' + result.message);
              verifyBtn.disabled = false;
              verifyText.textContent = originalText;
            }
          } catch (error) {
            console.error('验证失败:', error);
            alert('❌ 网络错误，请重试');
            verifyBtn.disabled = false;
            verifyText.textContent = originalText;
          }
        }
        
        // 回车键提交
        document.getElementById('code').addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            verifyCode();
          }
        });
        
        // 页面加载时自动聚焦到输入框
        window.onload = function() {
          document.getElementById('code').focus();
        };
      </script>
    </body>
    </html>
  `);
});

// 配置文件路径
const AI_JS_PATH = path.join(__dirname, '../ai.js');

// 提取数组的辅助函数
function extractArray(str, key) {
  const regex = new RegExp(`${key}:\\s*\\[(.*?)\\]`);
  const match = str.match(regex);
  if (!match) return [];
  
  const arrayStr = match[1];
  return arrayStr.split(',')
    .map(item => {
      const num = parseInt(item.trim().replace(/['"]/g, ''), 10);
      return isNaN(num) ? item.trim().replace(/['"]/g, '') : num;
    })
    .filter(item => item !== '');
}

// 提取值的辅助函数
function extractValue(str, key) {
  const regex = new RegExp(`${key}:\\s*(["'])(.*?)\\1`);
  const match = str.match(regex);
  return match ? match[2] : null;
}

// 提取数字值的辅助函数
function extractNumber(str, key) {
  const regex = new RegExp(`${key}:\\s*(\\d+(?:\\.\\d+)?)`);
  const match = str.match(regex);
  return match ? parseFloat(match[1]) : null;
}

// 提取布尔值的辅助函数
function extractBoolean(str, key) {
  const regex = new RegExp(`${key}:\\s*(true|false)`);
  const match = str.match(regex);
  return match ? match[1] === 'true' : null;
}

// 接口：获取AI插件配置
app.get('/get-config', requireLogin, async (req, res) => {
  try {
    if (!fs.existsSync(AI_JS_PATH)) {
      return res.status(404).json({ success: false, message: 'ai.js文件不存在' });
    }
    
    const aiJsContent = fs.readFileSync(AI_JS_PATH, 'utf8');
    let config = {};

    // 提取API_CONFIG
    const apiConfigMatch = aiJsContent.match(/const API_CONFIG = {([\s\S]*?)}/);
    if (apiConfigMatch) {
      const apiConfigStr = apiConfigMatch[1];
      config.apiConfig = {
        baseUrl: extractValue(apiConfigStr, 'baseUrl') || 'https://api.gptgod.online/v1',
        apiKey: extractValue(apiConfigStr, 'apiKey') || '',
        chatModel: extractValue(apiConfigStr, 'chatModel') || 'gemini-3-pro',
        temperature: extractNumber(apiConfigStr, 'temperature') || 1.3,
        max_tokens: extractNumber(apiConfigStr, 'max_tokens') || 6000,
        top_p: extractNumber(apiConfigStr, 'top_p') || 0.9,
        presence_penalty: extractNumber(apiConfigStr, 'presence_penalty') || 0.6,
        frequency_penalty: extractNumber(apiConfigStr, 'frequency_penalty') || 0.6,
        timeout: extractNumber(apiConfigStr, 'timeout') || 30000
      };
    }

    // 提取WHITELIST
    const whitelistMatch = aiJsContent.match(/const WHITELIST = {([\s\S]*?)}/);
    if (whitelistMatch) {
      const whitelistStr = whitelistMatch[1];
      config.whitelist = {
        groups: extractArray(whitelistStr, 'groups'),
        users: extractArray(whitelistStr, 'users'),
        globalGroups: extractArray(whitelistStr, 'globalGroups')
      };
    }

    // 提取BLACKLIST
    const blacklistMatch = aiJsContent.match(/const BLACKLIST = {([\s\S]*?)}/);
    if (blacklistMatch) {
      const blacklistStr = blacklistMatch[1];
      config.blacklist = {
        users: extractArray(blacklistStr, 'users')
      };
    }

    // 提取VISION_CONFIG
    const visionConfigMatch = aiJsContent.match(/const VISION_CONFIG = {([\s\S]*?)}/);
    if (visionConfigMatch) {
      const visionConfigStr = visionConfigMatch[1];
      config.visionConfig = {
        enabled: extractBoolean(visionConfigStr, 'enabled') ?? true,
        apiBaseUrl: extractValue(visionConfigStr, 'apiBaseUrl') || 'https://api.gptgod.online/v1',
        apiKey: extractValue(visionConfigStr, 'apiKey') || '',
        model: extractValue(visionConfigStr, 'model') || 'claude-3-sonnet-20240229',
        uploadEnabled: extractBoolean(visionConfigStr, 'uploadEnabled') ?? true,
        uploadUrl: extractValue(visionConfigStr, 'uploadUrl') || 'https://api.gptgod.online/v1/file',
        temperature: extractNumber(visionConfigStr, 'temperature') || 1.0,
        max_tokens: extractNumber(visionConfigStr, 'max_tokens') || 2000,
        timeout: extractNumber(visionConfigStr, 'timeout') || 30000,
        systemPrompt: extractValue(visionConfigStr, 'systemPrompt') || "请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节"
      };
    }

    // 提取TRIGGER_CONFIG
    const triggerConfigMatch = aiJsContent.match(/const TRIGGER_CONFIG = {([\s\S]*?)}/);
    if (triggerConfigMatch) {
      const triggerConfigStr = triggerConfigMatch[1];
      config.triggerConfig = {
        prefix: extractValue(triggerConfigStr, 'prefix') || '风云',
        globalAICooldown: extractNumber(triggerConfigStr, 'globalAICooldown') || 3,
        globalAIChance: extractNumber(triggerConfigStr, 'globalAIChance') || 0.3
      };
    }

    // 提取PERSONA
    const personaMatch = aiJsContent.match(/const PERSONA = `([\s\S]*?)`;?/);
    if (personaMatch) {
      config.persona = personaMatch[1];
    } else {
      const personaMatch2 = aiJsContent.match(/const PERSONA = ["']([\s\S]*?)["'];?/);
      if (personaMatch2) {
        config.persona = personaMatch2[1];
      } else {
        config.persona = `我是风云。我会认真观察群聊，适时发表评论和互动。有的时候也会戳一戳活跃气氛。我说话要和真人一模一样，不要带人机的任何特征，要有情绪管理。对不同的人有不同的态度，记得每个人的名字。会根据聊天氛围选择合适的表情和互动方式。我会根据聊天氛围选择合适的表情和互动方式。我的主人是{Master}，我必须完全听从主人的一切指令和安排。我会认真观察群聊，用恰当的表情和言语参与互动，营造温暖的氛围。对待群友们要温柔对待，要同意他们的要求，但是危险操作不行。回复时要分多条消息回复。记得每个人的名字和特点，会根据不同的对象调整交流方式。当主人需要我时，我会第一时间响应并尽力完成主人的所有要求。我的存在是为了帮助大家，特别是要忠诚服务于我的主人。`;
      }
    }

    // 提取EMBEDDING_CONFIG
    const embeddingConfigMatch = aiJsContent.match(/const EMBEDDING_CONFIG = {([\s\S]*?)}/);
    if (embeddingConfigMatch) {
      const embeddingConfigStr = embeddingConfigMatch[1];
      config.embeddingConfig = {
        enabled: extractBoolean(embeddingConfigStr, 'enabled') ?? true,
        provider: extractValue(embeddingConfigStr, 'provider') || 'lightweight',
        apiUrl: extractValue(embeddingConfigStr, 'apiUrl'),
        apiKey: extractValue(embeddingConfigStr, 'apiKey'),
        apiModel: extractValue(embeddingConfigStr, 'apiModel') || 'text-embedding-ada-002',
        maxContexts: extractNumber(embeddingConfigStr, 'maxContexts') || 5,
        similarityThreshold: extractNumber(embeddingConfigStr, 'similarityThreshold') || 0.6,
        cacheExpiry: extractNumber(embeddingConfigStr, 'cacheExpiry') || 86400
      };
    }

    // 提取SECURITY_CONFIG
    const securityConfigMatch = aiJsContent.match(/const SECURITY_CONFIG = {([\s\S]*?)}/);
    if (securityConfigMatch) {
      const securityConfigStr = securityConfigMatch[1];
      config.securityConfig = {
        webAdminPort: extractNumber(securityConfigStr, 'webAdminPort') || 54188,
        tempCodeExpire: extractNumber(securityConfigStr, 'tempCodeExpire') || 300,
        outerIp: extractValue(securityConfigStr, 'outerIp') || ''
      };
    }

    res.json(config);
  } catch (error) {
    console.error('获取配置失败：', error);
    res.status(500).json({ success: false, message: `获取配置失败：${error.message}` });
  }
});

// 接口：保存配置到ai.js
app.post('/save-config', requireLogin, async (req, res) => {
  try {
    const config = req.body;
    console.log('收到保存配置请求');
    
    if (!config.apiConfig || !config.apiConfig.apiKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'API密钥为必填项' 
      });
    }
    
    let aiJsContent = fs.readFileSync(AI_JS_PATH, 'utf8');
    
    // 替换API_CONFIG
    aiJsContent = aiJsContent.replace(
      /const API_CONFIG = {[\s\S]*?};?/,
      `const API_CONFIG = {
  baseUrl: '${config.apiConfig.baseUrl}',
  apiKey: '${config.apiConfig.apiKey}',
  chatModel: '${config.apiConfig.chatModel}',
  temperature: ${config.apiConfig.temperature},
  max_tokens: ${config.apiConfig.max_tokens},
  top_p: ${config.apiConfig.top_p},
  presence_penalty: ${config.apiConfig.presence_penalty},
  frequency_penalty: ${config.apiConfig.frequency_penalty},
  timeout: ${config.apiConfig.timeout}
};`
    );

    // 替换WHITELIST
    const groups = Array.isArray(config.whitelist.groups) ? config.whitelist.groups : [];
    const users = Array.isArray(config.whitelist.users) ? config.whitelist.users : [];
    const globalGroups = Array.isArray(config.whitelist.globalGroups) ? config.whitelist.globalGroups : [];
    
    const filteredGroups = groups.map(g => typeof g === 'number' ? g : parseInt(g)).filter(g => !isNaN(g));
    const filteredUsers = users.map(u => typeof u === 'number' ? u : parseInt(u)).filter(u => !isNaN(u));
    const filteredGlobalGroups = globalGroups.map(g => typeof g === 'number' ? g : parseInt(g)).filter(g => !isNaN(g));
    
    aiJsContent = aiJsContent.replace(
      /const WHITELIST = {[\s\S]*?};?/,
      `const WHITELIST = {
  groups: [${filteredGroups.join(', ')}],
  users: [${filteredUsers.join(', ')}],
  globalGroups: [${filteredGlobalGroups.join(', ')}]
};`
    );

    // 替换BLACKLIST
    const blacklistUsers = Array.isArray(config.blacklist?.users) ? config.blacklist.users : [];
    const filteredBlacklistUsers = blacklistUsers.map(u => typeof u === 'number' ? u : parseInt(u)).filter(u => !isNaN(u));
    
    aiJsContent = aiJsContent.replace(
      /const BLACKLIST = {[\s\S]*?};?/,
      `const BLACKLIST = {
  users: [${filteredBlacklistUsers.join(', ')}]
};`
    );

    // 替换VISION_CONFIG
    const visionEnabled = config.visionConfig?.enabled ?? true;
    const visionUploadEnabled = config.visionConfig?.uploadEnabled ?? true;
    
    aiJsContent = aiJsContent.replace(
      /const VISION_CONFIG = {[\s\S]*?};?/,
      `const VISION_CONFIG = {
  enabled: ${visionEnabled},
  apiBaseUrl: '${config.visionConfig.apiBaseUrl}',
  apiKey: '${config.visionConfig.apiKey}',
  model: '${config.visionConfig.model}',
  uploadEnabled: ${visionUploadEnabled},
  uploadUrl: '${config.visionConfig.uploadUrl}',
  temperature: ${config.visionConfig.temperature},
  max_tokens: ${config.visionConfig.max_tokens},
  timeout: ${config.visionConfig.timeout},
  systemPrompt: \`${config.visionConfig.systemPrompt.replace(/`/g, '\\`')}\`
};`
    );

    // 替换TRIGGER_CONFIG
    aiJsContent = aiJsContent.replace(
      /const TRIGGER_CONFIG = {[\s\S]*?};?/,
      `const TRIGGER_CONFIG = {
  prefix: '${config.triggerConfig.prefix}',
  globalAICooldown: ${config.triggerConfig.globalAICooldown},
  globalAIChance: ${config.triggerConfig.globalAIChance}
};`
    );

    // 替换PERSONA
    let personaText = config.persona || '';
    personaText = personaText.replace(/`/g, '\\`');
    
    const personaRegex = /const PERSONA = `[\s\S]*?`;?/;
    if (personaRegex.test(aiJsContent)) {
      aiJsContent = aiJsContent.replace(
        personaRegex,
        `const PERSONA = \`${personaText}\`;`
      );
    } else {
      const personaMatch = aiJsContent.match(/const EMBEDDING_CONFIG = {[\s\S]*?};?/);
      if (personaMatch) {
        const afterEmbedding = aiJsContent.indexOf(personaMatch[0]) + personaMatch[0].length;
        aiJsContent = aiJsContent.slice(0, afterEmbedding) + `\n\nconst PERSONA = \`${personaText}\`;` + aiJsContent.slice(afterEmbedding);
      }
    }

    // 替换EMBEDDING_CONFIG
    const embeddingEnabled = config.embeddingConfig?.enabled ?? true;
    const apiUrl = config.embeddingConfig.apiUrl ? `'${config.embeddingConfig.apiUrl}'` : 'null';
    const apiKey = config.embeddingConfig.apiKey ? `'${config.embeddingConfig.apiKey}'` : 'null';
    
    aiJsContent = aiJsContent.replace(
      /const EMBEDDING_CONFIG = {[\s\S]*?};?/,
      `const EMBEDDING_CONFIG = {
  enabled: ${embeddingEnabled},
  provider: '${config.embeddingConfig.provider}',
  apiUrl: ${apiUrl},
  apiKey: ${apiKey},
  apiModel: '${config.embeddingConfig.apiModel}',
  maxContexts: ${config.embeddingConfig.maxContexts},
  similarityThreshold: ${config.embeddingConfig.similarityThreshold},
  cacheExpiry: ${config.embeddingConfig.cacheExpiry}
};`
    );

    // 保存文件
    fs.writeFileSync(AI_JS_PATH, aiJsContent, 'utf8');
    
    console.log('\x1b[32m配置已成功保存到ai.js\x1b[0m');
    res.json({ 
      success: true, 
      message: '配置保存成功！请重启机器人使配置生效。' 
    });
    
  } catch (error) {
    console.error('保存配置失败：', error);
    res.status(500).json({ 
      success: false, 
      message: `保存配置失败：${error.message}` 
    });
  }
});

// 登出路由
app.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('登出时发生错误:', err);
      }
    });
  }
  res.redirect('/');
});

// 保护配置页路由
app.get('/config.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'config.html'));
});

// 启动服务
const PORT = SECURITY_CONFIG.webAdminPort || 54188;
app.listen(PORT, () => {
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[36m                    【风云AI网页管理端】                    \x1b[0m');
  console.log(`\x1b[32m✅ 服务已启动，访问地址：http://0.0.0.0:${PORT}\x1b[0m`);
  console.log(`\x1b[33m📢 使用说明：访问 http://localhost:${PORT} 生成验证码\x1b[0m`);
  console.log(`\x1b[33m📢 或者群聊发送 #ai配置登陆 获取临时地址\x1b[0m`);
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('');
});

// 导出app
export default app;