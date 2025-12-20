import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  console.log(`【web-admin】安全配置已同步`);
}

// 静态文件托管
app.use(express.static(__dirname));

// 根路由：验证临时码并跳转到配置页
app.get('/', (req, res) => {
  const queryCode = req.query.code;
  
  if (queryCode && /^\d{6}$/.test(queryCode)) {
    if (SECURITY_CONFIG.tempCodes && SECURITY_CONFIG.tempCodes[queryCode]) {
      const codeInfo = SECURITY_CONFIG.tempCodes[queryCode];
      
      // 验证临时码
      if (codeInfo.used) {
        return res.send(`
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head><meta charset="UTF-8"><title>临时码已使用</title></head>
          <body style="text-align:center; margin-top:50px; font-family:Arial,sans-serif;">
            <h1 style="color:#dc3545;">❌ 临时码已使用</h1>
            <p>请重新发送 <strong>#ai配置登陆</strong> 获取新码</p>
          </body>
          </html>
        `);
      }
      
      if (Date.now() > codeInfo.expire) {
        delete SECURITY_CONFIG.tempCodes[queryCode];
        return res.send(`
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head><meta charset="UTF-8"><title>临时码已过期</title></head>
          <body style="text-align:center; margin-top:50px; font-family:Arial,sans-serif;">
            <h1 style="color:#dc3545;">❌ 临时码已过期</h1>
            <p>请重新发送 <strong>#ai配置登陆</strong> 获取新码</p>
          </body>
          </html>
        `);
      }
      
      // 验证通过，跳转到配置页
      codeInfo.used = true;
      delete SECURITY_CONFIG.tempCodes[queryCode];
      return res.redirect('/config.html');
    } else {
      return res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head><meta charset="UTF-8"><title>临时码无效</title></head>
        <body style="text-align:center; margin-top:50px; font-family:Arial,sans-serif;">
          <h1 style="color:#dc3545;">❌ 临时码无效</h1>
          <p>请发送 <strong>#ai配置登陆</strong> 获取有效临时码</p>
        </body>
        </html>
      `);
    }
  }

  // 显示登录页
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>风云AI - 安全登录</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .error { color: #dc3545; margin-bottom: 15px; text-align:center; }
        .input-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top:10px; }
        button:hover { background: #0056b3; }
        .hint { color: #6c757d; font-size: 12px; margin-top: 15px; text-align:center; }
      </style>
    </head>
    <body>
      <h2 style="text-align:center; color:#007bff;">风云AI助手 - 安全登录</h2>
      <div class="input-group">
        <label>6位临时验证码</label>
        <input type="text" id="code" placeholder="请输入群聊获取的临时验证码" maxlength="6">
      </div>
      <button onclick="verifyCode()">验证并进入配置页</button>
      <div class="hint">请在QQ群发送 #ai配置登陆 获取临时验证码</div>
      <script>
        function verifyCode() {
          const code = document.getElementById('code').value.trim();
          if (!code || code.length !== 6) {
            alert('验证码必须为6位数字');
            return;
          }
          window.location.href = '/?code=' + code;
        }
      </script>
    </body>
    </html>
  `);
});

// 配置文件路径
const AI_JS_PATH = path.join(__dirname, '../ai.js');

// 接口：获取AI插件配置
app.get('/get-config', async (req, res) => {
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
        visionModel: extractValue(apiConfigStr, 'visionModel') || 'claude-3-sonnet-20240229',
        fileUploadUrl: extractValue(apiConfigStr, 'fileUploadUrl') || 'https://api.gptgod.online/v1/file',
        temperature: parseFloat(extractValue(apiConfigStr, 'temperature')) || 1.3,
        max_tokens: parseInt(extractValue(apiConfigStr, 'max_tokens')) || 6000,
        top_p: parseFloat(extractValue(apiConfigStr, 'top_p')) || 0.9,
        presence_penalty: parseFloat(extractValue(apiConfigStr, 'presence_penalty')) || 0.6,
        frequency_penalty: parseFloat(extractValue(apiConfigStr, 'frequency_penalty')) || 0.6,
        timeout: parseInt(extractValue(apiConfigStr, 'timeout')) || 30000
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

    // 提取TRIGGER_CONFIG - 修正字段名
    const triggerConfigMatch = aiJsContent.match(/const TRIGGER_CONFIG = {([\s\S]*?)}/);
    if (triggerConfigMatch) {
      const triggerConfigStr = triggerConfigMatch[1];
      config.triggerConfig = {
        prefix: extractValue(triggerConfigStr, 'prefix') || '风云',
        globalAICooldown: parseInt(extractValue(triggerConfigStr, 'globalAICooldown')) || 3,
        globalAIChance: parseFloat(extractValue(triggerConfigStr, 'globalAIChance')) || 0.3
      };
    }

    // 提取PERSONA - 重要修复：正确提取人设配置
    const personaMatch = aiJsContent.match(/const PERSONA = `([\s\S]*?)`;?/);
    if (personaMatch) {
      config.persona = personaMatch[1];
    } else {
      // 备用匹配方式
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
        enabled: extractValue(embeddingConfigStr, 'enabled') === 'true',
        provider: extractValue(embeddingConfigStr, 'provider') || 'lightweight',
        apiUrl: extractValue(embeddingConfigStr, 'apiUrl'),
        apiKey: extractValue(embeddingConfigStr, 'apiKey'),
        apiModel: extractValue(embeddingConfigStr, 'apiModel') || 'text-embedding-ada-002',
        maxContexts: parseInt(extractValue(embeddingConfigStr, 'maxContexts')) || 5,
        similarityThreshold: parseFloat(extractValue(embeddingConfigStr, 'similarityThreshold')) || 0.6,
        cacheExpiry: parseInt(extractValue(embeddingConfigStr, 'cacheExpiry')) || 86400
      };
    }

    // 提取SECURITY_CONFIG
    const securityConfigMatch = aiJsContent.match(/const SECURITY_CONFIG = {([\s\S]*?)}/);
    if (securityConfigMatch) {
      const securityConfigStr = securityConfigMatch[1];
      config.securityConfig = {
        webAdminPort: parseInt(extractValue(securityConfigStr, 'webAdminPort')) || 54188,
        tempCodeExpire: parseInt(extractValue(securityConfigStr, 'tempCodeExpire')) || 300,
        outerIp: extractValue(securityConfigStr, 'outerIp') || ''
      };
    }

    res.json(config);
  } catch (error) {
    console.error('获取配置失败：', error);
    res.status(500).json({ success: false, message: `获取配置失败：${error.message}` });
  }
});

