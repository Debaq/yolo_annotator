/**
 * YOLO ANNOTATOR - COMPLETE JAVASCRIPT
 * FabLab TecMedHub - Universidad Austral de Chile
 * 
 * Features:
 * - Multiple projects with IndexedDB
 * - Bbox and Mask annotation tools
 * - Zoom, pan, edit annotations
 * - Import/Export projects and configs
 * - Keyboard shortcuts
 * - Toast notifications
 * - Auto-save
 * - Image gallery with filters
 */

// ============================================
// DATABASE MANAGER - IndexedDB
// ============================================
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'YOLOAnnotatorDB';
        this.version = 2;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Projects store
                if (!db.objectStoreNames.contains('projects')) {
                    const projectStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    projectStore.createIndex('name', 'name', { unique: true });
                }

                // Images store
                if (!db.objectStoreNames.contains('images')) {
                    const imageStore = db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
                    imageStore.createIndex('projectId', 'projectId', { unique: false });
                    imageStore.createIndex('name', 'name', { unique: false });
                }
            };
        });
    }

    // Project operations
    async saveProject(project) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            const request = project.id ? store.put(project) : store.add(project);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getProject(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllProjects() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteProject(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Image operations
    async saveImage(imageData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            const request = imageData.id ? store.put(imageData) : store.add(imageData);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getImage(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getProjectImages(projectId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const index = store.index('projectId');
            const request = index.getAll(projectId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImage(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteProjectImages(projectId) {
        const images = await this.getProjectImages(projectId);
        for (const image of images) {
            await this.deleteImage(image.id);
        }
    }
}

// ============================================
// UI MANAGER - Toasts and Modals
// ============================================
class UIManager {
    constructor() {
        this.toastContainer = null;
        this.init();
    }

    init() {
        // Create toast container
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <i class="toast-icon ${icons[type]}"></i>
            <div class="toast-message">${message}</div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.onclick = () => this.removeToast(toast);

        this.toastContainer.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => this.removeToast(toast), duration);
        }
    }

    removeToast(toast) {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    confirm(message, onConfirm, onCancel) {
        return window.confirm(message);
    }

    showModal(title, content, buttons = []) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'modal';

        modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            <div class="modal-footer">
                ${buttons.map(btn => `
                    <button class="btn btn-${btn.type || 'secondary'}" data-action="${btn.action}">
                        ${btn.icon ? `<i class="${btn.icon}"></i>` : ''}
                        ${btn.text}
                    </button>
                `).join('')}
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close handlers
        const close = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 200);
        };

        modal.querySelector('.modal-close').onclick = close;
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        // Button handlers
        buttons.forEach(btn => {
            if (btn.handler) {
                modal.querySelector(`[data-action="${btn.action}"]`).onclick = () => {
                    btn.handler(modal, close);
                };
            }
        });

        return { modal, overlay, close };
    }
}

// ============================================
// PROJECT MANAGER
// ============================================
class ProjectManager {
    constructor(db, ui) {
        this.db = db;
        this.ui = ui;
        this.currentProject = null;
    }

    async createProject(name, type, classes) {
        const project = {
            name,
            type, // 'bbox' or 'mask'
            classes,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        try {
            const id = await this.db.saveProject(project);
            project.id = id;
            this.ui.showToast(`Proyecto "${name}" creado`, 'success');
            return project;
        } catch (error) {
            this.ui.showToast('Error al crear proyecto', 'error');
            throw error;
        }
    }

    async loadProject(id) {
        try {
            const project = await this.db.getProject(id);
            if (project) {
                this.currentProject = project;
                this.ui.showToast(`Proyecto "${project.name}" cargado`, 'success');
                return project;
            }
        } catch (error) {
            this.ui.showToast('Error al cargar proyecto', 'error');
            throw error;
        }
    }

    async updateProject(updates) {
        if (!this.currentProject) return;

        try {
            this.currentProject = {
                ...this.currentProject,
                ...updates,
                updatedAt: Date.now()
            };
            await this.db.saveProject(this.currentProject);
        } catch (error) {
            this.ui.showToast('Error al actualizar proyecto', 'error');
            throw error;
        }
    }

    async deleteProject(id) {
        try {
            await this.db.deleteProjectImages(id);
            await this.db.deleteProject(id);
            this.ui.showToast('Proyecto eliminado', 'success');
        } catch (error) {
            this.ui.showToast('Error al eliminar proyecto', 'error');
            throw error;
        }
    }

    async exportProject() {
        if (!this.currentProject) return;

        try {
            const images = await this.db.getProjectImages(this.currentProject.id);
            
            const exportData = {
                project: this.currentProject,
                images: images.map(img => ({
                    ...img,
                    image: null // We'll handle blob separately
                })),
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            this.downloadFile(blob, `${this.currentProject.name}.yoloproject`);
            
            this.ui.showToast('Proyecto exportado', 'success');
        } catch (error) {
            this.ui.showToast('Error al exportar proyecto', 'error');
            throw error;
        }
    }

    async exportConfig() {
        if (!this.currentProject) return;

        try {
            const config = {
                name: this.currentProject.name,
                type: this.currentProject.type,
                classes: this.currentProject.classes,
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            this.downloadFile(blob, `${this.currentProject.name}.yoloconfig`);
            
            this.ui.showToast('Configuración exportada', 'success');
        } catch (error) {
            this.ui.showToast('Error al exportar configuración', 'error');
        }
    }

    async importConfig(file) {
        try {
            const text = await file.text();
            const config = JSON.parse(text);
            return config;
        } catch (error) {
            this.ui.showToast('Error al importar configuración', 'error');
            throw error;
        }
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ============================================
// TOOL MANAGER - Bbox and Mask tools
// ============================================
class ToolManager {
    constructor() {
        this.currentTool = 'bbox'; // 'bbox', 'mask', 'pan', 'select'
        this.brushSize = 20;
        this.maskCanvas = null;
        this.maskCtx = null;
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    getTool() {
        return this.currentTool;
    }

    setBrushSize(size) {
        this.brushSize = size;
    }

    initMaskCanvas(width, height) {
        if (!this.maskCanvas) {
            this.maskCanvas = document.createElement('canvas');
            this.maskCtx = this.maskCanvas.getContext('2d');
        }
        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.maskCtx.clearRect(0, 0, width, height);
    }

    drawMask(x, y, color, erase = false) {
        if (!this.maskCtx) return;
        
        this.maskCtx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        this.maskCtx.fillStyle = color;
        this.maskCtx.beginPath();
        this.maskCtx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2);
        this.maskCtx.fill();
    }

    getMaskData() {
        if (!this.maskCanvas) return null;
        return this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    }

    clearMask() {
        if (this.maskCtx) {
            this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        }
    }
}

// ============================================
// CANVAS MANAGER - Main annotation canvas
// ============================================
class CanvasManager {
    constructor(canvas, ui) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ui = ui;
        
        // State
        this.image = null;
        this.imageName = '';
        this.imageId = null;
        this.annotations = []; // {type: 'bbox'|'mask', class: id, data: {...}}
        this.selectedAnnotation = null;
        
        // Drawing state
        this.isDrawing = false;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        // Transform state
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.1;
        this.maxZoom = 5;
        
        // Resize handle state
        this.resizeHandle = null; // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
        this.originalBox = null;
        
        // Tool manager
        this.toolManager = new ToolManager();
        
        // Classes
        this.classes = [];
        this.currentClass = 0;
        
        // Settings
        this.showLabels = true;
        this.maskOpacity = 0.5;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    // Transform between canvas and image coordinates
    canvasToImage(x, y) {
        return {
            x: (x - this.panX) / this.zoom,
            y: (y - this.panY) / this.zoom
        };
    }

    imageToCanvas(x, y) {
        return {
            x: x * this.zoom + this.panX,
            y: y * this.zoom + this.panY
        };
    }

    handleMouseDown(e) {
        if (!this.image) return;
        
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        
        const tool = this.toolManager.getTool();
        
        if (tool === 'pan' || e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        if (tool === 'select') {
            this.handleSelect(pos.x, pos.y);
            return;
        }
        
        // Check if clicking on resize handle
        if (this.selectedAnnotation && this.selectedAnnotation.type === 'bbox') {
            const handle = this.getResizeHandle(pos.x, pos.y);
            if (handle) {
                this.resizeHandle = handle;
                this.originalBox = { ...this.selectedAnnotation.data };
                return;
            }
        }
        
        this.isDrawing = true;
        
        if (tool === 'mask') {
            this.toolManager.initMaskCanvas(this.canvas.width, this.canvas.height);
        }
    }

    handleMouseMove(e) {
        if (!this.image) return;
        
        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;
        
        if (this.isPanning) {
            const dx = pos.x - this.startX;
            const dy = pos.y - this.startY;
            this.panX += dx;
            this.panY += dy;
            this.startX = pos.x;
            this.startY = pos.y;
            this.redraw();
            return;
        }
        
        if (this.resizeHandle) {
            this.handleResize(pos.x, pos.y);
            return;
        }
        
        if (!this.isDrawing) {
            // Update cursor based on hover
            this.updateCursor(pos.x, pos.y);
            return;
        }
        
        const tool = this.toolManager.getTool();
        
        if (tool === 'mask') {
            const imgPos = this.canvasToImage(pos.x, pos.y);
            const color = this.classes[this.currentClass]?.color || '#ff0000';
            this.toolManager.drawMask(imgPos.x, imgPos.y, color, e.shiftKey);
        }
        
        this.redraw();
        
        // Preview drawing
        if (tool === 'bbox') {
            const imgStart = this.canvasToImage(this.startX, this.startY);
            const imgCurrent = this.canvasToImage(pos.x, pos.y);
            
            this.ctx.strokeStyle = this.classes[this.currentClass]?.color || '#ff0000';
            this.ctx.lineWidth = 2 / this.zoom;
            this.ctx.strokeRect(
                imgStart.x * this.zoom + this.panX,
                imgStart.y * this.zoom + this.panY,
                (imgCurrent.x - imgStart.x) * this.zoom,
                (imgCurrent.y - imgStart.y) * this.zoom
            );
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'grab';
            return;
        }
        
        if (this.resizeHandle) {
            this.resizeHandle = null;
            this.originalBox = null;
            return;
        }
        
        if (!this.isDrawing) return;
        
        const pos = this.getMousePos(e);
        const tool = this.toolManager.getTool();
        
        if (tool === 'bbox') {
            const imgStart = this.canvasToImage(this.startX, this.startY);
            const imgEnd = this.canvasToImage(pos.x, pos.y);
            
            const width = Math.abs(imgEnd.x - imgStart.x);
            const height = Math.abs(imgEnd.y - imgStart.y);
            
            if (width > 5 && height > 5) {
                this.annotations.push({
                    type: 'bbox',
                    class: this.classes[this.currentClass]?.id || 0,
                    data: {
                        x: Math.min(imgStart.x, imgEnd.x),
                        y: Math.min(imgStart.y, imgEnd.y),
                        width,
                        height
                    }
                });
            }
        } else if (tool === 'mask') {
            const maskData = this.toolManager.getMaskData();
            if (maskData) {
                this.annotations.push({
                    type: 'mask',
                    class: this.classes[this.currentClass]?.id || 0,
                    data: maskData
                });
                this.toolManager.clearMask();
            }
        }
        
        this.isDrawing = false;
        this.redraw();
    }

    handleWheel(e) {
        e.preventDefault();
        
        const pos = this.getMousePos(e);
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * delta));
        
        // Zoom towards mouse position
        const imgPos = this.canvasToImage(pos.x, pos.y);
        this.zoom = newZoom;
        const newCanvasPos = this.imageToCanvas(imgPos.x, imgPos.y);
        
        this.panX += pos.x - newCanvasPos.x;
        this.panY += pos.y - newCanvasPos.y;
        
        this.redraw();
    }

    handleSelect(x, y) {
        const imgPos = this.canvasToImage(x, y);
        
        // Find clicked annotation (reverse order to get top one)
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const ann = this.annotations[i];
            
            if (ann.type === 'bbox') {
                const { x: bx, y: by, width, height } = ann.data;
                if (imgPos.x >= bx && imgPos.x <= bx + width &&
                    imgPos.y >= by && imgPos.y <= by + height) {
                    this.selectedAnnotation = ann;
                    this.redraw();
                    return;
                }
            }
        }
        
        this.selectedAnnotation = null;
        this.redraw();
    }

    getResizeHandle(x, y) {
        if (!this.selectedAnnotation || this.selectedAnnotation.type !== 'bbox') return null;
        
        const imgPos = this.canvasToImage(x, y);
        const { x: bx, y: by, width, height } = this.selectedAnnotation.data;
        const handleSize = 8 / this.zoom;
        
        const handles = {
            nw: { x: bx, y: by },
            ne: { x: bx + width, y: by },
            sw: { x: bx, y: by + height },
            se: { x: bx + width, y: by + height },
            n: { x: bx + width / 2, y: by },
            s: { x: bx + width / 2, y: by + height },
            e: { x: bx + width, y: by + height / 2 },
            w: { x: bx, y: by + height / 2 }
        };
        
        for (const [name, pos] of Object.entries(handles)) {
            if (Math.abs(imgPos.x - pos.x) < handleSize &&
                Math.abs(imgPos.y - pos.y) < handleSize) {
                return name;
            }
        }
        
        return null;
    }

    handleResize(x, y) {
        if (!this.selectedAnnotation || !this.originalBox) return;
        
        const imgPos = this.canvasToImage(x, y);
        const box = this.selectedAnnotation.data;
        const orig = this.originalBox;
        
        switch (this.resizeHandle) {
            case 'se':
                box.width = Math.max(5, imgPos.x - box.x);
                box.height = Math.max(5, imgPos.y - box.y);
                break;
            case 'nw':
                const newX = Math.min(imgPos.x, orig.x + orig.width - 5);
                const newY = Math.min(imgPos.y, orig.y + orig.height - 5);
                box.width = orig.x + orig.width - newX;
                box.height = orig.y + orig.height - newY;
                box.x = newX;
                box.y = newY;
                break;
            case 'ne':
                box.width = Math.max(5, imgPos.x - box.x);
                const newY2 = Math.min(imgPos.y, orig.y + orig.height - 5);
                box.height = orig.y + orig.height - newY2;
                box.y = newY2;
                break;
            case 'sw':
                const newX2 = Math.min(imgPos.x, orig.x + orig.width - 5);
                box.width = orig.x + orig.width - newX2;
                box.x = newX2;
                box.height = Math.max(5, imgPos.y - box.y);
                break;
        }
        
        this.redraw();
    }

    updateCursor(x, y) {
        const tool = this.toolManager.getTool();
        
        if (tool === 'pan') {
            this.canvas.style.cursor = 'grab';
            return;
        }
        
        if (tool === 'mask') {
            this.canvas.style.cursor = 'crosshair';
            return;
        }
        
        if (this.selectedAnnotation && this.selectedAnnotation.type === 'bbox') {
            const handle = this.getResizeHandle(x, y);
            if (handle) {
                const cursors = {
                    nw: 'nw-resize', ne: 'ne-resize',
                    sw: 'sw-resize', se: 'se-resize',
                    n: 'n-resize', s: 's-resize',
                    e: 'e-resize', w: 'w-resize'
                };
                this.canvas.style.cursor = cursors[handle];
                return;
            }
        }
        
        this.canvas.style.cursor = 'crosshair';
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            this.imageName = file.name.replace(/\.[^/.]+$/, '');
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.image = img;
                    this.fitImageToCanvas();
                    this.annotations = [];
                    this.selectedAnnotation = null;
                    this.redraw();
                    resolve();
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    fitImageToCanvas() {
        if (!this.image) return;
        
        const canvasAspect = this.canvas.width / this.canvas.height;
        const imageAspect = this.image.width / this.image.height;
        
        if (imageAspect > canvasAspect) {
            this.zoom = this.canvas.width / this.image.width;
        } else {
            this.zoom = this.canvas.height / this.image.height;
        }
        
        this.panX = (this.canvas.width - this.image.width * this.zoom) / 2;
        this.panY = (this.canvas.height - this.image.height * this.zoom) / 2;
    }

    redraw() {
        if (!this.image) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw image
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.drawImage(this.image, 0, 0);
        
        // Draw annotations
        this.annotations.forEach(ann => {
            if (ann.type === 'bbox') {
                this.drawBbox(ann);
            } else if (ann.type === 'mask') {
                this.drawMask(ann);
            }
        });
        
        // Draw selected annotation handles
        if (this.selectedAnnotation && this.selectedAnnotation.type === 'bbox') {
            this.drawResizeHandles(this.selectedAnnotation);
        }
        
        this.ctx.restore();
    }

    drawBbox(annotation) {
        const cls = this.classes.find(c => c.id === annotation.class);
        const color = cls?.color || '#ff0000';
        const { x, y, width, height } = annotation.data;
        
        const isSelected = annotation === this.selectedAnnotation;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = (isSelected ? 3 : 2) / this.zoom;
        this.ctx.strokeRect(x, y, width, height);
        
        if (this.showLabels && cls) {
            this.ctx.fillStyle = color;
            this.ctx.font = `${14 / this.zoom}px Arial`;
            this.ctx.fillText(cls.name, x + 5 / this.zoom, y - 5 / this.zoom);
        }
    }

    drawMask(annotation) {
        // Simplified mask rendering
        const cls = this.classes.find(c => c.id === annotation.class);
        const color = cls?.color || '#ff0000';
        
        this.ctx.globalAlpha = this.maskOpacity;
        this.ctx.fillStyle = color;
        // In real implementation, would draw the mask data
        this.ctx.globalAlpha = 1;
    }

    drawResizeHandles(annotation) {
        const { x, y, width, height } = annotation.data;
        const handleSize = 6 / this.zoom;
        
        const handles = [
            { x, y }, // nw
            { x: x + width, y }, // ne
            { x, y: y + height }, // sw
            { x: x + width, y: y + height }, // se
            { x: x + width / 2, y }, // n
            { x: x + width / 2, y: y + height }, // s
            { x: x + width, y: y + height / 2 }, // e
            { x, y: y + height / 2 } // w
        ];
        
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1 / this.zoom;
        
        handles.forEach(h => {
            this.ctx.fillRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
            this.ctx.strokeRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
        });
    }

    deleteSelected() {
        if (!this.selectedAnnotation) return;
        
        const index = this.annotations.indexOf(this.selectedAnnotation);
        if (index > -1) {
            this.annotations.splice(index, 1);
            this.selectedAnnotation = null;
            this.redraw();
        }
    }

    clear() {
        this.image = null;
        this.imageName = '';
        this.imageId = null;
        this.annotations = [];
        this.selectedAnnotation = null;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Export annotations to YOLO format
    exportYOLO() {
        if (!this.image || this.annotations.length === 0) return '';
        
        let yoloContent = '';
        
        this.annotations.forEach(ann => {
            if (ann.type === 'bbox') {
                const { x, y, width, height } = ann.data;
                const x_center = (x + width / 2) / this.image.width;
                const y_center = (y + height / 2) / this.image.height;
                const w = width / this.image.width;
                const h = height / this.image.height;
                
                yoloContent += `${ann.class} ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}\n`;
            }
        });
        
        return yoloContent;
    }
}

// ============================================
// GALLERY MANAGER
// ============================================
class GalleryManager {
    constructor(container, db, canvasManager, ui) {
        this.container = container;
        this.db = db;
        this.canvasManager = canvasManager;
        this.ui = ui;
        this.images = [];
        this.currentFilter = 'all'; // 'all', 'annotated', 'unannotated'
    }

    async loadImages(projectId) {
        try {
            this.images = await this.db.getProjectImages(projectId);
            this.render();
        } catch (error) {
            this.ui.showToast('Error al cargar imágenes', 'error');
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    }

    getFilteredImages() {
        switch (this.currentFilter) {
            case 'annotated':
                return this.images.filter(img => img.annotations && img.annotations.length > 0);
            case 'unannotated':
                return this.images.filter(img => !img.annotations || img.annotations.length === 0);
            default:
                return this.images;
        }
    }

    render() {
        const filtered = this.getFilteredImages();
        
        if (filtered.length === 0) {
            this.container.innerHTML = '<div class="empty-gallery">No hay imágenes</div>';
            return;
        }
        
        this.container.innerHTML = '';
        
        filtered.forEach(imageData => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            if (!imageData.annotations || imageData.annotations.length === 0) {
                item.classList.add('no-annotations');
            }
            if (imageData.id === this.canvasManager.imageId) {
                item.classList.add('active');
            }
            
            const url = URL.createObjectURL(imageData.image);
            const annotationCount = imageData.annotations ? imageData.annotations.length : 0;
            
            item.innerHTML = `
                <img src="${url}" alt="${imageData.name}">
                <div class="gallery-item-overlay">
                    <span>${annotationCount} labels</span>
                </div>
                <button class="gallery-item-delete" data-id="${imageData.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            item.onclick = (e) => {
                if (e.target.closest('.gallery-item-delete')) {
                    this.deleteImage(imageData.id);
                } else {
                    this.loadImage(imageData.id);
                }
            };
            
            this.container.appendChild(item);
        });
    }

    async loadImage(imageId) {
        try {
            const imageData = await this.db.getImage(imageId);
            if (!imageData) return;
            
            // Load image to canvas
            const blob = imageData.image;
            const file = new File([blob], imageData.name, { type: blob.type });
            await this.canvasManager.loadImage(file);
            
            this.canvasManager.imageId = imageId;
            this.canvasManager.imageName = imageData.name;
            this.canvasManager.annotations = imageData.annotations || [];
            this.canvasManager.redraw();
            
            this.render();
        } catch (error) {
            this.ui.showToast('Error al cargar imagen', 'error');
        }
    }

    async deleteImage(imageId) {
        if (!confirm('¿Eliminar esta imagen?')) return;
        
        try {
            await this.db.deleteImage(imageId);
            this.images = this.images.filter(img => img.id !== imageId);
            this.render();
            
            if (this.canvasManager.imageId === imageId) {
                this.canvasManager.clear();
            }
        } catch (error) {
            this.ui.showToast('Error al eliminar imagen', 'error');
        }
    }

    getCurrentImageIndex() {
        return this.images.findIndex(img => img.id === this.canvasManager.imageId);
    }

    async navigateNext() {
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex < this.images.length - 1) {
            await this.loadImage(this.images[currentIndex + 1].id);
        }
    }

    async navigatePrevious() {
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex > 0) {
            await this.loadImage(this.images[currentIndex - 1].id);
        }
    }

    canNavigateNext() {
        const currentIndex = this.getCurrentImageIndex();
        return currentIndex < this.images.length - 1;
    }

    canNavigatePrevious() {
        const currentIndex = this.getCurrentImageIndex();
        return currentIndex > 0;
    }
}

// ============================================
// MAIN APPLICATION
// ============================================
class YOLOAnnotator {
    constructor() {
        this.db = new DatabaseManager();
        this.ui = new UIManager();
        this.projectManager = null;
        this.canvasManager = null;
        this.galleryManager = null;
        
        this.autoSaveInterval = null;
        this.autoSaveEnabled = false;
    }

    async init() {
        try {
            // Initialize database
            await this.db.init();
            
            // Initialize managers
            this.projectManager = new ProjectManager(this.db, this.ui);
            
            const canvas = document.getElementById('canvas');
            this.canvasManager = new CanvasManager(canvas, this.ui);
            
            const galleryContainer = document.getElementById('galleryGrid');
            this.galleryManager = new GalleryManager(galleryContainer, this.db, this.canvasManager, this.ui);
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Load projects
            await this.loadProjects();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            this.ui.showToast('Aplicación iniciada', 'success');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.ui.showToast('Error al iniciar la aplicación', 'error');
        }
    }

    setupEventListeners() {
        // Project management
        document.getElementById('btnNewProject')?.addEventListener('click', () => this.showNewProjectModal());
        document.getElementById('btnExportProject')?.addEventListener('click', () => this.exportProject());
        document.getElementById('btnExportConfig')?.addEventListener('click', () => this.exportConfig());
        document.getElementById('btnImportConfig')?.addEventListener('click', () => this.importConfig());
        document.getElementById('btnHelp')?.addEventListener('click', () => this.startTour());
        
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                this.setTool(tool);
            });
        });
        
        // Image loading
        document.getElementById('imageInput')?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadImages(e.target.files);
            }
        });
        
        // Save current image
        document.getElementById('btnSave')?.addEventListener('click', () => this.saveCurrentImage());
        
        // Download dataset
        document.getElementById('btnDownloadZip')?.addEventListener('click', () => this.downloadDataset());
        
        // Class management
        document.getElementById('btnAddClass')?.addEventListener('click', () => this.addClass());
        
        // Canvas controls
        document.getElementById('btnZoomIn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('btnZoomOut')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('btnZoomReset')?.addEventListener('click', () => this.resetZoom());
        document.getElementById('btnToggleLabels')?.addEventListener('click', () => this.toggleLabels());
        
        // Navigation
        document.getElementById('btnPrevImage')?.addEventListener('click', () => this.navigatePrevious());
        document.getElementById('btnNextImage')?.addEventListener('click', () => this.navigateNext());
        
        // Gallery filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.galleryManager.setFilter(btn.dataset.filter);
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            // Numbers 1-9: select class
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (index < this.canvasManager.classes.length) {
                    this.canvasManager.currentClass = index;
                    this.updateClassUI();
                }
            }
            
            // S: Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentImage();
            }
            
            // Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            
            // Delete: Delete selected
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.canvasManager.deleteSelected();
            }
            
            // Escape: Deselect
            if (e.key === 'Escape') {
                this.canvasManager.selectedAnnotation = null;
                this.canvasManager.redraw();
            }
            
            // Arrow keys: Navigate images
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.navigatePrevious();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.navigateNext();
            }
            
            // Tools
            if (e.key === 'b') this.setTool('bbox');
            if (e.key === 'm') this.setTool('mask');
            if (e.key === 'v') this.setTool('select');
            if (e.key === 'h') this.setTool('pan');
        });
    }

    async loadProjects() {
        const projects = await this.db.getAllProjects();
        const selector = document.getElementById('projectSelector');
        
        if (selector) {
            selector.innerHTML = '<option value="">Seleccionar proyecto...</option>';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                selector.appendChild(option);
            });
            
            selector.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadProject(parseInt(e.target.value));
                }
            });
        }
    }

    async loadProject(projectId) {
        try {
            const project = await this.projectManager.loadProject(projectId);
            this.canvasManager.classes = project.classes || [];
            this.updateClassUI();
            await this.galleryManager.loadImages(projectId);
            this.updateStats();
        } catch (error) {
            console.error('Error loading project:', error);
        }
    }

    showNewProjectModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Nombre del Proyecto</label>
                <input type="text" id="projectName" class="form-control" placeholder="Mi Proyecto YOLO">
            </div>
            <div class="form-group">
                <label class="form-label">Tipo de Anotación</label>
                <select id="projectType" class="form-control form-select">
                    <option value="bbox">Bounding Box</option>
                    <option value="mask">Segmentación (Mask)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Clases Iniciales (opcional)</label>
                <input type="text" id="projectClasses" class="form-control" placeholder="clase1, clase2, clase3">
                <small class="text-muted">Separadas por comas. Puedes agregar más después.</small>
            </div>
        `;
        
        this.ui.showModal('Nuevo Proyecto', content, [
            {
                text: 'Cancelar',
                type: 'secondary',
                action: 'cancel',
                handler: (modal, close) => close()
            },
            {
                text: 'Crear',
                type: 'primary',
                icon: 'fas fa-plus',
                action: 'create',
                handler: async (modal, close) => {
                    const name = modal.querySelector('#projectName').value.trim();
                    const type = modal.querySelector('#projectType').value;
                    const classesText = modal.querySelector('#projectClasses').value.trim();
                    
                    if (!name) {
                        this.ui.showToast('Ingresa un nombre para el proyecto', 'warning');
                        return;
                    }
                    
                    const classes = classesText ? 
                        classesText.split(',').map((c, i) => ({
                            id: i,
                            name: c.trim(),
                            color: this.randomColor()
                        })) : [];
                    
                    await this.projectManager.createProject(name, type, classes);
                    await this.loadProjects();
                    close();
                }
            }
        ]);
    }

    randomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }

    setTool(tool) {
        this.canvasManager.toolManager.setTool(tool);
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    async loadImages(files) {
        if (!this.projectManager.currentProject) {
            this.ui.showToast('Selecciona un proyecto primero', 'warning');
            return;
        }
        
        for (const file of files) {
            try {
                await this.canvasManager.loadImage(file);
                break; // Load first image for now
            } catch (error) {
                this.ui.showToast(`Error al cargar ${file.name}`, 'error');
            }
        }
    }

    async saveCurrentImage() {
        if (!this.canvasManager.image || !this.projectManager.currentProject) {
            return;
        }
        
        try {
            this.canvasManager.canvas.toBlob(async (blob) => {
                const imageData = {
                    id: this.canvasManager.imageId,
                    projectId: this.projectManager.currentProject.id,
                    name: this.canvasManager.imageName,
                    image: blob,
                    annotations: this.canvasManager.annotations,
                    width: this.canvasManager.image.width,
                    height: this.canvasManager.image.height,
                    timestamp: Date.now()
                };
                
                const id = await this.db.saveImage(imageData);
                this.canvasManager.imageId = id;
                
                await this.galleryManager.loadImages(this.projectManager.currentProject.id);
                this.updateStats();
                
                this.ui.showToast('Imagen guardada', 'success');
            });
        } catch (error) {
            this.ui.showToast('Error al guardar imagen', 'error');
        }
    }

    async downloadDataset() {
        if (!this.projectManager.currentProject) return;
        
        try {
            const images = await this.db.getProjectImages(this.projectManager.currentProject.id);
            
            if (images.length === 0) {
                this.ui.showToast('No hay imágenes en el proyecto', 'warning');
                return;
            }
            
            const zip = new JSZip();
            const imagesFolder = zip.folder('images');
            const labelsFolder = zip.folder('labels');
            
            for (const imageData of images) {
                // Add image
                const ext = imageData.image.type.split('/')[1];
                imagesFolder.file(`${imageData.name}.${ext}`, imageData.image);
                
                // Create YOLO annotation
                let yoloContent = '';
                if (imageData.annotations && imageData.annotations.length > 0) {
                    imageData.annotations.forEach(ann => {
                        if (ann.type === 'bbox') {
                            const { x, y, width, height } = ann.data;
                            const x_center = (x + width / 2) / imageData.width;
                            const y_center = (y + height / 2) / imageData.height;
                            const w = width / imageData.width;
                            const h = height / imageData.height;
                            
                            yoloContent += `${ann.class} ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}\n`;
                        }
                    });
                }
                
                labelsFolder.file(`${imageData.name}.txt`, yoloContent);
            }
            
            // Add classes.txt
            const sortedClasses = [...this.projectManager.currentProject.classes].sort((a, b) => a.id - b.id);
            const classesContent = sortedClasses.map(cls => cls.name).join('\n');
            zip.file('classes.txt', classesContent);
            
            // Generate and download
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.projectManager.currentProject.name}_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.ui.showToast('Dataset descargado', 'success');
        } catch (error) {
            console.error('Error downloading dataset:', error);
            this.ui.showToast('Error al descargar dataset', 'error');
        }
    }

    addClass() {
        const nameInput = document.getElementById('newClassName');
        const colorInput = document.getElementById('newClassColor');
        
        if (!nameInput || !colorInput) return;
        
        const name = nameInput.value.trim();
        const color = colorInput.value;
        
        if (!name) {
            this.ui.showToast('Ingresa un nombre para la clase', 'warning');
            return;
        }
        
        if (this.canvasManager.classes.some(c => c.name === name)) {
            this.ui.showToast('Ya existe una clase con ese nombre', 'warning');
            return;
        }
        
        const newId = this.canvasManager.classes.length > 0 ? 
            Math.max(...this.canvasManager.classes.map(c => c.id)) + 1 : 0;
        
        this.canvasManager.classes.push({ id: newId, name, color });
        
        nameInput.value = '';
        colorInput.value = this.randomColor();
        
        this.updateClassUI();
        
        if (this.projectManager.currentProject) {
            this.projectManager.updateProject({ classes: this.canvasManager.classes });
        }
    }

    updateClassUI() {
        const container = document.getElementById('classList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.canvasManager.classes.forEach((cls, index) => {
            const item = document.createElement('div');
            item.className = 'class-item';
            if (index === this.canvasManager.currentClass) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div class="class-color" style="background: ${cls.color}"></div>
                <span class="class-name">${cls.name}</span>
                <button class="class-delete" data-id="${cls.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            item.onclick = (e) => {
                if (e.target.closest('.class-delete')) {
                    this.deleteClass(cls.id);
                } else {
                    this.canvasManager.currentClass = index;
                    this.updateClassUI();
                }
            };
            
            container.appendChild(item);
        });
    }

    deleteClass(classId) {
        const hasAnnotations = this.canvasManager.annotations.some(a => a.class === classId);
        
        if (hasAnnotations) {
            if (!confirm('Hay anotaciones con esta clase. ¿Eliminarla igual?')) {
                return;
            }
            this.canvasManager.annotations = this.canvasManager.annotations.filter(a => a.class !== classId);
        }
        
        this.canvasManager.classes = this.canvasManager.classes.filter(c => c.id !== classId);
        this.updateClassUI();
        this.canvasManager.redraw();
        
        if (this.projectManager.currentProject) {
            this.projectManager.updateProject({ classes: this.canvasManager.classes });
        }
    }

    zoomIn() {
        this.canvasManager.zoom = Math.min(this.canvasManager.maxZoom, this.canvasManager.zoom * 1.2);
        this.canvasManager.redraw();
        this.updateZoomDisplay();
    }

    zoomOut() {
        this.canvasManager.zoom = Math.max(this.canvasManager.minZoom, this.canvasManager.zoom / 1.2);
        this.canvasManager.redraw();
        this.updateZoomDisplay();
    }

    resetZoom() {
        this.canvasManager.fitImageToCanvas();
        this.canvasManager.redraw();
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const display = document.getElementById('zoomLevel');
        if (display) {
            display.textContent = `${Math.round(this.canvasManager.zoom * 100)}%`;
        }
    }

    toggleLabels() {
        this.canvasManager.showLabels = !this.canvasManager.showLabels;
        this.canvasManager.redraw();
    }

    undo() {
        if (this.canvasManager.annotations.length > 0) {
            this.canvasManager.annotations.pop();
            this.canvasManager.redraw();
        }
    }

    async navigateNext() {
        await this.galleryManager.navigateNext();
        this.updateNavigationButtons();
    }

    async navigatePrevious() {
        await this.galleryManager.navigatePrevious();
        this.updateNavigationButtons();
    }

    updateNavigationButtons() {
        const btnPrev = document.getElementById('btnPrevImage');
        const btnNext = document.getElementById('btnNextImage');
        
        if (btnPrev) btnPrev.disabled = !this.galleryManager.canNavigatePrevious();
        if (btnNext) btnNext.disabled = !this.galleryManager.canNavigateNext();
    }

    updateStats() {
        // Update project stats
        const images = this.galleryManager.images;
        const totalLabels = images.reduce((sum, img) => 
            sum + (img.annotations ? img.annotations.length : 0), 0);
        const annotated = images.filter(img => img.annotations && img.annotations.length > 0).length;
        
        document.getElementById('statTotalImages').textContent = images.length;
        document.getElementById('statAnnotated').textContent = annotated;
        document.getElementById('statLabels').textContent = totalLabels;
        
        const progress = images.length > 0 ? (annotated / images.length) * 100 : 0;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `${annotated}/${images.length} imágenes anotadas`;
    }

    async exportProject() {
        await this.projectManager.exportProject();
    }

    async exportConfig() {
        await this.projectManager.exportConfig();
    }

    async importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.yoloconfig';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const config = await this.projectManager.importConfig(file);
                    
                    // Create project with imported config
                    await this.projectManager.createProject(
                        config.name,
                        config.type,
                        config.classes
                    );
                    
                    await this.loadProjects();
                } catch (error) {
                    console.error('Error importing config:', error);
                }
            }
        };
        
        input.click();
    }

    startTour() {
        // Tour will be implemented with intro.js in HTML
        this.ui.showToast('Tour interactivo próximamente', 'info');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new YOLOAnnotator();
    window.app.init();
});
