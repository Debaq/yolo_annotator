/**
 * MAIN ENTRY POINT
 * Initializes Alpine.js and all application modules
 */

import Alpine from 'alpinejs';
import { registerAppStore } from '@stores/appStore';
import { i18n } from '@managers/i18n';
import { confirmModal, newProjectModal, exportModal } from '@components/modals';
import { canvasComponent } from '@components/canvas';
import '@styles/main.css';

// Make Alpine available globally for debugging
window.Alpine = Alpine;

// Register Alpine.js components
Alpine.data('confirmModal', confirmModal);
Alpine.data('newProjectModal', newProjectModal);
Alpine.data('exportModal', exportModal);
Alpine.data('canvasComponent', canvasComponent);

// Initialize i18n first
await i18n.init();

// Register stores
registerAppStore();

// Start Alpine
Alpine.start();

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea
    if (e.target.matches('input, textarea, select')) return;

    const app = Alpine.store('app');

    // Number keys for class selection
    if (e.key >= '1' && e.key <= '9' && app.currentProject?.classes) {
        const classIndex = parseInt(e.key) - 1;
        if (app.currentProject.classes[classIndex]) {
            app.selectedClass = classIndex;
        }
    }

    // Tool shortcuts
    const toolShortcuts = {
        'b': 'bbox',
        'm': 'mask',
        'v': 'select',
        'h': 'pan'
    };

    if (toolShortcuts[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
        app.setTool(toolShortcuts[e.key.toLowerCase()]);
    }

    // Save shortcut (Ctrl/Cmd + S)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (app.hasUnsavedChanges) {
            app.saveCurrentImage();
        }
    }

    // Navigation shortcuts
    if (e.key === 'ArrowLeft' && !e.ctrlKey) {
        e.preventDefault();
        app.previousImage();
    } else if (e.key === 'ArrowRight' && !e.ctrlKey) {
        e.preventDefault();
        app.nextImage();
    }

    // Undo (Ctrl/Cmd + Z)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        // Will be implemented
    }
});

console.log('✅ Annotix initialized successfully');
