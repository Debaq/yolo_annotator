/**
 * CANVAS FACTORY
 * Factory pattern to create appropriate canvas instance based on project type
 *
 * Supported project types:
 * - detection: Object Detection (Bounding Boxes) -> CanvasBbox
 * - obb: Oriented Bounding Boxes -> CanvasObb
 * - segmentation: Semantic Segmentation (Masks) -> CanvasMask
 * - instanceSeg: Instance Segmentation (Masks) -> CanvasMask
 * - keypoints: Pose/Skeleton Estimation -> CanvasKeypoints
 * - classification: Image Classification -> null (handled by ClassificationManager)
 * - multiLabel: Multi-Label Classification -> null (handled by ClassificationManager)
 */

class CanvasFactory {
    /**
     * Create canvas instance based on project type
     * @param {string} projectType - Type of project
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {UIManager} ui - UI manager instance
     * @returns {CanvasBase|null} Canvas instance or null for classification types
     */
    static create(projectType, canvas, ui) {
        // Mapping of project types to canvas classes
        const canvasMapping = {
            'detection': CanvasBbox,
            'obb': CanvasObb,
            'segmentation': CanvasMask,
            'instanceSeg': CanvasMask,
            'keypoints': CanvasKeypoints,
            'classification': null,  // Handled by ClassificationManager
            'multiLabel': null       // Handled by ClassificationManager
        };

        const CanvasClass = canvasMapping[projectType];

        // Classification types don't use canvas
        if (CanvasClass === null) {
            console.log(`Project type "${projectType}" does not require canvas`);
            return null;
        }

        // Check if canvas class exists
        if (!CanvasClass) {
            console.error(`Unsupported project type: ${projectType}`);
            throw new Error(`Unsupported project type: ${projectType}`);
        }

        // Check if canvas class is properly defined
        if (typeof CanvasClass !== 'function') {
            console.error(`Canvas class for "${projectType}" is not properly defined`);
            throw new Error(`Canvas class for "${projectType}" is not properly defined`);
        }

        console.log(`Creating canvas instance for project type: ${projectType}`);

        // Instantiate and return canvas
        try {
            const canvasInstance = new CanvasClass(canvas, ui, projectType);
            console.log(`Canvas instance created successfully:`, canvasInstance.constructor.name);
            return canvasInstance;
        } catch (error) {
            console.error(`Failed to create canvas instance for "${projectType}":`, error);
            throw error;
        }
    }

    /**
     * Get list of supported project types
     * @returns {Array<string>} List of supported project types
     */
    static getSupportedTypes() {
        return [
            'detection',
            'obb',
            'segmentation',
            'instanceSeg',
            'keypoints',
            'classification',
            'multiLabel'
        ];
    }

    /**
     * Check if project type requires canvas
     * @param {string} projectType - Type of project
     * @returns {boolean} True if canvas is required
     */
    static requiresCanvas(projectType) {
        return !['classification', 'multiLabel'].includes(projectType);
    }

    /**
     * Get available tools for a project type
     * @param {string} projectType - Type of project
     * @returns {Array<string>} List of available tools
     */
    static getAvailableTools(projectType) {
        const toolMapping = {
            'detection': ['bbox', 'select', 'pan'],
            'obb': ['obb', 'select', 'pan'],
            'segmentation': ['mask', 'select', 'pan'],
            'instanceSeg': ['mask', 'select', 'pan'],
            'keypoints': ['keypoint', 'select', 'pan'],
            'classification': [],
            'multiLabel': []
        };

        return toolMapping[projectType] || [];
    }

    /**
     * Get human-readable name for project type
     * @param {string} projectType - Type of project
     * @returns {string} Human-readable name
     */
    static getTypeName(projectType) {
        const nameMapping = {
            'detection': 'Object Detection',
            'obb': 'Oriented Bounding Boxes',
            'segmentation': 'Semantic Segmentation',
            'instanceSeg': 'Instance Segmentation',
            'keypoints': 'Pose/Skeleton Estimation',
            'classification': 'Image Classification',
            'multiLabel': 'Multi-Label Classification'
        };

        return nameMapping[projectType] || projectType;
    }

    /**
     * Get description for project type
     * @param {string} projectType - Type of project
     * @returns {string} Description
     */
    static getTypeDescription(projectType) {
        const descriptionMapping = {
            'detection': 'Draw rectangular bounding boxes around objects',
            'obb': 'Draw rotated bounding boxes for oriented objects',
            'segmentation': 'Paint pixel-perfect masks for semantic segmentation',
            'instanceSeg': 'Paint individual masks for each object instance',
            'keypoints': 'Mark key points and skeleton connections',
            'classification': 'Assign single label to entire image',
            'multiLabel': 'Assign multiple labels to entire image'
        };

        return descriptionMapping[projectType] || '';
    }
}
