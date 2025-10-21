/**
 * CANVAS MANAGER - FIXED VERSION
 * Main annotation canvas - handles drawing, editing, zoom, pan
 *
 * FIXES:
 * - Proper canvas resolution handling (devicePixelRatio)
 * - Sharp image rendering without pixelation
 * - Dynamic resize handling
 * - High-quality image smoothing
 * - Working mask system with rendering
 * - Project type validation (bbox vs mask)
 */

class CanvasManager {
    constructor(canvas, ui) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ui = ui;

        // State
        this.image = null;
        this.imageName = '';
        this.imageId = null;
        this.annotations = [];
        this.selectedAnnotation = null;

        // Project type ('bbox' or 'mask')
        this.projectType = 'bbox';

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
        this.resizeHandle = null;
        this.originalBox = null;

        // Tool manager
        this.toolManager = new ToolManager();

        // Classes
        this.classes = [];
        this.currentClass = 0;

        // Settings
        this.showLabels = true;
        this.maskOpacity = 0.5;

        // Device pixel ratio for sharp rendering
        this.dpr = window.devicePixelRatio || 1;

        this.setupEventListeners();
        this.setupCanvas();
        this.handleResize();
    }

    // Set project type and validate tools
    setProjectType(type) {
        this.projectType = type;
        console.log('Project type set to:', type);

        // Auto-select appropriate tool based on project type
        if (type === 'bbox' && this.toolManager.getTool() === 'mask') {
            this.toolManager.setTool('bbox');
        } else if (type === 'mask' && this.toolManager.getTool() === 'bbox') {
            this.toolManager.setTool('mask');
        }

        // Update UI to reflect available tools
        this.updateToolAvailability();
    }

    // Check if current tool is valid for project type
    isToolValid(tool) {
        if (tool === 'select' || tool === 'pan') return true;
        if (this.projectType === 'bbox' && tool === 'bbox') return true;
        if (this.projectType === 'mask' && tool === 'mask') return true;
        return false;
    }

    // Update UI to show/hide tools based on project type
    updateToolAvailability() {
        const bboxBtn = document.querySelector('[data-tool="bbox"]');
        const maskBtn = document.querySelector('[data-tool="mask"]');

        if (bboxBtn && maskBtn) {
            if (this.projectType === 'bbox') {
                bboxBtn.style.display = 'flex';
                maskBtn.style.display = 'none';
                // Show/hide mask controls
                const maskControls = document.getElementById('maskControls');
                if (maskControls) maskControls.style.display = 'none';
            } else if (this.projectType === 'mask') {
                bboxBtn.style.display = 'none';
                maskBtn.style.display = 'flex';
                // Show mask controls
                const maskControls = document.getElementById('maskControls');
                if (maskControls) maskControls.style.display = 'block';
            }
        }
    }

    setupCanvas() {
        // Set up canvas with proper resolution to avoid pixelation
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
        // Handle window resize
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

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left),
            y: (e.clientY - rect.top)
        };
    }

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

        // Validate tool for project type
        if (!this.isToolValid(tool) && tool !== 'pan' && tool !== 'select') {
            this.ui.showToast(`Tool "${tool}" not available for ${this.projectType} projects`, 'warning');
            return;
        }

        // Pan tool
        if (tool === 'pan' || e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Select tool
        if (tool === 'select') {
            this.handleSelect(pos.x, pos.y);
            return;
        }

        // Check resize handles (only for bbox)
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
            // Initialize mask canvas with image dimensions
            this.toolManager.initMaskCanvas(this.image.width, this.image.height);

            // Start drawing mask
            const imgPos = this.canvasToImage(pos.x, pos.y);
            const color = this.classes[this.currentClass]?.color || '#ff0000';
            this.toolManager.drawMask(imgPos.x, imgPos.y, color);
            this.redraw();
        }
    }

    handleMouseMove(e) {
        if (!this.image) return;

        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;

        // Panning
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

        // Resizing
        if (this.resizeHandle) {
            this.handleResizeDrag(pos.x, pos.y);
            return;
        }

        if (!this.isDrawing) {
            this.updateCursor(pos.x, pos.y);
            return;
        }

        const tool = this.toolManager.getTool();

        // Mask drawing
        if (tool === 'mask') {
            const imgPos = this.canvasToImage(pos.x, pos.y);
            const color = this.classes[this.currentClass]?.color || '#ff0000';
            this.toolManager.drawMask(imgPos.x, imgPos.y, color);
            this.redraw();
        }

        // Preview bbox
        if (tool === 'bbox') {
            this.redraw();

            const imgStart = this.canvasToImage(this.startX, this.startY);
            const imgCurrent = this.canvasToImage(pos.x, pos.y);

            this.ctx.strokeStyle = this.classes[this.currentClass]?.color || '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(
                imgStart.x * this.zoom + this.panX,
                imgStart.y * this.zoom + this.panY,
                (imgCurrent.x - imgStart.x) * this.zoom,
                                (imgCurrent.y - imgStart.y) * this.zoom
            );
            this.ctx.setLineDash([]);
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
                    data: maskData // Store as data URL
                });
                this.toolManager.clearMask();
            }
        }

        this.isDrawing = false;
        this.toolManager.resetLastPosition();
        this.redraw();
    }

    handleMouseLeave(e) {
        // Reset drawing state when mouse leaves canvas
        if (this.isDrawing && this.toolManager.getTool() === 'mask') {
            this.toolManager.resetLastPosition();
        }
    }

    handleWheel(e) {
        e.preventDefault();

        const pos = this.getMousePos(e);
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * delta));

        const imgPos = this.canvasToImage(pos.x, pos.y);
        this.zoom = newZoom;
        const newCanvasPos = this.imageToCanvas(imgPos.x, imgPos.y);

        this.panX += pos.x - newCanvasPos.x;
        this.panY += pos.y - newCanvasPos.y;

        this.redraw();
    }

    handleSelect(x, y) {
        const imgPos = this.canvasToImage(x, y);

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

    handleResizeDrag(x, y) {
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

        const rect = this.canvas.getBoundingClientRect();
        const canvasWidth = rect.width;
        const canvasHeight = rect.height;

        const canvasAspect = canvasWidth / canvasHeight;
        const imageAspect = this.image.width / this.image.height;

        if (imageAspect > canvasAspect) {
            this.zoom = (canvasWidth * 0.9) / this.image.width;
        } else {
            this.zoom = (canvasHeight * 0.9) / this.image.height;
        }

        this.panX = (canvasWidth - this.image.width * this.zoom) / 2;
        this.panY = (canvasHeight - this.image.height * this.zoom) / 2;
    }

    redraw() {
        if (!this.image) return;

        const rect = this.canvas.getBoundingClientRect();

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

        // Draw image with high quality
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.drawImage(this.image, 0, 0);

        // Draw annotations
        this.annotations.forEach(ann => {
            if (ann.type === 'bbox') {
                this.drawBbox(ann);
            } else if (ann.type === 'mask') {
                this.drawMaskAnnotation(ann);
            }
        });

        // Draw current mask being drawn
        if (this.isDrawing && this.toolManager.getTool() === 'mask') {
            const previewCanvas = this.toolManager.getPreviewCanvas();
            if (previewCanvas) {
                this.ctx.globalAlpha = this.maskOpacity;
                this.ctx.drawImage(previewCanvas, 0, 0);
                this.ctx.globalAlpha = 1;
            }
        }

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
            const textWidth = this.ctx.measureText(cls.name).width;
            this.ctx.fillRect(x, y - 20 / this.zoom, textWidth + 10 / this.zoom, 20 / this.zoom);
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(cls.name, x + 5 / this.zoom, y - 5 / this.zoom);
        }
    }

    drawMaskAnnotation(annotation) {
        const cls = this.classes.find(c => c.id === annotation.class);
        const color = cls?.color || '#ff0000';

        // Load mask image from data URL
        if (typeof annotation.data === 'string') {
            const img = new Image();
            img.onload = () => {
                this.ctx.globalAlpha = this.maskOpacity;
                this.ctx.drawImage(img, 0, 0);
                this.ctx.globalAlpha = 1;
            };
            // Only set src if not already loaded
            if (!img.src) {
                img.src = annotation.data;
            }
        }
    }

    drawResizeHandles(annotation) {
        const { x, y, width, height } = annotation.data;
        const handleSize = 6 / this.zoom;

        const handles = [
            { x, y },
            { x: x + width, y },
            { x, y: y + height },
            { x: x + width, y: y + height },
            { x: x + width / 2, y },
            { x: x + width / 2, y: y + height },
            { x: x + width, y: y + height / 2 },
            { x, y: y + height / 2 }
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

        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }

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
            // Note: YOLO segmentation format would need polygon points, not pixel masks
        });

        return yoloContent;
    }
}
