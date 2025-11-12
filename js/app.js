/**
 * YOLO ANNOTATOR - MAIN APPLICATION
 * Connects all managers and handles application logic
 */

class YOLOAnnotator {
    constructor() {
        this.db = new DatabaseManager();
        this.ui = new UIManager();
        this.projectManager = null;
        this.canvasManager = null;
        this.classificationManager = null;
        this.galleryManager = null;

        // Active annotation mode ('canvas' or 'classification')
        this.annotationMode = 'canvas';

        this.autoSaveInterval = null;
        this.autoSaveEnabled = true;
        this.autoSaveDelay = 3000; // 3 seconds after last change
        this.autoSaveTimer = null;
        this.periodicAutoSaveInterval = 30000; // 30 seconds periodic autosave

        // Counter for serialized image naming to avoid collisions
        this.imageCounter = 0;
        this.sessionTimestamp = Date.now(); // Unique session identifier
    }

    async init() {
        try {
            console.log('Initializing YOLO Annotator...');
            
            // Initialize database
            await this.db.init();
            console.log('Database initialized');
            
            // Initialize managers
            this.projectManager = new ProjectManager(this.db, this.ui);

            const canvas = document.getElementById('canvas');
            this.canvasManager = new CanvasManager(canvas, this.ui);

            const canvasContainer = document.querySelector('.canvas-container');
            this.classificationManager = new ClassificationManager(canvasContainer, this.ui);

            const galleryContainer = document.getElementById('galleryGrid');
            this.galleryManager = new GalleryManager(galleryContainer, this.db, this, this.ui);
            
            console.log('Managers initialized');
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Load projects
            await this.loadProjects();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Initialize button states
            this.updateButtonStates();

            // Start periodic auto-save
            this.startPeriodicAutoSave();

            this.ui.showToast(window.i18n.t('notifications.appStarted'), 'success');
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.ui.showToast(window.i18n.t('notifications.error.initApp'), 'error');
        }
    }

    setupEventListeners() {
        // Project management
        document.getElementById('btnNewProject')?.addEventListener('click', () => this.showNewProjectModal());
        document.getElementById('btnExport')?.addEventListener('click', () => this.showExportModal());
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

        // Button to trigger file input
        document.getElementById('btnLoadImages')?.addEventListener('click', () => {
            document.getElementById('imageInput')?.click();
        });

        // Batch augmentation button
        document.getElementById('btnBatchAugmentation')?.addEventListener('click', () => this.showAugmentationModal());

        // Show shortcuts modal
        document.getElementById('btnShowShortcuts')?.addEventListener('click', () => this.showShortcutsModal());

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
        document.getElementById('btnToggleGrid')?.addEventListener('click', () => this.toggleGrid());

        // Mask controls
        const brushSlider = document.getElementById('brushSizeSlider');
        const brushValue = document.getElementById('brushSizeValue');
        if (brushSlider && brushValue) {
            brushSlider.addEventListener('input', (e) => {
                const size = parseInt(e.target.value);
                this.canvasManager.toolManager.setBrushSize(size);
                brushValue.textContent = `${size}px`;
            });
        }

        // Erase mode button (mask tool)
        document.getElementById('btnEraseMode')?.addEventListener('click', () => {
            const isEraseMode = !this.canvasManager.toolManager.isEraseMode();
            this.canvasManager.toolManager.setEraseMode(isEraseMode);
            const btn = document.getElementById('btnEraseMode');
            if (btn) {
                btn.classList.toggle('active', isEraseMode);
                // Visual feedback
                const icon = btn.querySelector('i');
                if (icon && isEraseMode) {
                    this.ui.showToast('Modo borrador activado', 'info');
                }
            }
        });

        // New instance button (start fresh mask)
        document.getElementById('btnNewInstance')?.addEventListener('click', () => {
            this.canvasManager.startNewMaskInstance();
            this.ui.showToast('Nueva instancia iniciada', 'success');
        });

        // Image rotation controls
        const rotationSlider = document.getElementById('rotationSlider');
        const rotationValue = document.getElementById('rotationValue');
        if (rotationSlider && rotationValue) {
            rotationSlider.addEventListener('input', (e) => {
                const angle = parseInt(e.target.value);
                this.canvasManager.setImageRotation(angle);
                rotationValue.textContent = `${angle}°`;
            });
        }

        document.getElementById('btnResetRotation')?.addEventListener('click', () => {
            this.canvasManager.resetImageRotation();
            if (rotationSlider) rotationSlider.value = 0;
            if (rotationValue) rotationValue.textContent = '0°';
        });

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

            // S: Save (always available)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentImage();
                return;
            }

            // Classification mode shortcuts
            if (this.annotationMode === 'classification') {
                // Arrow keys: Navigate between images
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.navigatePrevious();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.navigateNext();
                    return;
                }

                // A: Cycle to previous class (in the list, not the image)
                if (e.key === 'a' || e.key === 'A') {
                    e.preventDefault();
                    this.classificationManager.cycleClassPrevious();
                    return;
                }

                // D: Cycle to next class (in the list, not the image)
                if (e.key === 'd' || e.key === 'D') {
                    e.preventDefault();
                    this.classificationManager.cycleClassNext();
                    return;
                }

                // Enter: Toggle current class and navigate (if single-label)
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.classificationManager.toggleCurrentClass();

