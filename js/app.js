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

        document.getElementById('btnEraseMode')?.addEventListener('click', () => {
            const isEraseMode = !this.canvasManager.toolManager.isEraseMode();
            this.canvasManager.toolManager.setEraseMode(isEraseMode);
            const btn = document.getElementById('btnEraseMode');
            if (btn) {
                btn.classList.toggle('active', isEraseMode);
            }
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
                // Arrow keys disabled in classification mode to prevent accidental navigation
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    return;
                }

                // A: Cycle to previous class
                if (e.key === 'a' || e.key === 'A') {
                    e.preventDefault();
                    this.classificationManager.cycleClassPrevious();
                    return;
                }

                // D: Cycle to next class
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

            // Arrow keys: Navigate images (only in canvas mode)
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

            // Canvas mode shortcuts (detection, segmentation, etc.)

            // Numbers 1-9: select class
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (index < this.canvasManager.classes.length) {
                    this.canvasManager.currentClass = index;
                    this.updateClassUI();
                }
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

            // A/D: Rotate image
            if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                this.rotateImageLeft();
            }
            if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                this.rotateImageRight();
            }

            // Tools
            if (e.key === 'b') this.setTool('bbox');
            if (e.key === 'o') this.setTool('obb');
            if (e.key === 'm') this.setTool('mask');
            if (e.key === 'v') this.setTool('select');
            if (e.key === 'h') this.setTool('pan');
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
        const toolsBar = document.querySelector('.tools-bar');
        const annotationsBar = document.getElementById('annotationsBar');

        if (this.annotationMode === 'classification') {
            // Hide ALL drawing/editing tools in classification mode
            if (toolsBar) {
                // Hide all annotation tools
                const bboxBtn = toolsBar.querySelector('[data-tool="bbox"]');
                const obbBtn = toolsBar.querySelector('[data-tool="obb"]');
                const maskBtn = toolsBar.querySelector('[data-tool="mask"]');
                const selectBtn = toolsBar.querySelector('[data-tool="select"]');
                const panBtn = toolsBar.querySelector('[data-tool="pan"]');
                const maskControls = document.getElementById('maskControls');
                const rotationControls = document.getElementById('rotationControls');
                const eraseBtn = document.getElementById('btnEraseMode');
                const toggleLabelsBtn = document.getElementById('btnToggleLabels');
                const toggleGridBtn = document.getElementById('btnToggleGrid');

                // Hide all annotation tools
                if (bboxBtn) bboxBtn.style.display = 'none';
                if (obbBtn) obbBtn.style.display = 'none';
                if (maskBtn) maskBtn.style.display = 'none';
                if (selectBtn) selectBtn.style.display = 'none';
                if (panBtn) panBtn.style.display = 'none';
                if (maskControls) maskControls.style.display = 'none';
                if (rotationControls) rotationControls.style.display = 'none';
                if (eraseBtn) eraseBtn.style.display = 'none';
                if (toggleLabelsBtn) toggleLabelsBtn.style.display = 'none';
                if (toggleGridBtn) toggleGridBtn.style.display = 'none';

                // Keep zoom controls visible
                const zoomIn = document.getElementById('btnZoomIn');
                const zoomOut = document.getElementById('btnZoomOut');
                const zoomReset = document.getElementById('btnZoomReset');
                if (zoomIn) zoomIn.style.display = 'flex';
                if (zoomOut) zoomOut.style.display = 'flex';
                if (zoomReset) zoomReset.style.display = 'flex';
            }

            // Hide annotations bar (bottom panel)
            if (annotationsBar) annotationsBar.style.display = 'none';

        } else {
            // Show all tools for canvas mode
            if (toolsBar) {
                // Show toggle buttons
                const toggleLabelsBtn = document.getElementById('btnToggleLabels');
                const toggleGridBtn = document.getElementById('btnToggleGrid');
                if (toggleLabelsBtn) toggleLabelsBtn.style.display = 'flex';
                if (toggleGridBtn) toggleGridBtn.style.display = 'flex';

                // Show tool buttons
                const tools = toolsBar.querySelectorAll('[data-tool]');
                tools.forEach(tool => tool.style.display = 'flex');

                // Let CanvasManager handle specific tool visibility
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

        // Define project types with their internal IDs
        const projectTypes = [
            { id: 'classification', key: 'classification' },
            { id: 'multiLabel', key: 'multiLabel' },
            { id: 'detection', key: 'detection' },
            { id: 'segmentation', key: 'segmentation' },
            { id: 'instanceSeg', key: 'instanceSeg' },
            { id: 'keypoints', key: 'keypoints' },
            { id: 'obb', key: 'obb' }
        ];

        const content = `
            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.name')}</label>
                <input type="text" id="projectName" class="form-control" placeholder="${window.i18n.t('project.namePlaceholder')}">
            </div>
            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.type')}</label>
                <p class="form-helper-text" style="margin-bottom: 12px; color: #666; font-size: 0.9em;">
                    ${window.i18n.t('project.typeSelectHelper')}
                </p>
                <div class="project-type-selector">
                    ${projectTypes.map(type => {
                        const name = window.i18n.t(`project.types.${type.key}.name`);
                        const description = window.i18n.t(`project.types.${type.key}.description`);
                        const useCases = window.i18n.t(`project.types.${type.key}.useCases`);
                        const models = window.i18n.t(`project.types.${type.key}.models`);
                        const difficulty = window.i18n.t(`project.types.${type.key}.difficulty`);

                        const difficultyColor =
                            difficulty === 'Principiante' || difficulty === 'Beginner' ? '#10b981' :
                            difficulty === 'Intermedio' || difficulty === 'Intermediate' ? '#f59e0b' : '#ef4444';

                        return `
                            <label class="project-type-card">
                                <input type="radio" name="projectType" value="${type.id}" ${type.id === 'detection' ? 'checked' : ''}>
                                <div class="type-card-content">
                                    <div class="type-card-header">
                                        <strong class="type-name">${name}</strong>
                                        <span class="type-difficulty" style="background: ${difficultyColor}">${difficulty}</span>
                                    </div>
                                    <p class="type-description">${description}</p>
                                    <div class="type-details">
                                        <div class="type-detail-item">
                                            <i class="fas fa-lightbulb" style="color: #f59e0b;"></i>
                                            <span>${useCases}</span>
                                        </div>
                                        <div class="type-detail-item">
                                            <i class="fas fa-brain" style="color: #8b5cf6;"></i>
                                            <span>${models}</span>
                                        </div>
                                    </div>
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
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="dimensionMode" value="auto" checked style="margin-right: 8px;">
                        ${window.i18n.t('project.dimensionsAuto')}
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="dimensionMode" value="fixed" style="margin-right: 8px;">
                        ${window.i18n.t('project.dimensionsFixed')}
                    </label>
                </div>
            </div>
            <div class="form-group" id="fixedDimensionsOptions" style="display: none; margin-left: 30px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
                <div style="margin-bottom: 15px;">
                    <label class="form-label">${window.i18n.t('project.targetSize')}</label>
                    <select id="projectTargetSize" class="form-control form-select">
                        ${sizeOptions.map(size => `
                            <option value="${size}" ${size === 640 ? 'selected' : ''}>${size}x${size}px</option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label class="form-label">${window.i18n.t('project.resizeStrategy')}</label>
                    <select id="projectStrategy" class="form-control form-select">
                        <option value="resize">${window.i18n.t('preprocessing.strategies.resize.name')}</option>
                        <option value="padding">${window.i18n.t('preprocessing.strategies.padding.name')}</option>
                    </select>
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
                                await this.applyAugmentationToImage(imageData, config, keepAnnotations, i + 1);
                            }
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

    async applyAugmentationToImage(imageData, config, keepAnnotations, variationIndex = null) {
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

            // Generate new filename
            const baseName = imageData.name.replace(/\.[^/.]+$/, ''); // Remove extension
            const extension = imageData.name.match(/\.[^/.]+$/)?.[0] || '.png';
            const suffix = ImagePreprocessor.generateAugmentationSuffix(config);
            const varSuffix = variationIndex ? `_v${variationIndex}` : '';
            const newName = baseName + suffix + varSuffix + extension;

            // Save as new image
            const newImageData = {
                projectId: this.projectManager.currentProject.id,
                name: newName,
                image: result.blob,
                annotations: result.annotations,
                width: result.width,
                height: result.height,
                timestamp: Date.now()
            };

            await this.db.saveImage(newImageData);

        } catch (error) {
            console.error('Error applying augmentation:', error);
            throw error;
        }
    }

    async applyRandomAugmentationToImage(imageData, randomOptions, variations, keepAnnotations) {
        try {
            this.ui.showToast(window.i18n.t('augmentation.generatingVariations', { count: variations }), 'info');

            for (let i = 0; i < variations; i++) {
                const config = this.generateRandomConfig(randomOptions);
                await this.applyAugmentationToImage(imageData, config, keepAnnotations, i + 1);
            }

            // Refresh gallery
            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            this.updateStats();

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

        // Random flip
        if (options.flip) {
            config.flipHorizontal = Math.random() > 0.5;
            config.flipVertical = Math.random() > 0.5;
        }

        // Random rotation
        if (options.rotation) {
            config.rotation = Math.floor(Math.random() * (options.rotationMax - options.rotationMin + 1)) + options.rotationMin;
        }

        // Random color adjustments
        if (options.color) {
            config.brightness = Math.floor(Math.random() * (options.brightnessMax - options.brightnessMin + 1)) + options.brightnessMin;
            config.contrast = Math.floor(Math.random() * (options.contrastMax - options.contrastMin + 1)) + options.contrastMin;
            config.saturation = Math.floor(Math.random() * (options.saturationMax - options.saturationMin + 1)) + options.saturationMin;
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

            const preprocessor = new ImagePreprocessor();
            const projectType = this.projectManager.currentProject.type;

            this.ui.showToast(window.i18n.t('augmentation.batchProcessing', { count: images.length }), 'info');

            let processed = 0;
            for (const imageData of images) {
                const annotations = keepAnnotations ? imageData.annotations : [];
                const result = await preprocessor.applyAugmentation(
                    imageData.image,
                    config,
                    annotations,
                    projectType
                );

                // Generate new filename
                const baseName = imageData.name.replace(/\.[^/.]+$/, '');
                const extension = imageData.name.match(/\.[^/.]+$/)?.[0] || '.png';
                const suffix = ImagePreprocessor.generateAugmentationSuffix(config);
                const newName = baseName + suffix + extension;

                // Save as new image
                const newImageData = {
                    projectId: this.projectManager.currentProject.id,
                    name: newName,
                    image: result.blob,
                    annotations: result.annotations,
                    width: result.width,
                    height: result.height,
                    timestamp: Date.now()
                };

                await this.db.saveImage(newImageData);
                processed++;
            }

            // Refresh gallery
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
                    await this.applyAugmentationToImage(imageData, config, keepAnnotations, i + 1);
                    processed++;
                }
            }

            // Refresh gallery
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