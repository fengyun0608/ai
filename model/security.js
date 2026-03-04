import cfg from '../../../lib/config/config.js';
import configManager from './config.js';

class PermissionManager {
  constructor() {
  }

  getConfig() {
    return configManager.config?.permissionConfig || {
      enabled: true,
      masterOnlyMode: false,
      protectedActions: ['setEssence', 'removeEssence', 'announce', 'signIn'],
      protectedActionPermission: 'admin',
      protectedUsers: [],
      cantTouchMaster: true
    };
  }

  getMasterQQ() {
    const masters = cfg.masterQQ || [];
    if (!Array.isArray(masters)) return [masters].filter(Boolean);
    return masters.map(m => String(m)).filter(Boolean);
  }

  isMaster(userId) {
    const masters = this.getMasterQQ();
    return masters.includes(String(userId));
  }

  async getGroupMemberRole(e, userId) {
    if (!e?.isGroup || !e?.group) return 'member';
    
    try {
      const member = e.group.pickMember?.(userId || e.user_id);
      if (!member) return 'member';
      
      const info = await member.getInfo?.().catch(() => null);
      if (!info) return 'member';
      
      return info.role || 'member';
    } catch {
      return 'member';
    }
  }

  async getUserPermissionLevel(e, userId) {
    const uid = String(userId || e?.user_id);
    
    if (this.isMaster(uid) || e?.isMaster) {
      return 'master';
    }
    
    const role = await this.getGroupMemberRole(e, uid);
    return role || 'member';
  }

  async checkToolPermission(e, toolName, params = {}) {
    const config = this.getConfig();
    
    if (!config.enabled) {
      return { allowed: true };
    }
    
    const userId = String(e?.user_id);
    const level = await this.getUserPermissionLevel(e, userId);
    
    if (config.protectedActions?.includes(toolName)) {
      const requiredLevel = config.protectedActionPermission || 'admin';
      const levelHierarchy = ['member', 'admin', 'owner', 'master'];
      const userLevelIndex = levelHierarchy.indexOf(level);
      const requiredLevelIndex = levelHierarchy.indexOf(requiredLevel);
      
      if (userLevelIndex < requiredLevelIndex) {
        return { allowed: false, reason: `此操作需要${this.getLevelName(requiredLevel)}权限` };
      }
    }
    
    if (config.cantTouchMaster && (toolName === 'poke' || toolName === 'at')) {
      const targetQQ = params.qq;
      if (targetQQ) {
        const masters = this.getMasterQQ();
        if (masters.includes(String(targetQQ))) {
          if (!this.isMaster(userId)) {
            return { allowed: false, reason: '不能对主人使用此操作' };
          }
        }
      }
    }
    
    return { allowed: true };
  }

  getLevelName(level) {
    const names = {
      master: '主人',
      owner: '群主',
      admin: '管理员',
      member: '普通用户'
    };
    return names[level] || level;
  }

  async checkTriggerPermission(e) {
    return { allowed: true };
  }

  buildPermissionPrompt(e) {
    const config = this.getConfig();
    if (!config.enabled) return '';
    
    const masters = this.getMasterQQ();
    const masterInfo = masters.length > 0 ? `主人QQ: ${masters.join(', ')}` : '';
    
    const protectedList = config.protectedActions?.map(a => {
      const names = {
        setEssence: '设为精华',
        removeEssence: '取消精华',
        announce: '发布公告',
        signIn: '群签到'
      };
      return names[a] || a;
    }).join('、') || '';
    
    let prompt = '\n\n【权限规则】';
    if (masterInfo) prompt += `\n${masterInfo}`;
    if (protectedList) prompt += `\n需要管理员权限: ${protectedList}`;
    if (config.cantTouchMaster) prompt += '\n禁止对主人使用戳一戳等操作';
    
    return prompt;
  }
}

const permissionManager = new PermissionManager();
export default permissionManager;
