/**
 * CANVAS KEYPOINTS - Pose/Skeleton Estimation
 * Handles keypoint annotations with skeleton connections
 *
 * Features:
 * - Place keypoints by clicking
 * - Drag keypoints to adjust position
 * - Configurable skeleton connections
 * - Visibility toggle for each keypoint (visible/hidden/occluded)
 * - Auto-connect keypoints based on skeleton definition
 * - Shortcuts: K (keypoint tool), V (select), D (delete), T (toggle visibility)
 *
 * Tools: keypoint, select, pan
 */

class CanvasKeypoints extends CanvasBase {
    constructor(canvas, ui, projectType) {
        super(canvas, ui, projectType);

        // Keypoint-specific state
        this.isDragging = false;
        this.draggedKeypoint = null;
        this.selectedKeypoint = null;

        // Skeleton definition (can be customized per project)
        // Default: COCO 17-point skeleton
        this.keypointNames = [
            'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
            'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
        ];

        // Skeleton connections (pairs of keypoint indices)
        this.skeletonConnections = [
            [0, 1], [0, 2], [1, 3], [2, 4],  // head
            [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],  // arms
            [5, 11], [6, 12], [11, 12],  // torso
            [11, 13], [13, 15], [12, 14], [14, 16]  // legs
        ];

        // Current tool
        this.currentTool = 'keypoint'; // 'keypoint', 'select', 'pan'

        // Current keypoint index being placed
        this.currentKeypointIndex = 0;
    }

    // ============================================
    // TOOL MANAGEMENT
    // ============================================

    getAvailableTools() {
        return ['keypoint', 'select', 'pan'];
    }

    setTool(tool) {
        if (!this.getAvailableTools().includes(tool)) {
            console.warn(`Tool "${tool}" not available for keypoint canvas`);
            return;
        }
        this.currentTool = tool;
        this.updateCursor();
    }

    updateCursor() {
        const cursorMap = {
            'keypoint': 'crosshair',
            'select': 'default',
            'pan': 'grab'
        };
        this.canvas.style.cursor = cursorMap[this.currentTool] || 'default';
    }

    // ============================================
    // SHORTCUTS - Specific to Keypoints
    // ============================================

    getSpecificShortcuts() {
        return {
            // Tools
            'k': { handler: () => this.setTool('keypoint'), description: 'Keypoint Tool' },
            'v': { handler: () => this.setTool('select'), description: 'Select Tool' },

            // Actions
            'Delete': { handler: () => this.deleteSelected(), description: 'Delete Selected Instance' },
            'Backspace': { handler: () => this.deleteSelected(), description: 'Delete Selected Instance' },
            'd': { handler: () => this.deleteSelected(), description: 'Delete Selected Instance' },
            't': { handler: () => this.toggleKeypointVisibility(), description: 'Toggle Keypoint Visibility' },

            // Navigation
            'n': { handler: () => this.newKeypointInstance(), description: 'New Keypoint Instance' },
            'Tab': { handler: () => this.nextKeypoint(), description: 'Next Keypoint' },

            // Class selection (1-9)
            '1': { handler: () => this.selectClass(0), description: 'Select Class 1' },
            '2': { handler: () => this.selectClass(1), description: 'Select Class 2' },
            '3': { handler: () => this.selectClass(2), description: 'Select Class 3' },
            '4': { handler: () => this.selectClass(3), description: 'Select Class 4' },
            '5': { handler: () => this.selectClass(4), description: 'Select Class 5' },
            '6': { handler: () => this.selectClass(5), description: 'Select Class 6' },
            '7': { handler: () => this.selectClass(6), description: 'Select Class 7' },
            '8': { handler: () => this.selectClass(7), description: 'Select Class 8' },
            '9': { handler: () => this.selectClass(8), description: 'Select Class 9' }
        };
    }

    selectClass(index) {
        if (index < this.classes.length) {
            this.currentClass = this.classes[index].id;
            this.emit('classChanged', { classId: this.currentClass });
        }
    }

