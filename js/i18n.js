/**
 * I18N SYSTEM - Internationalization Manager
 * Handles loading and switching between multiple languages
 */

class I18N {
    constructor() {
        this.currentLanguage = 'es'; // Default language
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
        const savedLang = localStorage.getItem('yolo_annotator_language');
        if (savedLang) {
            this.currentLanguage = savedLang;
        }
    }

    async loadLanguage(langCode) {
        try {
            const response = await fetch(`locales/${langCode}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language: ${langCode}`);
            }
            this.translations = await response.json();
            this.currentLanguage = langCode;
            
            // Save preference
            localStorage.setItem('yolo_annotator_language', langCode);
            
            return true;
        } catch (error) {
            console.error('Error loading language:', error);
            
            // Fallback to Spanish if loading fails
            if (langCode !== 'es') {
                console.log('Falling back to Spanish');
                return await this.loadLanguage('es');
            }
            
            return false;
        }
    }

    // Get translation by key path (e.g., "app.title")
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

    // Update all text elements in the DOM with translations
    updateDOM() {
        if (!this.translations) return;

        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder !== undefined) {
                    element.placeholder = translation;
                }
            } else {
                element.textContent = translation;
            }
        });

        // Update elements with data-i18n-title attribute (for tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // Update elements with data-i18n-html attribute (allows HTML)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });
    }

    // Create language selector dropdown
    createLanguageSelector() {
        const container = document.createElement('div');
        container.className = 'language-selector-container';
        container.style.cssText = 'position: relative; display: inline-block;';

        const currentLang = this.availableLanguages.find(l => l.code === this.currentLanguage);
        
        const button = document.createElement('button');
        button.className = 'btn-header language-selector-btn';
        button.innerHTML = `<span class="flag">${currentLang.flag}</span> <span class="lang-name">${currentLang.name}</span> <i class="fas fa-chevron-down"></i>`;
        button.style.cssText = 'min-width: 140px; justify-content: space-between;';
        
        const dropdown = document.createElement('div');
        dropdown.className = 'language-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 5px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 180px;
            display: none;
            z-index: 10000;
            max-height: 400px;
            overflow-y: auto;
        `;

        this.availableLanguages.forEach(lang => {
            const item = document.createElement('div');
            item.className = 'language-item';
            item.style.cssText = `
                padding: 10px 15px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background 0.2s;
                font-size: 0.9em;
            `;
            
            if (lang.code === this.currentLanguage) {
                item.style.background = '#f0f0f0';
                item.style.fontWeight = 'bold';
            }
            
            item.innerHTML = `<span class="flag" style="font-size: 1.2em;">${lang.flag}</span> <span>${lang.name}</span>`;
            
            item.onmouseover = () => item.style.background = '#f8f9fa';
            item.onmouseout = () => {
                item.style.background = lang.code === this.currentLanguage ? '#f0f0f0' : 'white';
            };
            
            item.onclick = async () => {
                dropdown.style.display = 'none';
                if (lang.code !== this.currentLanguage) {
                    await this.changeLanguage(lang.code);
                }
            };
            
            dropdown.appendChild(item);
        });

        button.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        container.appendChild(button);
        container.appendChild(dropdown);

        return container;
    }

    async changeLanguage(langCode) {
        const success = await this.loadLanguage(langCode);
        if (success) {
            this.updateDOM();
            
            // Update language selector button
            const currentLang = this.availableLanguages.find(l => l.code === langCode);
            const selectorBtn = document.querySelector('.language-selector-btn');
            if (selectorBtn && currentLang) {
                selectorBtn.innerHTML = `<span class="flag">${currentLang.flag}</span> <span class="lang-name">${currentLang.name}</span> <i class="fas fa-chevron-down"></i>`;
            }
            
            // Refresh highlights in dropdown
            document.querySelectorAll('.language-item').forEach(item => {
                const langName = item.querySelector('span:last-child').textContent;
                const lang = this.availableLanguages.find(l => l.name === langName);
                if (lang && lang.code === langCode) {
                    item.style.background = '#f0f0f0';
                    item.style.fontWeight = 'bold';
                } else {
                    item.style.background = 'white';
                    item.style.fontWeight = 'normal';
                }
            });
            
            // Trigger custom event for language change
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: langCode } }));
            
            // Show toast notification if app is loaded
            if (window.app && window.app.ui) {
                window.app.ui.showToast(this.t('notifications.appStarted'), 'success', 2000);
            }
        }
    }

    async init() {
        await this.loadLanguage(this.currentLanguage);
        this.updateDOM();
    }
}

// Create global instance
window.i18n = new I18N();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.i18n.init();
    });
} else {
    window.i18n.init();
}
