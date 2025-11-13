/**
 * MAIN APPLICATION STORE
 * Central reactive state management with Alpine.js
 */

import Alpine from 'alpinejs';
import { db } from '@managers/database';

export function createAppStore() {
    return {
        // ============================================
        // STATE
        // ============================================

        // App initialization
        isInitialized: false,
        isLoading: false,
        error: null,

        // Current project
        currentProject: null,
        currentProjectId: null,

        // Projects list
        projects: [],

        // Current image
        currentImage: null,
        currentImageId: null,
        hasUnsavedChanges: false,

        // Images for current project
        images: [],

        // UI state
        selectedTool: 'bbox',
        zoom: 1,
        pan: { x: 0, y: 0 },

        // Modals & UI
        activeModal: null,
        toast: { message: '', type: '', visible: false },

        // Auto-save
        autoSaveEnabled: true,
        autoSaveTimer: null,

        // ============================================
        // INITIALIZATION
        // ============================================

        async init() {
            try {
                this.isLoading = true;
                this.error = null;

                // Initialize database
                await db.init();

                // Load projects
                await this.loadProjects();

                // Try to restore last project from localStorage
                const lastProjectId = localStorage.getItem('lastProjectId');
                if (lastProjectId) {
                    const projectId = parseInt(lastProjectId);
                    const project = this.projects.find(p => p.id === projectId);
                    if (project) {
                        await this.loadProject(projectId);
                    }
                }

                this.isInitialized = true;
                this.showToast('Application initialized successfully', 'success');
            } catch (error) {
                this.error = error.message;
                this.showToast(`Initialization error: ${error.message}`, 'error');
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        // ============================================
        // PROJECT MANAGEMENT
        // ============================================

        async loadProjects() {
            try {
                this.projects = await db.getAllProjects();
            } catch (error) {
                this.handleError('Failed to load projects', error);
            }
        },

        async createProject(projectData) {
            try {
                this.isLoading = true;

                // Validate project data
                if (!projectData.name || !projectData.type) {
                    throw new Error('Project name and type are required');
                }

                // Check if project exists
                const exists = await db.projectExists(projectData.name);
                if (exists) {
                    throw new Error(`Project "${projectData.name}" already exists`);
                }

                // Create project object
                const project = {
                    name: projectData.name,
                    type: projectData.type,
                    classes: projectData.classes || [],
                    timestamp: Date.now()
                };

                // Save to database
                const projectId = await db.saveProject(project);
                project.id = projectId;

                // Reload projects and load new project
                await this.loadProjects();
                await this.loadProject(projectId);

                this.showToast(`Project "${project.name}" created successfully`, 'success');
                return project;
            } catch (error) {
                this.handleError('Failed to create project', error);
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        async loadProject(projectId) {
            try {
                this.isLoading = true;

                // Check for unsaved changes
                if (this.hasUnsavedChanges) {
                    const confirm = await this.confirm(
                        'You have unsaved changes. Do you want to save them before switching projects?'
                    );
                    if (confirm) {
                        await this.saveCurrentImage();
                    }
                }

                // Load project
                const project = await db.getProject(projectId);
                if (!project) {
                    throw new Error('Project not found');
                }

                this.currentProject = project;
                this.currentProjectId = projectId;

                // Save to localStorage
                localStorage.setItem('lastProjectId', projectId.toString());

                // Load images for this project
                await this.loadProjectImages();

                // Reset current image
                this.currentImage = null;
                this.currentImageId = null;
                this.hasUnsavedChanges = false;

                // Reset canvas state
                this.resetCanvasState();

                this.showToast(`Project "${project.name}" loaded`, 'success');
            } catch (error) {
                this.handleError('Failed to load project', error);
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        async updateProject(updates) {
            try {
                if (!this.currentProject) {
                    throw new Error('No project loaded');
                }

                // Merge updates
                const updatedProject = {
                    ...this.currentProject,
                    ...updates,
                    timestamp: Date.now()
                };

                // Save to database
                await db.saveProject(updatedProject);

                // Update local state
                this.currentProject = updatedProject;

                // Reload projects list
                await this.loadProjects();

                return updatedProject;
            } catch (error) {
                this.handleError('Failed to update project', error);
                throw error;
            }
        },

        async deleteProject(projectId) {
            try {
                this.isLoading = true;

                const project = await db.getProject(projectId);
                if (!project) {
                    throw new Error('Project not found');
                }

                // Delete from database (cascades to images)
                await db.deleteProject(projectId);

                // If deleted project is current, unload it
                if (this.currentProjectId === projectId) {
                    this.currentProject = null;
                    this.currentProjectId = null;
                    this.images = [];
                    this.currentImage = null;
                    localStorage.removeItem('lastProjectId');
                }

                // Reload projects
                await this.loadProjects();

                this.showToast(`Project "${project.name}" deleted`, 'success');
            } catch (error) {
                this.handleError('Failed to delete project', error);
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        // ============================================
        // IMAGE MANAGEMENT
        // ============================================

        async loadProjectImages() {
            try {
                if (!this.currentProjectId) {
                    this.images = [];
                    return;
                }

                this.images = await db.getProjectImages(this.currentProjectId);
            } catch (error) {
                this.handleError('Failed to load images', error);
            }
        },

        async addImages(files) {
            try {
                this.isLoading = true;

                if (!this.currentProjectId) {
                    throw new Error('No project loaded');
                }

                const addedImages = [];

                for (const file of files) {
                    // Create image data
                    const imageData = {
                        projectId: this.currentProjectId,
                        name: file.name,
                        image: file,
                        annotations: [],
                        width: 0,
                        height: 0,
                        timestamp: Date.now()
                    };

                    // Get image dimensions
                    const dimensions = await this.getImageDimensions(file);
                    imageData.width = dimensions.width;
                    imageData.height = dimensions.height;

                    // Save to database
                    const imageId = await db.saveImage(imageData);
                    imageData.id = imageId;

                    addedImages.push(imageData);
                }

                // Reload images
                await this.loadProjectImages();

                // Load first image if none loaded
                if (!this.currentImageId && addedImages.length > 0) {
                    await this.loadImage(addedImages[0].id);
                }

                this.showToast(`${addedImages.length} image(s) added`, 'success');
                return addedImages;
            } catch (error) {
                this.handleError('Failed to add images', error);
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        async loadImage(imageId) {
            try {
                // Auto-save current image if has changes
                if (this.hasUnsavedChanges) {
                    await this.saveCurrentImage();
                }

                const image = await db.getImage(imageId);
                if (!image) {
                    throw new Error('Image not found');
                }

                this.currentImage = image;
                this.currentImageId = imageId;
                this.hasUnsavedChanges = false;

                // Reset canvas state
                this.resetCanvasState();
            } catch (error) {
                this.handleError('Failed to load image', error);
                throw error;
            }
        },

        async saveCurrentImage() {
            try {
                if (!this.currentImage) {
                    return;
                }

                await db.saveImage(this.currentImage);
                this.hasUnsavedChanges = false;

                // Reload images to update thumbnails
                await this.loadProjectImages();

                this.showToast('Image saved', 'success');
            } catch (error) {
                this.handleError('Failed to save image', error);
                throw error;
            }
        },

        async deleteImage(imageId) {
            try {
                await db.deleteImage(imageId);

                // Reload images
                await this.loadProjectImages();

                // If deleted image is current, unload it
                if (this.currentImageId === imageId) {
                    this.currentImage = null;
                    this.currentImageId = null;
                    this.hasUnsavedChanges = false;

                    // Load next image if available
                    if (this.images.length > 0) {
                        await this.loadImage(this.images[0].id);
                    }
                }

                this.showToast('Image deleted', 'success');
            } catch (error) {
                this.handleError('Failed to delete image', error);
                throw error;
            }
        },

        // ============================================
        // CANVAS STATE
        // ============================================

        resetCanvasState() {
            this.zoom = 1;
            this.pan = { x: 0, y: 0 };
        },

        setZoom(value) {
            this.zoom = Math.max(0.1, Math.min(5, value));
        },

        setPan(x, y) {
            this.pan = { x, y };
        },

        setTool(tool) {
            this.selectedTool = tool;
        },

        // ============================================
        // ANNOTATIONS
        // ============================================

        addAnnotation(annotation) {
            if (!this.currentImage) return;

            if (!this.currentImage.annotations) {
                this.currentImage.annotations = [];
            }

            this.currentImage.annotations.push(annotation);
            this.hasUnsavedChanges = true;

            // Auto-save if enabled
            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }
        },

        updateAnnotation(index, updates) {
            if (!this.currentImage || !this.currentImage.annotations) return;

            this.currentImage.annotations[index] = {
                ...this.currentImage.annotations[index],
                ...updates
            };
            this.hasUnsavedChanges = true;

            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }
        },

        deleteAnnotation(index) {
            if (!this.currentImage || !this.currentImage.annotations) return;

            this.currentImage.annotations.splice(index, 1);
            this.hasUnsavedChanges = true;

            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }
        },

        // ============================================
        // AUTO-SAVE
        // ============================================

        scheduleAutoSave() {
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }

            this.autoSaveTimer = setTimeout(() => {
                this.saveCurrentImage();
            }, 3000); // 3 seconds debounce
        },

        // ============================================
        // UI HELPERS
        // ============================================

        showToast(message, type = 'info', duration = 3000) {
            this.toast = { message, type, visible: true };

            setTimeout(() => {
                this.toast.visible = false;
            }, duration);
        },

        async confirm(message) {
            // This will be handled by modal component
            return new Promise((resolve) => {
                this.activeModal = {
                    type: 'confirm',
                    message,
                    onConfirm: () => {
                        this.activeModal = null;
                        resolve(true);
                    },
                    onCancel: () => {
                        this.activeModal = null;
                        resolve(false);
                    }
                };
            });
        },

        handleError(context, error) {
            console.error(`[${context}]`, error);
            this.showToast(`${context}: ${error.message}`, 'error');
        },

        // ============================================
        // UTILITIES
        // ============================================

        async getImageDimensions(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);

                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve({ width: img.width, height: img.height });
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('Failed to load image'));
                };

                img.src = url;
            });
        },

        // Computed properties
        get hasProject() {
            return !!this.currentProject;
        },

        get hasImage() {
            return !!this.currentImage;
        },

        get imageCount() {
            return this.images.length;
        },

        get annotatedImageCount() {
            return this.images.filter(img =>
                img.annotations && img.annotations.length > 0
            ).length;
        },

        get currentImageIndex() {
            if (!this.currentImageId) return -1;
            return this.images.findIndex(img => img.id === this.currentImageId);
        },

        get canGoNext() {
            const index = this.currentImageIndex;
            return index >= 0 && index < this.images.length - 1;
        },

        get canGoPrevious() {
            return this.currentImageIndex > 0;
        },

        // Navigation
        async nextImage() {
            if (!this.canGoNext) return;
            const nextImage = this.images[this.currentImageIndex + 1];
            await this.loadImage(nextImage.id);
        },

        async previousImage() {
            if (!this.canGoPrevious) return;
            const prevImage = this.images[this.currentImageIndex - 1];
            await this.loadImage(prevImage.id);
        }
    };
}

// Register store globally
export function registerAppStore() {
    Alpine.store('app', createAppStore());
}
