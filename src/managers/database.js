/**
 * DATABASE MANAGER - IndexedDB with Enhanced Error Handling
 * Modern ES6 module with proper error management
 */

export class DatabaseError extends Error {
    constructor(message, operation, originalError = null) {
        super(message);
        this.name = 'DatabaseError';
        this.operation = operation;
        this.originalError = originalError;
        this.timestamp = Date.now();
    }
}

export class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'AnnotixDB';
        this.version = 3;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized && this.db) {
            return this.db;
        }

        try {
            return await new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);

                request.onerror = () => {
                    reject(new DatabaseError(
                        'Failed to open database',
                        'init',
                        request.error
                    ));
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    this.isInitialized = true;

                    // Handle unexpected database closure
                    this.db.onversionchange = () => {
                        this.db.close();
                        this.isInitialized = false;
                        console.warn('Database version changed. Please reload the page.');
                    };

                    resolve(this.db);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    // Projects store
                    if (!db.objectStoreNames.contains('projects')) {
                        const projectStore = db.createObjectStore('projects', {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        projectStore.createIndex('name', 'name', { unique: true });
                        projectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }

                    // Images store
                    if (!db.objectStoreNames.contains('images')) {
                        const imageStore = db.createObjectStore('images', {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        imageStore.createIndex('projectId', 'projectId', { unique: false });
                        imageStore.createIndex('name', 'name', { unique: false });
                        imageStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                };
            });
        } catch (error) {
            throw new DatabaseError('Database initialization failed', 'init', error);
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    _ensureInitialized() {
        if (!this.isInitialized || !this.db) {
            throw new DatabaseError(
                'Database not initialized. Call init() first.',
                'validation'
            );
        }
    }

    async _transaction(storeName, mode, operation, errorContext) {
        this._ensureInitialized();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], mode);
                const store = transaction.objectStore(storeName);
                const request = operation(store);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    reject(new DatabaseError(
                        `Transaction failed: ${errorContext}`,
                        errorContext,
                        request.error
                    ));
                };
            } catch (error) {
                reject(new DatabaseError(
                    `Transaction error: ${errorContext}`,
                    errorContext,
                    error
                ));
            }
        });
    }

    // ============================================
    // PROJECT OPERATIONS
    // ============================================

    async saveProject(project) {
        if (!project || typeof project !== 'object') {
            throw new DatabaseError('Invalid project data', 'saveProject');
        }

        // Add timestamp if not exists
        if (!project.timestamp) {
            project.timestamp = Date.now();
        }

        return this._transaction(
            'projects',
            'readwrite',
            (store) => project.id ? store.put(project) : store.add(project),
            'saveProject'
        );
    }

    async getProject(id) {
        if (!id) {
            throw new DatabaseError('Project ID is required', 'getProject');
        }

        return this._transaction(
            'projects',
            'readonly',
            (store) => store.get(id),
            'getProject'
        );
    }

    async getAllProjects() {
        const projects = await this._transaction(
            'projects',
            'readonly',
            (store) => store.getAll(),
            'getAllProjects'
        );

        // Sort by timestamp (newest first)
        return projects.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    async deleteProject(id) {
        if (!id) {
            throw new DatabaseError('Project ID is required', 'deleteProject');
        }

        // Delete associated images first
        await this.deleteProjectImages(id);

        return this._transaction(
            'projects',
            'readwrite',
            (store) => store.delete(id),
            'deleteProject'
        );
    }

    async projectExists(name) {
        this._ensureInitialized();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['projects'], 'readonly');
                const store = transaction.objectStore('projects');
                const index = store.index('name');
                const request = index.get(name);

                request.onsuccess = () => resolve(!!request.result);
                request.onerror = () => reject(new DatabaseError(
                    'Failed to check project existence',
                    'projectExists',
                    request.error
                ));
            } catch (error) {
                reject(new DatabaseError(
                    'Error checking project existence',
                    'projectExists',
                    error
                ));
            }
        });
    }

    // ============================================
    // IMAGE OPERATIONS
    // ============================================

    async saveImage(imageData) {
        if (!imageData || !imageData.projectId) {
            throw new DatabaseError('Invalid image data or missing projectId', 'saveImage');
        }

        // Add timestamp if not exists
        if (!imageData.timestamp) {
            imageData.timestamp = Date.now();
        }

        return this._transaction(
            'images',
            'readwrite',
            (store) => imageData.id ? store.put(imageData) : store.add(imageData),
            'saveImage'
        );
    }

    async getImage(id) {
        if (!id) {
            throw new DatabaseError('Image ID is required', 'getImage');
        }

        return this._transaction(
            'images',
            'readonly',
            (store) => store.get(id),
            'getImage'
        );
    }

    async getProjectImages(projectId) {
        if (!projectId) {
            throw new DatabaseError('Project ID is required', 'getProjectImages');
        }

        this._ensureInitialized();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['images'], 'readonly');
                const store = transaction.objectStore('images');
                const index = store.index('projectId');
                const request = index.getAll(projectId);

                request.onsuccess = () => {
                    const images = request.result;
                    // Sort by timestamp (oldest first for annotation order)
                    resolve(images.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
                };

                request.onerror = () => {
                    reject(new DatabaseError(
                        'Failed to retrieve project images',
                        'getProjectImages',
                        request.error
                    ));
                };
            } catch (error) {
                reject(new DatabaseError(
                    'Error retrieving project images',
                    'getProjectImages',
                    error
                ));
            }
        });
    }

    async deleteImage(id) {
        if (!id) {
            throw new DatabaseError('Image ID is required', 'deleteImage');
        }

        return this._transaction(
            'images',
            'readwrite',
            (store) => store.delete(id),
            'deleteImage'
        );
    }

    async deleteProjectImages(projectId) {
        if (!projectId) {
            throw new DatabaseError('Project ID is required', 'deleteProjectImages');
        }

        try {
            const images = await this.getProjectImages(projectId);

            // Delete all images in batch
            const deletePromises = images.map(image => this.deleteImage(image.id));
            await Promise.all(deletePromises);

            return images.length;
        } catch (error) {
            throw new DatabaseError(
                `Failed to delete images for project ${projectId}`,
                'deleteProjectImages',
                error
            );
        }
    }

    // ============================================
    // STATISTICS & UTILITIES
    // ============================================

    async getStorageStats() {
        try {
            const projects = await this.getAllProjects();
            let totalImages = 0;
            let totalSize = 0;

            for (const project of projects) {
                const images = await this.getProjectImages(project.id);
                totalImages += images.length;

                // Estimate size (rough calculation)
                images.forEach(img => {
                    if (img.image && img.image.size) {
                        totalSize += img.image.size;
                    }
                });
            }

            return {
                projectCount: projects.length,
                imageCount: totalImages,
                estimatedSize: totalSize,
                estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
            };
        } catch (error) {
            throw new DatabaseError('Failed to calculate storage stats', 'getStorageStats', error);
        }
    }

    async clearDatabase() {
        this._ensureInitialized();

        try {
            // Clear projects
            await this._transaction(
                'projects',
                'readwrite',
                (store) => store.clear(),
                'clearDatabase-projects'
            );

            // Clear images
            await this._transaction(
                'images',
                'readwrite',
                (store) => store.clear(),
                'clearDatabase-images'
            );

            return true;
        } catch (error) {
            throw new DatabaseError('Failed to clear database', 'clearDatabase', error);
        }
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
}

// Export singleton instance
export const db = new DatabaseManager();
