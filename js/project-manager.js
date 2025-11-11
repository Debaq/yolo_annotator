/**
 * PROJECT MANAGER
 * Manages project creation, loading, export, and import
 */

class ProjectManager {
    constructor(db, ui) {
        this.db = db;
        this.ui = ui;
        this.currentProject = null;
    }

    async createProject(name, type, classes, preprocessingConfig = { enabled: false }) {
        const project = {
            name,
            type, // 'bbox' or 'mask'
            classes,
            preprocessingConfig, // Image preprocessing configuration
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        try {
            const id = await this.db.saveProject(project);
            project.id = id;

            const msg = window.i18n.t('project.created', { name });
            this.ui.showToast(msg, 'success');

            return project;
        } catch (error) {
            console.error('Error creating project:', error);
            this.ui.showToast(window.i18n.t('notifications.error.createProject'), 'error');
            throw error;
        }
    }

    async loadProject(id) {
        try {
            const project = await this.db.getProject(id);
            if (project) {
                this.currentProject = project;
                
                const msg = window.i18n.t('project.loaded', { name: project.name });
                this.ui.showToast(msg, 'success');
                
                return project;
            }
        } catch (error) {
            console.error('Error loading project:', error);
            this.ui.showToast(window.i18n.t('notifications.error.loadProject'), 'error');
            throw error;
        }
    }

    async updateProject(updates) {
        if (!this.currentProject) return;

        try {
            this.currentProject = {
                ...this.currentProject,
                ...updates,
                updatedAt: Date.now()
            };
            await this.db.saveProject(this.currentProject);
        } catch (error) {
            console.error('Error updating project:', error);
            this.ui.showToast(window.i18n.t('notifications.error.updateProject'), 'error');
            throw error;
        }
    }

    async deleteProject(id) {
        try {
            await this.db.deleteProjectImages(id);
            await this.db.deleteProject(id);
            this.ui.showToast(window.i18n.t('project.deleted'), 'success');
        } catch (error) {
            console.error('Error deleting project:', error);
            this.ui.showToast(window.i18n.t('notifications.error.deleteProject'), 'error');
            throw error;
        }
    }

    async exportProject() {
        if (!this.currentProject) {
            this.ui.showToast(window.i18n.t('project.selectFirst'), 'warning');
            return;
        }

        try {
            const images = await this.db.getProjectImages(this.currentProject.id);
            
            const exportData = {
                project: this.currentProject,
                images: images.map(img => ({
                    ...img,
                    image: null // We'll handle blob separately
                })),
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            this.downloadFile(blob, `${this.currentProject.name}.yoloproject`);
            
            this.ui.showToast(window.i18n.t('project.exported'), 'success');
        } catch (error) {
            console.error('Error exporting project:', error);
            this.ui.showToast(window.i18n.t('notifications.error.exportProject'), 'error');
            throw error;
        }
    }

    async exportConfig() {
        if (!this.currentProject) {
            this.ui.showToast(window.i18n.t('project.selectFirst'), 'warning');
            return;
        }

        try {
            const config = {
                name: this.currentProject.name,
                type: this.currentProject.type,
                classes: this.currentProject.classes,
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            this.downloadFile(blob, `${this.currentProject.name}.yoloconfig`);
            
            this.ui.showToast(window.i18n.t('project.configExported'), 'success');
        } catch (error) {
            console.error('Error exporting config:', error);
            this.ui.showToast(window.i18n.t('notifications.error.exportConfig'), 'error');
        }
    }

    async importConfig(file) {
        try {
            const text = await file.text();
            const config = JSON.parse(text);
            return config;
        } catch (error) {
            console.error('Error importing config:', error);
            this.ui.showToast(window.i18n.t('notifications.error.importConfig'), 'error');
            throw error;
        }
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}