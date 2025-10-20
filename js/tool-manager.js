/**
 * TOOL MANAGER
 * Manages annotation tools (bbox, mask, select, pan)
 */

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

    // ============================================
    // MASK TOOL METHODS
    // ============================================

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