                    // If single-label mode, automatically move to next image
                    if (!this.classificationManager.isMultiLabel) {
                        // Small delay to show the selection before navigating
                        setTimeout(() => {
                            this.navigateNext();
                        }, 150);
                    }
                    return;
                }

                // Numbers 1-9: select class directly (1-based indexing)
                if (e.key >= '1' && e.key <= '9') {
                    e.preventDefault();
                    const index = parseInt(e.key) - 1; // Convert to 0-based index
                    if (index < this.classificationManager.classes.length) {
                        const classId = this.classificationManager.classes[index].id;
                        this.classificationManager.toggleLabel(classId);

                        // If single-label mode, automatically move to next image
                        if (!this.classificationManager.isMultiLabel) {
                            setTimeout(() => {
                                this.navigateNext();
                            }, 150);
                        }
                    }
                    return;
                }

                return; // No other shortcuts in classification mode
            }

            // Canvas mode shortcuts (detection, segmentation, etc.)
            // Arrow keys: Navigate images
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.navigatePrevious();
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.navigateNext();
                return;
            }

            // ALL other canvas-specific shortcuts below

            // Numbers 1-9: select class
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (index < this.canvasManager.classes.length) {
                    this.canvasManager.currentClass = index;
                    this.updateClassUI();
                }
                return; // Prevent fallthrough
            }

            // Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
                return;
            }

            // Delete: Delete selected
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.canvasManager.deleteSelected();
                return;
            }

            // Escape: Deselect
            if (e.key === 'Escape') {
                this.canvasManager.selectedAnnotation = null;
                this.canvasManager.redraw();
                return;
            }

            // A/D: Rotate image (only in canvas mode)
            if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                this.rotateImageLeft();
                return;
            }
            if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                this.rotateImageRight();
                return;
            }

            // Drawing/editing tools (B, O, M, V, H) - only in canvas mode
            if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                this.setTool('bbox');
                return;
            }
            if (e.key === 'o' || e.key === 'O') {
                e.preventDefault();
                this.setTool('obb');
                return;
            }
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                this.setTool('mask');
                return;
            }
            if (e.key === 'v' || e.key === 'V') {
                e.preventDefault();
                this.setTool('select');
                return;
            }
            if (e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                this.setTool('pan');
                return;
            }
        });
    }

    // DEPRECATED: No longer used - classification now uses direct number keys 1-9
    // handleNumberKeyForClassification(key) {
    //     // Add digit to buffer
    //     this.numberBuffer += key;
    //
    //     // Clear existing timeout
    //     if (this.numberBufferTimeout) {
    //         clearTimeout(this.numberBufferTimeout);
    //     }
    //
    //     // Set new timeout (400ms delay for multi-digit input)
    //     this.numberBufferTimeout = setTimeout(() => {
    //         const classIndex = parseInt(this.numberBuffer);
    //         this.numberBuffer = '';
    //
    //         // Check if class exists
    //         if (classIndex >= 0 && classIndex < this.classificationManager.classes.length) {
    //             const classId = this.classificationManager.classes[classIndex].id;
    //             this.classificationManager.toggleLabel(classId);
    //         }
    //     }, 400);
    // }

    async loadProjects() {
        const projects = await this.db.getAllProjects();
        const selector = document.getElementById('projectSelector');
        
        if (selector) {
            selector.innerHTML = `<option value="">${window.i18n.t('header.selectProject')}</option>`;
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

            // Auto-select first project if exists and none selected
            if (projects.length > 0 && !selector.value) {
                selector.value = projects[0].id;
                await this.loadProject(projects[0].id);
            }
        }
    }

    async loadProject(projectId) {
        try {
            console.log('Loading project:', projectId);
            const project = await this.projectManager.loadProject(projectId);

            // Determine annotation mode based on project type
            const classificationType = ['classification', 'multiLabel'].includes(project.type);

            if (classificationType) {
                // Switch to classification mode
                this.annotationMode = 'classification';
                this.classificationManager.classes = project.classes || [];
                this.classificationManager.init(project.type === 'multiLabel');
                this.canvasManager.clear();
            } else {
                // Switch to canvas mode
                this.annotationMode = 'canvas';
                if (this.classificationManager.classificationUI) {
                    this.classificationManager.destroy();
                }
                this.canvasManager.classes = project.classes || [];
                this.canvasManager.setProjectType(project.type);
            }

            // Update UI visibility based on mode
            this.updateUIForMode();

            this.updateClassUI();
            await this.galleryManager.loadImages(projectId);
            this.updateStats();
            console.log('Project loaded successfully in', this.annotationMode, 'mode');
        } catch (error) {
            console.error('Error loading project:', error);
        }
    }

    // Update UI elements visibility based on annotation mode
    updateUIForMode() {
        const floatingTools = document.querySelector('.floating-tools');
        const annotationsBar = document.getElementById('annotationsBar');

        if (this.annotationMode === 'classification') {
            // Hide ALL drawing/editing tools in classification mode
            if (floatingTools) {
                // Get all tool sections
                const toolSections = floatingTools.querySelectorAll('.floating-section');

                // Hide first section (drawing tools: bbox, obb, mask, select, pan)
                if (toolSections[0]) {
                    toolSections[0].style.display = 'none';
                }

                // Keep zoom section visible (second section)
                if (toolSections[1]) {
                    toolSections[1].style.display = 'flex';
                }

                // Hide third section if exists (toggle buttons)
                if (toolSections[2]) {
                    toolSections[2].style.display = 'none';
                }

                // Also hide individual controls
                const maskControls = document.getElementById('maskControls');
                const rotationControls = document.getElementById('rotationControls');
                const toggleLabelsBtn = document.getElementById('btnToggleLabels');
                const toggleGridBtn = document.getElementById('btnToggleGrid');

                if (maskControls) maskControls.style.display = 'none';
                if (rotationControls) rotationControls.style.display = 'none';
                if (toggleLabelsBtn) toggleLabelsBtn.style.display = 'none';
                if (toggleGridBtn) toggleGridBtn.style.display = 'none';
            }

            // Hide annotations bar (bottom panel)
            if (annotationsBar) annotationsBar.style.display = 'none';

        } else {
            // Show all tools for canvas mode
            if (floatingTools) {
                const toolSections = floatingTools.querySelectorAll('.floating-section');

                // Show all sections
                toolSections.forEach(section => {
                    section.style.display = 'flex';
                });

                // Show toggle buttons
                const toggleLabelsBtn = document.getElementById('btnToggleLabels');
                const toggleGridBtn = document.getElementById('btnToggleGrid');
                if (toggleLabelsBtn) toggleLabelsBtn.style.display = 'flex';
                if (toggleGridBtn) toggleGridBtn.style.display = 'flex';

                // Let CanvasManager handle specific tool visibility based on project type
                this.canvasManager.updateToolAvailability();
            }

            // Show annotations bar
            if (annotationsBar) annotationsBar.style.display = 'block';
        }
    }

    showShortcutsModal() {
        const content = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-height: 400px; overflow-y: auto;">
                <div class="shortcut-item">
                    <span><strong>Guardar</strong></span>
                    <span class="shortcut-key">Ctrl+S</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Deshacer</strong></span>
                    <span class="shortcut-key">Ctrl+Z</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Eliminar</strong></span>
                    <span class="shortcut-key">Del/Backspace</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Deseleccionar</strong></span>
                    <span class="shortcut-key">Esc</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Navegación imágenes</strong></span>
                    <span class="shortcut-key">← →</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Rotar imagen</strong></span>
                    <span class="shortcut-key">A / D</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Herramienta Box</strong></span>
                    <span class="shortcut-key">B</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Herramienta OBB</strong></span>
                    <span class="shortcut-key">O</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Herramienta Mask</strong></span>
                    <span class="shortcut-key">M</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Herramienta Select</strong></span>
                    <span class="shortcut-key">V</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Herramienta Pan</strong></span>
                    <span class="shortcut-key">H</span>
                </div>
                <div class="shortcut-item">
                    <span><strong>Seleccionar Clase</strong></span>
                    <span class="shortcut-key">1-9</span>
                </div>
            </div>
            <style>
                .shortcut-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: var(--gray-light);
                    border-radius: 6px;
                }
                .shortcut-key {
                    background: var(--primary);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 0.9em;
                    font-weight: 600;
                }
            </style>
        `;

        this.ui.showModal('⌨️ Atajos de Teclado', content, [
            {
                text: 'Cerrar',
                type: 'primary',
                action: 'close',
                handler: (modal, close) => close()
            }
        ]);
    }

    showNewProjectModal() {
        const preprocessor = new ImagePreprocessor();
        const sizeOptions = preprocessor.standardSizes;

        // Define project types with their internal IDs, icons and colors
        const projectTypes = [
            { id: 'classification', key: 'classification', icon: 'fa-tag', color: '#667eea' },
            { id: 'multiLabel', key: 'multiLabel', icon: 'fa-tags', color: '#9333ea' },
            { id: 'detection', key: 'detection', icon: 'fa-vector-square', color: '#10b981' },
            { id: 'segmentation', key: 'segmentation', icon: 'fa-fill-drip', color: '#f59e0b' },
            { id: 'instanceSeg', key: 'instanceSeg', icon: 'fa-object-group', color: '#ef4444' },
            { id: 'keypoints', key: 'keypoints', icon: 'fa-braille', color: '#06b6d4' },
            { id: 'obb', key: 'obb', icon: 'fa-rotate', color: '#6366f1' }
        ];

        const content = `
            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.name')}</label>
                <input type="text" id="projectName" class="form-control" placeholder="${window.i18n.t('project.namePlaceholder')}">
            </div>

            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.type')}</label>
                <div class="project-type-grid">
                    ${projectTypes.map(type => {
                        const name = window.i18n.t(`project.types.${type.key}.name`);
                        const description = window.i18n.t(`project.types.${type.key}.description`);
                        const difficulty = window.i18n.t(`project.types.${type.key}.difficulty`);
                        const useCases = window.i18n.t(`project.types.${type.key}.useCases`);
                        const models = window.i18n.t(`project.types.${type.key}.models`);

                        const difficultyColor =
                            difficulty === 'Principiante' || difficulty === 'Beginner' ? '#10b981' :
                            difficulty === 'Intermedio' || difficulty === 'Intermediate' ? '#f59e0b' : '#ef4444';

                        return `
                            <label class="project-type-card-compact" data-type-color="${type.color}">
                                <input type="radio" name="projectType" value="${type.id}" ${type.id === 'detection' ? 'checked' : ''}>
                                <div class="type-card-icon" style="color: ${type.color};">
                                    <i class="fas ${type.icon}"></i>
                                </div>
                                <div class="type-card-compact-content">
                                    <div class="type-card-compact-header">
                                        <strong class="type-name">${name}</strong>
                                        <button type="button"
                                                class="project-type-info-btn"
                                                data-type-key="${type.key}"
                                                data-name="${name}"
                                                data-difficulty="${difficulty}"
                                                data-difficulty-color="${difficultyColor}"
                                                data-use-cases="${useCases}"
                                                data-models="${models}"
                                                title="Más información">
                                            <i class="fas fa-question"></i>
                                        </button>
                                    </div>
                                    <p class="type-description-compact">${description}</p>
                                </div>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.initialClasses')}</label>
                <input type="text" id="projectClasses" class="form-control" placeholder="${window.i18n.t('project.classesPlaceholder')}">
                <small class="text-muted">${window.i18n.t('project.classesHelp')}</small>
            </div>

            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.imageDimensions')}</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <label class="dimension-mode-option">
                        <input type="radio" name="dimensionMode" value="auto" checked>
                        <div>
                            <i class="fas fa-magic"></i>
                            ${window.i18n.t('project.dimensionsAuto')}
                        </div>
                    </label>
                    <label class="dimension-mode-option">
                        <input type="radio" name="dimensionMode" value="fixed">
                        <div>
                            <i class="fas fa-crop"></i>
                            ${window.i18n.t('project.dimensionsFixed')}
                        </div>
                    </label>
                </div>
            </div>

            <div class="form-group" id="fixedDimensionsOptions" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label class="form-label" style="font-size: 0.85em;">${window.i18n.t('project.targetSize')}</label>
                        <select id="projectTargetSize" class="form-control form-select">
                            ${sizeOptions.map(size => `
                                <option value="${size}" ${size === 640 ? 'selected' : ''}>${size}px</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label" style="font-size: 0.85em;">${window.i18n.t('project.resizeStrategy')}</label>
                        <select id="projectStrategy" class="form-control form-select">
                            <option value="resize">${window.i18n.t('preprocessing.strategies.resize.name')}</option>
                            <option value="padding">${window.i18n.t('preprocessing.strategies.padding.name')}</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        this.ui.showModal(window.i18n.t('project.new'), content, [
            {
                text: window.i18n.t('actions.cancel'),
                type: 'secondary',
                action: 'cancel',
                handler: (modal, close) => close()
            },
            {
                text: window.i18n.t('actions.create'),
                type: 'primary',
                icon: 'fas fa-plus',
                action: 'create',
                handler: async (modal, close) => {
                    const name = modal.querySelector('#projectName').value.trim();
                    const type = modal.querySelector('input[name="projectType"]:checked').value;
                    const classesText = modal.querySelector('#projectClasses').value.trim();

                    if (!name) {
                        this.ui.showToast(window.i18n.t('project.enterName'), 'warning');
                        return;
                    }

                    const classes = classesText ?
                        classesText.split(',').map((c, i) => ({
                            id: i,
                            name: c.trim(),
                            color: this.randomColor()
                        })) : [];

                    // Get image dimension configuration
                    const dimensionMode = modal.querySelector('input[name="dimensionMode"]:checked').value;
                    const preprocessingConfig = dimensionMode === 'fixed' ? {
                        enabled: true,
                        targetSize: parseInt(modal.querySelector('#projectTargetSize').value),
                        strategy: modal.querySelector('#projectStrategy').value
                    } : {
                        enabled: false
                    };

                    const project = await this.projectManager.createProject(name, type, classes, preprocessingConfig);
                    await this.loadProjects();
                    close();

                    // Auto-select the newly created project
                    if (project && project.id) {
                        const selector = document.getElementById('projectSelector');
                        if (selector) {
                            selector.value = project.id;
                            await this.loadProject(project.id);
                        }
                    }
                }
            }
        ]);

        // Add event listener to toggle fixed dimensions options
        setTimeout(() => {
            const modal = document.querySelector('.modal');
            if (modal) {
                const radioButtons = modal.querySelectorAll('input[name="dimensionMode"]');
                const fixedOptions = modal.querySelector('#fixedDimensionsOptions');

                radioButtons.forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        if (fixedOptions) {
                            fixedOptions.style.display = e.target.value === 'fixed' ? 'block' : 'none';
                        }
                    });
                });

                // Add event listeners for project type info buttons
                const infoButtons = modal.querySelectorAll('.project-type-info-btn');
                let activeTooltip = null;

                infoButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        // Remove existing tooltip if any
                        if (activeTooltip) {
                            activeTooltip.remove();
                            if (activeTooltip.dataset.btnId === btn.dataset.typeKey) {
                                activeTooltip = null;
                                return;
                            }
                        }

                        // Create tooltip
                        const tooltip = document.createElement('div');
                        tooltip.className = 'project-type-tooltip';
                        tooltip.dataset.btnId = btn.dataset.typeKey;

                        const difficultyBgColor = btn.dataset.difficultyColor;

                        tooltip.innerHTML = `
                            <h4>${btn.dataset.name}</h4>
                            <div class="project-type-tooltip-section">
                                <span class="project-type-tooltip-label">${window.i18n.t('project.types.useCasesLabel') || 'Casos de uso'}:</span>
                                <div class="project-type-tooltip-content">${btn.dataset.useCases}</div>
                            </div>
                            <div class="project-type-tooltip-section">
                                <span class="project-type-tooltip-label">${window.i18n.t('project.types.modelsLabel') || 'Modelos'}:</span>
                                <div class="project-type-tooltip-content">${btn.dataset.models}</div>
                            </div>
                            <div class="project-type-tooltip-section">
                                <span class="project-type-tooltip-label">${window.i18n.t('project.types.difficultyLabel') || 'Dificultad'}:</span>
                                <span class="project-type-tooltip-difficulty" style="background: ${difficultyBgColor}; color: white;">${btn.dataset.difficulty}</span>
                            </div>
                        `;

                        document.body.appendChild(tooltip);

                        // Position tooltip near the button
                        const btnRect = btn.getBoundingClientRect();
                        const tooltipRect = tooltip.getBoundingClientRect();

                        let left = btnRect.right + 10;
                        let top = btnRect.top;

                        // Adjust if tooltip goes off screen
                        if (left + tooltipRect.width > window.innerWidth) {
                            left = btnRect.left - tooltipRect.width - 10;
                        }
                        if (top + tooltipRect.height > window.innerHeight) {
                            top = window.innerHeight - tooltipRect.height - 10;
                        }

                        tooltip.style.left = left + 'px';
                        tooltip.style.top = top + 'px';

                        activeTooltip = tooltip;

                        // Close tooltip when clicking outside
                        const closeTooltip = (event) => {
                            if (!tooltip.contains(event.target) && event.target !== btn) {
                                tooltip.remove();
                                activeTooltip = null;
                                document.removeEventListener('click', closeTooltip);
                            }
                        };

                        setTimeout(() => {
                            document.addEventListener('click', closeTooltip);
                        }, 10);
                    });
                });
            }
        }, 100);
    }

    randomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }

    setTool(tool) {
        // Validate tool for project type
        if (!this.canvasManager.isToolValid(tool)) {
            const type = this.canvasManager.projectType;
            this.ui.showToast(
                `Herramienta "${tool}" no disponible para proyectos de tipo "${type}". Usa ${type === 'bbox' ? 'Box' : 'Mask'}.`,
                'warning'
            );
            return;
        }

        this.canvasManager.toolManager.setTool(tool);
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Show/hide mask controls based on tool
        const maskControls = document.getElementById('maskControls');
        if (maskControls) {
            maskControls.style.display = (tool === 'mask') ? 'block' : 'none';
        }
    }

    async loadImages(files) {
        if (!this.projectManager.currentProject) {
            this.ui.showToast(window.i18n.t('project.selectFirst'), 'warning');
            return;
        }

        // Load all images first to check dimensions
        const loadedImages = [];
        for (const file of files) {
            try {
                const img = await this.loadImageFile(file);
                loadedImages.push({ img, file });
            } catch (error) {
                console.error(`Error loading ${file.name}:`, error);
                this.ui.showToast(`Error loading ${file.name}`, 'error');
            }
        }

        if (loadedImages.length === 0) return;

        // Check if preprocessing is needed
        const preprocessor = new ImagePreprocessor();
        const projectConfig = this.projectManager.currentProject.preprocessingConfig;

        let processedImages = loadedImages;

        // If project has fixed preprocessing config, apply it automatically
        if (projectConfig && projectConfig.enabled) {
            // Apply preprocessing with project configuration (force all images)
            processedImages = await this.preprocessImages(
                loadedImages,
                preprocessor,
                projectConfig.targetSize,
                projectConfig.strategy,
                true // Force preprocessing for all images
            );
        } else {
            // No fixed config, check if images need preprocessing and ask user
            const nonSquareImages = loadedImages.filter(({ img }) =>
                preprocessor.needsPreprocessing(img.width, img.height)
            );

            if (nonSquareImages.length > 0) {
                // Show preprocessing modal
                const shouldPreprocess = await this.showPreprocessingModal(nonSquareImages, preprocessor);

                if (shouldPreprocess) {
                    processedImages = await this.preprocessImages(loadedImages, preprocessor, shouldPreprocess.targetSize, shouldPreprocess.strategy);
                }
            }
        }

        // Save all images
        let loadedCount = 0;
        let firstImageId = null;

        for (const { img, file, blob, width, height } of processedImages) {
            try {
                const finalBlob = blob || await this.fileToBlob(file);
                const finalWidth = width || img.width;
                const finalHeight = height || img.height;

                const imageData = {
                    projectId: this.projectManager.currentProject.id,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    image: finalBlob,
                    annotations: [],
                    width: finalWidth,
                    height: finalHeight,
                    timestamp: Date.now()
                };

                const imageId = await this.db.saveImage(imageData);

                if (loadedCount === 0) {
                    firstImageId = imageId;
                }

                loadedCount++;
            } catch (error) {
                console.error(`Error saving ${file.name}:`, error);
                this.ui.showToast(`Error saving ${file.name}`, 'error');
            }
        }

        if (loadedCount > 0) {
            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            this.updateStats();

            if (firstImageId) {
                await this.galleryManager.loadImage(firstImageId);
            }

            this.ui.showToast(window.i18n.t('notifications.imagesLoaded', { count: loadedCount }), 'success');
        }
    }

    loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    fileToBlob(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(new Blob([e.target.result], { type: file.type }));
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async showPreprocessingModal(nonSquareImages, preprocessor) {
        return new Promise((resolve) => {
            const count = nonSquareImages.length;

            // Calculate recommended size based on largest dimension
            const maxDimensions = nonSquareImages.map(({ img }) => Math.max(img.width, img.height));
            const largestDim = Math.max(...maxDimensions);
            const recommendedSize = preprocessor.getRecommendedSize(largestDim, largestDim);

            // Create size options
            const sizeOptions = preprocessor.standardSizes
                .filter(size => size >= largestDim)
                .slice(0, 4);

            if (!sizeOptions.includes(recommendedSize)) {
                sizeOptions.push(recommendedSize);
                sizeOptions.sort((a, b) => a - b);
            }

            const modalContent = `
                <div style="text-align: left; padding: 20px;">
                    <p style="margin-bottom: 20px;">
                        <strong>${window.i18n.t('preprocessing.detected', { count })}</strong>
                    </p>
                    <p style="margin-bottom: 20px; color: #666;">
                        ${window.i18n.t('preprocessing.description')}
                    </p>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 12px; font-weight: 500;">
                            ${window.i18n.t('preprocessing.strategy')}
                        </label>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <label style="display: flex; align-items: start; padding: 12px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s;" class="strategy-option">
                                <input type="radio" name="strategy" value="resize" checked style="margin-top: 4px; margin-right: 12px;">
                                <div>
                                    <div style="font-weight: 500; margin-bottom: 4px;">${window.i18n.t('preprocessing.strategies.resize.name')}</div>
                                    <div style="font-size: 13px; color: #666;">${window.i18n.t('preprocessing.strategies.resize.description')}</div>
                                </div>
                            </label>
                            <label style="display: flex; align-items: start; padding: 12px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s;" class="strategy-option">
                                <input type="radio" name="strategy" value="padding" style="margin-top: 4px; margin-right: 12px;">
                                <div>
                                    <div style="font-weight: 500; margin-bottom: 4px;">${window.i18n.t('preprocessing.strategies.padding.name')}</div>
                                    <div style="font-size: 13px; color: #666;">${window.i18n.t('preprocessing.strategies.padding.description')}</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label for="targetSizeSelect" style="display: block; margin-bottom: 8px; font-weight: 500;">
                            ${window.i18n.t('preprocessing.targetSize')}
                        </label>
                        <select id="targetSizeSelect" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            ${sizeOptions.map(size => `
                                <option value="${size}" ${size === recommendedSize ? 'selected' : ''}>
                                    ${size}x${size}px ${size === recommendedSize ? '(' + window.i18n.t('preprocessing.recommended', { size }) + ')' : ''}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div style="padding: 12px; background: #f8f9fa; border-radius: 4px; font-size: 14px;">
                        <div style="margin-bottom: 4px;">✓ ${window.i18n.t('preprocessing.aspectRatio')}</div>
                        <div>✓ ${window.i18n.t('preprocessing.paddingInfo')}</div>
                    </div>
                </div>
            `;

            this.ui.showModal(
                window.i18n.t('preprocessing.title'),
                modalContent,
                [
                    {
                        text: window.i18n.t('preprocessing.options.skip'),
                        type: 'secondary',
                        action: 'skip',
                        handler: (modal, close) => {
                            close();
                            resolve(null);
                        }
                    },
                    {
                        text: window.i18n.t('preprocessing.options.apply'),
                        type: 'primary',
                        icon: 'fas fa-magic',
                        action: 'apply',
                        handler: (modal, close) => {
                            const selectElement = modal.querySelector('#targetSizeSelect');
                            const targetSize = parseInt(selectElement.value);
                            const strategyElement = modal.querySelector('input[name="strategy"]:checked');
                            const strategy = strategyElement ? strategyElement.value : 'resize';
                            close();
                            resolve({ targetSize, strategy });
                        }
                    }
                ]
            );
        });
    }

    async preprocessImages(loadedImages, preprocessor, targetSize, strategy = 'resize', forceAll = false) {
        const processed = [];

        for (let i = 0; i < loadedImages.length; i++) {
            const { img, file } = loadedImages[i];

            // Show progress
            this.ui.showToast(
                window.i18n.t('preprocessing.progress', { current: i + 1, total: loadedImages.length }),
                'info'
            );

            const needsProcessing = forceAll ||
                preprocessor.needsPreprocessing(img.width, img.height) ||
                img.width !== targetSize || img.height !== targetSize;

            if (needsProcessing) {
                // Apply letterboxing with chosen strategy
                const result = await preprocessor.applyLetterboxing(img, targetSize, '#000000', strategy);

                processed.push({
                    img,
                    file,
                    blob: result.blob,
                    width: result.padding.targetSize,
                    height: result.padding.targetSize,
                    padding: result.padding
                });
            } else {
                // Image already matches target size exactly
                processed.push({
                    img,
                    file,
                    blob: null,
                    width: img.width,
                    height: img.height,
                    padding: null
                });
            }
        }

        this.ui.showToast(
            window.i18n.t('preprocessing.complete', { count: processed.length }),
            'success'
        );

        return processed;
    }

    scheduleAutoSave() {
        if (!this.autoSaveEnabled) return;

        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Schedule auto-save after delay
        this.autoSaveTimer = setTimeout(() => {
            this.autoSave();
        }, this.autoSaveDelay);
    }

    async autoSave() {
        if (this.annotationMode === 'classification') {
            if (!this.classificationManager.hasUnsavedChanges) return;
            if (!this.classificationManager.image || !this.projectManager.currentProject) return;
        } else {
            if (!this.canvasManager.hasUnsavedChanges) return;
            if (!this.canvasManager.image || !this.projectManager.currentProject) return;
        }

        console.log('Auto-saving...');
        await this.saveCurrentImage(true); // true = silent save
    }

    startPeriodicAutoSave() {
        // Clear existing interval if any
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // Set up periodic auto-save every 30 seconds
        this.autoSaveInterval = setInterval(async () => {
            if (!this.autoSaveEnabled) return;

            let hasChanges = false;
            if (this.annotationMode === 'classification') {
                hasChanges = this.classificationManager.hasUnsavedChanges &&
                            this.classificationManager.imageId &&
                            this.projectManager.currentProject;
            } else {
                hasChanges = this.canvasManager.hasUnsavedChanges &&
                            this.canvasManager.imageId &&
                            this.projectManager.currentProject;
            }

            if (hasChanges) {
                console.log('Periodic auto-save triggered...');
                await this.saveCurrentImage(true); // true = silent save
            }
        }, this.periodicAutoSaveInterval);

        console.log('Periodic auto-save started (every', this.periodicAutoSaveInterval / 1000, 'seconds)');
    }

    stopPeriodicAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('Periodic auto-save stopped');
        }
    }

    async saveCurrentImage(silent = false) {
        if (!this.projectManager.currentProject) {
            return;
        }

        try {
            let imageBlob, imageData;

            if (this.annotationMode === 'classification') {
                // Classification mode
                if (!this.classificationManager.image) return;

                imageBlob = this.classificationManager.image;
                imageData = {
                    id: this.classificationManager.imageId,
                    projectId: this.projectManager.currentProject.id,
                    name: this.classificationManager.imageName,
                    image: imageBlob,
                    annotations: this.classificationManager.getLabels(), // Array of class IDs
                    timestamp: Date.now()
                };

                const id = await this.db.saveImage(imageData);
                this.classificationManager.imageId = id;
                this.classificationManager.clearUnsavedChanges();

            } else {
                // Canvas mode (detection, segmentation, etc.)
                if (!this.canvasManager.image) return;

                imageBlob = this.canvasManager.originalImageBlob;

                if (!imageBlob) {
                    if (!silent) {
                        this.ui.showToast('Error: No se encontró la imagen original', 'error');
                    }
                    return;
                }

                // Clean annotations to remove cached image objects
                const cleanAnnotations = this.canvasManager.annotations.map(ann => {
                    const cleanAnn = { ...ann };
                    delete cleanAnn._cachedImage;
                    return cleanAnn;
                });

                imageData = {
                    id: this.canvasManager.imageId,
                    projectId: this.projectManager.currentProject.id,
                    name: this.canvasManager.imageName,
                    image: imageBlob,
                    annotations: cleanAnnotations,
                    width: this.canvasManager.image.width,
                    height: this.canvasManager.image.height,
                    timestamp: Date.now()
                };

                const id = await this.db.saveImage(imageData);
                this.canvasManager.imageId = id;
                this.canvasManager.clearUnsavedChanges();
            }

            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            this.updateStats();

            if (!silent) {
                this.ui.showToast(window.i18n.t('notifications.imageSaved'), 'success');
            } else {
                console.log('Auto-saved successfully');
            }
        } catch (error) {
            console.error('Error saving image:', error);
            if (!silent) {
                this.ui.showToast(window.i18n.t('notifications.error.saveImage'), 'error');
            }
        }
    }

    // ==========================================
    // DATA AUGMENTATION METHODS
    // ==========================================

    async showAugmentationModal(imageData = null) {
        if (!this.projectManager.currentProject) {
            this.ui.showToast(window.i18n.t('project.selectFirst'), 'warning');
            return;
        }

        const projectType = this.projectManager.currentProject.type;
        const isBbox = projectType === 'bbox';

        const content = `
            <div class="form-group">
                <label class="form-label">${window.i18n.t('augmentation.variationsCount')}</label>
                <input type="number" id="augVariations" class="form-control" value="1" min="1" max="20" step="1">
                <small class="text-muted">${window.i18n.t('augmentation.variationsCountHelp')}</small>
            </div>

            <div class="form-group">
                <label class="form-label">${window.i18n.t('augmentation.generationMode')}</label>
                <select id="augMode" class="form-control form-select">
                    <option value="manual">${window.i18n.t('augmentation.modeManual')}</option>
                    <option value="random">${window.i18n.t('augmentation.modeRandom')}</option>
                </select>
                <small class="text-muted" id="modeHelp">${window.i18n.t('augmentation.modeManualHelp')}</small>
            </div>

            <div id="manualControls">
                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.geometricTransforms')}</label>
                    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="augFlipH" style="margin-right: 8px;">
                            ${window.i18n.t('augmentation.flipHorizontal')}
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="augFlipV" style="margin-right: 8px;">
                            ${window.i18n.t('augmentation.flipVertical')}
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.rotation')}</label>
                    <select id="augRotation" class="form-control form-select">
                        <option value="0">${window.i18n.t('augmentation.noRotation')}</option>
                        <option value="90">90°</option>
                        <option value="180">180°</option>
                        <option value="270">270°</option>
                        <option value="custom">${window.i18n.t('augmentation.customRotation')}</option>
                    </select>
                    <div id="customRotationDiv" style="display: none; margin-top: 10px;">
                        <input type="range" id="augRotationCustom" min="-45" max="45" value="0" step="1" class="form-range" style="width: 100%;">
                        <div style="text-align: center; margin-top: 5px;">
                            <span id="rotationValue">0°</span>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.colorAdjustments')}</label>

                    <div style="margin-bottom: 15px;">
                        <label>${window.i18n.t('augmentation.brightness')}: <span id="brightnessValue">0</span></label>
                        <input type="range" id="augBrightness" min="-100" max="100" value="0" step="5" class="form-range" style="width: 100%;">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label>${window.i18n.t('augmentation.contrast')}: <span id="contrastValue">0</span></label>
                        <input type="range" id="augContrast" min="-100" max="100" value="0" step="5" class="form-range" style="width: 100%;">
                    </div>

                    <div>
                        <label>${window.i18n.t('augmentation.saturation')}: <span id="saturationValue">0</span></label>
                        <input type="range" id="augSaturation" min="-100" max="100" value="0" step="5" class="form-range" style="width: 100%;">
                    </div>
                </div>
            </div>

            <div id="randomControls" style="display: none;">
                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.randomOptions')}</label>
                    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="augRandomFlip" checked style="margin-right: 8px;">
                            ${window.i18n.t('augmentation.randomFlip')}
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="augRandomRotation" checked style="margin-right: 8px;">
                            ${window.i18n.t('augmentation.randomRotation')}
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="augRandomColor" checked style="margin-right: 8px;">
                            ${window.i18n.t('augmentation.randomColor')}
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.rotationRange')}</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.min')}</label>
                            <input type="number" id="augRotationMin" class="form-control" value="-30" min="-45" max="45">
                        </div>
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.max')}</label>
                            <input type="number" id="augRotationMax" class="form-control" value="30" min="-45" max="45">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.brightnessRange')}</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.min')}</label>
                            <input type="number" id="augBrightnessMin" class="form-control" value="-30" min="-100" max="100">
                        </div>
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.max')}</label>
                            <input type="number" id="augBrightnessMax" class="form-control" value="30" min="-100" max="100">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.contrastRange')}</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.min')}</label>
                            <input type="number" id="augContrastMin" class="form-control" value="-20" min="-100" max="100">
                        </div>
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.max')}</label>
                            <input type="number" id="augContrastMax" class="form-control" value="20" min="-100" max="100">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${window.i18n.t('augmentation.saturationRange')}</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.min')}</label>
                            <input type="number" id="augSaturationMin" class="form-control" value="-20" min="-100" max="100">
                        </div>
                        <div>
                            <label style="font-size: 0.9em;">${window.i18n.t('augmentation.max')}</label>
                            <input type="number" id="augSaturationMax" class="form-control" value="20" min="-100" max="100">
                        </div>
                    </div>
                </div>
            </div>

            ${isBbox ? `
            <div class="form-group">
                <label style="display: flex; align-items: center; cursor: pointer; padding: 10px; background: #e8f5e9; border-radius: 6px;">
                    <input type="checkbox" id="augKeepAnnotations" checked style="margin-right: 8px;">
                    <span style="font-weight: 500;">${window.i18n.t('augmentation.keepAnnotations')}</span>
                </label>
                <small class="text-muted" style="margin-top: 5px; display: block;">
                    ${window.i18n.t('augmentation.keepAnnotationsHelp')}
                </small>
            </div>
            ` : `
            <div style="padding: 10px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                <strong>${window.i18n.t('augmentation.maskProjectWarning')}</strong>
                <p style="margin: 5px 0 0 0; font-size: 0.9em;">${window.i18n.t('augmentation.maskProjectWarningText')}</p>
            </div>
            `}
        `;

        this.ui.showModal(window.i18n.t('augmentation.title'), content, [
            {
                text: window.i18n.t('actions.cancel'),
                type: 'secondary',
                action: 'cancel',
                handler: (modal, close) => close()
            },
            {
                text: window.i18n.t('augmentation.apply'),
                type: 'primary',
                icon: 'fas fa-wand-magic-sparkles',
                action: 'apply',
                handler: async (modal, close) => {
                    const mode = modal.querySelector('#augMode').value;
                    const variations = parseInt(modal.querySelector('#augVariations').value);
                    const keepAnnotations = isBbox && modal.querySelector('#augKeepAnnotations')?.checked;

                    close();

                    if (mode === 'manual') {
                        // Manual mode: apply same config N times
                        const config = {
                            flipHorizontal: modal.querySelector('#augFlipH').checked,
                            flipVertical: modal.querySelector('#augFlipV').checked,
                            rotation: 0,
                            brightness: parseInt(modal.querySelector('#augBrightness').value),
                            contrast: parseInt(modal.querySelector('#augContrast').value),
                            saturation: parseInt(modal.querySelector('#augSaturation').value)
                        };

                        const rotationSelect = modal.querySelector('#augRotation').value;
                        if (rotationSelect === 'custom') {
                            config.rotation = parseInt(modal.querySelector('#augRotationCustom').value);
                        } else {
                            config.rotation = parseInt(rotationSelect);
                        }

                        // Apply augmentation
                        if (imageData) {
                            // Single image: create N variations with same config
                            for (let i = 0; i < variations; i++) {
                                // Refresh gallery every 3 variations for better UX
                                const shouldRefresh = (i + 1) % 3 === 0 || (i + 1) === variations;
                                await this.applyAugmentationToImage(imageData, config, keepAnnotations, i + 1, shouldRefresh);
                            }
                            // Final gallery refresh and stats update
                            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
                            this.updateStats();
                        } else {
                            // Batch: apply to all images
                            await this.applyAugmentationBatch(config, keepAnnotations);
                        }
                    } else {
                        // Random mode: generate random configs
                        const randomOptions = {
                            flip: modal.querySelector('#augRandomFlip').checked,
                            rotation: modal.querySelector('#augRandomRotation').checked,
                            color: modal.querySelector('#augRandomColor').checked,
                            rotationMin: parseInt(modal.querySelector('#augRotationMin').value),
                            rotationMax: parseInt(modal.querySelector('#augRotationMax').value),
                            brightnessMin: parseInt(modal.querySelector('#augBrightnessMin').value),
                            brightnessMax: parseInt(modal.querySelector('#augBrightnessMax').value),
                            contrastMin: parseInt(modal.querySelector('#augContrastMin').value),
                            contrastMax: parseInt(modal.querySelector('#augContrastMax').value),
                            saturationMin: parseInt(modal.querySelector('#augSaturationMin').value),
                            saturationMax: parseInt(modal.querySelector('#augSaturationMax').value)
                        };

                        if (imageData) {
                            // Single image: create N random variations
                            await this.applyRandomAugmentationToImage(imageData, randomOptions, variations, keepAnnotations);
                        } else {
                            // Batch: apply random to all images
                            await this.applyRandomAugmentationBatch(randomOptions, variations, keepAnnotations);
                        }
                    }
                }
            }
        ]);

        // Setup dynamic value updates
        setTimeout(() => {
            const modal = document.querySelector('.modal');
            if (!modal) return;

            // Mode selector
            const modeSelect = modal.querySelector('#augMode');
            const manualControls = modal.querySelector('#manualControls');
            const randomControls = modal.querySelector('#randomControls');
            const modeHelp = modal.querySelector('#modeHelp');

            modeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'manual') {
                    manualControls.style.display = 'block';
                    randomControls.style.display = 'none';
                    modeHelp.textContent = window.i18n.t('augmentation.modeManualHelp');
                } else {
                    manualControls.style.display = 'none';
                    randomControls.style.display = 'block';
                    modeHelp.textContent = window.i18n.t('augmentation.modeRandomHelp');
                }
            });

            // Rotation selector
            const rotationSelect = modal.querySelector('#augRotation');
            const customRotationDiv = modal.querySelector('#customRotationDiv');
            const rotationCustom = modal.querySelector('#augRotationCustom');
            const rotationValue = modal.querySelector('#rotationValue');

            if (rotationSelect) {
                rotationSelect.addEventListener('change', (e) => {
                    customRotationDiv.style.display = e.target.value === 'custom' ? 'block' : 'none';
                });
            }

            if (rotationCustom) {
                rotationCustom.addEventListener('input', (e) => {
                    rotationValue.textContent = e.target.value + '°';
                });
            }

            // Color adjustment sliders (manual mode)
            const brightnessSlider = modal.querySelector('#augBrightness');
            const contrastSlider = modal.querySelector('#augContrast');
            const saturationSlider = modal.querySelector('#augSaturation');

            if (brightnessSlider) {
                brightnessSlider.addEventListener('input', (e) => {
                    modal.querySelector('#brightnessValue').textContent = e.target.value;
                });
            }

            if (contrastSlider) {
                contrastSlider.addEventListener('input', (e) => {
                    modal.querySelector('#contrastValue').textContent = e.target.value;
                });
            }

            if (saturationSlider) {
                saturationSlider.addEventListener('input', (e) => {
                    modal.querySelector('#saturationValue').textContent = e.target.value;
                });
            }
        }, 100);
    }

    async applyAugmentationToImage(imageData, config, keepAnnotations, variationIndex = null, refreshGallery = false) {
        try {
            const preprocessor = new ImagePreprocessor();
            const projectType = this.projectManager.currentProject.type;

            // Apply augmentation
            const annotations = keepAnnotations ? imageData.annotations : [];
            const result = await preprocessor.applyAugmentation(
                imageData.image,
                config,
                annotations,
                projectType
            );

            // Generate new filename with serialized naming system
            // Format: basename_suffix_TIMESTAMP_COUNTER.ext
            // This ensures unique names even with identical augmentation configs
            const baseName = imageData.name.replace(/\.[^/.]+$/, ''); // Remove extension
            const extension = imageData.name.match(/\.[^/.]+$/)?.[0] || '.png';
            const suffix = ImagePreprocessor.generateAugmentationSuffix(config);

            // Increment counter for unique naming
            this.imageCounter++;

            // Create serialized name: basename_suffix_timestamp_counter.ext
            const serializedName = `${baseName}${suffix}_${this.sessionTimestamp}_${this.imageCounter.toString().padStart(4, '0')}${extension}`;

            // Save as new image
            const newImageData = {
                projectId: this.projectManager.currentProject.id,
                name: serializedName,
                image: result.blob,
                annotations: result.annotations,
                width: result.width,
                height: result.height,
                timestamp: Date.now()
            };

            await this.db.saveImage(newImageData);

            // Refresh gallery incrementally if requested
            if (refreshGallery) {
                await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            }

            return serializedName; // Return the generated name for logging

        } catch (error) {
            console.error('Error applying augmentation:', error);
            throw error;
        }
    }

    async applyRandomAugmentationToImage(imageData, randomOptions, variations, keepAnnotations) {
        try {
            this.ui.showToast(window.i18n.t('augmentation.generatingVariations', { count: variations }), 'info');

            // Generate all variations with incremental gallery refresh
            const generatedNames = [];
            for (let i = 0; i < variations; i++) {
                const config = this.generateRandomConfig(randomOptions);

                // Refresh gallery every 3 images for better UX (show progress)
                const shouldRefresh = (i + 1) % 3 === 0 || (i + 1) === variations;
                const newName = await this.applyAugmentationToImage(imageData, config, keepAnnotations, i + 1, shouldRefresh);

                generatedNames.push(newName);

                // Small delay to prevent UI blocking
                if (i < variations - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // Final gallery refresh and stats update
            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            this.updateStats();

            console.log('Generated augmented images:', generatedNames);
            this.ui.showToast(window.i18n.t('augmentation.variationsSuccess', { count: variations }), 'success');

        } catch (error) {
            console.error('Error applying random augmentation:', error);
            this.ui.showToast(window.i18n.t('augmentation.error'), 'error');
        }
    }

    generateRandomConfig(options) {
        const config = {
            flipHorizontal: false,
            flipVertical: false,
            rotation: 0,
            brightness: 0,
            contrast: 0,
            saturation: 0
        };

        // Improved random flip with better distribution
        // Instead of simple > 0.5, use different probabilities for each
        if (options.flip) {
            // Each flip has independent ~40-60% probability (more varied)
            const flipHProb = 0.4 + Math.random() * 0.2; // 40-60%
            const flipVProb = 0.4 + Math.random() * 0.2; // 40-60%
            config.flipHorizontal = Math.random() < flipHProb;
            config.flipVertical = Math.random() < flipVProb;
        }

        // Improved random rotation with better distribution
        if (options.rotation) {
            const range = options.rotationMax - options.rotationMin + 1;
            // Use crypto.getRandomValues for better randomness if available
            if (window.crypto && window.crypto.getRandomValues) {
                const array = new Uint32Array(1);
                window.crypto.getRandomValues(array);
                config.rotation = options.rotationMin + (array[0] % range);
            } else {
                config.rotation = options.rotationMin + Math.floor(Math.random() * range);
            }
        }

        // Improved random color adjustments with better distribution
        if (options.color) {
            // Helper function for better random distribution
            const betterRandom = (min, max) => {
                const range = max - min + 1;
                if (window.crypto && window.crypto.getRandomValues) {
                    const array = new Uint32Array(1);
                    window.crypto.getRandomValues(array);
                    return min + (array[0] % range);
                }
                return min + Math.floor(Math.random() * range);
            };

            config.brightness = betterRandom(options.brightnessMin, options.brightnessMax);
            config.contrast = betterRandom(options.contrastMin, options.contrastMax);
            config.saturation = betterRandom(options.saturationMin, options.saturationMax);
        }

        return config;
    }

    async applyAugmentationBatch(config, keepAnnotations) {
        try {
            const images = await this.db.getProjectImages(this.projectManager.currentProject.id);

            if (images.length === 0) {
                this.ui.showToast(window.i18n.t('notifications.noImages'), 'warning');
                return;
            }

            this.ui.showToast(window.i18n.t('augmentation.batchProcessing', { count: images.length }), 'info');

            let processed = 0;
            for (const imageData of images) {
                // Use the improved applyAugmentationToImage with serialized naming
                // Refresh gallery every 5 images for better UX
                const shouldRefresh = (processed + 1) % 5 === 0 || (processed + 1) === images.length;
                await this.applyAugmentationToImage(imageData, config, keepAnnotations, null, shouldRefresh);

                processed++;

                // Small delay to prevent UI blocking
                if (processed < images.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // Final gallery refresh and stats update
            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            this.updateStats();

            this.ui.showToast(window.i18n.t('augmentation.batchSuccess', { count: processed }), 'success');

        } catch (error) {
            console.error('Error applying batch augmentation:', error);
            this.ui.showToast(window.i18n.t('augmentation.batchError'), 'error');
        }
    }

    async applyRandomAugmentationBatch(randomOptions, variations, keepAnnotations) {
        try {
            const images = await this.db.getProjectImages(this.projectManager.currentProject.id);

            if (images.length === 0) {
                this.ui.showToast(window.i18n.t('notifications.noImages'), 'warning');
                return;
            }

            const totalVariations = images.length * variations;
            this.ui.showToast(window.i18n.t('augmentation.batchRandomProcessing', {
                images: images.length,
                variations: variations,
                total: totalVariations
            }), 'info');

            let processed = 0;
            for (const imageData of images) {
                for (let i = 0; i < variations; i++) {
                    const config = this.generateRandomConfig(randomOptions);

                    // Refresh gallery every 5 augmentations for better UX
                    const shouldRefresh = (processed + 1) % 5 === 0 || (processed + 1) === totalVariations;
                    await this.applyAugmentationToImage(imageData, config, keepAnnotations, i + 1, shouldRefresh);

                    processed++;

                    // Small delay to prevent UI blocking
                    if (processed < totalVariations) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
            }

            // Final gallery refresh and stats update
            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            this.updateStats();

            this.ui.showToast(window.i18n.t('augmentation.batchRandomSuccess', { count: processed }), 'success');

        } catch (error) {
            console.error('Error applying random batch augmentation:', error);
            this.ui.showToast(window.i18n.t('augmentation.batchError'), 'error');
        }
    }

    async downloadDataset() {
        if (!this.projectManager.currentProject) return;

        try {
            const images = await this.db.getProjectImages(this.projectManager.currentProject.id);

            if (images.length === 0) {
                this.ui.showToast(window.i18n.t('notifications.noImages'), 'warning');
                return;
            }

            // Show format selection modal
            this.showExportFormatModal(images);

        } catch (error) {
            console.error('Error downloading dataset:', error);
            this.ui.showToast(window.i18n.t('notifications.error.downloadDataset'), 'error');
        }
    }

    showExportFormatModal(images) {
        const formats = [
            { id: 'yolo', key: 'yolo' },
            { id: 'yoloSeg', key: 'yoloSeg' },
            { id: 'coco', key: 'coco' },
            { id: 'masksPng', key: 'masksPng' },
            { id: 'voc', key: 'voc' },
            { id: 'csv', key: 'csv' }
        ];

        const formatsHTML = formats.map(fmt => `
            <label class="export-format-option">
                <input type="radio" name="exportFormat" value="${fmt.id}" ${fmt.id === 'yolo' ? 'checked' : ''}>
                <div class="format-content">
                    <strong>${window.i18n.t(`export.formats.${fmt.key}.name`)}</strong>
                    <p>${window.i18n.t(`export.formats.${fmt.key}.description`)}</p>
                </div>
            </label>
        `).join('');

        const content = `
            <div class="export-format-selector">
                <p class="format-description">${window.i18n.t('export.formatDescription')}</p>
                <div class="format-options">
                    ${formatsHTML}
                </div>
            </div>
            <style>
                .export-format-selector {
                    padding: 10px 0;
                }
                .format-description {
                    margin-bottom: 20px;
                    color: var(--gray-dark);
                }
                .format-options {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                .export-format-option {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px;
                    border: 2px solid var(--gray-light);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .export-format-option:hover {
                    border-color: var(--primary);
                    background: var(--gray-light);
                }
                .export-format-option input[type="radio"] {
                    margin-top: 4px;
                    cursor: pointer;
                }
                .export-format-option input[type="radio"]:checked ~ .format-content {
                    color: var(--primary);
                }
                .format-content {
                    flex: 1;
                }
                .format-content strong {
                    display: block;
                    margin-bottom: 4px;
                    font-size: 1.05em;
                }
                .format-content p {
                    margin: 0;
                    font-size: 0.9em;
                    color: var(--gray-dark);
                }
            </style>
        `;

        this.ui.showModal(window.i18n.t('export.selectFormat'), content, [
            {
                text: window.i18n.t('actions.cancel'),
                type: 'secondary',
                action: 'cancel',
                handler: (modal, close) => close()
            },
            {
                text: window.i18n.t('export.downloadDataset'),
                type: 'primary',
                icon: 'fas fa-download',
                action: 'export',
                handler: async (modal, close) => {
                    const selectedFormat = modal.querySelector('input[name="exportFormat"]:checked').value;
                    close();
                    await this.executeExport(selectedFormat, images);
                }
            }
        ]);
    }

    async executeExport(format, images) {
        console.log(`Formato seleccionado: ${format}`);

        // Classification projects should only export to CSV
        if (this.annotationMode === 'classification') {
            await this.exportClassificationCSV(images);
            return;
        }

        // Other formats for detection/segmentation projects
        if (format === 'yolo') {
            await this.exportYOLODetection(images);
        } else if (format === 'csv') {
            await this.exportClassificationCSV(images);
        } else {
            this.ui.showToast(`Formato ${format} - Falta implementar`, 'info');
        }
    }

    async exportClassificationCSV(images) {
        try {
            // CSV Header
            let csvContent = 'image_name,labels,class_ids\n';

            // Add each image
            for (const imageData of images) {
                const imageName = imageData.name;
                const labels = imageData.annotations || [];

                if (labels.length === 0) {
                    // Image without labels
                    csvContent += `${imageName},,\n`;
                } else {
                    // Get class names
                    const classNames = labels.map(classId => {
                        const cls = this.classificationManager.classes.find(c => c.id === classId);
                        return cls ? cls.name : `Class_${classId}`;
                    });

                    csvContent += `${imageName},"${classNames.join(', ')}","${labels.join(', ')}"\n`;
                }
            }

            // Create and download CSV file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.projectManager.currentProject.name}_classification_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);

            this.ui.showToast(window.i18n.t('notifications.datasetDownloaded'), 'success');
        } catch (error) {
            console.error('Error exporting classification CSV:', error);
            this.ui.showToast(window.i18n.t('notifications.error.downloadDataset'), 'error');
        }
    }

    async exportYOLODetection(images) {
        try {
            const zip = new JSZip();
            const imagesFolder = zip.folder('images');
            const labelsFolder = zip.folder('labels');

            for (const imageData of images) {
                const ext = imageData.image.type.split('/')[1];
                imagesFolder.file(`${imageData.name}.${ext}`, imageData.image);

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

            const sortedClasses = [...this.projectManager.currentProject.classes].sort((a, b) => a.id - b.id);
            const classesContent = sortedClasses.map(cls => cls.name).join('\n');
            zip.file('classes.txt', classesContent);

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.projectManager.currentProject.name}_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);

            this.ui.showToast(window.i18n.t('notifications.datasetDownloaded'), 'success');
        } catch (error) {
            console.error('Error exporting YOLO dataset:', error);
            this.ui.showToast(window.i18n.t('notifications.error.downloadDataset'), 'error');
        }
    }

    addClass() {
        const nameInput = document.getElementById('newClassName');
        const colorInput = document.getElementById('newClassColor');

        if (!nameInput || !colorInput) return;

        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) {
            this.ui.showToast(window.i18n.t('classes.enterName'), 'warning');
            return;
        }

        // Get classes from appropriate manager
        const classes = this.annotationMode === 'classification'
            ? this.classificationManager.classes
            : this.canvasManager.classes;

        if (classes.some(c => c.name === name)) {
            this.ui.showToast(window.i18n.t('classes.exists'), 'warning');
            return;
        }

        const newId = classes.length > 0 ?
            Math.max(...classes.map(c => c.id)) + 1 : 0;

        const newClass = { id: newId, name, color };

        // Add to appropriate manager
        if (this.annotationMode === 'classification') {
            this.classificationManager.classes.push(newClass);
        } else {
            this.canvasManager.classes.push(newClass);
        }

        nameInput.value = '';
        colorInput.value = this.randomColor();

        this.updateClassUI();

        if (this.projectManager.currentProject) {
            const updatedClasses = this.annotationMode === 'classification'
                ? this.classificationManager.classes
                : this.canvasManager.classes;
            this.projectManager.updateProject({ classes: updatedClasses });
        }
    }

    updateClassUI() {
        // Delegate to appropriate manager based on mode
        if (this.annotationMode === 'classification') {
            this.classificationManager.renderClassList();
            return;
        }

        // Canvas mode (detection, segmentation, etc.)
        const container = document.getElementById('classList');
        if (!container) return;

        container.innerHTML = '';

        if (this.canvasManager.classes.length === 0) {
            container.innerHTML = `<div class="empty-message">${window.i18n.t('classes.empty')}</div>`;
            return;
        }

        this.canvasManager.classes.forEach((cls, index) => {
            const item = document.createElement('div');
            item.className = 'class-item';
            if (index === this.canvasManager.currentClass) {
                item.classList.add('active');
            }

            // Show number only if index is 0-8 (keys 1-9)
            const classNumber = index < 9 ? `[${index + 1}] ` : '';

            item.innerHTML = `
                <div class="class-color" style="background: ${cls.color}"></div>
                <span class="class-name">${classNumber}${cls.name}</span>
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
        if (this.annotationMode === 'classification') {
            // Classification mode
            const hasLabels = this.classificationManager.labels.includes(classId);

            if (hasLabels) {
                const confirmMsg = window.i18n.t('classes.deleteConfirm');
                if (!confirm(confirmMsg)) {
                    return;
                }
                // Remove class from current image labels
                this.classificationManager.labels = this.classificationManager.labels.filter(id => id !== classId);
                this.classificationManager.markUnsavedChanges();
            }

            this.classificationManager.classes = this.classificationManager.classes.filter(c => c.id !== classId);
            this.updateClassUI();

            if (this.projectManager.currentProject) {
                this.projectManager.updateProject({ classes: this.classificationManager.classes });
            }
        } else {
            // Canvas mode (detection, segmentation, etc.)
            const hasAnnotations = this.canvasManager.annotations.some(a => a.class === classId);

            if (hasAnnotations) {
                const confirmMsg = window.i18n.t('classes.deleteConfirm');
                if (!confirm(confirmMsg)) {
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
        const btn = document.getElementById('btnToggleLabels');
        if (btn) {
            btn.classList.toggle('active', this.canvasManager.showLabels);
        }
        this.canvasManager.redraw();
    }

    toggleGrid() {
        this.canvasManager.showGrid = !this.canvasManager.showGrid;
        const btn = document.getElementById('btnToggleGrid');
        if (btn) {
            btn.classList.toggle('active', this.canvasManager.showGrid);
        }
        this.canvasManager.redraw();
    }

    rotateImageLeft() {
        if (!this.canvasManager.image) return;
        const currentRotation = this.canvasManager.getImageRotation();
        const newRotation = (currentRotation - 5 + 360) % 360; // Rotate 5 degrees counterclockwise
        this.canvasManager.setImageRotation(newRotation);

        // Update UI
        const rotationSlider = document.getElementById('rotationSlider');
        const rotationValue = document.getElementById('rotationValue');
        if (rotationSlider) rotationSlider.value = newRotation;
        if (rotationValue) rotationValue.textContent = `${newRotation}°`;
    }

    rotateImageRight() {
        if (!this.canvasManager.image) return;
        const currentRotation = this.canvasManager.getImageRotation();
        const newRotation = (currentRotation + 5) % 360; // Rotate 5 degrees clockwise
        this.canvasManager.setImageRotation(newRotation);

        // Update UI
        const rotationSlider = document.getElementById('rotationSlider');
        const rotationValue = document.getElementById('rotationValue');
        if (rotationSlider) rotationSlider.value = newRotation;
        if (rotationValue) rotationValue.textContent = `${newRotation}°`;
    }

    updateButtonStates() {
        // Update labels button (default is true)
        const btnLabels = document.getElementById('btnToggleLabels');
        if (btnLabels) {
            btnLabels.classList.toggle('active', this.canvasManager.showLabels);
        }

        // Update grid button (default is false)
        const btnGrid = document.getElementById('btnToggleGrid');
        if (btnGrid) {
            btnGrid.classList.toggle('active', this.canvasManager.showGrid);
        }
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
        const images = this.galleryManager.images;
        const totalLabels = images.reduce((sum, img) => 
            sum + (img.annotations ? img.annotations.length : 0), 0);
        const annotated = images.filter(img => img.annotations && img.annotations.length > 0).length;
        
        document.getElementById('statTotalImages').textContent = images.length;
        document.getElementById('statAnnotated').textContent = annotated;
        document.getElementById('statLabels').textContent = totalLabels;
        
        const progress = images.length > 0 ? (annotated / images.length) * 100 : 0;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `${annotated}/${images.length} ${window.i18n.t('stats.progress')}`;
    }

    showExportModal() {
        if (!this.projectManager.currentProject) {
            this.ui.showToast(window.i18n.t('project.selectFirst'), 'warning');
            return;
        }

        const content = `
            <div class="export-options">
                <!-- Export Project .tix -->
                <div class="export-card">
                    <div class="export-card-header">
                        <i class="fas fa-box-archive"></i>
                        <h4>${window.i18n.t('export.project.title')}</h4>
                    </div>
                    <p class="export-card-description">${window.i18n.t('export.project.description')}</p>
                    <div class="export-card-actions">
                        <label class="export-option">
                            <input type="checkbox" id="exportWithImages" checked>
                            <span>${window.i18n.t('export.project.withImages')}</span>
                        </label>
                        <button class="btn btn-primary btn-block" id="btnExportProjectTix">
                            <i class="fas fa-file-zipper"></i> ${window.i18n.t('export.project.button')}
                        </button>
                    </div>
                </div>

                <!-- Export for Training -->
                <div class="export-card export-card-training">
                    <div class="export-card-header">
                        <i class="fas fa-graduation-cap"></i>
                        <h4>${window.i18n.t('export.training.title')}</h4>
                    </div>
                    <p class="export-card-description">${window.i18n.t('export.training.description')}</p>

                    <!-- Tabs -->
                    <div class="export-tabs">
                        <button class="export-tab active" data-tab="export">
                            <i class="fas fa-download"></i> ${window.i18n.t('export.training.tabExport') || 'Exportar'}
                        </button>
                        <button class="export-tab" data-tab="code">
                            <i class="fas fa-code"></i> ${window.i18n.t('export.training.tabCode') || 'Generar Código'}
                        </button>
                    </div>

                    <!-- Tab Content: Export -->
                    <div class="export-tab-content active" id="tab-export">
                        <div class="export-card-actions">
                            <label class="form-label" style="margin-top: 8px;">${window.i18n.t('export.training.selectFormat')}</label>
                            <select class="form-control form-select" id="trainingFormatSelect">
                                ${this.getAvailableFormats().map(fmt => `
                                    <option value="${fmt.id}">${window.i18n.t(`export.formats.${fmt.key}.name`)}</option>
                                `).join('')}
                            </select>
                            <button class="btn btn-success btn-block" id="btnExportTraining" style="margin-top: 8px;">
                                <i class="fas fa-rocket"></i> ${window.i18n.t('export.training.button')}
                            </button>
                        </div>
                    </div>

                    <!-- Tab Content: Generate Code -->
                    <div class="export-tab-content" id="tab-code">
                        <div class="code-generator">
                            <div class="code-config">
                                <!-- Basic Configuration -->
                                <div class="config-row">
                                    <div class="config-item">
                                        <label class="form-label">
                                            Framework
                                            <span class="help-icon" data-tippy-content="Librería de deep learning a usar. Se adapta según tu tipo de proyecto.">
                                                <i class="fas fa-question-circle"></i>
                                            </span>
                                        </label>
                                        <select class="form-control form-select" id="codeFramework">
                                            <!-- Populated dynamically based on project type -->
                                        </select>
                                    </div>
                                    <div class="config-item">
                                        <label class="form-label">
                                            Modelo
                                            <span class="help-icon" data-tippy-content="Tamaño del modelo: Nano es rápido pero menos preciso, XLarge es lento pero más preciso.">
                                                <i class="fas fa-question-circle"></i>
                                            </span>
                                        </label>
                                        <select class="form-control form-select" id="codeModel">
                                            <option value="n">Nano (más rápido)</option>
                                            <option value="s">Small</option>
                                            <option value="m" selected>Medium</option>
                                            <option value="l">Large</option>
                                            <option value="x">XLarge (más preciso)</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="config-row">
                                    <div class="config-item">
                                        <label class="form-label">
                                            Dispositivo
                                            <span class="help-icon" data-tippy-content="Dónde entrenar: CPU es lento pero funciona siempre, GPU (CUDA) es muy rápido si tienes NVIDIA.">
                                                <i class="fas fa-question-circle"></i>
                                            </span>
                                        </label>
                                        <select class="form-control form-select" id="codeDevice">
                                            <option value="cpu">🖥️ CPU</option>
                                            <option value="cuda:0" selected>🎮 GPU (CUDA)</option>
                                            <option value="mps">🍎 Apple Silicon (MPS)</option>
                                        </select>
                                    </div>
                                    <div class="config-item">
                                        <label class="form-label">
                                            Epochs
                                            <span class="help-icon" data-tippy-content="Cuántas veces el modelo ve todo el dataset. Más epochs = más aprendizaje pero más tiempo.">
                                                <i class="fas fa-question-circle"></i>
                                            </span>
                                        </label>
                                        <input type="number" class="form-control" id="codeEpochs" value="100" min="1">
                                    </div>
                                </div>
                                <div class="config-row">
                                    <div class="config-item">
                                        <label class="form-label">
                                            Batch Size
                                            <span class="help-icon" data-tippy-content="Cuántas imágenes procesar al mismo tiempo. Valores altos usan más memoria pero entrenan más rápido.">
                                                <i class="fas fa-question-circle"></i>
                                            </span>
                                        </label>
                                        <input type="number" class="form-control" id="codeBatch" value="16" min="1">
                                    </div>
                                    <div class="config-item">
                                        <label class="form-label">
                                            Tamaño Imagen
                                            <span class="help-icon" data-tippy-content="Resolución de las imágenes durante entrenamiento. Más grande = más detalle pero más lento.">
                                                <i class="fas fa-question-circle"></i>
                                            </span>
                                        </label>
                                        <select class="form-control form-select" id="codeImgsz">
                                            <option value="416">416</option>
                                            <option value="640" selected>640</option>
                                            <option value="1280">1280</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Advanced Options Accordion -->
                                <div class="config-accordion">
                                    <button class="config-accordion-toggle" type="button" id="toggleAdvanced">
                                        <i class="fas fa-chevron-down"></i>
                                        <span>Opciones Avanzadas</span>
                                    </button>
                                    <div class="config-accordion-content" id="advancedOptions">
                                        <!-- Training Options -->
                                        <div class="config-section">
                                            <h5 class="config-section-title">
                                                <i class="fas fa-cogs"></i> Entrenamiento
                                            </h5>
                                            <div class="config-row">
                                                <div class="config-item">
                                                    <label class="form-label">
                                                        Optimizer
                                                        <span class="help-icon" data-tippy-content="Algoritmo que ajusta los pesos del modelo durante entrenamiento. Adam: equilibrado y popular. AdamW: Adam con weight decay mejorado. SGD: clásico, más lento pero a veces mejor resultado final. RMSprop: bueno para RNNs.">
                                                            <i class="fas fa-question-circle"></i>
                                                        </span>
                                                    </label>
                                                    <select class="form-control form-select" id="codeOptimizer">
                                                        <option value="Adam" selected>Adam (recomendado para principiantes)</option>
                                                        <option value="AdamW">AdamW (Adam mejorado con weight decay)</option>
                                                        <option value="SGD">SGD (clásico, requiere más ajuste)</option>
                                                        <option value="RMSprop">RMSprop (bueno para redes recurrentes)</option>
                                                    </select>
                                                </div>
                                                <div class="config-item">
                                                    <label class="form-label">
                                                        Learning Rate
                                                        <span class="help-icon" data-tippy-content="Qué tan rápido aprende el modelo. Valores altos = aprende rápido pero puede ser inestable. 0.001 es un buen punto de partida.">
                                                            <i class="fas fa-question-circle"></i>
                                                        </span>
                                                    </label>
                                                    <input type="number" class="form-control" id="codeLr" value="0.001" step="0.0001" min="0">
                                                </div>
                                            </div>
                                            <div class="config-row">
                                                <div class="config-item">
                                                    <label class="form-label">
                                                        Patience (Early Stop)
                                                        <span class="help-icon" data-tippy-content="Cuántos epochs esperar sin mejora antes de detener. Si el modelo no mejora en 50 epochs, para automáticamente.">
                                                            <i class="fas fa-question-circle"></i>
                                                        </span>
                                                    </label>
                                                    <input type="number" class="form-control" id="codePatience" value="50" min="0">
                                                </div>
                                                <div class="config-item">
                                                    <label class="form-label">
                                                        Validation Split (%)
                                                        <span class="help-icon" data-tippy-content="Qué porcentaje de tus imágenes usar para validar el modelo. 20% es estándar: 80% entrena, 20% valida.">
                                                            <i class="fas fa-question-circle"></i>
                                                        </span>
                                                    </label>
                                                    <input type="number" class="form-control" id="codeValSplit" value="20" min="5" max="50">
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Data Augmentation -->
                                        <div class="config-section">
                                            <h5 class="config-section-title">
                                                <i class="fas fa-magic"></i> Data Augmentation
                                                <span class="help-icon" data-tippy-content="Técnicas para crear variaciones de tus imágenes y evitar que el modelo memorice. Ayuda a generalizar mejor.">
                                                    <i class="fas fa-question-circle"></i>
                                                </span>
                                            </h5>
                                            <div class="config-checkboxes">
                                                <label class="checkbox-label" data-tippy-content="Combina 4 imágenes aleatorias en una sola. Muy efectivo para mejorar detección de objetos pequeños.">
                                                    <input type="checkbox" id="augMosaic" checked>
                                                    <span>Mosaic (combina 4 imágenes)</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Mezcla dos imágenes con transparencia. Ayuda al modelo a ser más robusto ante oclusiones.">
                                                    <input type="checkbox" id="augMixup">
                                                    <span>Mixup (mezcla transparencias)</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Cambia los colores de la imagen (tono, saturación, brillo). Útil para diferentes condiciones de iluminación.">
                                                    <input type="checkbox" id="augHsv" checked>
                                                    <span>HSV (color jitter)</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Voltea las imágenes horizontal o verticalmente. Duplica tus datos sin esfuerzo.">
                                                    <input type="checkbox" id="augFlip" checked>
                                                    <span>Flips (horizontal/vertical)</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Rota las imágenes levemente. Útil si tus objetos pueden aparecer en diferentes ángulos.">
                                                    <input type="checkbox" id="augRotate">
                                                    <span>Rotación</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Hace zoom in/out y recorta aleatoriamente. Simula objetos a diferentes distancias.">
                                                    <input type="checkbox" id="augScale" checked>
                                                    <span>Scale/Crop</span>
                                                </label>
                                            </div>
                                        </div>

                                        <!-- Metrics & Plots -->
                                        <div class="config-section">
                                            <h5 class="config-section-title">
                                                <i class="fas fa-chart-line"></i> Métricas y Gráficos
                                                <span class="help-icon" data-tippy-content="Qué información guardar durante el entrenamiento para analizar el rendimiento del modelo.">
                                                    <i class="fas fa-question-circle"></i>
                                                </span>
                                            </h5>
                                            <div class="config-checkboxes">
                                                <label class="checkbox-label" data-tippy-content="Guarda gráficos de pérdida y precisión durante entrenamiento. Muy útil para ver si el modelo está aprendiendo.">
                                                    <input type="checkbox" id="savePlots" checked>
                                                    <span>Guardar gráficos de entrenamiento</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Tabla que muestra qué clases se confunden entre sí. Ideal para entender errores del modelo.">
                                                    <input type="checkbox" id="saveConfMatrix" checked>
                                                    <span>Matriz de confusión</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Gráficos que muestran el balance entre precisión y recall. Importantes para evaluar calidad de detecciones.">
                                                    <input type="checkbox" id="savePrCurves" checked>
                                                    <span>Curvas Precision-Recall</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Guarda imágenes con las predicciones del modelo dibujadas encima. Perfecto para ver qué tan bien funciona visualmente.">
                                                    <input type="checkbox" id="savePredictions">
                                                    <span>Visualizar predicciones</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="Exporta todas las métricas a un archivo CSV para analizarlas en Excel o hacer tus propios gráficos.">
                                                    <input type="checkbox" id="saveMetricsCsv" checked>
                                                    <span>Exportar métricas a CSV</span>
                                                </label>
                                            </div>
                                        </div>

                                        <!-- Model Export -->
                                        <div class="config-section">
                                            <h5 class="config-section-title">
                                                <i class="fas fa-file-export"></i> Exportación del Modelo
                                                <span class="help-icon" data-tippy-content="Formatos para deployar tu modelo entrenado en producción.">
                                                    <i class="fas fa-question-circle"></i>
                                                </span>
                                            </h5>
                                            <div class="config-checkboxes">
                                                <label class="checkbox-label" data-tippy-content="ONNX: formato universal, funciona con TensorFlow, PyTorch, y casi cualquier librería. Ideal para producción.">
                                                    <input type="checkbox" id="exportOnnx" checked>
                                                    <span>ONNX (recomendado)</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="TorchScript: formato nativo de PyTorch, muy rápido pero solo funciona con PyTorch.">
                                                    <input type="checkbox" id="exportTorchscript">
                                                    <span>TorchScript</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="TensorFlow Lite: para móviles y dispositivos embebidos (Android, iOS, Raspberry Pi).">
                                                    <input type="checkbox" id="exportTflite">
                                                    <span>TensorFlow Lite</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="OpenVINO: optimizado para CPUs Intel. Muy rápido en hardware Intel.">
                                                    <input type="checkbox" id="exportOpenvino">
                                                    <span>OpenVINO</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="CoreML: para apps nativas de iOS/macOS. Aprovecha los chips Apple.">
                                                    <input type="checkbox" id="exportCoreml">
                                                    <span>CoreML</span>
                                                </label>
                                                <label class="checkbox-label" data-tippy-content="TensorRT: máxima aceleración en GPUs NVIDIA. Para producción de alto rendimiento.">
                                                    <input type="checkbox" id="exportTensorrt">
                                                    <span>TensorRT</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="code-preview-container">
                                <div class="code-preview-header">
                                    <span class="code-preview-title">
                                        <i class="fas fa-terminal"></i> ${window.i18n.t('export.code.preview') || 'Vista Previa'}
                                    </span>
                                    <div class="code-preview-actions">
                                        <button class="btn-icon" id="btnCopyCode" title="${window.i18n.t('export.code.copy') || 'Copiar'}">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                        <button class="btn-icon" id="btnDownloadPy" title="${window.i18n.t('export.code.downloadPy') || 'Descargar .py'}">
                                            <i class="fas fa-file-code"></i>
                                        </button>
                                        <button class="btn-icon" id="btnDownloadIpynb" title="${window.i18n.t('export.code.downloadIpynb') || 'Descargar .ipynb'}">
                                            <i class="fas fa-book"></i>
                                        </button>
                                    </div>
                                </div>
                                <pre class="code-preview" id="codePreview"><code class="language-python"># El código se generará aquí...</code></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.ui.showModal(window.i18n.t('export.title'), content, [
            {
                text: window.i18n.t('actions.cancel'),
                type: 'secondary',
                action: 'cancel',
                handler: (modal, close) => close()
            }
        ]);

        // Setup event listeners for buttons in modal
        setTimeout(() => {
            document.getElementById('btnExportProjectTix')?.addEventListener('click', () => this.exportProjectTix());
            document.getElementById('btnExportTraining')?.addEventListener('click', () => this.exportForTraining());

            // Tab switching
            document.querySelectorAll('.export-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const tabName = e.currentTarget.dataset.tab;

                    // Update tabs
                    document.querySelectorAll('.export-tab').forEach(t => t.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    // Update content
                    document.querySelectorAll('.export-tab-content').forEach(c => c.classList.remove('active'));
                    document.getElementById(`tab-${tabName}`)?.classList.add('active');

                    // Show/hide project card and adjust training card width
                    const projectCard = document.querySelector('.export-card:not(.export-card-training)');
                    const trainingCard = document.querySelector('.export-card-training');
                    const modal = document.querySelector('.modal');

                    if (tabName === 'code') {
                        // Hide project card and expand training card to full width
                        if (projectCard) projectCard.style.display = 'none';
                        if (trainingCard) trainingCard.classList.add('full-width');

                        // Expand modal to full screen mode
                        if (modal) modal.classList.add('code-mode');

                        this.populateFrameworks();
                        this.generateTrainingCode();
                    } else {
                        // Show project card and restore normal width
                        if (projectCard) projectCard.style.display = 'flex';
                        if (trainingCard) trainingCard.classList.remove('full-width');

                        // Restore normal modal size
                        if (modal) modal.classList.remove('code-mode');
                    }
                });
            });

            // Advanced options accordion
            document.getElementById('toggleAdvanced')?.addEventListener('click', (e) => {
                const content = document.getElementById('advancedOptions');
                const icon = e.currentTarget.querySelector('i');
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    icon.style.transform = 'rotate(180deg)';
                }
            });

            // Code generation controls - basic
            ['codeFramework', 'codeModel', 'codeDevice', 'codeEpochs', 'codeBatch', 'codeImgsz'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => this.generateTrainingCode());
                document.getElementById(id)?.addEventListener('input', () => this.generateTrainingCode());
            });

            // Code generation controls - advanced
            ['codeOptimizer', 'codeLr', 'codePatience', 'codeValSplit',
             'augMosaic', 'augMixup', 'augHsv', 'augFlip', 'augRotate', 'augScale',
             'savePlots', 'saveConfMatrix', 'savePrCurves', 'savePredictions', 'saveMetricsCsv',
             'exportOnnx', 'exportTorchscript', 'exportTflite', 'exportOpenvino', 'exportCoreml', 'exportTensorrt'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => this.generateTrainingCode());
                document.getElementById(id)?.addEventListener('input', () => this.generateTrainingCode());
            });

            // Code actions
            document.getElementById('btnCopyCode')?.addEventListener('click', () => this.copyCode());
            document.getElementById('btnDownloadPy')?.addEventListener('click', () => this.downloadCode('py'));
            document.getElementById('btnDownloadIpynb')?.addEventListener('click', () => this.downloadCode('ipynb'));

            // Initialize Tippy.js tooltips
            if (typeof tippy !== 'undefined') {
                tippy('[data-tippy-content]', {
                    theme: 'light',
                    arrow: true,
                    placement: 'top',
                    maxWidth: 320,
                    animation: 'scale',
                    duration: [200, 150],
                    appendTo: () => document.body,  // Append to body so tooltips appear above modal
                });
            }
        }, 100);
    }

    getAvailableFormats() {
        const projectType = this.projectManager.currentProject?.type;

        // Return formats based on project type
        if (projectType === 'classification' || projectType === 'multiLabel') {
            return [
                { id: 'folders', key: 'folders' },
                { id: 'csv', key: 'csv' }
            ];
        } else if (projectType === 'detection' || projectType === 'obb') {
            return [
                { id: 'yolo', key: 'yolo' },
                { id: 'coco', key: 'coco' },
                { id: 'voc', key: 'voc' }
            ];
        } else if (projectType === 'segmentation' || projectType === 'instanceSeg') {
            return [
                { id: 'yoloSeg', key: 'yoloSeg' },
                { id: 'coco', key: 'coco' },
                { id: 'masksPng', key: 'masksPng' }
            ];
        } else if (projectType === 'keypoints') {
            return [
                { id: 'coco', key: 'coco' },
                { id: 'yolo', key: 'yolo' }
            ];
        }

        // Default: all formats
        return [
            { id: 'yolo', key: 'yolo' },
            { id: 'coco', key: 'coco' },
            { id: 'csv', key: 'csv' }
        ];
    }

    async exportProjectTix() {
        const includeImages = document.getElementById('exportWithImages')?.checked;
        // TODO: Implement .tix export
        this.ui.showToast('Exportando proyecto...', 'info');
        console.log('Export .tix with images:', includeImages);
    }

    async exportForTraining() {
        const format = document.getElementById('trainingFormatSelect')?.value;
        // TODO: Route to appropriate export handler based on format
        this.ui.showToast(`Exportando en formato ${format}...`, 'info');
        console.log('Export for training:', format);
    }

    populateFrameworks() {
        const projectType = this.projectManager.currentProject?.type || 'detection';
        const frameworkSelect = document.getElementById('codeFramework');
        if (!frameworkSelect) return;

        let frameworks = [];

        // Define frameworks based on project type
        if (projectType === 'detection') {
            frameworks = [
                { value: 'yolov8', label: 'YOLOv8 (Ultralytics)' },
                { value: 'yolov5', label: 'YOLOv5' },
                { value: 'yolov11', label: 'YOLOv11' },
                { value: 'yolo-nas', label: 'YOLO-NAS' },
                { value: 'detectron2', label: 'Detectron2 (Faster R-CNN)' }
            ];
        } else if (projectType === 'segmentation' || projectType === 'instanceSeg') {
            frameworks = [
                { value: 'yolov8-seg', label: 'YOLOv8 Segmentation' },
                { value: 'yolov11-seg', label: 'YOLOv11 Segmentation' },
                { value: 'detectron2-mask', label: 'Detectron2 (Mask R-CNN)' },
                { value: 'smp', label: 'segmentation_models.pytorch' }
            ];
        } else if (projectType === 'classification' || projectType === 'multiLabel') {
            frameworks = [
                { value: 'yolov8-cls', label: 'YOLOv8 Classification' },
                { value: 'yolov11-cls', label: 'YOLOv11 Classification' },
                { value: 'timm', label: 'PyTorch timm (ResNet, EfficientNet, ViT)' },
                { value: 'torchvision', label: 'TorchVision Models' }
            ];
        } else if (projectType === 'keypoints') {
            frameworks = [
                { value: 'yolov8-pose', label: 'YOLOv8 Pose' },
                { value: 'yolov11-pose', label: 'YOLOv11 Pose' },
                { value: 'mmpose', label: 'MMPose' }
            ];
        } else if (projectType === 'obb') {
            frameworks = [
                { value: 'yolov8-obb', label: 'YOLOv8 OBB' },
                { value: 'yolov11-obb', label: 'YOLOv11 OBB' },
                { value: 'detectron2-rotated', label: 'Detectron2 (Rotated)' }
            ];
        } else {
            // Default to detection
            frameworks = [
                { value: 'yolov8', label: 'YOLOv8 (Ultralytics)' },
                { value: 'yolov5', label: 'YOLOv5' },
                { value: 'yolov11', label: 'YOLOv11' }
            ];
        }

        // Populate select
        frameworkSelect.innerHTML = frameworks.map(fw =>
            `<option value="${fw.value}">${fw.label}</option>`
        ).join('');
    }

    generateTrainingCode() {
        // Read basic parameters
        const framework = document.getElementById('codeFramework')?.value || 'yolov8';
        const model = document.getElementById('codeModel')?.value || 'm';
        const device = document.getElementById('codeDevice')?.value || 'cuda:0';
        const epochs = document.getElementById('codeEpochs')?.value || '100';
        const batch = document.getElementById('codeBatch')?.value || '16';
        const imgsz = document.getElementById('codeImgsz')?.value || '640';

        // Read advanced parameters
        const optimizer = document.getElementById('codeOptimizer')?.value || 'Adam';
        const lr = document.getElementById('codeLr')?.value || '0.001';
        const patience = document.getElementById('codePatience')?.value || '50';
        const valSplit = document.getElementById('codeValSplit')?.value || '20';

        // Read augmentation options
        const augMosaic = document.getElementById('augMosaic')?.checked || false;
        const augMixup = document.getElementById('augMixup')?.checked || false;
        const augHsv = document.getElementById('augHsv')?.checked || false;
        const augFlip = document.getElementById('augFlip')?.checked || false;
        const augRotate = document.getElementById('augRotate')?.checked || false;
        const augScale = document.getElementById('augScale')?.checked || false;

        // Read metrics/plots options
        const savePlots = document.getElementById('savePlots')?.checked || false;
        const saveConfMatrix = document.getElementById('saveConfMatrix')?.checked || false;
        const savePrCurves = document.getElementById('savePrCurves')?.checked || false;
        const savePredictions = document.getElementById('savePredictions')?.checked || false;
        const saveMetricsCsv = document.getElementById('saveMetricsCsv')?.checked || false;

        // Read export options
        const exportOnnx = document.getElementById('exportOnnx')?.checked || false;
        const exportTorchscript = document.getElementById('exportTorchscript')?.checked || false;
        const exportTflite = document.getElementById('exportTflite')?.checked || false;
        const exportOpenvino = document.getElementById('exportOpenvino')?.checked || false;
        const exportCoreml = document.getElementById('exportCoreml')?.checked || false;
        const exportTensorrt = document.getElementById('exportTensorrt')?.checked || false;

        const projectType = this.projectManager.currentProject?.type || 'detection';
        const projectName = this.projectManager.currentProject?.name || 'mi_proyecto';
        const numClasses = this.canvasManager.classes.length;

        let code = '';

        if (framework === 'yolov8' || framework === 'yolov11' ||
            framework === 'yolov8-seg' || framework === 'yolov11-seg' ||
            framework === 'yolov8-cls' || framework === 'yolov11-cls' ||
            framework === 'yolov8-pose' || framework === 'yolov11-pose' ||
            framework === 'yolov8-obb' || framework === 'yolov11-obb') {

            const task = this.getYOLOTask(projectType);
            const isV11 = framework.includes('yolov11');
            const modelName = isV11 ? `yolo11${model}${task}.pt` : `yolov8${model}${task}.pt`;

            code = `"""
${projectName} - Training Script
Generado automáticamente por Annotix
Framework: ${isV11 ? 'YOLOv11' : 'YOLOv8'} (Ultralytics)
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: Instalar dependencias antes de ejecutar
"""

# ============================================
# 1. INSTALACIÓN DE DEPENDENCIAS
# ============================================
# Ejecutar estos comandos en tu terminal:
# pip install ultralytics
# pip install torch torchvision${savePlots || saveConfMatrix ? '\n# pip install matplotlib seaborn  # Para visualizaciones' : ''}${saveMetricsCsv ? '\n# pip install pandas  # Para exportar métricas' : ''}
# pip install opencv-python pillow numpy

from ultralytics import YOLO
import torch${savePlots || saveConfMatrix || saveMetricsCsv ? '\nimport matplotlib.pyplot as plt' : ''}${saveMetricsCsv ? '\nimport pandas as pd' : ''}
from pathlib import Path

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
${device.includes('cuda') ? `print(f"CUDA device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A'}")` : ''}

# ============================================
# 2. CONFIGURACIÓN DEL ENTRENAMIENTO
# ============================================

# Modelo y dispositivo
MODEL_NAME = '${modelName}'
DEVICE = '${device}'

# Hiperparámetros básicos
EPOCHS = ${epochs}
BATCH_SIZE = ${batch}
IMG_SIZE = ${imgsz}
LEARNING_RATE = ${lr}
PATIENCE = ${patience}  # Early stopping

# Data Augmentation
MOSAIC = ${augMosaic ? '1.0' : '0.0'}  # Combina 4 imágenes en una
MIXUP = ${augMixup ? '0.1' : '0.0'}   # Mezcla transparencias
HSV_H = ${augHsv ? '0.015' : '0.0'}   # Color jitter: Hue
HSV_S = ${augHsv ? '0.7' : '0.0'}     # Color jitter: Saturation
HSV_V = ${augHsv ? '0.4' : '0.0'}     # Color jitter: Value
FLIPLR = ${augFlip ? '0.5' : '0.0'}   # Flip horizontal
FLIPUD = ${augFlip ? '0.1' : '0.0'}   # Flip vertical
DEGREES = ${augRotate ? '10.0' : '0.0'}  # Rotación (grados)
SCALE = ${augScale ? '0.5' : '0.0'}   # Escala aleatoria

# ============================================
# 3. CARGAR MODELO PREENTRENADO
# ============================================

model = YOLO(MODEL_NAME)
print(f"✅ Modelo cargado: {MODEL_NAME}")
print(f"📦 Parámetros: {sum(p.numel() for p in model.model.parameters()):,}")

# ============================================
# 4. ENTRENAR EL MODELO
# ============================================

results = model.train(
    # Dataset
    data='data.yaml',           # Archivo YAML con rutas del dataset

    # Básicos
    epochs=EPOCHS,
    batch=BATCH_SIZE,
    imgsz=IMG_SIZE,
    device=DEVICE,

    # Optimización
    optimizer='${optimizer}',    # Adam, AdamW, SGD, RMSprop
    lr0=LEARNING_RATE,          # Learning rate inicial
    lrf=0.01,                   # Learning rate final (como fracción de lr0)
    momentum=0.937,             # Momentum para SGD
    weight_decay=0.0005,        # Weight decay (L2 regularization)

    # Data Augmentation
    mosaic=MOSAIC,
    mixup=MIXUP,
    hsv_h=HSV_H,
    hsv_s=HSV_S,
    hsv_v=HSV_V,
    degrees=DEGREES,
    translate=0.1,
    scale=SCALE,
    fliplr=FLIPLR,
    flipud=FLIPUD,

    # Callbacks y guardado
    patience=PATIENCE,          # Early stopping patience
    save=True,                  # Guardar checkpoints
    save_period=${Math.ceil(parseInt(epochs) / 10)},               # Guardar cada N epochs

    # Visualización y métricas
    plots=${savePlots},                 # Generar gráficas de entrenamiento${saveConfMatrix ? '\n    conf=0.001,                 # Confianza mínima para confusion matrix' : ''}

    # Performance
    cache=False,                # Cachear imágenes (usa más RAM)
    workers=8,                  # Número de workers para DataLoader
    project='runs/${projectType}',   # Carpeta de resultados
    name='${projectName}',      # Nombre del experimento
    exist_ok=True,              # Sobrescribir experimentos existentes

    # Validación
    val=True,                   # Validar durante entrenamiento
    split_val=${parseFloat(valSplit) / 100.0},            # Porcentaje de validación si no existe val split
    verbose=True                # Modo verbose
)

print("\\n" + "="*50)
print("✅ ENTRENAMIENTO COMPLETADO")
print("="*50)

# ============================================
# 5. EVALUAR EL MODELO
# ============================================

# Validar con el mejor modelo
best_model_path = results.save_dir / 'weights' / 'best.pt'
model_best = YOLO(best_model_path)

print("\\n🔍 Evaluando modelo...")
metrics = model_best.val()

# Imprimir métricas clave
print("\\n📊 MÉTRICAS FINALES:")
print("-" * 40)
${projectType === 'detection' || projectType === 'obb' ? `print(f"mAP50:     {metrics.box.map50:.4f}")
print(f"mAP50-95:  {metrics.box.map:.4f}")
print(f"Precision: {metrics.box.mp:.4f}")
print(f"Recall:    {metrics.box.mr:.4f}")` :
projectType === 'segmentation' || projectType === 'instanceSeg' ? `print(f"mAP50 (box):  {metrics.box.map50:.4f}")
print(f"mAP50 (mask): {metrics.seg.map50:.4f}")
print(f"mAP50-95 (box):  {metrics.box.map:.4f}")
print(f"mAP50-95 (mask): {metrics.seg.map:.4f}")` :
projectType === 'classification' || projectType === 'multiLabel' ? `print(f"Top-1 Accuracy: {metrics.top1:.4f}")
print(f"Top-5 Accuracy: {metrics.top5:.4f}")` :
projectType === 'keypoints' ? `print(f"mAP50 (box):  {metrics.box.map50:.4f}")
print(f"mAP50 (pose): {metrics.pose.map50:.4f}")` :
`print(f"mAP50: {metrics.box.map50:.4f}")`}
print("-" * 40)

${saveMetricsCsv ? `# ============================================
# 6. EXPORTAR MÉTRICAS A CSV
# ============================================

metrics_dict = {
    'epochs': results.epoch,
    'train_loss': results.results_dict.get('train/loss', []),
    'val_loss': results.results_dict.get('val/loss', []),
}

metrics_df = pd.DataFrame(metrics_dict)
metrics_path = results.save_dir / 'metrics.csv'
metrics_df.to_csv(metrics_path, index=False)
print(f"\\n💾 Métricas guardadas en: {metrics_path}")

` : ''}${savePredictions ? `# ============================================
# 7. VISUALIZAR PREDICCIONES
# ============================================

# Predecir en imágenes de validación
val_results = model_best.predict(
    source='path/to/val/images',  # Cambiar a tu carpeta de validación
    save=True,                     # Guardar imágenes con predicciones
    conf=0.25,                     # Confianza mínima
    save_txt=False,                # No guardar labels
    save_crop=False,               # No recortar detecciones
    project=results.save_dir,
    name='predictions'
)
print(f"\\n🎨 Predicciones guardadas en: {results.save_dir / 'predictions'}")

` : ''}${exportOnnx || exportTorchscript || exportTflite || exportOpenvino || exportCoreml || exportTensorrt ? `# ============================================
# 8. EXPORTAR MODELO PARA PRODUCCIÓN
# ============================================

print("\\n📦 Exportando modelo a formatos de producción...")
${exportOnnx ? "\nmodel_best.export(format='onnx')  # ONNX - Universal\nprint('✅ ONNX exportado')" : ''}${exportTorchscript ? "\nmodel_best.export(format='torchscript')  # TorchScript - PyTorch nativo\nprint('✅ TorchScript exportado')" : ''}${exportTflite ? "\nmodel_best.export(format='tflite')  # TensorFlow Lite - Móviles\nprint('✅ TFLite exportado')" : ''}${exportOpenvino ? "\nmodel_best.export(format='openvino')  # OpenVINO - Intel CPUs\nprint('✅ OpenVINO exportado')" : ''}${exportCoreml ? "\nmodel_best.export(format='coreml')  # CoreML - iOS/macOS\nprint('✅ CoreML exportado')" : ''}${exportTensorrt ? "\nmodel_best.export(format='engine')  # TensorRT - NVIDIA GPUs\nprint('✅ TensorRT exportado')" : ''}

` : ''}print("\\n🎉 Todo listo!")
print(f"📁 Resultados en: {results.save_dir}")
print(f"🏆 Mejor modelo: {best_model_path}")
`;
        } else if (framework === 'yolov5') {
            code = `"""
${projectName} - Training Script (YOLOv5)
Generado automáticamente por Annotix
Framework: YOLOv5
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: YOLOv5 usa CLI, no API de Python
"""

# ============================================
# 1. INSTALACIÓN
# ============================================
# Clonar repositorio YOLOv5 (solo primera vez):
# !git clone https://github.com/ultralytics/yolov5
# %cd yolov5
# !pip install -r requirements.txt

# ============================================
# 2. ENTRENAR CON CLI
# ============================================

!python train.py \\
    --img ${imgsz} \\
    --batch ${batch} \\
    --epochs ${epochs} \\
    --data ../data.yaml \\
    --weights yolov5${model}.pt \\
    --device ${device === 'cuda:0' ? '0' : 'cpu'} \\
    --optimizer ${optimizer} \\
    --patience ${patience} \\
    --project ../runs/${projectType} \\
    --name ${projectName} \\${augMosaic ? '\n    --mosaic 1.0 \\' : ''}${augMixup ? '\n    --mixup 0.1 \\' : ''}${augHsv ? '\n    --hsv_h 0.015 --hsv_s 0.7 --hsv_v 0.4 \\' : ''}${augFlip ? '\n    --fliplr 0.5 --flipud 0.1 \\' : ''}${augRotate ? '\n    --degrees 10.0 \\' : ''}${augScale ? '\n    --scale 0.5 \\' : ''}
    --cache \\
    --save-period ${Math.ceil(parseInt(epochs) / 10)}

# ============================================
# 3. VALIDAR
# ============================================

!python val.py \\
    --weights runs/train/${projectName}/weights/best.pt \\
    --data ../data.yaml \\
    --img ${imgsz} \\
    --task val${saveConfMatrix ? ' \\\n    --save-json --save-conf' : ''}

print("✅ Entrenamiento YOLOv5 completado!")
print("📁 Resultados en: runs/train/${projectName}")
`;
        } else if (framework === 'yolo-nas') {
            code = `"""
${projectName} - Training Script (YOLO-NAS)
Generado automáticamente por Annotix
"""

from super_gradients.training import Trainer
from super_gradients.training import dataloaders
from super_gradients.training import models
from super_gradients.training.losses import PPYoloELoss
from super_gradients.training.metrics import DetectionMetrics_050

# 1. Preparar trainer
trainer = Trainer(experiment_name='${projectName}', ckpt_root_dir='checkpoints')

# 2. Configurar dataset
train_data = dataloaders.coco_detection_yolo_format_train(
    dataset_params={
        'data_dir': 'dataset/',
        'images_dir': 'images/train',
        'labels_dir': 'labels/train',
        'classes': ${this.canvasManager.classes.length}
    },
    dataloader_params={
        'batch_size': ${batch},
        'num_workers': 2
    }
)

val_data = dataloaders.coco_detection_yolo_format_val(
    dataset_params={
        'data_dir': 'dataset/',
        'images_dir': 'images/val',
        'labels_dir': 'labels/val',
        'classes': ${this.canvasManager.classes.length}
    },
    dataloader_params={
        'batch_size': ${batch},
        'num_workers': 2
    }
)

# 3. Cargar modelo
model = models.get('yolo_nas_${model}', num_classes=${this.canvasManager.classes.length}, pretrained_weights="coco")

# 4. Entrenar
trainer.train(
    model=model,
    training_params={
        'max_epochs': ${epochs},
        'lr_mode': 'cosine',
        'initial_lr': 5e-4,
        'optimizer': 'Adam',
        'loss': PPYoloELoss(),
        'valid_metrics_list': [DetectionMetrics_050(num_cls=${this.canvasManager.classes.length})],
        'metric_to_watch': 'mAP@0.50',
        'save_checkpoints': True
    },
    train_loader=train_data,
    valid_loader=val_data
)

print("✅ Entrenamiento YOLO-NAS completado!")
`;
        } else if (framework === 'detectron2' || framework === 'detectron2-mask' || framework === 'detectron2-rotated') {
            const isSegmentation = framework === 'detectron2-mask';
            const isRotated = framework === 'detectron2-rotated';
            const modelType = isSegmentation ? 'mask_rcnn' : isRotated ? 'FCOS' : 'faster_rcnn';

            code = `"""
${projectName} - Training Script (Detectron2)
Generado automáticamente por Annotix
Framework: Detectron2 (${isSegmentation ? 'Mask R-CNN' : isRotated ? 'Rotated Detection' : 'Faster R-CNN'})
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: Detectron2 es más avanzado pero complejo
"""

# ============================================
# 1. INSTALACIÓN DE DEPENDENCIAS
# ============================================
# pip install torch torchvision
# pip install 'git+https://github.com/facebookresearch/detectron2.git'
# pip install opencv-python pycocotools matplotlib

import os
import torch
from detectron2.engine import DefaultTrainer
from detectron2.config import get_cfg
from detectron2 import model_zoo
from detectron2.data import DatasetCatalog, MetadataCatalog
from detectron2.data.datasets import register_coco_instances
from detectron2.evaluation import COCOEvaluator
${savePlots ? 'import matplotlib.pyplot as plt' : ''}

print(f"PyTorch version: {torch.__version__}")
print(f"Detectron2 version: {torch.ops.detectron2._get_torch_version()}")

# ============================================
# 2. REGISTRAR DATASET
# ============================================

# Registrar tu dataset en formato COCO
register_coco_instances(
    "${projectName}_train",
    {},
    "./annotations/instances_train.json",
    "./images/train"
)

register_coco_instances(
    "${projectName}_val",
    {},
    "./annotations/instances_val.json",
    "./images/val"
)

# ============================================
# 3. CONFIGURACIÓN DEL MODELO
# ============================================

cfg = get_cfg()
cfg.merge_from_file(model_zoo.get_config_file(
    "COCO-${isSegmentation ? 'InstanceSegmentation' : isRotated ? 'Detection' : 'Detection'}/${modelType}_R_50_FPN_3x.yaml"
))

# Datasets
cfg.DATASETS.TRAIN = ("${projectName}_train",)
cfg.DATASETS.TEST = ("${projectName}_val",)
cfg.DATALOADER.NUM_WORKERS = 4

# Modelo preentrenado
cfg.MODEL.WEIGHTS = model_zoo.get_checkpoint_url(
    "COCO-${isSegmentation ? 'InstanceSegmentation' : 'Detection'}/${modelType}_R_50_FPN_3x.yaml"
)

# Hiperparámetros
cfg.SOLVER.IMS_PER_BATCH = ${batch}
cfg.SOLVER.BASE_LR = ${lr}
cfg.SOLVER.MAX_ITER = ${Math.ceil(parseInt(epochs) * 1000)}  # Aprox epochs
cfg.SOLVER.STEPS = []  # Learning rate schedule
cfg.SOLVER.CHECKPOINT_PERIOD = ${Math.ceil(parseInt(epochs) * 100)}

# Número de clases
cfg.MODEL.ROI_HEADS.NUM_CLASSES = ${numClasses}
${isSegmentation ? `cfg.MODEL.MASK_ON = True` : ''}

# Data Augmentation
cfg.INPUT.MIN_SIZE_TRAIN = (${Math.floor(parseInt(imgsz) * 0.8)}, ${imgsz})
cfg.INPUT.MAX_SIZE_TRAIN = ${Math.ceil(parseInt(imgsz) * 1.2)}
cfg.INPUT.MIN_SIZE_TEST = ${imgsz}
cfg.INPUT.MAX_SIZE_TEST = ${imgsz}${augFlip ? '\ncfg.INPUT.RANDOM_FLIP = "horizontal"' : ''}

# Output
cfg.OUTPUT_DIR = "./output/${projectName}"
os.makedirs(cfg.OUTPUT_DIR, exist_ok=True)

# ============================================
# 4. ENTRENAR
# ============================================

trainer = DefaultTrainer(cfg)
trainer.resume_or_load(resume=False)
trainer.train()

print("\\n✅ Entrenamiento completado!")
print(f"📁 Resultados en: {cfg.OUTPUT_DIR}")

# ============================================
# 5. EVALUAR
# ============================================

from detectron2.evaluation import inference_on_dataset
from detectron2.data import build_detection_test_loader

evaluator = COCOEvaluator("${projectName}_val", cfg, False, output_dir=cfg.OUTPUT_DIR)
val_loader = build_detection_test_loader(cfg, "${projectName}_val")
results = inference_on_dataset(trainer.model, val_loader, evaluator)

print("\\n📊 MÉTRICAS FINALES:")
print(results)
`;
        } else if (framework === 'timm' || framework === 'torchvision') {
            const useTorchvision = framework === 'torchvision';

            code = `"""
${projectName} - Training Script
Generado automáticamente por Annotix
Framework: ${useTorchvision ? 'TorchVision' : 'PyTorch timm'}
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: Clasificación con arquitecturas modernas
"""

# ============================================
# 1. INSTALACIÓN DE DEPENDENCIAS
# ============================================
# pip install torch torchvision${!useTorchvision ? '\n# pip install timm  # PyTorch Image Models' : ''}
# pip install pillow numpy${saveMetricsCsv ? ' pandas' : ''}${savePlots ? ' matplotlib seaborn' : ''}

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import transforms, datasets${useTorchvision ? ', models' : ''}${!useTorchvision ? '\nimport timm' : ''}
from pathlib import Path${saveMetricsCsv ? '\nimport pandas as pd' : ''}${savePlots ? '\nimport matplotlib.pyplot as plt' : ''}

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

# ============================================
# 2. CONFIGURACIÓN
# ============================================

DEVICE = torch.device('${device.replace('cuda:0', 'cuda')}')
NUM_CLASSES = ${numClasses}
BATCH_SIZE = ${batch}
EPOCHS = ${epochs}
LEARNING_RATE = ${lr}
IMG_SIZE = ${imgsz}

# ============================================
# 3. DATA AUGMENTATION Y LOADERS
# ============================================

# Transformaciones de entrenamiento
train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),${augFlip ? '\n    transforms.RandomHorizontalFlip(0.5),' : ''}${augRotate ? '\n    transforms.RandomRotation(10),' : ''}${augScale ? '\n    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.8, 1.0)),' : ''}${augHsv ? '\n    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),' : ''}
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                       std=[0.229, 0.224, 0.225])
])

# Transformaciones de validación
val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                       std=[0.229, 0.224, 0.225])
])