    toggleKeypointVisibility() {
        if (this.selectedKeypoint) {
            const visibility = this.selectedKeypoint.visibility || 2;
            // Cycle: 2 (visible) -> 1 (occluded) -> 0 (not labeled)
            this.selectedKeypoint.visibility = visibility === 2 ? 1 : (visibility === 1 ? 0 : 2);
            this.hasUnsavedChanges = true;
            this.redraw();
            const states = ['Not Labeled', 'Occluded', 'Visible'];
            this.ui.showToast(`Keypoint: ${states[this.selectedKeypoint.visibility]}`, 'info');
        }
    }

    newKeypointInstance() {
        // Create new empty keypoint instance
        const annotation = {
            type: 'keypoints',
            class: this.currentClass,
            data: {
                keypoints: this.keypointNames.map(() => ({ x: null, y: null, visibility: 0 })),
                bbox: null // Will be computed from keypoints
            }
        };
        this.addAnnotation(annotation);
        this.selectedAnnotation = annotation;
        this.currentKeypointIndex = 0;
        this.ui.showToast('New keypoint instance created', 'success');
        this.redraw();
    }

    nextKeypoint() {
        if (this.selectedAnnotation && this.selectedAnnotation.type === 'keypoints') {
            this.currentKeypointIndex = (this.currentKeypointIndex + 1) % this.keypointNames.length;
            this.ui.showToast(`Placing: ${this.keypointNames[this.currentKeypointIndex]}`, 'info');
        }
    }

    // ============================================
    // DRAWING LOGIC
    // ============================================

    handleDrawStart(x, y) {
        if (this.currentTool === 'keypoint') {
            // Validate classes exist before allowing annotation
            if (!this.classes || this.classes.length === 0) {
                this.ui.showToast('Add at least one class before annotating', 'warning');
                return;
            }

            // If no instance selected, create one
            if (!this.selectedAnnotation || this.selectedAnnotation.type !== 'keypoints') {
                this.newKeypointInstance();
            }

            // Place keypoint at current index
            if (this.selectedAnnotation && this.selectedAnnotation.type === 'keypoints') {
                const kps = this.selectedAnnotation.data.keypoints;
                kps[this.currentKeypointIndex] = { x, y, visibility: 2 };
                this.updateBoundingBox(this.selectedAnnotation);
                this.hasUnsavedChanges = true;
                this.redraw();

                // Auto-advance to next keypoint
                this.nextKeypoint();
            }
        } else if (this.currentTool === 'select') {
            // Check if clicking on keypoint
            const { annotation, keypointIndex } = this.getKeypointAtPosition(x, y);
            if (annotation) {
                this.selectedAnnotation = annotation;
                this.selectedKeypoint = annotation.data.keypoints[keypointIndex];
                this.draggedKeypoint = { annotation, index: keypointIndex };
                this.isDragging = true;
                this.redraw();
            } else {
                // Check if clicking on instance (bbox)
                const instance = this.getInstanceAtPosition(x, y);
                if (instance) {
                    this.selectedAnnotation = instance;
                    this.selectedKeypoint = null;
                    this.redraw();
                } else {
                    this.selectedAnnotation = null;
                    this.selectedKeypoint = null;
                    this.redraw();
                }
            }
        }
    }

    handleDrawMove(x, y) {
        if (this.currentTool === 'select' && this.isDragging && this.draggedKeypoint) {
            // Move keypoint
            const kp = this.draggedKeypoint.annotation.data.keypoints[this.draggedKeypoint.index];
            kp.x = x;
            kp.y = y;
            this.updateBoundingBox(this.draggedKeypoint.annotation);
            this.hasUnsavedChanges = true;
            this.redraw();
        }
    }

    handleDrawEnd(x, y) {
        if (this.currentTool === 'select' && this.isDragging) {
            this.isDragging = false;
            this.draggedKeypoint = null;
        }
    }

