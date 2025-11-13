/**
 * MAIN ENTRY POINT
 * Initializes Alpine.js and all application modules
 */

import Alpine from 'alpinejs';
import { registerAppStore } from '@stores/appStore';
import '@styles/main.css';

// Make Alpine available globally for debugging
window.Alpine = Alpine;

// Register stores
registerAppStore();

// Start Alpine
Alpine.start();

console.log('✅ Annotix initialized successfully');
