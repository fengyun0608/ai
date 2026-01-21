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
const CONFIG_JSON_PATH = path.join(__dirname, '../../data/ai/config.json');
const _path = path.resolve(__dirname, '../../..');

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
    if (!fs.existsSync(CONFIG_JSON_PATH)) {
      // 如果配置文件不存在，返回默认配置
      return res.json({
        apiConfig: {
          baseUrl: 'https://api.gptgod.online/v1',
          apiKey: '',
          chatModel: 'gemini-3-pro',
          temperature: 1.3,
          max_tokens: 6000,
          top_p: 0.9,
          presence_penalty: 0.6,
          frequency_penalty: 0.6,
          timeout: 30000
        },
        whitelist: {
          groups: [],
          users: [],
          globalGroups: []
        },
        blacklist: {
          users: []
        },
        visionConfig: {
          enabled: true,
          apiBaseUrl: 'https://api.gptgod.online/v1',
          apiKey: '',
          model: 'claude-3-sonnet-20240229',
          uploadEnabled: true,
          uploadUrl: 'https://api.gptgod.online/v1/file',
          temperature: 1.0,
          max_tokens: 2000,
          timeout: 30000,
          systemPrompt: "请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节"
        },
        triggerConfig: {
          prefix: '白子',
          globalAICooldown: 3,
          globalAIChance: 0.8
        },
        embeddingConfig: {
          enabled: true,
          provider: 'lightweight',
          apiUrl: null,
          apiKey: null,
          apiModel: 'text-embedding-ada-002',
          maxContexts: 5,
          similarityThreshold: 0.6,
          cacheExpiry: 86400
        },
        securityConfig: {
          webAdminPort: 54188,
          tempCodeExpire: 300,
          outerIp: ''
        }
      });
    }
    
    // 从config.json文件中读取配置
    const configContent = fs.readFileSync(CONFIG_JSON_PATH, 'utf8');
    const config = JSON.parse(configContent);
    
    res.json(config);
  } catch (error) {
    console.error('获取配置失败：', error);
    res.status(500).json({ success: false, message: `获取配置失败：${error.message}` });
  }
});

// 接口：保存AI插件配置
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
    
    // 清理和验证配置数据
    const cleanedConfig = {
      ...config,
      whitelist: {
        groups: Array.isArray(config.whitelist?.groups) ? config.whitelist.groups.map(g => typeof g === 'number' ? g : parseInt(g)).filter(g => !isNaN(g)) : [],
        users: Array.isArray(config.whitelist?.users) ? config.whitelist.users.map(u => typeof u === 'number' ? u : parseInt(u)).filter(u => !isNaN(u)) : [],
        globalGroups: Array.isArray(config.whitelist?.globalGroups) ? config.whitelist.globalGroups.map(g => typeof g === 'number' ? g : parseInt(g)).filter(g => !isNaN(g)) : []
      },
      blacklist: {
        users: Array.isArray(config.blacklist?.users) ? config.blacklist.users.map(u => typeof u === 'number' ? u : parseInt(u)).filter(u => !isNaN(u)) : []
      }
    };
    
    // 保存配置到config.json文件
    fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(cleanedConfig, null, 2), 'utf8');
    
    console.log('\x1b[32m配置已成功保存到config.json\x1b[0m');
    res.json({ 
      success: true, 
      message: '配置保存成功！配置会立即生效，无需重启机器人。' 
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