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
        this.galleryManager = null;
        
        this.autoSaveInterval = null;
        this.autoSaveEnabled = false;
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
            
            const galleryContainer = document.getElementById('galleryGrid');
            this.galleryManager = new GalleryManager(galleryContainer, this.db, this.canvasManager, this.ui);
            
            console.log('Managers initialized');
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Load projects
            await this.loadProjects();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
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
        }
    }

    async loadProject(projectId) {
        try {
            console.log('Loading project:', projectId);
            const project = await this.projectManager.loadProject(projectId);
            this.canvasManager.classes = project.classes || [];
            this.updateClassUI();
            await this.galleryManager.loadImages(projectId);
            this.updateStats();
            console.log('Project loaded successfully');
        } catch (error) {
            console.error('Error loading project:', error);
        }
    }

    showNewProjectModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.name')}</label>
                <input type="text" id="projectName" class="form-control" placeholder="${window.i18n.t('project.namePlaceholder')}">
            </div>
            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.type')}</label>
                <select id="projectType" class="form-control form-select">
                    <option value="bbox">${window.i18n.t('project.typeBbox')}</option>
                    <option value="mask">${window.i18n.t('project.typeMask')}</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">${window.i18n.t('project.initialClasses')}</label>
                <input type="text" id="projectClasses" class="form-control" placeholder="${window.i18n.t('project.classesPlaceholder')}">
                <small class="text-muted">${window.i18n.t('project.classesHelp')}</small>
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
                    const type = modal.querySelector('#projectType').value;
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
            this.ui.showToast(window.i18n.t('project.selectFirst'), 'warning');
            return;
        }

        let loadedCount = 0;
        let firstImageId = null;

        for (const file of files) {
            try {
                const img = await this.loadImageFile(file);
                const blob = await this.fileToBlob(file);

                const imageData = {
                    projectId: this.projectManager.currentProject.id,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    image: blob,
                    annotations: [],
                    width: img.width,
                    height: img.height,
                    timestamp: Date.now()
                };

                const imageId = await this.db.saveImage(imageData);

                if (loadedCount === 0) {
                    firstImageId = imageId;
                }

                loadedCount++;
            } catch (error) {
                console.error(`Error loading ${file.name}:`, error);
                this.ui.showToast(`Error al cargar ${file.name}`, 'error');
            }
        }

        if (loadedCount > 0) {
            await this.galleryManager.loadImages(this.projectManager.currentProject.id);
            this.updateStats();

            if (firstImageId) {
                await this.galleryManager.loadImage(firstImageId);
            }

            this.ui.showToast(`${loadedCount} ${window.i18n.t('notifications.imagesLoaded')}`, 'success');
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
                
                this.ui.showToast(window.i18n.t('notifications.imageSaved'), 'success');
            });
        } catch (error) {
            console.error('Error saving image:', error);
            this.ui.showToast(window.i18n.t('notifications.error.saveImage'), 'error');
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
            console.error('Error downloading dataset:', error);
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
        
        if (this.canvasManager.classes.some(c => c.name === name)) {
            this.ui.showToast(window.i18n.t('classes.exists'), 'warning');
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