/**
 * YOLO ANNOTATOR - MAIN APPLICATION
 * Connects all managers and handles application logic
 */

class YOLOAnnotator {
    constructor() {
        this.db = new DatabaseManager();
        this.ui = new UIManager();
        this.projectManager = null;
        this.exportManager = null;
        this.trainingCodeGenerator = null;
        this.shortcutsManager = null;
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
            // Initialize database
            await this.db.init();

            // Initialize managers
            this.projectManager = new ProjectManager(this.db, this.ui);
            this.exportManager = new ExportManager(this.db, this.ui);
            this.shortcutsManager = new ShortcutsManager(this.ui);

            // Canvas will be created dynamically when project is loaded (using CanvasFactory)
            const canvas = document.getElementById('canvas');
            this.canvas = canvas;
            this.canvasManager = null; // Will be set in loadProject()

            const canvasContainer = document.querySelector('.canvas-container');
            this.classificationManager = new ClassificationManager(canvasContainer, this.ui);

            const galleryContainer = document.getElementById('galleryGrid');
            this.galleryManager = new GalleryManager(galleryContainer, this.db, this, this.ui);

            // Initialize training code generator (requires projectManager and canvasManager)
            this.trainingCodeGenerator = new TrainingCodeGenerator(this.projectManager, this.canvasManager, this.ui);

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
        } catch (error) {
            console.error('Error initializing app:', error);
            this.ui.showToast(window.i18n.t('notifications.error.initApp'), 'error');
        }
    }

    setupEventListeners() {
        // Project management
        document.getElementById('btnNewProject')?.addEventListener('click', () => this.showNewProjectModal());
        document.getElementById('btnOpenProject')?.addEventListener('click', () => this.openProjectFile());
        document.getElementById('btnManageProjects')?.addEventListener('click', () => this.showManageProjectsModal());
        document.getElementById('btnExport')?.addEventListener('click', () => this.showExportModal());
        document.getElementById('btnHelp')?.addEventListener('click', () => this.shortcutsManager.startTour());

        // Project import file input
        document.getElementById('projectImportInput')?.addEventListener('change', (e) => this.handleProjectImport(e));

        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                // Skip if no tool attribute (e.g., erase mode button has its own handler)
                if (!tool) return;
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
        document.getElementById('btnShowShortcuts')?.addEventListener('click', () => this.shortcutsManager.showShortcutsModal());

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
                if (!this.canvasManager) return;
                const size = parseInt(e.target.value);
                this.canvasManager.toolManager.setBrushSize(size);
                brushValue.textContent = `${size}px`;
            });
        }

        // Erase mode button (mask tool)
        document.getElementById('btnEraseMode')?.addEventListener('click', () => {
            if (!this.canvasManager) return;
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
            if (!this.canvasManager) return;
            this.canvasManager.startNewMaskInstance();
            this.ui.showToast('Nueva instancia iniciada', 'success');
        });

        // Image rotation controls
        const rotationSlider = document.getElementById('rotationSlider');
        const rotationValue = document.getElementById('rotationValue');
        if (rotationSlider && rotationValue) {
            rotationSlider.addEventListener('input', (e) => {
                if (!this.canvasManager) return;
                const angle = parseInt(e.target.value);
                this.canvasManager.setImageRotation(angle);
                rotationValue.textContent = `${angle}°`;
            });
        }

        document.getElementById('btnResetRotation')?.addEventListener('click', () => {
            if (!this.canvasManager) return;
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
            // Skip if no canvas manager loaded
            if (!this.canvasManager) return;

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

                // Destroy canvas if exists
                if (this.canvasManager) {
                    this.canvasManager.destroy();
                    this.canvasManager = null;
                }
            } else {
                // Switch to canvas mode
                this.annotationMode = 'canvas';
                if (this.classificationManager.classificationUI) {
                    this.classificationManager.destroy();
                }

                // Destroy previous canvas if exists and type changed
                if (this.canvasManager) {
                    // Check if project type changed
                    if (this.canvasManager.projectType !== project.type) {
                        this.canvasManager.destroy();
                        this.canvasManager = null;
                    }
                }

                // Create canvas using factory if not exists
                if (!this.canvasManager) {
                    try {
                        this.canvasManager = CanvasFactory.create(project.type, this.canvas, this.ui);
                    } catch (canvasError) {
                        console.error('Failed to create canvas:', canvasError);
                        this.ui.showToast(`Error creating canvas: ${canvasError.message}`, 'error');
                        throw canvasError;
                    }
                }

                // Set classes
                if (this.canvasManager) {
                    this.canvasManager.classes = project.classes || [];
                    this.canvasManager.currentClass = (project.classes && project.classes.length > 0) ? project.classes[0].id : 0;
                } else {
                    console.error('Canvas manager is null after creation attempt');
                    this.ui.showToast('Failed to initialize canvas', 'error');
                }
            }

            // Update UI visibility based on mode
            this.updateUIForMode();

            this.updateClassUI();
            await this.galleryManager.loadImages(projectId);
            this.updateStats();
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

    openProjectFile() {
        const input = document.getElementById('projectImportInput');
        if (input) {
            input.click();
        }
    }

    async handleProjectImport(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const project = await this.projectManager.importProject(file);

            // Reload projects list
            await this.loadProjects();

            // Auto-select the imported project
            const selector = document.getElementById('projectSelector');
            if (selector && project.id) {
                selector.value = project.id;
                await this.loadProject(project.id);
            }
        } catch (error) {
            console.error('Error importing project:', error);
        } finally {
            // Reset file input
            event.target.value = '';
        }
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
                            color: Utils.randomColor()
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


    setTool(tool) {
        if (!this.canvasManager) return;

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
                const img = await Utils.loadImageFile(file);
                loadedImages.push({ img, file });
            } catch (error) {
                console.error(`Error loading ${file.name}:`, error);
                this.ui.showToast(`Error loading ${file.name}: ${error.message}`, 'error');
            }
        }

        if (loadedImages.length === 0) {
            this.ui.showToast('No images could be loaded', 'error');
            return;
        }

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

        // Get current image count to generate sequential codes
        const existingImages = await this.db.getProjectImages(this.projectManager.currentProject.id);
        let imageCounter = existingImages.length + 1;

        // Save all images
        let loadedCount = 0;
        let firstImageId = null;

        for (const { img, file, blob, width, height } of processedImages) {
            try {
                const finalBlob = blob || await Utils.fileToBlob(file);
                const finalWidth = width || img.width;
                const finalHeight = height || img.height;

                // Generate clean sequential filename
                const extension = file.name.match(/\.[^/.]+$/)?.[0] || '.jpg';
                const paddedNumber = String(imageCounter).padStart(4, '0');
                const cleanFilename = `img_${paddedNumber}${extension}`;

                const imageData = {
                    projectId: this.projectManager.currentProject.id,
                    name: cleanFilename,              // Clean code for exports: img_0001.jpg
                    originalFileName: file.name,      // Original name for display in UI
                    displayName: file.name,           // For showing in gallery/UI
                    mimeType: finalBlob.type,
                    image: finalBlob,
                    annotations: [],
                    width: finalWidth,
                    height: finalHeight,
                    timestamp: Date.now()
                };

                console.log(`Saving image: ${cleanFilename} (original: ${file.name})`);

                const imageId = await this.db.saveImage(imageData);

                if (loadedCount === 0) {
                    firstImageId = imageId;
                }

                loadedCount++;
                imageCounter++;
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
        } else {
            this.ui.showToast('Failed to save any images', 'error');
        }
    }



    async showManageProjectsModal() {
        try {
            const projects = await this.db.getAllProjects();

            if (projects.length === 0) {
                this.ui.showToast(window.i18n.t('project.noProjects'), 'info');
                return;
            }

            // Get detailed info for each project
            const projectsInfo = await Promise.all(
                projects.map(p => this.projectManager.getProjectInfo(p.id))
            );

            const content = `
                <div class="project-management-container">
                    <div class="project-list">
                        ${projectsInfo.map(project => `
                            <div class="project-card" data-project-id="${project.id}">
                                <div class="project-card-header">
                                    <div class="project-info">
                                        <h4 class="project-name">${project.name}</h4>
                                        <div class="project-meta">
                                            <span class="project-type" data-type="${project.type}">
                                                <i class="fas ${Utils.getProjectTypeIcon(project.type)}"></i>
                                                ${window.i18n.t(`project.types.${project.type}.name`)}
                                            </span>
                                            <span class="project-stats">
                                                <i class="fas fa-images"></i> ${project.imageCount}
                                                <span class="text-muted">${window.i18n.t('project.images')}</span>
                                            </span>
                                            <span class="project-stats">
                                                <i class="fas fa-tag"></i> ${project.totalAnnotations}
                                                <span class="text-muted">${window.i18n.t('project.annotations')}</span>
                                            </span>
                                        </div>
                                        <div class="project-dates">
                                            <small class="text-muted">
                                                ${window.i18n.t('project.created')}: ${project.createdDate} |
                                                ${window.i18n.t('project.updated')}: ${project.updatedDate}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                                <div class="project-card-actions">
                                    <button class="btn btn-sm btn-secondary" data-action="export-tix" data-id="${project.id}" title="${window.i18n.t('project.exportBackup')}">
                                        <i class="fas fa-download"></i> ${window.i18n.t('actions.exportBackup')}
                                    </button>
                                    <button class="btn btn-sm btn-secondary" data-action="duplicate" data-id="${project.id}" title="${window.i18n.t('actions.duplicate')}">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                    <button class="btn btn-sm btn-secondary" data-action="rename" data-id="${project.id}" title="${window.i18n.t('actions.rename')}">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${project.id}" title="${window.i18n.t('actions.delete')}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            this.ui.showModal(window.i18n.t('project.manageProjects'), content, [
                {
                    text: window.i18n.t('actions.close'),
                    type: 'secondary',
                    action: 'close',
                    handler: (modal, close) => close()
                }
            ]);

            // Add event listeners for actions
            setTimeout(() => {
                const modal = document.querySelector('.modal');
                if (!modal) return;

                // Export .tix backup
                modal.querySelectorAll('[data-action="export-tix"]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const projectId = parseInt(e.currentTarget.dataset.id);
                        const project = await this.db.getProject(projectId);
                        if (project) {
                            // Temporarily set as current project for export
                            const originalProject = this.projectManager.currentProject;
                            this.projectManager.currentProject = project;
                            await this.projectManager.exportProject();
                            this.projectManager.currentProject = originalProject;
                        }
                    });
                });

                // Duplicate project
                modal.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const projectId = parseInt(e.currentTarget.dataset.id);
                        try {
                            const newProject = await this.projectManager.duplicateProject(projectId);
                            // Refresh the modal
                            modal.querySelector('.modal-close')?.click();
                            await this.loadProjects();
                            await this.showManageProjectsModal();
                        } catch (error) {
                            console.error('Error duplicating project:', error);
                        }
                    });
                });

                // Rename project
                modal.querySelectorAll('[data-action="rename"]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const projectId = parseInt(e.currentTarget.dataset.id);
                        const project = await this.db.getProject(projectId);
                        if (!project) return;

                        // Close the manage projects modal first
                        modal.querySelector('.modal-close')?.click();

                        // Wait a bit for the close animation
                        setTimeout(() => {
                            const renameContent = `
                                <div class="form-group">
                                    <label class="form-label">${window.i18n.t('project.newName')}</label>
                                    <input type="text" id="newProjectName" class="form-control" value="${project.name}" placeholder="${window.i18n.t('project.namePlaceholder')}">
                                </div>
                            `;

                            this.ui.showModal(window.i18n.t('project.renameProject'), renameContent, [
                                {
                                    text: window.i18n.t('actions.cancel'),
                                    type: 'secondary',
                                    action: 'cancel',
                                    handler: (renameModal, closeRename) => {
                                        closeRename();
                                        setTimeout(() => this.showManageProjectsModal(), 100);
                                    }
                                },
                                {
                                    text: window.i18n.t('actions.save'),
                                    type: 'primary',
                                    icon: 'fas fa-save',
                                    action: 'save',
                                    handler: async (renameModal, closeRename) => {
                                        const newName = renameModal.querySelector('#newProjectName').value.trim();
                                        if (!newName) {
                                            this.ui.showToast(window.i18n.t('project.enterName'), 'warning');
                                            return;
                                        }
                                        try {
                                            await this.projectManager.renameProject(projectId, newName);
                                            await this.loadProjects();
                                            closeRename();
                                            setTimeout(() => this.showManageProjectsModal(), 100);
                                        } catch (error) {
                                            console.error('Error renaming project:', error);
                                        }
                                    }
                                }
                            ]);
                        }, 200);
                    });
                });

                // Delete project with strong warning
                modal.querySelectorAll('[data-action="delete"]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const projectId = parseInt(e.currentTarget.dataset.id);
                        const project = await this.db.getProject(projectId);
                        if (!project) return;

                        // Close the manage projects modal first
                        modal.querySelector('.modal-close')?.click();

                        // Wait a bit for the close animation
                        setTimeout(() => {
                            const deleteContent = `
                                <div class="warning-box">
                                    <div class="warning-icon">
                                        <i class="fas fa-exclamation-triangle"></i>
                                    </div>
                                    <h3>${window.i18n.t('project.deleteWarning.title')}</h3>
                                    <p><strong>${window.i18n.t('project.deleteWarning.projectName')}</strong> ${project.name}</p>
                                    <div class="warning-details">
                                        <p>${window.i18n.t('project.deleteWarning.message')}</p>
                                        <ul class="warning-list">
                                            <li><i class="fas fa-times-circle"></i> ${window.i18n.t('project.deleteWarning.permanent')}</li>
                                            <li><i class="fas fa-times-circle"></i> ${window.i18n.t('project.deleteWarning.allData')}</li>
                                            <li><i class="fas fa-times-circle"></i> ${window.i18n.t('project.deleteWarning.noUndo')}</li>
                                        </ul>
                                        <p class="warning-recommendation">
                                            <i class="fas fa-lightbulb"></i>
                                            ${window.i18n.t('project.deleteWarning.recommendation')}
                                        </p>
                                    </div>
                                </div>
                            `;

                            this.ui.showModal(window.i18n.t('project.deleteWarning.confirmTitle'), deleteContent, [
                            {
                                text: window.i18n.t('actions.cancel'),
                                type: 'secondary',
                                action: 'cancel',
                                handler: (deleteModal, closeDelete) => {
                                    closeDelete();
                                    setTimeout(() => this.showManageProjectsModal(), 100);
                                }
                            },
                            {
                                text: window.i18n.t('actions.deleteConfirm'),
                                type: 'danger',
                                icon: 'fas fa-trash',
                                action: 'delete',
                                handler: async (deleteModal, closeDelete) => {
                                    try {
                                        await this.projectManager.deleteProject(projectId);

                                        // If deleted project was current, clear it
                                        if (this.projectManager.currentProject?.id === projectId) {
                                            this.projectManager.currentProject = null;
                                            this.canvasManager.clearCanvas();
                                            this.galleryManager.clearGallery();
                                        }

                                        await this.loadProjects();
                                        closeDelete();

                                        // Show manage modal again if there are still projects
                                        const remainingProjects = await this.db.getAllProjects();
                                        if (remainingProjects.length > 0) {
                                            setTimeout(() => this.showManageProjectsModal(), 100);
                                        }
                                    } catch (error) {
                                        console.error('Error deleting project:', error);
                                    }
                                }
                            }
                        ]);
                        }, 200);
                    });
                });
            }, 100);

        } catch (error) {
            console.error('Error showing manage projects modal:', error);
            this.ui.showToast(window.i18n.t('notifications.error.loadProjects'), 'error');
        }
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
                if (!this.canvasManager.image) {
                    return;
                }

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

            // Only reload gallery if this is a manual save, not auto-save
            if (!silent) {
                await this.galleryManager.loadImages(this.projectManager.currentProject.id);
                this.updateStats();
                this.ui.showToast(window.i18n.t('notifications.imageSaved'), 'success');
            } else {
                // For silent auto-save, only update the current thumbnail
                const currentImageId = this.annotationMode === 'classification'
                    ? this.classificationManager.imageId
                    : this.canvasManager.imageId;

                if (currentImageId) {
                    // Update thumbnail badge count
                    this.galleryManager.updateThumbnail(currentImageId);

                    // Update stats quietly without any visual disruption
                    this.updateStatsQuiet();
                }
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

        // Use ExportManager for all exports
        const project = this.projectManager.currentProject;
        await this.exportManager.exportDataset(format, project, images);
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
        colorInput.value = Utils.randomColor();

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

            // Count annotations using this class
            const annotationCount = this.canvasManager.annotations.filter(a => a.class === cls.id).length;

            item.innerHTML = `
                <div class="class-color" style="background: ${cls.color}"></div>
                <span class="class-name">${classNumber}${cls.name}</span>
                <span class="class-count">${annotationCount}</span>
                <button class="class-edit" data-id="${cls.id}" title="${window.i18n.t('classes.edit') || 'Edit'}">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="class-delete" data-id="${cls.id}" title="${window.i18n.t('classes.delete') || 'Delete'}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            item.onclick = (e) => {
                if (e.target.closest('.class-delete')) {
                    this.showDeleteClassModal(cls.id, cls.name, annotationCount);
                } else if (e.target.closest('.class-edit')) {
                    e.stopPropagation();
                    this.showEditClassModal(cls.id, cls.name, cls.color);
                } else {
                    this.canvasManager.currentClass = index;
                    this.updateClassUI();
                }
            };

            container.appendChild(item);
        });
    }

    async deleteClass(classId) {
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
            console.log(`Deleting class ${classId} from all images in project...`);

            // Delete annotations from ALL images in the project (including current one)
            if (this.projectManager.currentProject) {
                // Get all images for this project
                const allImages = await this.db.getProjectImages(this.projectManager.currentProject.id);
                let updatedCount = 0;
                let deletedAnnotations = 0;

                // Process each image
                for (const imageData of allImages) {
                    const originalCount = imageData.annotations?.length || 0;

                    // Filter out annotations with this class
                    const filtered = (imageData.annotations || []).filter(a => a.class !== classId);
                    const removed = originalCount - filtered.length;

                    imageData.annotations = filtered;

                    // Update if annotations were removed
                    if (removed > 0) {
                        await this.db.saveImage(imageData);
                        updatedCount++;
                        deletedAnnotations += removed;
                    }
                }

                console.log(`✓ Deleted ${deletedAnnotations} annotations from ${updatedCount} images`);

                // If current image is loaded, update it from database
                if (this.canvasManager.imageId) {
                    const currentImageData = await this.db.getImage(this.canvasManager.imageId);
                    if (currentImageData) {
                        this.canvasManager.annotations = currentImageData.annotations || [];
                        this.canvasManager.redraw();
                        this.canvasManager.updateAnnotationsBar();
                    }
                }
            }

            // Remove class from list
            this.canvasManager.classes = this.canvasManager.classes.filter(c => c.id !== classId);
            this.updateClassUI();

            if (this.projectManager.currentProject) {
                await this.projectManager.updateProject({ classes: this.canvasManager.classes });
            }

            // Reload gallery to update counts
            await this.galleryManager.loadImages(this.projectManager.currentProject.id);

            // Update statistics
            this.updateStats();

            this.ui.showToast(window.i18n.t('notifications.classDeleted') || 'Class and all its annotations deleted', 'success');
        }
    }

    showDeleteClassModal(classId, className, annotationCount) {
        const warningMsg = annotationCount > 0
            ? `<p style="color: #e74c3c; margin: 10px 0;"><i class="fas fa-exclamation-triangle"></i> ${window.i18n.t('classes.deleteWarning') || 'This class has'} <strong>${annotationCount}</strong> ${window.i18n.t('classes.annotations') || 'annotations'}.</p>`
            : '';

        this.ui.showModal(
            `${window.i18n.t('classes.deleteTitle') || 'Delete Class'}: ${className}`,
            `
                <p>${window.i18n.t('classes.deleteQuestion') || 'What would you like to do with this class?'}</p>
                ${warningMsg}
            `,
            [
                {
                    text: window.i18n.t('actions.cancel') || 'Cancel',
                    type: 'secondary',
                    action: 'cancel',
                    handler: (modal, close) => close()
                },
                annotationCount > 0 ? {
                    text: window.i18n.t('classes.rename') || 'Rename Class',
                    type: 'info',
                    icon: 'fas fa-pen',
                    action: 'rename',
                    handler: (modal, close) => {
                        close();
                        this.showEditClassModal(classId, className,
                            this.canvasManager.classes.find(c => c.id === classId).color
                        );
                    }
                } : null,
                {
                    text: annotationCount > 0
                        ? (window.i18n.t('classes.deleteAll') || `Delete Class & ${annotationCount} Annotations`)
                        : (window.i18n.t('classes.delete') || 'Delete Class'),
                    type: 'danger',
                    icon: 'fas fa-trash',
                    action: 'delete',
                    handler: (modal, close) => {
                        this.deleteClass(classId);
                        close();
                    }
                }
            ].filter(btn => btn !== null)
        );
    }

    showEditClassModal(classId, currentName, currentColor) {
        const cls = this.canvasManager.classes.find(c => c.id === classId);
        if (!cls) return;

        this.ui.showModal(
            window.i18n.t('classes.editTitle') || 'Edit Class',
            `
                <div class="form-group">
                    <label class="form-label">${window.i18n.t('classes.name') || 'Name'}:</label>
                    <input type="text" id="editClassName" class="form-control" value="${currentName}" placeholder="${window.i18n.t('classes.namePlaceholder') || 'Class name'}">
                </div>
                <div class="form-group">
                    <label class="form-label">${window.i18n.t('classes.color') || 'Color'}:</label>
                    <input type="color" id="editClassColor" class="color-input" value="${currentColor}">
                </div>
            `,
            [
                {
                    text: window.i18n.t('actions.cancel') || 'Cancel',
                    type: 'secondary',
                    action: 'cancel',
                    handler: (modal, close) => close()
                },
                {
                    text: window.i18n.t('actions.save') || 'Save Changes',
                    type: 'primary',
                    icon: 'fas fa-save',
                    action: 'save',
                    handler: (modal, close) => {
                        const newName = modal.querySelector('#editClassName').value.trim();
                        const newColor = modal.querySelector('#editClassColor').value;

                        if (!newName) {
                            this.ui.showToast(window.i18n.t('classes.nameRequired') || 'Class name is required', 'error');
                            return;
                        }

                        // Update class
                        cls.name = newName;
                        cls.color = newColor;

                        // Update UI
                        this.updateClassUI();
                        this.canvasManager.redraw();

                        // Save to project
                        if (this.projectManager.currentProject) {
                            this.projectManager.updateProject({ classes: this.canvasManager.classes });
                        }

                        this.ui.showToast(window.i18n.t('classes.updated') || 'Class updated successfully', 'success');
                        close();
                    }
                }
            ]
        );

        // Focus on name input
        setTimeout(() => {
            const input = document.getElementById('editClassName');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    zoomIn() {
        if (!this.canvasManager) return;
        this.canvasManager.zoom = Math.min(this.canvasManager.maxZoom, this.canvasManager.zoom * 1.2);
        this.canvasManager.redraw();
        this.updateZoomDisplay();
    }

    zoomOut() {
        if (!this.canvasManager) return;
        this.canvasManager.zoom = Math.max(this.canvasManager.minZoom, this.canvasManager.zoom / 1.2);
        this.canvasManager.redraw();
        this.updateZoomDisplay();
    }

    resetZoom() {
        if (!this.canvasManager) return;
        this.canvasManager.fitImageToCanvas();
        this.canvasManager.redraw();
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        if (!this.canvasManager) return;
        const display = document.getElementById('zoomLevel');
        if (display) {
            display.textContent = `${Math.round(this.canvasManager.zoom * 100)}%`;
        }
    }

    toggleLabels() {
        if (!this.canvasManager) return;
        this.canvasManager.showLabels = !this.canvasManager.showLabels;
        const btn = document.getElementById('btnToggleLabels');
        if (btn) {
            btn.classList.toggle('active', this.canvasManager.showLabels);
        }
        this.canvasManager.redraw();
    }

    toggleGrid() {
        if (!this.canvasManager) return;
        this.canvasManager.showGrid = !this.canvasManager.showGrid;
        const btn = document.getElementById('btnToggleGrid');
        if (btn) {
            btn.classList.toggle('active', this.canvasManager.showGrid);
        }
        this.canvasManager.redraw();
    }

    rotateImageLeft() {
        if (!this.canvasManager || !this.canvasManager.image) return;
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
        if (!this.canvasManager || !this.canvasManager.image) return;
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
        if (!this.canvasManager) return;

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
        if (!this.canvasManager) return;
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

    updateStatsQuiet() {
        // Update stats without causing any visual disruption (used for auto-save)
        // Only update if elements exist
        const statLabelsEl = document.getElementById('statLabels');
        const statAnnotatedEl = document.getElementById('statAnnotated');
        const progressBarEl = document.getElementById('progressBar');
        const progressTextEl = document.getElementById('progressText');

        if (!statLabelsEl || !statAnnotatedEl) return;

        const images = this.galleryManager.images;
        const totalLabels = images.reduce((sum, img) =>
            sum + (img.annotations ? img.annotations.length : 0), 0);
        const annotated = images.filter(img => img.annotations && img.annotations.length > 0).length;

        // Use requestAnimationFrame to batch DOM updates and prevent reflow
        requestAnimationFrame(() => {
            statAnnotatedEl.textContent = annotated;
            statLabelsEl.textContent = totalLabels;

            if (progressBarEl && progressTextEl) {
                const progress = images.length > 0 ? (annotated / images.length) * 100 : 0;
                progressBarEl.style.width = `${progress}%`;
                progressTextEl.textContent = `${annotated}/${images.length} ${window.i18n.t('stats.progress')}`;
            }
        });
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

                        this.trainingCodeGenerator.populateFrameworks();
                        this.trainingCodeGenerator.generateTrainingCode();
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
                document.getElementById(id)?.addEventListener('change', () => this.trainingCodeGenerator.generateTrainingCode());
                document.getElementById(id)?.addEventListener('input', () => this.trainingCodeGenerator.generateTrainingCode());
            });

            // Code generation controls - advanced
            ['codeOptimizer', 'codeLr', 'codePatience', 'codeValSplit',
             'augMosaic', 'augMixup', 'augHsv', 'augFlip', 'augRotate', 'augScale',
             'savePlots', 'saveConfMatrix', 'savePrCurves', 'savePredictions', 'saveMetricsCsv',
             'exportOnnx', 'exportTorchscript', 'exportTflite', 'exportOpenvino', 'exportCoreml', 'exportTensorrt'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => this.trainingCodeGenerator.generateTrainingCode());
                document.getElementById(id)?.addEventListener('input', () => this.trainingCodeGenerator.generateTrainingCode());
            });

            // Code actions
            document.getElementById('btnCopyCode')?.addEventListener('click', () => this.trainingCodeGenerator.copyCode());
            document.getElementById('btnDownloadPy')?.addEventListener('click', () => this.trainingCodeGenerator.downloadCode('py'));
            document.getElementById('btnDownloadIpynb')?.addEventListener('click', () => this.trainingCodeGenerator.downloadCode('ipynb'));

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
        const project = this.projectManager.currentProject;
        const images = await this.db.getProjectImages(project.id);

        await this.exportManager.exportDataset(format, project, images);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new YOLOAnnotator();
    window.app.init();
});