# Cargar dataset (estructura: train/class1, train/class2, ...)
train_dataset = datasets.ImageFolder('path/to/train', transform=train_transform)
val_dataset = datasets.ImageFolder('path/to/val', transform=val_transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE,
                         shuffle=True, num_workers=4, pin_memory=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE,
                       shuffle=False, num_workers=4, pin_memory=True)

print(f"📦 Train samples: {len(train_dataset)}")
print(f"📦 Val samples: {len(val_dataset)}")
print(f"📦 Classes: {train_dataset.classes}")

# ============================================
# 4. MODELO
# ============================================

${useTorchvision ? `# TorchVision models
model = models.resnet50(pretrained=True)  # Opciones: resnet18, resnet50, efficientnet_b0
model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)` : `# timm models (más modelos disponibles)
model = timm.create_model('efficientnet_b${model === 'n' ? '0' : model === 's' ? '1' : model === 'm' ? '2' : model === 'l' ? '3' : '4'}',
                         pretrained=True,
                         num_classes=NUM_CLASSES)`}

model = model.to(DEVICE)
print(f"✅ Modelo cargado")
print(f"📦 Parámetros: {sum(p.numel() for p in model.parameters()):,}")

# ============================================
# 5. LOSS Y OPTIMIZER
# ============================================

