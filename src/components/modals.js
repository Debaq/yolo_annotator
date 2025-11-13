/**
 * MODAL COMPONENTS
 * Reusable modal components for Alpine.js
 */

export function confirmModal() {
    return {
        show: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null,

        init() {
            // Listen for confirm modal requests
            this.$watch('$store.app.activeModal', (modal) => {
                if (modal && modal.type === 'confirm') {
                    this.title = modal.title || 'Confirm';
                    this.message = modal.message;
                    this.onConfirm = modal.onConfirm;
                    this.onCancel = modal.onCancel;
                    this.show = true;
                }
            });
        },

        confirm() {
            if (this.onConfirm) this.onConfirm();
            this.close();
        },

        cancel() {
            if (this.onCancel) this.onCancel();
            this.close();
        },

        close() {
            this.show = false;
            this.$store.app.activeModal = null;
        }
    };
}

export function newProjectModal() {
    return {
        show: false,
        formData: {
            name: '',
            type: 'bbox',
            classes: []
        },
        newClassName: '',
        newClassColor: '#' + Math.floor(Math.random()*16777215).toString(16),

        init() {
            this.$watch('$store.app.modals.newProject', (value) => {
                this.show = value;
                if (value) {
                    this.resetForm();
                }
            });
        },

        resetForm() {
            this.formData = {
                name: '',
                type: 'bbox',
                classes: []
            };
            this.newClassName = '';
            this.newClassColor = '#' + Math.floor(Math.random()*16777215).toString(16);
        },

        addClass() {
            if (!this.newClassName.trim()) return;

            this.formData.classes.push({
                id: this.formData.classes.length,
                name: this.newClassName.trim(),
                color: this.newClassColor
            });

            this.newClassName = '';
            this.newClassColor = '#' + Math.floor(Math.random()*16777215).toString(16);
        },

        removeClass(index) {
            this.formData.classes.splice(index, 1);
            // Reindex classes
            this.formData.classes.forEach((cls, idx) => {
                cls.id = idx;
            });
        },

        async submit() {
            if (!this.formData.name.trim()) {
                this.$store.app.showToast('Project name is required', 'error');
                return;
            }

            if (this.formData.classes.length === 0) {
                this.$store.app.showToast('At least one class is required', 'error');
                return;
            }

            try {
                await this.$store.app.createProject(this.formData);
                this.close();
            } catch (error) {
                // Error already handled by store
            }
        },

        close() {
            this.$store.app.hideModal('newProject');
        }
    };
}

export function exportModal() {
    return {
        show: false,
        exportFormat: 'yolo',
        includeImages: true,
        includeLabels: true,

        init() {
            this.$watch('$store.app.modals.export', (value) => {
                this.show = value;
            });
        },

        async startExport() {
            // This will be implemented when we migrate ExportManager
            this.$store.app.showToast('Export functionality will be available soon', 'info');
            this.close();
        },

        close() {
            this.$store.app.hideModal('export');
        }
    };
}
