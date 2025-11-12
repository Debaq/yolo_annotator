/**
 * CANVAS BASE - Abstract Base Class
 * Shared functionality for all canvas types
 *
 * Provides:
 * - Image loading and rendering
 * - Zoom and pan controls
 * - Grid and labels toggle
 * - General shortcuts (zoom, pan, grid, labels)
 * - Coordinate transformations
 * - Event handling framework
 */

class CanvasBase {
    constructor(canvas, ui, projectType) {
        if (this.constructor === CanvasBase) {
            throw new Error("CanvasBase is abstract and cannot be instantiated directly");
        }

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ui = ui;
        this.projectType = projectType;

        // State
        this.image = null;
        this.imageName = '';
        this.imageId = null;
        this.annotations = [];
        this.selectedAnnotation = null;
        this.originalImageBlob = null;

        // Transform state
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.1;
        this.maxZoom = 5;
        this.imageRotation = 0;

        // Pan state
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        // Classes
        this.classes = [];
        this.currentClass = 0;

        // Settings (shared across all canvas types)
        this.showLabels = true;
        this.showGrid = false;

        // Unsaved changes tracking
        this.hasUnsavedChanges = false;
        this.lastSavedAnnotationsCount = 0;

        // Device pixel ratio for sharp rendering
        this.dpr = window.devicePixelRatio || 1;

        // Shortcuts map - general shortcuts (can be extended by child classes)
        this.shortcuts = this.getGeneralShortcuts();

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupShortcuts();
        this.handleResize();
    }

    // ============================================
    // ABSTRACT METHODS - Must be implemented by child classes
    // ============================================

    drawAnnotation(annotation) {
        throw new Error("drawAnnotation() must be implemented by child class");
    }

    handleDrawStart(x, y) {
        throw new Error("handleDrawStart() must be implemented by child class");
    }

    handleDrawMove(x, y) {
        throw new Error("handleDrawMove() must be implemented by child class");
    }

    handleDrawEnd(x, y) {
        throw new Error("handleDrawEnd() must be implemented by child class");
    }

    // Get specific shortcuts for this canvas type (to be overridden)
    getSpecificShortcuts() {
        return {};
    }

    // Get available tools for this canvas type (to be overridden)
    getAvailableTools() {
        return ['select', 'pan'];
    }

    // ============================================
    // CANVAS SETUP
    // ============================================

    setupCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set display size (css pixels)
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        // Set actual size in memory (scaled by device pixel ratio)
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;

        // Scale context to match device pixel ratio
        this.ctx.scale(this.dpr, this.dpr);

