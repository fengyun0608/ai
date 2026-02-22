
import { Config } from '../../xiaofei-plugin/components/index.js';

// 音乐源映射
const MUSIC_SOURCES = {
    'qq': 'qq',
    'netease': 'netease',
    'kugou': 'kugou',
    'kuwo': 'kuwo',
    'bilibili': 'bilibili'
};

export class MusicHandler {
    constructor() {
        this.source = 'qq'; // 默认源
    }

    /**
     * 设置音乐源
     * @param {string} source - 音乐源 (qq, netease, kugou, kuwo, bilibili)
     */
    setSource(source) {
        if (MUSIC_SOURCES[source]) {
            this.source = source;
            return true;
        }
        return false;
    }

    /**
     * 获取当前音乐源
     */
    getSource() {
        return this.source;
    }

    /**
     * 构造点歌指令
     * @param {string} keyword - 歌曲名
     * @returns {string} - 构造的点歌指令
     */
    getCommand(keyword) {
        // 构造指令，例如 "#QQ点歌 稻香" 或 "#网易点歌 稻香"
        const sourceName = this.getSourceName(this.source);
        return `#${sourceName}点歌 ${keyword}`;
    }

    /**
     * 获取源的中文名称
     */
    getSourceName(source) {
        switch (source) {
            case 'qq': return 'QQ';
            case 'netease': return '网易';
            case 'kugou': return '酷狗';
            case 'kuwo': return '酷我';
            case 'bilibili': return '哔哩哔哩';
            default: return 'QQ';
        }
    }
}

export default new MusicHandler();
