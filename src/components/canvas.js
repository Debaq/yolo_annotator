/**
 * CANVAS COMPONENT
 * Alpine.js wrapper for existing canvas system
 * Integrates legacy canvas classes with reactive store
 */

export function canvasComponent() {
    return {
        canvasManager: null,
        isDrawing: false,

        init() {
            // Watch for current image changes
            this.$watch('$store.app.currentImage', async (image) => {
                if (image) {
                    await this.loadImageIntoCanvas(image);
                } else {
                    this.clearCanvas();
                }
            });

            // Watch for tool changes
            this.$watch('$store.app.selectedTool', (tool) => {
                if (this.canvasManager && this.canvasManager.toolManager) {
                    this.canvasManager.toolManager.setTool(tool);
                }
            });

            // Watch for zoom changes
            this.$watch('$store.app.zoom', (zoom) => {
                if (this.canvasManager) {
                    this.canvasManager.zoom = zoom;
                    this.canvasManager.redraw();
                }
            });

            // Setup canvas when project loads
            this.$watch('$store.app.currentProject', (project) => {
                if (project) {
                    this.setupCanvasForProject(project);
                }
            });
        },

        async setupCanvasForProject(project) {
            // Lazy load canvas classes
            if (!window.CanvasFactory) {
                await this.loadCanvasModules();
            }

            const canvas = this.$refs.canvas;
            if (!canvas) return;

            try {
                // Create canvas instance using factory
                this.canvasManager = window.CanvasFactory.create(
                    project.type,
                    canvas,
                    { showToast: (msg, type) => this.$store.app.showToast(msg, type) }
                );

                // Set classes
                if (project.classes) {
                    this.canvasManager.classes = project.classes;
                }

                // Sync with store
                this.syncCanvasWithStore();
            } catch (error) {
                console.error('Failed to setup canvas:', error);
                this.$store.app.showToast('Failed to initialize canvas', 'error');
            }
        },

        async loadCanvasModules() {
            // Load existing canvas modules dynamically
            const modules = [
                '/js/canvas/canvas-base.js',
                '/js/canvas/canvas-bbox.js',
                '/js/canvas/canvas-mask.js',
                '/js/canvas/canvas-obb.js',
                '/js/canvas/canvas-keypoints.js',
                '/js/canvas/canvas-factory.js'
            ];

            for (const modulePath of modules) {
                await this.loadScript(modulePath);
            }
        },

        loadScript(src) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        },

        async loadImageIntoCanvas(imageData) {
            if (!this.canvasManager) return;

            try {
                // Create image URL from blob
                const imageUrl = URL.createObjectURL(imageData.image);
                const img = new Image();

                img.onload = () => {
                    URL.revokeObjectURL(imageUrl);

                    // Load into canvas
                    this.canvasManager.loadImage(img, imageData.name, imageData.id);

                    // Load existing annotations
                    if (imageData.annotations) {
                        this.canvasManager.annotations = imageData.annotations;
                    }

                    this.canvasManager.redraw();
                };

                img.onerror = () => {
                    URL.revokeObjectURL(imageUrl);
                    this.$store.app.showToast('Failed to load image', 'error');
                };

                img.src = imageUrl;
            } catch (error) {
                console.error('Error loading image:', error);
                this.$store.app.showToast('Failed to load image', 'error');
            }
        },

        clearCanvas() {
            if (this.canvasManager) {
                this.canvasManager.clear();
            }
        },

        syncCanvasWithStore() {
            if (!this.canvasManager) return;

            // Sync canvas state to store
            const syncInterval = setInterval(() => {
                if (!this.canvasManager || !this.$store.app.currentImage) {
                    clearInterval(syncInterval);
                    return;
                }

                // Check for changes
                const canvas = this.canvasManager;
                if (canvas.hasUnsavedChanges) {
                    this.$store.app.hasUnsavedChanges = true;

                    // Update annotations in store
                    if (this.$store.app.currentImage) {
                        this.$store.app.currentImage.annotations = [...canvas.annotations];
                    }
                }

                // Sync zoom
                if (canvas.zoom !== this.$store.app.zoom) {
                    this.$store.app.zoom = canvas.zoom;
                }
            }, 100);
        },

        // Mouse event handlers
        handleCanvasMouseDown(e) {
            this.isDrawing = true;
        },

        handleCanvasMouseMove(e) {
            // Handled by canvas manager
        },

        handleCanvasMouseUp(e) {
            this.isDrawing = false;
        },

        handleCanvasWheel(e) {
            if (!this.canvasManager) return;

            // Let canvas manager handle zoom
            e.preventDefault();
        },

        // Keyboard shortcuts
        handleKeyDown(e) {
            if (!this.canvasManager) return;

            // Number keys for class selection
            if (e.key >= '1' && e.key <= '9') {
                const classIndex = parseInt(e.key) - 1;
                if (this.canvasManager.classes[classIndex]) {
                    this.canvasManager.currentClass = classIndex;
                    this.$store.app.selectedClass = classIndex;
                }
            }

            // Tool shortcuts
            const toolShortcuts = {
                'b': 'bbox',
                'm': 'mask',
                'v': 'select',
                'h': 'pan'
            };

            if (toolShortcuts[e.key.toLowerCase()]) {
                this.$store.app.setTool(toolShortcuts[e.key.toLowerCase()]);
            }

            // Save shortcut
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.$store.app.saveCurrentImage();
            }

            // Navigation shortcuts
            if (e.key === 'ArrowLeft') {
                this.$store.app.previousImage();
            } else if (e.key === 'ArrowRight') {
                this.$store.app.nextImage();
            }
        }
    };
}
