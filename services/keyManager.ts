
export type TaskType = 'tts' | 'image_video' | 'translate';

interface AppSettings {
    geminiKey: string;
    deepseekKey: string;
    geminiModel: string;
    rawKeys: string;
}

class KeyManager {
    private STORAGE_KEY = 'puch_manual_api_keys';
    private SETTINGS_KEY = 'puch_app_settings';
    private badKeys: Set<string> = new Set();

    private defaultSettings: AppSettings = {
        geminiKey: '',
        deepseekKey: '',
        geminiModel: 'gemini-2.5-flash-lite',
        rawKeys: ''
    };

    public saveKeys(keysString: string) {
        localStorage.setItem(this.STORAGE_KEY, keysString);
        this.badKeys.clear();
        
        // Cập nhật rawKeys trong settings nếu có
        const settings = this.getSettings();
        settings.rawKeys = keysString;
        this.saveSettings(settings);
    }

    public getKeysRaw(): string {
        const existing = localStorage.getItem(this.STORAGE_KEY);
        if (!existing) {
            const randomKey = Math.floor(Math.random() * 900000000000 + 100000000000).toString();
            this.saveKeys(randomKey);
            return randomKey;
        }
        return existing;
    }

    public getSettings(): AppSettings {
        const saved = localStorage.getItem(this.SETTINGS_KEY);
        if (saved) {
            try {
                return { ...this.defaultSettings, ...JSON.parse(saved), rawKeys: this.getKeysRaw() };
            } catch (e) {
                return { ...this.defaultSettings, rawKeys: this.getKeysRaw() };
            }
        }
        return { ...this.defaultSettings, rawKeys: this.getKeysRaw() };
    }

    public saveSettings(settings: AppSettings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({
            geminiKey: settings.geminiKey,
            deepseekKey: settings.deepseekKey,
            geminiModel: settings.geminiModel
        }));
        
        if (settings.rawKeys !== undefined) {
            localStorage.setItem(this.STORAGE_KEY, settings.rawKeys);
        }
    }

    public regenerateKey() {
        const newKey = Math.floor(Math.random() * 900000000000 + 100000000000).toString();
        this.saveKeys(newKey);
    }

    private getAllKeys(): string[] {
        return this.getKeysRaw()
            .split('\n')
            .map(k => k.trim())
            .filter(k => k.length > 0);
    }

    public getKey(task: TaskType): string {
        const settings = this.getSettings();

        // Ưu tiên Gemini Key riêng nếu có
        if ((task === 'image_video' || task === 'translate')) {
            if (settings.geminiKey) return settings.geminiKey;
            if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        }

        const keys = this.getAllKeys();
        let primaryKey = '';

        if (task === 'tts') primaryKey = keys[0] || '';
        else if (task === 'image_video') primaryKey = keys[1] || '';
        else if (task === 'translate') primaryKey = keys[2] || '';

        if (primaryKey && !this.badKeys.has(primaryKey)) {
            return primaryKey;
        }

        const fallbackStartIndex = task === 'translate' ? 3 : 2;
        const fallbackPool = keys.slice(fallbackStartIndex);
        for (const fbKey of fallbackPool) {
            if (!this.badKeys.has(fbKey)) {
                return fbKey;
            }
        }

        return (task === 'image_video' || task === 'translate') 
            ? (process.env.GEMINI_API_KEY || primaryKey || keys[0] || '')
            : (primaryKey || keys[0] || '');
    }

    public markKeyAsBad(key: string) {
        if (key) {
            this.badKeys.add(key);
            console.warn(`API Key ${key.substring(0, 8)}... đã bị đánh dấu lỗi.`);
        }
    }
}

export const keyManager = new KeyManager();
