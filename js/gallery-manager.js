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
    constructor(container, db, canvasManager, ui) {
        this.container = container;
        this.db = db;
        this.canvasManager = canvasManager;
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
            if (imageData.id === this.canvasManager.imageId) {
                item.classList.add('active');
            }
            
            // Create blob URL and store it
            const url = URL.createObjectURL(imageData.image);
            this.blobUrls.set(imageData.id, url);
            
            const annotationCount = imageData.annotations ? imageData.annotations.length : 0;
            
            item.innerHTML = `
                <img src="${url}" alt="${imageData.name}">
                <div class="gallery-item-overlay">
                    <span>${annotationCount} labels</span>
                </div>
                <button class="gallery-item-delete" data-id="${imageData.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // Event handlers
            item.onclick = (e) => {
                if (e.target.closest('.gallery-item-delete')) {
                    e.stopPropagation();
                    this.deleteImage(imageData.id);
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
            const imageData = await this.db.getImage(imageId);
            
            if (!imageData) {
                console.error('Image not found:', imageId);
                this.ui.showToast(window.i18n.t('notifications.error.loadImage'), 'error');
                return;
            }
            
            // Create File from Blob
            const blob = imageData.image;
            const file = new File([blob], imageData.name, { type: blob.type });
            
            // Load to canvas
            await this.canvasManager.loadImage(file);
            
            // Set canvas state
            this.canvasManager.imageId = imageId;
            this.canvasManager.imageName = imageData.name;
            this.canvasManager.annotations = imageData.annotations || [];
            this.canvasManager.redraw();
            
            // Update gallery display
            this.render();
            
            console.log('Image loaded successfully');
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

    getCurrentImageIndex() {
        return this.images.findIndex(img => img.id === this.canvasManager.imageId);
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