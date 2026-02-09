import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { promisify } from 'util';
import { pipeline } from 'stream';
import configManager from './config.js';
import BotUtil from '../../../lib/common/util.js';

const _path = process.cwd();
const TEMP_IMAGE_DIR = path.join(_path, 'data/temp/ai_images');

// Ensure temp image dir exists
if (!fs.existsSync(TEMP_IMAGE_DIR)) {
  fs.mkdirSync(TEMP_IMAGE_DIR, { recursive: true });
}

export function cleanInvalidCharacters(text) {
  if (!text) return '';
  return text
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '')
    .trim();
}

export function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class AILogic {
  constructor() {
    this.visionConfig = configManager.getConfigValue('visionConfig');
    this.triggerConfig = configManager.getConfigValue('triggerConfig');
  }

  /**
   * 处理图片识别
   */
  async processImage(imageUrl) {
    const visionConfig = configManager.getConfigValue('visionConfig');
    if (!imageUrl || !visionConfig.enabled || !visionConfig.apiKey) {
      return '识图功能未启用或未配置API密钥';
    }

    let tempFilePath = null;
    try {
      tempFilePath = await this.downloadImage(imageUrl);
      let uploadedUrl = imageUrl;
      
      if (visionConfig.uploadEnabled && visionConfig.uploadUrl) {
        uploadedUrl = await this.uploadImageToAPI(tempFilePath);
      }

      const messages = [
        { role: 'system', content: visionConfig.systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: uploadedUrl }
            }
          ]
        }
      ];

      const result = await this.callVisionAPI(messages);
      return result || '识图失败';
    } catch (error) {
      console.error(`\x1b[31m【风云AI-识图】图片处理失败: ${error.message}\x1b[0m`);
      return '图片处理失败';
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.error(`\x1b[31m【风云AI】清理临时文件失败: ${err.message}\x1b[0m`);
        }
      }
    }
  }

  async downloadImage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      const filename = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
      const filePath = path.join(TEMP_IMAGE_DIR, filename);

      const streamPipeline = promisify(pipeline);
      await streamPipeline(response.body, fs.createWriteStream(filePath));

      return filePath;
    } catch (error) {
      throw new Error(`图片下载失败: ${error.message}`);
    }
  }

  async uploadImageToAPI(filePath) {
    const visionConfig = configManager.getConfigValue('visionConfig');
    if (!visionConfig.uploadUrl) {
      throw new Error('未配置文件上传URL');
    }

    try {
      const form = new FormData();
      const fileBuffer = await fs.promises.readFile(filePath);

      form.append('file', fileBuffer, {
        filename: path.basename(filePath),
        contentType: 'image/png'
      });

      const apiKey = visionConfig.apiKey;
      if (!apiKey) {
        throw new Error('未配置识图API密钥');
      }

      const response = await fetch(visionConfig.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        },
        body: form
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`上传失败: ${response.status} ${response.statusText}${text ? ` | ${text}` : ''}`);
      }

      const result = await response.json().catch(() => ({}));
      const finalUrl =
        result?.data?.url ??
        (Array.isArray(result?.data) ? result.data[0]?.url : undefined) ??
        result?.url;

      if (!finalUrl) {
        throw new Error(`上传成功标未返回URL，响应: ${JSON.stringify(result)}`);
      }

      return finalUrl;
    } catch (error) {
      throw new Error(`图片上传失败: ${error.message}`);
    }
  }

  async callVisionAPI(messages) {
    const visionConfig = configManager.getConfigValue('visionConfig');
    try {
      const baseUrl = visionConfig.apiBaseUrl;
      const apiKey = visionConfig.apiKey;
      
      if (!apiKey) {
        throw new Error('未配置识图API密钥');
      }

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: visionConfig.model,
          messages,
          temperature: visionConfig.temperature,
          max_tokens: visionConfig.max_tokens
        }),
        signal: AbortSignal.timeout(visionConfig.timeout)
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`API错误: ${resp.status} ${resp.statusText}${text ? ` | ${text}` : ''}`);
      }

      const data = await resp.json();
      return data?.choices?.[0]?.message?.content || null;
    } catch (error) {
      throw new Error(`识图API调用失败: ${error.message}`);
    }
  }

  /**
   * 处理消息内容
   */
  async processMessageContent(e, chatStream) {
    const visionConfig = configManager.getConfigValue('visionConfig');
    const triggerConfig = configManager.getConfigValue('triggerConfig');
    let content = '';
    const imageDescriptions = [];
    const message = e.message;

    if (!Array.isArray(message)) {
      const rawText = e.msg || '';
      return { 
        content: cleanInvalidCharacters(rawText), 
        text: cleanInvalidCharacters(rawText) 
      };
    }

    try {
      if (e.source && e.getReply) {
        try {
          const reply = await e.getReply();
          if (reply) {
            const nickname = reply.sender?.card || reply.sender?.nickname || '未知';
            const replyText = reply.raw_message?.substring(0, 30) || '';
            content += `[回复${nickname}的"${replyText}..."] `;

            if (Array.isArray(reply.message)) {
              for (const replySeg of reply.message) {
                if (replySeg.type === 'image' && visionConfig.enabled && visionConfig.apiKey) {
                  const imageUrl = replySeg.url || replySeg.file;
                  if (imageUrl) {
                    console.log(`\x1b[36m【风云AI-识图】检测到回复消息中的图片: ${imageUrl}\x1b[0m`);
                    const desc = await this.processImage(imageUrl);
                    imageDescriptions.push(`[回复图片:${desc}]`);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`\x1b[31m【风云AI】处理回复消息失败: ${error.message}\x1b[0m`);
        }
      }

      for (const seg of message) {
        switch (seg.type) {
          case 'text':
            content += seg.text;
            break;

          case 'at':
            if (seg.qq != e.self_id) {
              try {
                const member = e.group?.pickMember(seg.qq);
                const info = await member?.getInfo();
                const nickname = info?.card || info?.nickname || seg.qq;
                content += `@${nickname} `;
              } catch {
                content += `@${seg.qq} `;
              }
            }
            break;

          case 'image':
            if (visionConfig.enabled && visionConfig.apiKey) {
              const imageUrl = seg.url || seg.file;
              if (imageUrl) {
                console.log(`\x1b[36m【风云AI-识图】检测到消息图片: ${imageUrl}\x1b[0m`);
                const desc = await this.processImage(imageUrl);
                imageDescriptions.push(`[图片:${desc}]`);
              }
            } else {
              content += '[图片] ';
            }
            break;
        }
      }

      const prefix = triggerConfig.prefix;
      if (prefix) {
        content = content.replace(new RegExp(`^${prefix}`), '');
      }

      return {
        content: cleanInvalidCharacters(content.trim()),
        text: cleanInvalidCharacters(content.trim()),
        imageDescriptions
      };
    } catch (error) {
      console.error(`\x1b[31m【风云AI】处理消息内容失败: ${error.message}\x1b[0m`);
      return { content: e.msg || '', text: e.msg || '' };
    }
  }
}

export default new AILogic();
