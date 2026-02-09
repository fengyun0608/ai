import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

// 获取当前文件目录路径（ES模块方式）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let PORT = 54188;

// Redis 客户端配置
let redisClient;
let redisStore;

// 初始化Redis客户端
async function initRedis() {
  try {
    redisClient = createClient({
      url: 'redis://127.0.0.1:6379/0'
    });
    await redisClient.connect();
    redisStore = new RedisStore({ client: redisClient });
    console.log('✅ Redis连接成功');
  } catch (error) {
    console.error('❌ Redis连接失败:', error);
    // 退化为内存存储
    redisStore = undefined;
  }
}

// 配置文件路径
const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai', 'config.json');

// 默认配置
const DEFAULT_CONFIG = {
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
    temperature: 1,
    max_tokens: 2000,
    timeout: 30000,
    systemPrompt: '请详细描述这张图片的内容，包括人物、场景、物体、颜色、动作、情绪等细节'
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
    tempCodes: {},
    outerIp: ""
  }
};

// 安全配置
let SECURITY_CONFIG = {
  tempCodeExpire: 300, // 临时验证码有效期(秒)
  tempCodes: {},
  outerIp: ''
};

// 加载配置
function loadConfig() {
  try {
    if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
      fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    }
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`【web-admin】加载配置失败: ${error.message}`);
  }
  // 使用默认配置并保存
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

// 保存配置
function saveConfig(config) {
  try {
    if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
      fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`【web-admin】保存配置失败: ${error.message}`);
    return false;
  }
}

// 接收ai.js的安全配置
export function setSecurityConfig(config) {
  SECURITY_CONFIG = { ...SECURITY_CONFIG, ...config };
  // 从配置中获取端口号，如果有的话
  if (config.webAdminPort) {
    PORT = config.webAdminPort;
  }
  console.log('【web-admin】安全配置已同步');
}

// 静态文件托管
app.use(express.static(__dirname));

// 专门处理MP3文件的路由，确保正确的Content-Type
app.get('/:filename.mp3', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, `${filename}.mp3`);
  
  if (fs.existsSync(filePath)) {
    // 明确设置Content-Type为audio/mpeg
    res.set('Content-Type', 'audio/mpeg');
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📢 网页登录验证码已生成');
  console.log(`✅ 验证码: ${code}`);
  console.log(`⏱️  有效期: ${SECURITY_CONFIG.tempCodeExpire || 300}秒 (至 ${new Date(expireTime).toLocaleTimeString('zh-CN')})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  return code;
}

// 初始化函数
export async function init() {
  await initRedis();
  
  // 配置session
  app.use(session({
    secret: 'ai-web-admin-secret',
    resave: false,
    saveUninitialized: false,
    store: redisStore,
    cookie: {
      secure: false,
      maxAge: 30 * 60 * 1000 // 30分钟过期
    }
  }));
  
  // 解析JSON请求体
  app.use(express.json());
  
  // 登录验证中间件
  function requireLogin(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
      const loginTime = req.session.loginTime || 0;
      const now = Date.now();
      
      // 检查是否过期（30分钟）
      if (now - loginTime <= 30 * 60 * 1000) {
        next();
      } else {
        // 已过期，清除session
        req.session.destroy();
        res.redirect('/?error=session_expired');
      }
    } else {
      res.redirect('/?error=not_logged_in');
    }
  }
  
  // 根路由：重定向到独立的登录页面
  app.get('/', (req, res) => {
    res.redirect('/login.html' + req.url.slice(1));
  });

  // 生成新验证码的路由
  app.get('/generate-code', (req, res) => {
    try {
      generateAndPrintCode();
      res.json({ success: true, message: '验证码已生成，请查看服务器终端' });
    } catch (error) {
      res.json({ success: false, message: '生成验证码失败' });
    }
  });
  
  // 验证码验证路由
  app.post('/verify-code', (req, res) => {
    const { code } = req.body;
    
    if (!code || !/^\d{6}$/.test(code)) {
      return res.json({ success: false, message: '无效的验证码格式' });
    }
    
    const tempCodes = SECURITY_CONFIG.tempCodes || {};
    const codeInfo = tempCodes[code];
    
    if (!codeInfo) {
      return res.json({ success: false, message: '验证码不存在或已过期' });
    }
    
    const now = Date.now();
    if (now > codeInfo.expire) {
      // 已过期，删除验证码
      delete tempCodes[code];
      SECURITY_CONFIG.tempCodes = tempCodes;
      return res.json({ success: false, message: '验证码已过期' });
    }
    
    if (codeInfo.used) {
      return res.json({ success: false, message: '验证码已被使用' });
    }
    
    // 验证成功，标记为已使用
    codeInfo.used = true;
    SECURITY_CONFIG.tempCodes = tempCodes;
    
    // 设置session
    req.session.isLoggedIn = true;
    req.session.loginTime = now;
    
    return res.json({ success: true, redirect: '/config.html' });
  });
  
  // 配置页路由（需要登录）
  app.get('/config.html', requireLogin, (req, res) => {
    // 静态文件托管已经处理了这个路由，这里只是确保登录验证
    res.sendFile(path.join(__dirname, 'config.html'));
  });
  
  // 获取配置的路由（需要登录验证）
  app.get('/get-config', requireLogin, (req, res) => {
    try {
      const config = loadConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ success: false, message: '加载配置失败: ' + error.message });
    }
  });
  
  // 保存配置的路由（需要登录验证）
  app.post('/save-config', requireLogin, (req, res) => {
    try {
      const config = req.body;
      if (saveConfig(config)) {
        res.json({ success: true, message: '配置保存成功' });
      } else {
        res.status(500).json({ success: false, message: '配置保存失败' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: '保存配置失败: ' + error.message });
    }
  });
  
  // 其他需要登录的API路由
  app.post('/api/update-config', requireLogin, (req, res) => {
    // 处理配置更新
    res.json({ success: true, message: '配置更新成功' });
  });
  
  // 启动服务器
  app.listen(PORT, () => {
    console.log(`🌐 风云AI管理端已启动，访问地址: http://localhost:${PORT}`);
    console.log(`📱 移动端访问地址: http://${SECURITY_CONFIG.outerIp || 'localhost'}:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 生成初始验证码
    generateAndPrintCode();
  });
}