// 辅助函数：从字符串中提取值
function extractValue(str, key) {
  const regex = new RegExp(`${key}:\\s*(["'])(.*?)\\1`);
  const match = str.match(regex);
  return match ? match[2] : null;
}

// 辅助函数：从字符串中提取数组
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

// 接口：保存配置到ai.js
app.post('/save-config', async (req, res) => {
  try {
    const config = req.body;
    console.log('收到保存配置请求');
    
    // 验证必填项
    if (!config.apiConfig || !config.apiConfig.apiKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'API密钥为必填项' 
      });
    }
    
    // 读取原始文件
    let aiJsContent = fs.readFileSync(AI_JS_PATH, 'utf8');
    
    // 替换API_CONFIG
    aiJsContent = aiJsContent.replace(
      /const API_CONFIG = {[\s\S]*?};?/,
      `const API_CONFIG = {
  baseUrl: '${config.apiConfig.baseUrl}',
  apiKey: '${config.apiConfig.apiKey}',
  chatModel: '${config.apiConfig.chatModel}',
  visionModel: '${config.apiConfig.visionModel}',
  fileUploadUrl: '${config.apiConfig.fileUploadUrl}',
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
    
    // 过滤掉非数字
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

    // 替换TRIGGER_CONFIG - 重要修复
    aiJsContent = aiJsContent.replace(
      /const TRIGGER_CONFIG = {[\s\S]*?};?/,
      `const TRIGGER_CONFIG = {
  prefix: '${config.triggerConfig.prefix}',
  globalAICooldown: ${config.triggerConfig.globalAICooldown},
  globalAIChance: ${config.triggerConfig.globalAIChance}
};`
    );

    // 替换PERSONA - 重要修复：正确处理多行人设
    let personaText = config.persona || '';
    // 转义反引号，避免在模板字符串中出现未闭合的反引号
    personaText = personaText.replace(/`/g, '\\`');
    
    const personaRegex = /const PERSONA = `[\s\S]*?`;?/;
    if (personaRegex.test(aiJsContent)) {
      aiJsContent = aiJsContent.replace(
        personaRegex,
        `const PERSONA = \`${personaText}\`;`
      );
    } else {
      // 如果找不到原有人设配置，在文件末尾添加
      const personaMatch = aiJsContent.match(/const EMBEDDING_CONFIG = {[\s\S]*?};?/);
      if (personaMatch) {
        const afterEmbedding = aiJsContent.indexOf(personaMatch[0]) + personaMatch[0].length;
        aiJsContent = aiJsContent.slice(0, afterEmbedding) + `\n\nconst PERSONA = \`${personaText}\`;` + aiJsContent.slice(afterEmbedding);
      }
    }

    // 替换EMBEDDING_CONFIG
    const apiUrl = config.embeddingConfig.apiUrl ? `'${config.embeddingConfig.apiUrl}'` : 'null';
    const apiKey = config.embeddingConfig.apiKey ? `'${config.embeddingConfig.apiKey}'` : 'null';
    
    aiJsContent = aiJsContent.replace(
      /const EMBEDDING_CONFIG = {[\s\S]*?};?/,
      `const EMBEDDING_CONFIG = {
  enabled: ${config.embeddingConfig.enabled},
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
    
    console.log('配置已成功保存到ai.js');
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

// 配置页路由
app.get('/config.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'config.html'));
});

// 启动服务
const PORT = SECURITY_CONFIG.webAdminPort || 54188;
app.listen(PORT, () => {
  console.log(`【风云AI】网页管理端已启动，访问地址：http://0.0.0.0:${PORT}`);
  console.log(`【风云AI】安全机制：群聊发送#ai配置登陆获取临时地址`);
});

// 导出app
export default app;