criterion = nn.CrossEntropyLoss()
optimizer = optim.${optimizer}(model.parameters(), lr=LEARNING_RATE)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

# ============================================
# 6. ENTRENAMIENTO
# ============================================

best_acc = 0.0
history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}

for epoch in range(EPOCHS):
    # Training
    model.train()
    train_loss = 0.0
    train_correct = 0
    train_total = 0

    for inputs, labels in train_loader:
        inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()
        _, predicted = outputs.max(1)
        train_total += labels.size(0)
        train_correct += predicted.eq(labels).sum().item()

    # Validation
    model.eval()
    val_loss = 0.0
    val_correct = 0
    val_total = 0

    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
            outputs = model(inputs)
            loss = criterion(outputs, labels)

            val_loss += loss.item()
            _, predicted = outputs.max(1)
            val_total += labels.size(0)
            val_correct += predicted.eq(labels).sum().item()

    # Metrics
    train_acc = 100. * train_correct / train_total
    val_acc = 100. * val_correct / val_total

    history['train_loss'].append(train_loss / len(train_loader))
    history['val_loss'].append(val_loss / len(val_loader))
    history['train_acc'].append(train_acc)
    history['val_acc'].append(val_acc)

    print(f"Epoch [{epoch+1}/{EPOCHS}] - "
          f"Train Loss: {train_loss/len(train_loader):.4f}, "
          f"Train Acc: {train_acc:.2f}%, "
          f"Val Loss: {val_loss/len(val_loader):.4f}, "
          f"Val Acc: {val_acc:.2f}%")

    # Save best model
    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), 'best_model.pth')
        print(f"💾 Mejor modelo guardado (accuracy: {best_acc:.2f}%)")

    scheduler.step()