        // Enable image smoothing for better quality
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    handleResize() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.image) {
                    const wasZoomed = this.zoom !== 1;
                    this.setupCanvas();
                    if (!wasZoomed) {
                        this.fitImageToCanvas();
                    }
                    this.redraw();
                }
            }, 100);
        });
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleMouseDown(e) {
        if (!this.image) return;

        const pos = this.getMousePos(e);

        // Pan with middle mouse or Ctrl+Left
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            this.isPanning = true;
            this.panStartX = pos.x;
            this.panStartY = pos.y;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Delegate to child class
        const imgPos = this.canvasToImage(pos.x, pos.y);
        this.handleDrawStart(imgPos.x, imgPos.y);
    }

    handleMouseMove(e) {
        if (!this.image) return;

        const pos = this.getMousePos(e);

        // Handle panning
        if (this.isPanning) {
            const dx = pos.x - this.panStartX;
            const dy = pos.y - this.panStartY;
            this.panX += dx;
            this.panY += dy;
            this.panStartX = pos.x;
            this.panStartY = pos.y;
            this.redraw();
            return;
        }

        // Delegate to child class
        const imgPos = this.canvasToImage(pos.x, pos.y);
        this.handleDrawMove(imgPos.x, imgPos.y);
    }

    handleMouseUp(e) {
        if (!this.image) return;

        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        const pos = this.getMousePos(e);
        const imgPos = this.canvasToImage(pos.x, pos.y);
        this.handleDrawEnd(imgPos.x, imgPos.y);
    }

    handleMouseLeave(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }

    handleWheel(e) {
        e.preventDefault();
        if (!this.image) return;

        const pos = this.getMousePos(e);
        const delta = e.deltaY > 0 ? 0.9 : 1.1;

        // Zoom towards mouse position
        const imgPosBeforeZoom = this.canvasToImage(pos.x, pos.y);
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * delta));
        const imgPosAfterZoom = this.canvasToImage(pos.x, pos.y);

        // Adjust pan to keep mouse position stable
        this.panX += (imgPosAfterZoom.x - imgPosBeforeZoom.x) * this.zoom;
        this.panY += (imgPosAfterZoom.y - imgPosBeforeZoom.y) * this.zoom;

        this.redraw();
        this.updateZoomDisplay();
    }

    // ============================================
    // SHORTCUTS - General (Zoom, Pan, Grid, Labels)
    // ============================================

    getGeneralShortcuts() {
        return {
            // Zoom controls
            '+': { handler: () => this.zoomIn(), description: 'Zoom In' },
            '=': { handler: () => this.zoomIn(), description: 'Zoom In' },
            '-': { handler: () => this.zoomOut(), description: 'Zoom Out' },
            '0': { handler: () => this.resetZoom(), description: 'Reset Zoom' },

            // View controls
            'g': { handler: () => this.toggleGrid(), description: 'Toggle Grid' },
            'l': { handler: () => this.toggleLabels(), description: 'Toggle Labels' },

            // Navigation (if integrated with gallery)
            'ArrowLeft': { handler: () => this.emit('previousImage'), description: 'Previous Image' },
            'ArrowRight': { handler: () => this.emit('nextImage'), description: 'Next Image' },

            // Pan shortcuts (optional, middle mouse is primary)
            'h': { handler: () => this.emit('activatePanTool'), description: 'Activate Pan Tool' }
        };
    }

    setupShortcuts() {
        // Merge general shortcuts with specific shortcuts from child class
        const specificShortcuts = this.getSpecificShortcuts();
        this.shortcuts = { ...this.shortcuts, ...specificShortcuts };

        // Setup keyboard listener
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in input/textarea
            if (e.target.matches('input, textarea')) return;

            const key = e.key;
            const shortcut = this.shortcuts[key];

            if (shortcut) {
                e.preventDefault();
                shortcut.handler();
            }
        });
    }

    // Get all shortcuts for display (general + specific)
    getAllShortcuts() {
        return this.shortcuts;
    }

    // ============================================
    // COORDINATE TRANSFORMATIONS
    // ============================================

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    canvasToImage(x, y) {
        // Remove zoom and pan
        let imgX = (x - this.panX) / this.zoom;
        let imgY = (y - this.panY) / this.zoom;

        // Apply inverse rotation if needed
        if (this.imageRotation !== 0 && this.image) {
            const centerX = this.image.width / 2;
            const centerY = this.image.height / 2;
            const angleRad = -(this.imageRotation * Math.PI) / 180;

            const dx = imgX - centerX;
            const dy = imgY - centerY;

            imgX = centerX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
            imgY = centerY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        }

        return { x: imgX, y: imgY };
    }

    imageToCanvas(x, y) {
        return {
            x: x * this.zoom + this.panX,
            y: y * this.zoom + this.panY
        };
    }

    // ============================================
    // IMAGE LOADING
    // ============================================

    async loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.image = img;
                    this.imageName = file.name;
                    this.originalImageBlob = file;
                    this.fitImageToCanvas();
                    this.redraw();
                    resolve(img);
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

        const rect = this.canvas.getBoundingClientRect();
        const canvasWidth = rect.width;
        const canvasHeight = rect.height;

        const scaleX = canvasWidth / this.image.width;
        const scaleY = canvasHeight / this.image.height;
        this.zoom = Math.min(scaleX, scaleY) * 0.9;

        this.panX = (canvasWidth - this.image.width * this.zoom) / 2;
        this.panY = (canvasHeight - this.image.height * this.zoom) / 2;

        this.updateZoomDisplay();
    }

    // ============================================
    // ZOOM CONTROLS
    // ============================================

    zoomIn() {
        if (!this.image) return;
        this.zoom = Math.min(this.maxZoom, this.zoom * 1.2);
        this.redraw();
        this.updateZoomDisplay();
    }

    zoomOut() {
        if (!this.image) return;
        this.zoom = Math.max(this.minZoom, this.zoom / 1.2);
        this.redraw();
        this.updateZoomDisplay();
    }

    resetZoom() {
        if (!this.image) return;
        this.fitImageToCanvas();
        this.redraw();
    }

    updateZoomDisplay() {
        const zoomPercent = Math.round(this.zoom * 100);
        const zoomElement = document.getElementById('zoomLevel');
        if (zoomElement) {
            zoomElement.textContent = `${zoomPercent}%`;
        }
    }

    // ============================================
    // VIEW CONTROLS
    // ============================================

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.redraw();
        const icon = document.querySelector('#btnToggleGrid i');
        if (icon) {
            icon.classList.toggle('fa-th');
            icon.classList.toggle('fa-th-large');
        }
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.redraw();
        const icon = document.querySelector('#btnToggleLabels i');
        if (icon) {
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        }
    }

    // ============================================
    // DRAWING
    // ============================================

    redraw() {
        if (!this.image) return;

        // Clear with proper scaling
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        // Reset transform and apply DPR scaling
        this.ctx.save();
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // Apply zoom and pan
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);

        // Apply image rotation around center
        if (this.imageRotation !== 0) {
            const centerX = this.image.width / 2;
            const centerY = this.image.height / 2;
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate((this.imageRotation * Math.PI) / 180);
            this.ctx.translate(-centerX, -centerY);
        }

        // Draw image with high quality
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.drawImage(this.image, 0, 0);

        // Draw grid if enabled
        if (this.showGrid) {
            this.drawGrid();
        }

        // Draw all annotations (delegate to child class)
        this.annotations.forEach(ann => {
            this.drawAnnotation(ann);
        });

        this.ctx.restore();
    }

    drawGrid() {
        if (!this.image) return;

        const gridSize = 50;
        const width = this.image.width;
        const height = this.image.height;

        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 1 / this.zoom;

        // Vertical lines
        for (let x = gridSize; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = gridSize; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    // ============================================
    // ANNOTATIONS MANAGEMENT
    // ============================================

    addAnnotation(annotation) {
        this.annotations.push(annotation);
        this.hasUnsavedChanges = true;
        this.redraw();
    }

    removeAnnotation(annotation) {
        const index = this.annotations.indexOf(annotation);
        if (index !== -1) {
            this.annotations.splice(index, 1);
            if (this.selectedAnnotation === annotation) {
                this.selectedAnnotation = null;
            }
            this.hasUnsavedChanges = true;
            this.redraw();
        }
    }

    clearAnnotations() {
        this.annotations = [];
        this.selectedAnnotation = null;
        this.hasUnsavedChanges = true;
        this.redraw();
    }

    deleteSelected() {
        if (this.selectedAnnotation) {
            this.removeAnnotation(this.selectedAnnotation);
            this.ui.showToast('Annotation deleted', 'success');
        }
    }

    // ============================================
    // EVENT EMITTER (for communication with app.js)
    // ============================================

    emit(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        this.canvas.dispatchEvent(event);
    }

    on(eventName, handler) {
        this.canvas.addEventListener(eventName, handler);
    }

    // ============================================
    // CLEANUP
    // ============================================

    destroy() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('wheel', this.handleWheel);
    }
}
