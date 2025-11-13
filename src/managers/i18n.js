/**
 * I18N MANAGER - Internationalization System
 * Modern ES6 module with Alpine.js integration
 */

export class I18N {
    constructor() {
        this.currentLanguage = 'es';
        this.translations = null;
        this.availableLanguages = [
            { code: 'en', name: 'English', flag: '🇬🇧' },
            { code: 'es', name: 'Español', flag: '🇪🇸' },
            { code: 'fr', name: 'Français', flag: '🇫🇷' },
            { code: 'zh', name: '中文', flag: '🇨🇳' },
            { code: 'ja', name: '日本語', flag: '🇯🇵' },
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'pt', name: 'Português', flag: '🇵🇹' },
            { code: 'it', name: 'Italiano', flag: '🇮🇹' },
            { code: 'ru', name: 'Русский', flag: '🇷🇺' },
            { code: 'ko', name: '한국어', flag: '🇰🇷' }
        ];

        // Load saved language preference
        const savedLang = localStorage.getItem('annotix_language');
        if (savedLang && this.availableLanguages.find(l => l.code === savedLang)) {
            this.currentLanguage = savedLang;
        }
    }

    async loadLanguage(langCode) {
        try {
            const response = await fetch(`/locales/${langCode}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language: ${langCode}`);
            }

            this.translations = await response.json();
            this.currentLanguage = langCode;

            // Save preference
            localStorage.setItem('annotix_language', langCode);

            return true;
        } catch (error) {
            console.error('Error loading language:', error);

            // Fallback to Spanish if loading fails
            if (langCode !== 'es') {
                console.warn('Falling back to Spanish');
                return await this.loadLanguage('es');
            }

            return false;
        }
    }

    /**
     * Get translation by key path (e.g., "app.title")
     * @param {string} keyPath - Dot-notation path to translation
     * @param {object} params - Parameters to replace in translation {key: value}
     * @returns {string} Translated text
     */
    t(keyPath, params = {}) {
        if (!this.translations) {
            return keyPath;
        }

        const keys = keyPath.split('.');
        let value = this.translations;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                console.warn(`Translation key not found: ${keyPath}`);
                return keyPath;
            }
        }

        // Replace parameters in translation string
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            return value.replace(/\{(\w+)\}/g, (match, key) => {
                return params[key] !== undefined ? params[key] : match;
            });
        }

        return value;
    }

    /**
     * Update all DOM elements with data-i18n attributes
     */
    updateDOM() {
        if (!this.translations) return;

        // Update text content
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);

            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update titles/tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // Update HTML content
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });
    }

    /**
     * Change language and update UI
     * @param {string} langCode - Language code (e.g., 'en', 'es')
     */
    async changeLanguage(langCode) {
        const success = await this.loadLanguage(langCode);
        if (success) {
            this.updateDOM();

            // Dispatch Alpine.js event
            window.dispatchEvent(new CustomEvent('language-changed', {
                detail: { language: langCode }
            }));
        }
        return success;
    }

    /**
     * Initialize i18n system
     */
    async init() {
        await this.loadLanguage(this.currentLanguage);
        this.updateDOM();
    }

    /**
     * Get current language object
     */
    getCurrentLanguage() {
        return this.availableLanguages.find(l => l.code === this.currentLanguage);
    }
}

// Create and export singleton instance
export const i18n = new I18N();

// Make available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.i18n = i18n;
}