print("\\n✅ Entrenamiento completado!")
print(f"🏆 Mejor accuracy: {best_acc:.2f}%")

${saveMetricsCsv ? `# Guardar métricas
metrics_df = pd.DataFrame(history)
metrics_df.to_csv('training_metrics.csv', index=False)
print("💾 Métricas guardadas en: training_metrics.csv")` : ''}

${savePlots ? `# Graficar resultados
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

ax1.plot(history['train_loss'], label='Train')
ax1.plot(history['val_loss'], label='Val')
ax1.set_title('Loss')
ax1.legend()

ax2.plot(history['train_acc'], label='Train')
ax2.plot(history['val_acc'], label='Val')
ax2.set_title('Accuracy')
ax2.legend()

plt.savefig('training_curves.png')
print("📊 Gráficos guardados en: training_curves.png")` : ''}
`;
        } else if (framework === 'smp') {
            code = `"""
${projectName} - Training Script
Generado automáticamente por Annotix
Framework: segmentation_models.pytorch
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: Segmentación semántica con arquitecturas modernas
"""

# ============================================
# 1. INSTALACIÓN DE DEPENDENCIAS
# ============================================
# pip install segmentation-models-pytorch
# pip install torch torchvision
# pip install albumentations opencv-python${saveMetricsCsv ? ' pandas' : ''}${savePlots ? ' matplotlib' : ''}