    updateBoundingBox(annotation) {
        if (!annotation || annotation.type !== 'keypoints') return;

        const kps = annotation.data.keypoints.filter(kp => kp.x !== null && kp.y !== null);
        if (kps.length === 0) {
            annotation.data.bbox = null;
            return;
        }

        const xs = kps.map(kp => kp.x);
        const ys = kps.map(kp => kp.y);

        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        annotation.data.bbox = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // ============================================
    // DRAWING
    // ============================================

    drawAnnotation(annotation) {
        if (annotation.type === 'keypoints') {
            this.drawKeypoints(annotation);
        }
    }

    drawKeypoints(annotation) {
        const cls = this.classes.find(c => c.id === annotation.class);
        const color = cls?.color || '#ff0000';
        const isSelected = annotation === this.selectedAnnotation;

        const kps = annotation.data.keypoints;

        // Draw skeleton connections first (behind keypoints)
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 / this.zoom;

        this.skeletonConnections.forEach(([idx1, idx2]) => {
            const kp1 = kps[idx1];
            const kp2 = kps[idx2];

            // Only draw if both keypoints are visible
            if (kp1.x !== null && kp1.y !== null && kp1.visibility > 0 &&
                kp2.x !== null && kp2.y !== null && kp2.visibility > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(kp1.x, kp1.y);
                this.ctx.lineTo(kp2.x, kp2.y);
                this.ctx.stroke();
            }
        });

        // Draw keypoints
        kps.forEach((kp, idx) => {
            if (kp.x === null || kp.y === null || kp.visibility === 0) return;

            const isSelectedKp = kp === this.selectedKeypoint;
            const radius = (isSelectedKp ? 6 : 4) / this.zoom;

            // Keypoint circle
            this.ctx.fillStyle = kp.visibility === 1 ? 'rgba(255, 255, 0, 0.7)' : color; // Yellow if occluded
            this.ctx.beginPath();
            this.ctx.arc(kp.x, kp.y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // White border
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2 / this.zoom;
            this.ctx.stroke();

            // Keypoint label (on hover or selected)
            if (this.showLabels && isSelectedKp) {
                this.ctx.fillStyle = color;
                this.ctx.font = `${12 / this.zoom}px Arial`;
                const text = this.keypointNames[idx];
                const textWidth = this.ctx.measureText(text).width;
                this.ctx.fillRect(kp.x + 8 / this.zoom, kp.y - 16 / this.zoom, textWidth + 6 / this.zoom, 16 / this.zoom);
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText(text, kp.x + 11 / this.zoom, kp.y - 4 / this.zoom);
            }
        });

        // Draw bounding box if selected
        if (isSelected && annotation.data.bbox) {
            const { x, y, width, height } = annotation.data.bbox;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2 / this.zoom;
            this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
            this.ctx.strokeRect(x, y, width, height);
            this.ctx.setLineDash([]);

            // Label
            if (this.showLabels && cls) {
                this.ctx.fillStyle = color;
                this.ctx.font = `${14 / this.zoom}px Arial`;
                const textWidth = this.ctx.measureText(cls.name).width;
                this.ctx.fillRect(x, y - 20 / this.zoom, textWidth + 10 / this.zoom, 20 / this.zoom);
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText(cls.name, x + 5 / this.zoom, y - 5 / this.zoom);
            }
        }
    }

    // ============================================
    // SELECTION & INTERACTION
    // ============================================

    getKeypointAtPosition(x, y) {
        const threshold = 8 / this.zoom;

        // Check from last to first (top instances first)
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const ann = this.annotations[i];
            if (ann.type === 'keypoints') {
                const kps = ann.data.keypoints;
                for (let idx = 0; idx < kps.length; idx++) {
                    const kp = kps[idx];
                    if (kp.x !== null && kp.y !== null && kp.visibility > 0) {
                        const dist = Math.hypot(x - kp.x, y - kp.y);
                        if (dist <= threshold) {
                            return { annotation: ann, keypointIndex: idx };
                        }
                    }
                }
            }
        }

        return { annotation: null, keypointIndex: -1 };
    }

    getInstanceAtPosition(x, y) {
        // Check bounding boxes
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const ann = this.annotations[i];
            if (ann.type === 'keypoints' && ann.data.bbox) {
                const { x: bx, y: by, width, height } = ann.data.bbox;
                if (x >= bx && x <= bx + width && y >= by && y <= by + height) {
                    return ann;
                }
            }
        }
        return null;
    }

    // ============================================
    // PUBLIC METHODS (called from UI)
    // ============================================

    setSkeletonDefinition(keypointNames, connections) {
        this.keypointNames = keypointNames;
        this.skeletonConnections = connections;
        this.redraw();
    }

    getKeypointNames() {
        return this.keypointNames;
    }

    getCurrentKeypointName() {
        return this.keypointNames[this.currentKeypointIndex];
    }
}
