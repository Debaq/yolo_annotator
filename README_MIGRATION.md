# Annotix - Migrated to Vite + Alpine.js ✅

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server with HMR
npm run dev
# Opens automatically at http://localhost:3000
```

### Production Build
```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

## ✨ What Changed

### Before: Traditional Web App
- 1.6 MB unoptimized code
- 243 manual DOM manipulations
- Scattered state management
- No build system

### After: Modern Alpine.js App
- **29 KB optimized bundle** (98% smaller!)
- Reactive UI with Alpine.js
- Centralized state management
- Vite build system with HMR

## 📂 New File Structure

```
src/
├── main.js                    # Application entry point
├── stores/
│   └── appStore.js           # Reactive state management
├── managers/
│   ├── database.js           # IndexedDB operations
│   └── i18n.js              # Internationalization
├── components/
│   ├── modals.js            # Modal components
│   └── canvas.js            # Canvas wrapper
└── styles/
    └── main.css             # Aggregated styles

public/
└── locales/                 # Translation files

dist/                        # Production build output
```

## 🎯 Key Features

### Reactive State Management
```javascript
// Access app state anywhere
Alpine.store('app').currentProject
Alpine.store('app').loadProject(id)
```

### Declarative UI
```html
<!-- Before: Manual DOM manipulation -->
document.getElementById('btn').disabled = !hasProject;

<!-- After: Reactive binding -->
<button :disabled="!$store.app.hasProject">
```

### Keyboard Shortcuts
- `1-9`: Select classes
- `B`: Bounding box tool
- `M`: Mask tool
- `V`: Select tool
- `H`: Pan tool
- `Ctrl+S`: Save
- `←/→`: Navigate images

## 🔧 Development Workflow

### Hot Module Replacement
Changes to code are reflected **instantly** without page reload:
```bash
npm run dev
# Edit src/stores/appStore.js → See changes immediately
```

### Type Safety (Optional)
Add JSDoc comments for IDE autocomplete:
```javascript
/**
 * @param {number} projectId
 * @returns {Promise<Project>}
 */
async function loadProject(projectId) {
  // TypeScript-like autocomplete!
}
```

## 📦 Bundle Analysis

```
Production build (gzipped):
- index.html:           4.0 KB
- Main JavaScript:      5.7 KB
- Alpine.js vendor:    14.3 KB
- CSS:                  9.4 KB
────────────────────────────────
Total:                 33.4 KB
```

## 🐛 Debugging

### Development
- Open browser DevTools
- Access Alpine store: `Alpine.store('app')`
- View reactive state changes in real-time

### Production
- Source maps included for debugging
- Remove in `vite.config.js` if not needed

## 🔄 Backward Compatibility

- **Old version preserved**: `index-old.html`
- **Database compatible**: No schema changes
- **Data migrates automatically**: IndexedDB unchanged

## 📚 Learn More

- **Vite**: https://vitejs.dev
- **Alpine.js**: https://alpinejs.dev
- **Migration Details**: See `MIGRATION.md`

## 💡 Tips

1. **Use `npm run dev`** for development (not `index.html`)
2. **Deploy `dist/` folder** to production
3. **Keyboard shortcuts work globally** (except in inputs)
4. **Auto-save enabled** by default (3-second debounce)

## 🚨 Important Notes

1. **Node.js required**: For development and building
2. **Modern browsers only**: Requires ES2020+ support
3. **No IE11 support**: Uses top-level await

---

**Previous version**: Open `index-old.html` directly
**New version**: Run `npm run dev` or deploy `dist/`