import torch
import segmentation_models_pytorch as smp
from torch.utils.data import Dataset, DataLoader
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np
from pathlib import Path${saveMetricsCsv ? '\nimport pandas as pd' : ''}

print(f"PyTorch version: {torch.__version__}")
print(f"SMP version: {smp.__version__}")

# ============================================
# 2. CONFIGURACIÓN
# ============================================

DEVICE = torch.device('${device.replace('cuda:0', 'cuda')}')
NUM_CLASSES = ${numClasses}
BATCH_SIZE = ${batch}
EPOCHS = ${epochs}
LEARNING_RATE = ${lr}
IMG_SIZE = ${imgsz}

# ============================================
# 3. DATASET PERSONALIZADO
# ============================================

class SegmentationDataset(Dataset):
    def __init__(self, images_dir, masks_dir, transform=None):
        self.images_dir = Path(images_dir)
        self.masks_dir = Path(masks_dir)
        self.transform = transform
        self.images = sorted(list(self.images_dir.glob('*.png')) + list(self.images_dir.glob('*.jpg')))

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_path = self.images[idx]
        mask_path = self.masks_dir / f"{img_path.stem}.png"

        image = cv2.imread(str(img_path))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)

        if self.transform:
            transformed = self.transform(image=image, mask=mask)
            image = transformed['image']
            mask = transformed['mask']

        return image, mask.long()

