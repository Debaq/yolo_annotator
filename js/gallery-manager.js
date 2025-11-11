/**
 * GALLERY MANAGER - FIXED VERSION
 * Manages image gallery display and navigation
 * 
 * FIXES:
 * - Proper async/await handling
 * - Better error handling in loadImages()
 * - Fixed render() to handle blob URLs correctly
 * - Added proper cleanup of old blob URLs
 */

class GalleryManager {
    constructor(container, db, app, ui) {
        this.container = container;
        this.db = db;
        this.app = app; // Reference to main app for accessing both managers
        this.ui = ui;
        this.images = [];
        this.currentFilter = 'all'; // 'all', 'annotated', 'unannotated'
        this.blobUrls = new Map(); // Track blob URLs for cleanup
    }

    async loadImages(projectId) {
        try {
            console.log('Loading images for project:', projectId);
            this.images = await this.db.getProjectImages(projectId);
            console.log('Images loaded:', this.images.length);
            
            // Clean up old blob URLs
            this.cleanupBlobUrls();
            
            this.render();
        } catch (error) {
            console.error('Error loading images:', error);
            this.ui.showToast(window.i18n.t('notifications.error.loadImages'), 'error');
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    }

    getFilteredImages() {
        switch (this.currentFilter) {
            case 'annotated':
                return this.images.filter(img => img.annotations && img.annotations.length > 0);
            case 'unannotated':
                return this.images.filter(img => !img.annotations || img.annotations.length === 0);
            default:
                return this.images;
        }
    }

    cleanupBlobUrls() {
        // Revoke old blob URLs to prevent memory leaks
        this.blobUrls.forEach(url => URL.revokeObjectURL(url));
        this.blobUrls.clear();
    }

    render() {
        console.log('Rendering gallery...');
        const filtered = this.getFilteredImages();
        console.log('Filtered images:', filtered.length);
        
        if (filtered.length === 0) {
            this.container.innerHTML = `<div class="empty-gallery">${window.i18n.t('gallery.empty')}</div>`;
            return;
        }
        
        this.container.innerHTML = '';
        
        filtered.forEach(imageData => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            // Add status classes
            if (!imageData.annotations || imageData.annotations.length === 0) {
                item.classList.add('no-annotations');
            }
            // Check active image based on current mode
            const currentImageId = this.app.annotationMode === 'classification'
                ? this.app.classificationManager.imageId
                : this.app.canvasManager.imageId;
            if (imageData.id === currentImageId) {
                item.classList.add('active');
            }
            
            // Create blob URL and store it
            const url = URL.createObjectURL(imageData.image);
            this.blobUrls.set(imageData.id, url);
            
            const annotationCount = imageData.annotations ? imageData.annotations.length : 0;

            // For classification projects, show class badges instead of count
            let overlayContent = '';
            if (this.app.annotationMode === 'classification' && annotationCount > 0) {
                // Get class names for badges
                const classNames = imageData.annotations.map(classId => {
                    const cls = this.app.classificationManager.classes.find(c => c.id === classId);
                    return cls ? { name: cls.name, color: cls.color } : null;
                }).filter(c => c !== null);

                if (classNames.length > 0) {
                    overlayContent = `
                        <div class="gallery-class-badges">
                            ${classNames.map(cls => `
                                <span class="gallery-class-badge" style="background: ${cls.color}">
                                    ${cls.name}
                                </span>
                            `).join('')}
                        </div>
                    `;
                }
            } else {
                // For detection/segmentation projects, show annotation count
                overlayContent = `<span>${annotationCount} labels</span>`;
            }

            item.innerHTML = `
                <img src="${url}" alt="${imageData.name}">
                <div class="gallery-item-overlay">
                    ${overlayContent}
                </div>
                <div class="gallery-item-actions">
                    <button class="gallery-item-augment" data-id="${imageData.id}" data-i18n-title="augmentation.augmentImage" title="Data Augmentation">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>
                    <button class="gallery-item-delete" data-id="${imageData.id}" data-i18n-title="actions.delete" title="Delete">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            // Event handlers
            item.onclick = (e) => {
                if (e.target.closest('.gallery-item-delete')) {
                    e.stopPropagation();
                    this.deleteImage(imageData.id);
                } else if (e.target.closest('.gallery-item-augment')) {
                    e.stopPropagation();
                    this.augmentImage(imageData.id);
                } else {
                    this.loadImage(imageData.id);
                }
            };
            
            this.container.appendChild(item);
        });
        
        console.log('Gallery rendered successfully');
    }

    async loadImage(imageId) {
        try {
            console.log('Loading image:', imageId);

            // IMPORTANT: Save current image before loading a new one
            // This prevents losing unsaved changes when navigating between images
            if (this.app.annotationMode === 'classification') {
                if (this.app.classificationManager.hasUnsavedChanges &&
                    this.app.classificationManager.imageId) {
                    console.log('Auto-saving classification changes before loading new image...');
                    await this.app.saveCurrentImage(true); // true = silent save
                }
            } else {
                if (this.app.canvasManager.hasUnsavedChanges &&
                    this.app.canvasManager.imageId) {
                    console.log('Auto-saving canvas changes before loading new image...');
                    await this.app.saveCurrentImage(true); // true = silent save
                }
            }

            const imageData = await this.db.getImage(imageId);

            if (!imageData) {
                console.error('Image not found:', imageId);
                this.ui.showToast(window.i18n.t('notifications.error.loadImage'), 'error');
                return;
            }

            // Create File from Blob
            const blob = imageData.image;
            const file = new File([blob], imageData.name, { type: blob.type });

            if (this.app.annotationMode === 'classification') {
                // Classification mode
                await this.app.classificationManager.loadImage(file);
                this.app.classificationManager.imageId = imageId;
                this.app.classificationManager.imageName = imageData.name;

                // Load labels (stored in annotations array as class IDs)
                const labels = imageData.annotations || [];
                this.app.classificationManager.setLabels(labels);
                this.app.classificationManager.clearUnsavedChanges();
            } else {
                // Canvas mode (detection, segmentation, etc.)
                await this.app.canvasManager.loadImage(file);
                this.app.canvasManager.imageId = imageId;
                this.app.canvasManager.imageName = imageData.name;
                this.app.canvasManager.annotations = imageData.annotations || [];
                this.app.canvasManager.clearUnsavedChanges();
                this.app.canvasManager.redraw();
                this.app.canvasManager.updateAnnotationsBar();
            }

            // Update gallery display
            this.render();

            console.log('Image loaded successfully in', this.app.annotationMode, 'mode');
        } catch (error) {
            console.error('Error loading image:', error);
            this.ui.showToast(window.i18n.t('notifications.error.loadImage'), 'error');
        }
    }

    async deleteImage(imageId) {
        const confirmMsg = window.i18n.t('gallery.deleteConfirm');
        if (!confirm(confirmMsg)) return;

        try {
            await this.db.deleteImage(imageId);

            // Remove from local array
            this.images = this.images.filter(img => img.id !== imageId);

            // Cleanup blob URL
            const url = this.blobUrls.get(imageId);
            if (url) {
                URL.revokeObjectURL(url);
                this.blobUrls.delete(imageId);
            }

            this.render();

            // Clear canvas if this was the current image
            if (this.canvasManager.imageId === imageId) {
                this.canvasManager.clear();
            }

            this.ui.showToast(window.i18n.t('notifications.imageDeleted'), 'success');
        } catch (error) {
            console.error('Error deleting image:', error);
            this.ui.showToast(window.i18n.t('notifications.error.deleteImage'), 'error');
        }
    }

    async augmentImage(imageId) {
        try {
            // Get image data
            const imageData = await this.db.getImage(imageId);

            if (!imageData) {
                console.error('Image not found:', imageId);
                this.ui.showToast(window.i18n.t('notifications.error.loadImage'), 'error');
                return;
            }

            // Get app instance and call augmentation modal
            // The app instance is available globally
            if (window.app && window.app.showAugmentationModal) {
                window.app.showAugmentationModal(imageData);
            } else {
                console.error('App instance not available');
                this.ui.showToast('Error: Application not initialized', 'error');
            }
        } catch (error) {
            console.error('Error loading image for augmentation:', error);
            this.ui.showToast(window.i18n.t('notifications.error.loadImage'), 'error');
        }
    }

    getCurrentImageIndex() {
        // Get current image ID based on annotation mode
        const currentImageId = this.app.annotationMode === 'classification'
            ? this.app.classificationManager.imageId
            : this.app.canvasManager.imageId;

        return this.images.findIndex(img => img.id === currentImageId);
    }

    async navigateNext() {
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex < this.images.length - 1) {
            await this.loadImage(this.images[currentIndex + 1].id);
        }
    }

    async navigatePrevious() {
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex > 0) {
            await this.loadImage(this.images[currentIndex - 1].id);
        }
    }

    canNavigateNext() {
        const currentIndex = this.getCurrentImageIndex();
        return currentIndex >= 0 && currentIndex < this.images.length - 1;
    }

    canNavigatePrevious() {
        const currentIndex = this.getCurrentImageIndex();
        return currentIndex > 0;
    }
}