# Data Augmentation
train_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),${augFlip ? '\n    A.HorizontalFlip(p=0.5),' : ''}${augRotate ? '\n    A.Rotate(limit=10, p=0.5),' : ''}${augScale ? '\n    A.RandomScale(scale_limit=0.2, p=0.5),' : ''}${augHsv ? '\n    A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1, p=0.5),' : ''}
    A.Normalize(),
    ToTensorV2(),
])

val_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.Normalize(),
    ToTensorV2(),
])

train_dataset = SegmentationDataset('path/to/train/images', 'path/to/train/masks', train_transform)
val_dataset = SegmentationDataset('path/to/val/images', 'path/to/val/masks', val_transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)

# ============================================
# 4. MODELO
# ============================================

# Arquitecturas disponibles: Unet, UnetPlusPlus, MAnet, Linknet, FPN, PSPNet, DeepLabV3, DeepLabV3Plus
model = smp.Unet(
    encoder_name="resnet${model === 'n' ? '18' : model === 's' ? '34' : model === 'm' ? '50' : model === 'l' ? '101' : '152'}",
    encoder_weights="imagenet",
    in_channels=3,
    classes=NUM_CLASSES,
)

model = model.to(DEVICE)
print(f"✅ Modelo U-Net cargado")

# ============================================
# 5. LOSS Y OPTIMIZER
# ============================================

loss_fn = smp.losses.DiceLoss(mode='multiclass')
optimizer = torch.optim.${optimizer}(model.parameters(), lr=LEARNING_RATE)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

metrics = [
    smp.utils.metrics.IoU(threshold=0.5),
    smp.utils.metrics.Fscore(threshold=0.5),
]

# ============================================
# 6. ENTRENAMIENTO
# ============================================

best_iou = 0.0
history = {'train_loss': [], 'val_loss': [], 'val_iou': []}

for epoch in range(EPOCHS):
    # Training
    model.train()
    train_loss = 0.0

    for images, masks in train_loader:
        images, masks = images.to(DEVICE), masks.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(images)
        loss = loss_fn(outputs, masks)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()

    # Validation
    model.eval()
    val_loss = 0.0
    val_ious = []

    with torch.no_grad():
        for images, masks in val_loader:
            images, masks = images.to(DEVICE), masks.to(DEVICE)
            outputs = model(images)
            loss = loss_fn(outputs, masks)
            val_loss += loss.item()

            # Calculate IoU
            tp, fp, fn, tn = smp.metrics.get_stats(outputs.argmax(1), masks, mode='multiclass', num_classes=NUM_CLASSES)
            iou = smp.metrics.iou_score(tp, fp, fn, tn, reduction="micro")
            val_ious.append(iou.item())

    avg_val_iou = np.mean(val_ious)

    history['train_loss'].append(train_loss / len(train_loader))
    history['val_loss'].append(val_loss / len(val_loader))
    history['val_iou'].append(avg_val_iou)

    print(f"Epoch [{epoch+1}/{EPOCHS}] - "
          f"Train Loss: {train_loss/len(train_loader):.4f}, "
          f"Val Loss: {val_loss/len(val_loader):.4f}, "
          f"Val IoU: {avg_val_iou:.4f}")

    if avg_val_iou > best_iou:
        best_iou = avg_val_iou
        torch.save(model.state_dict(), 'best_unet.pth')
        print(f"💾 Mejor modelo guardado (IoU: {best_iou:.4f})")

    scheduler.step()

print("\\n✅ Entrenamiento completado!")
print(f"🏆 Mejor IoU: {best_iou:.4f}")
`;
        }

        const codePreview = document.getElementById('codePreview');
        if (codePreview) {
            codePreview.textContent = code;
        }
    }

    getYOLOTask(projectType) {
        if (projectType === 'classification' || projectType === 'multiLabel') return '-cls';
        if (projectType === 'segmentation' || projectType === 'instanceSeg') return '-seg';
        if (projectType === 'keypoints') return '-pose';
        if (projectType === 'obb') return '-obb';
        return '';  // detection
    }

    getProjectTypeLabel(projectType) {
        const labels = {
            'classification': 'Clasificación Simple',
            'multiLabel': 'Clasificación Multi-Etiqueta',
            'detection': 'Detección de Objetos',
            'segmentation': 'Segmentación Semántica',
            'instanceSeg': 'Segmentación de Instancias',
            'keypoints': 'Puntos Clave',
            'obb': 'Cajas Rotadas (OBB)'
        };
        return labels[projectType] || projectType;
    }

    async copyCode() {
        const code = document.getElementById('codePreview')?.textContent;
        if (code) {
            try {
                await navigator.clipboard.writeText(code);
                this.ui.showToast('Código copiado al portapapeles', 'success');
            } catch (err) {
                this.ui.showToast('Error al copiar código', 'error');
            }
        }
    }

    downloadCode(format) {
        const code = document.getElementById('codePreview')?.textContent;
        const projectName = this.projectManager.currentProject?.name || 'training';

        if (format === 'py') {
            const blob = new Blob([code], { type: 'text/x-python' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}_train.py`;
            a.click();
            URL.revokeObjectURL(url);
            this.ui.showToast('Archivo .py descargado', 'success');
        } else if (format === 'ipynb') {
            // Create Jupyter notebook format
            const notebook = {
                cells: [
                    {
                        cell_type: 'markdown',
                        metadata: {},
                        source: [`# ${projectName} - Training Notebook\n\nGenerado automáticamente por Annotix`]
                    },
                    {
                        cell_type: 'code',
                        execution_count: null,
                        metadata: {},
                        outputs: [],
                        source: code.split('\n')
                    }
                ],
                metadata: {
                    kernelspec: {
                        display_name: 'Python 3',
                        language: 'python',
                        name: 'python3'
                    },
                    language_info: {
                        name: 'python',
                        version: '3.8.0'
                    }
                },
                nbformat: 4,
                nbformat_minor: 4
            };

            const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}_train.ipynb`;
            a.click();
            URL.revokeObjectURL(url);
            this.ui.showToast('Notebook .ipynb descargado', 'success');
        }
    }

    startTour() {
        if (window.startAppTour) {
            window.startAppTour();
        } else {
            this.ui.showToast('Tour no disponible', 'info');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new YOLOAnnotator();
    window.app.init();
});