/**
 * TIME SERIES CANVAS MANAGER
 * Handles visualization and annotation of time series data
 */

class TimeSeriesCanvasManager {
    constructor(canvas, projectType, classes, ui) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.projectType = projectType;
        this.classes = classes;
        this.ui = ui;

        // Project-specific configuration
        this.projectConfig = this.getProjectTypeConfig();

        // Time series data
        this.currentData = null;
        this.timeSeriesMetadata = null;
        this.parsedData = [];

        // Chart.js instance
        this.chart = null;
        this.chartContainer = null;

        // Annotations
        this.annotations = [];
        this.activeAnnotation = null;
        this.isDrawing = false;

        // Current tool - set default based on project type
        this.currentTool = this.projectConfig.tools[0] || 'select';
        this.selectedClassId = 0;

        // Interaction state
        this.startX = null;
        this.tempRangeStart = null;

        this.setupCanvas();
    }

    setupCanvas() {
        // Hide the default canvas and create Chart.js container
        this.canvas.style.display = 'none';

        // Create container for Chart.js
        this.chartContainer = document.createElement('div');
        this.chartContainer.id = 'timeseriesChartContainer';
        this.chartContainer.style.width = '100%';
        this.chartContainer.style.height = '100%';
        this.chartContainer.style.position = 'relative';

        // Create canvas for Chart.js
        this.chartCanvas = document.createElement('canvas');
        this.chartCanvas.id = 'timeseriesChart';
        this.chartContainer.appendChild(this.chartCanvas);

        // Insert after original canvas
        this.canvas.parentNode.insertBefore(this.chartContainer, this.canvas.nextSibling);

        // Setup mouse/touch events
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.chartCanvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.chartCanvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.chartCanvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.chartCanvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
    }

    /**
     * Get project-specific configuration
     * Defines tools, modes, and behavior for each time series project type
     */
    getProjectTypeConfig() {
        const configs = {
            'timeSeriesClassification': {
                mode: 'global',
                tools: [],
                requiresCanvas: false,
                allowPoint: false,
                allowRange: false,
                description: 'Clasificar serie temporal completa',
                models: 'InceptionTime, ROCKET, ResNet'
            },
            'timeSeriesForecasting': {
                mode: 'canvas',
                tools: ['range', 'select', 'pan', 'zoom'],
                requiresCanvas: true,
                allowPoint: false,
                allowRange: true,
                rangeType: 'forecast',
                description: 'Marcar ventana histórica y horizonte de predicción',
                models: 'LSTM, Transformer, N-BEATS, Prophet'
            },
            'anomalyDetection': {
                mode: 'canvas',
                tools: ['point', 'select', 'pan', 'zoom'],
                requiresCanvas: true,
                allowPoint: true,
                allowRange: false,
                description: 'Marcar puntos anómalos en la serie',
                models: 'AutoEncoder, Isolation Forest, LSTM-AE'
            },
            'timeSeriesSegmentation': {
                mode: 'canvas',
                tools: ['range', 'select', 'pan', 'zoom'],
                requiresCanvas: true,
                allowPoint: false,
                allowRange: true,
                rangeType: 'segment',
                description: 'Segmentar serie en regiones con clases',
                models: 'ClaSP, FLUSS, Seasonal-Trend Decomposition'
            },
            'patternRecognition': {
                mode: 'canvas',
                tools: ['range', 'select', 'pan', 'zoom'],
                requiresCanvas: true,
                allowPoint: false,
                allowRange: true,
                rangeType: 'pattern',
                description: 'Marcar patrones/motifs repetitivos',
                models: 'Matrix Profile, STOMP, SAX'
            },
            'eventDetection': {
                mode: 'canvas',
                tools: ['point', 'select', 'pan', 'zoom'],
                requiresCanvas: true,
                allowPoint: true,
                allowRange: false,
                description: 'Marcar eventos discretos en el tiempo',
                models: 'Change Point Detection, Event Detection CNN'
            },
            'timeSeriesRegression': {
                mode: 'canvas',
                tools: ['point', 'select', 'pan', 'zoom'],
                requiresCanvas: true,
                allowPoint: true,
                allowRange: false,
                pointType: 'regression',
                description: 'Marcar puntos con valores target numéricos',
                models: 'XGBoost, Random Forest, Neural Networks'
            },
            'clustering': {
                mode: 'global',
                tools: [],
                requiresCanvas: false,
                allowPoint: false,
                allowRange: false,
                description: 'Asignar cluster a serie completa',
                models: 'K-Shape, DTW-KMeans, K-Means'
            },
            'imputation': {
                mode: 'canvas',
                tools: ['range', 'select', 'pan', 'zoom'],
                requiresCanvas: true,
                allowPoint: false,
                allowRange: true,
                rangeType: 'gap',
                description: 'Marcar secciones de datos faltantes a imputar',
                models: 'MICE, KNN, Interpolation, BRITS'
            }
        };

        return configs[this.projectType] || configs['anomalyDetection']; // default fallback
    }

    /**
     * Load time series data from database entry
     */
    async loadData(dataEntry) {
        try {
            this.currentData = dataEntry;
            this.timeSeriesMetadata = dataEntry.timeSeriesMetadata;

            // Parse CSV blob
            const csvText = await this.blobToText(dataEntry.image);
            const parser = new CSVParser();
            const parsed = await parser.parse(csvText, {
                delimiter: this.timeSeriesMetadata.delimiter,
                hasHeaders: this.timeSeriesMetadata.hasHeaders
            });

            this.parsedData = parsed.data;

            // Load existing annotations
            this.annotations = dataEntry.annotations || [];

            // Set compatibility properties for UI
            this.imageName = dataEntry.name;
            this.imageId = dataEntry.id;
            // Create pseudo-image object for compatibility with UI code
            this.image = {
                width: parsed.data.length,  // Number of time points
                height: parsed.headers ? parsed.headers.length - 1 : 1  // Number of series (excluding time column)
            };

            // Render chart
            this.renderChart();

        } catch (error) {
            console.error('Error loading time series data:', error);
            this.ui.showToast('Error al cargar datos de serie temporal', 'error');
        }
    }

    /**
     * Convert blob to text
     */
    blobToText(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(blob);
        });
    }

    /**
     * Render Chart.js visualization
     */
    renderChart() {
        if (!this.parsedData || this.parsedData.length === 0) {
            console.warn('No data to render');
            return;
        }

        // Prepare data for Chart.js
        const { labels, datasets } = this.prepareChartData();

        // Destroy previous chart if exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new chart
        this.chart = new Chart(this.chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        enabled: true
                    },
                    // Custom plugin for annotations
                    annotation: {
                        annotations: this.getChartAnnotations()
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: this.timeSeriesMetadata.timeColumn || 'Índice'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Valor'
                        }
                    }
                }
            }
        });

        // Render annotations overlay
        this.renderAnnotations();
    }

    /**
     * Prepare data for Chart.js
     */
    prepareChartData() {
        const headers = this.timeSeriesMetadata.headers;
        const timeColumn = this.timeSeriesMetadata.timeColumn;

        // Extract labels (x-axis)
        let labels;
        if (timeColumn) {
            labels = this.parsedData.map(row => row[timeColumn]);
        } else {
            labels = this.parsedData.map((_, index) => index);
        }

        // Extract datasets (one per numeric column, excluding time column)
        const datasets = [];
        const colors = [
            '#667eea', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
            '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'
        ];

        let colorIndex = 0;
        for (const header of headers) {
            if (header === timeColumn) continue;

            // Check if column is numeric
            const firstValue = this.parsedData[0][header];
            if (typeof firstValue !== 'number' && isNaN(firstValue)) continue;

            const data = this.parsedData.map(row => {
                const val = row[header];
                return typeof val === 'number' ? val : parseFloat(val);
            });

            datasets.push({
                label: header,
                data: data,
                borderColor: colors[colorIndex % colors.length],
                backgroundColor: colors[colorIndex % colors.length] + '33',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0 // Straight lines
            });

            colorIndex++;
        }

        return { labels, datasets };
    }

    /**
     * Get annotations formatted for Chart.js
     */
    getChartAnnotations() {
        const chartAnnotations = {};

        this.annotations.forEach((ann, index) => {
            if (ann.type === 'point') {
                chartAnnotations[`point_${index}`] = {
                    type: 'point',
                    xValue: ann.data.x,
                    yValue: ann.data.y,
                    backgroundColor: this.getClassColor(ann.class),
                    radius: 6
                };
            } else if (ann.type === 'range') {
                chartAnnotations[`range_${index}`] = {
                    type: 'box',
                    xMin: ann.data.start,
                    xMax: ann.data.end,
                    backgroundColor: this.getClassColor(ann.class) + '33',
                    borderColor: this.getClassColor(ann.class),
                    borderWidth: 2
                };
            }
        });

        return chartAnnotations;
    }

    /**
     * Render annotations overlay (for temporary drawing)
     */
    renderAnnotations() {
        // Annotations are now rendered by Chart.js plugin
        // This method can be used for temporary UI elements during drawing
    }

    /**
     * Mouse down handler
     */
    onMouseDown(e) {
        const rect = this.chartCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.currentTool === 'point') {
            this.addPointAnnotation(x, y);
        } else if (this.currentTool === 'range') {
            this.startX = x;
            this.tempRangeStart = this.getXValue(x);
            this.isDrawing = true;
        } else if (this.currentTool === 'select') {
            this.selectAnnotation(x, y);
        }
    }

    /**
     * Mouse move handler
     */
    onMouseMove(e) {
        if (!this.isDrawing) return;

        const rect = this.chartCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (this.currentTool === 'range') {
            // Update temporary range visualization
            this.updateTempRange(x);
        }
    }

    /**
     * Mouse up handler
     */
    onMouseUp(e) {
        if (!this.isDrawing) return;

        const rect = this.chartCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (this.currentTool === 'range') {
            this.addRangeAnnotation(x);
        }

        this.isDrawing = false;
        this.startX = null;
        this.tempRangeStart = null;
    }

    /**
     * Mouse leave handler
     */
    onMouseLeave(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.startX = null;
            this.tempRangeStart = null;
        }
    }

    /**
     * Add point annotation
     */
    addPointAnnotation(canvasX, canvasY) {
        // Validate that point annotations are allowed for this project type
        if (!this.projectConfig.allowPoint) {
            this.ui.showToast('Este tipo de proyecto no permite anotaciones de puntos', 'warning');
            return;
        }

        const xValue = this.getXValue(canvasX);
        const yValue = this.getYValue(canvasY);

        if (xValue === null || yValue === null) return;

        const annotation = {
            type: 'point',
            class: this.selectedClassId,
            data: {
                x: xValue,
                y: yValue,
                index: this.getClosestDataIndex(xValue)
            }
        };

        // For regression type, could add UI to input target value
        if (this.projectConfig.pointType === 'regression') {
            annotation.data.targetValue = yValue; // Store Y value as target
        }

        this.annotations.push(annotation);
        this.renderChart();
        this.onAnnotationsChanged();
    }

    /**
     * Add range annotation
     */
    addRangeAnnotation(endX) {
        // Validate that range annotations are allowed for this project type
        if (!this.projectConfig.allowRange) {
            this.ui.showToast('Este tipo de proyecto no permite anotaciones de rango', 'warning');
            return;
        }

        const endValue = this.getXValue(endX);

        if (this.tempRangeStart === null || endValue === null) return;

        const start = Math.min(this.tempRangeStart, endValue);
        const end = Math.max(this.tempRangeStart, endValue);

        const annotation = {
            type: 'range',
            class: this.selectedClassId,
            data: {
                start: start,
                end: end,
                startIndex: this.getClosestDataIndex(start),
                endIndex: this.getClosestDataIndex(end),
                rangeType: this.projectConfig.rangeType || 'generic'
            }
        };

        this.annotations.push(annotation);
        this.renderChart();
        this.onAnnotationsChanged();
    }

    /**
     * Get X value from canvas coordinates
     */
    getXValue(canvasX) {
        if (!this.chart) return null;

        const xScale = this.chart.scales.x;
        return xScale.getValueForPixel(canvasX);
    }

    /**
     * Get Y value from canvas coordinates
     */
    getYValue(canvasY) {
        if (!this.chart) return null;

        const yScale = this.chart.scales.y;
        return yScale.getValueForPixel(canvasY);
    }

    /**
     * Get closest data index for a given x value
     */
    getClosestDataIndex(xValue) {
        const labels = this.chart.data.labels;
        let closestIndex = 0;
        let minDiff = Math.abs(labels[0] - xValue);

        for (let i = 1; i < labels.length; i++) {
            const diff = Math.abs(labels[i] - xValue);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    /**
     * Update temporary range visualization
     */
    updateTempRange(currentX) {
        // This could draw a temporary overlay on the chart
        // For now, Chart.js handles this internally
    }

    /**
     * Select annotation at coordinates
     */
    selectAnnotation(x, y) {
        // Find annotation at click position
        // For now, just clear selection
        this.activeAnnotation = null;
    }

    /**
     * Delete selected annotation
     */
    deleteSelectedAnnotation() {
        if (this.activeAnnotation !== null) {
            this.annotations.splice(this.activeAnnotation, 1);
            this.activeAnnotation = null;
            this.renderChart();
            this.onAnnotationsChanged();
        }
    }

    /**
     * Get class color
     */
    getClassColor(classId) {
        const cls = this.classes.find(c => c.id === classId);
        return cls ? cls.color : '#667eea';
    }

    /**
     * Set active tool
     */
    setTool(tool) {
        this.currentTool = tool;
        this.isDrawing = false;
        this.startX = null;
        this.tempRangeStart = null;
    }

    /**
     * Set selected class
     */
    setSelectedClass(classId) {
        this.selectedClassId = classId;
    }

    /**
     * Get annotations for saving
     */
    getAnnotations() {
        return this.annotations;
    }

    /**
     * Callback when annotations change
     */
    onAnnotationsChanged() {
        // Override this method to handle annotation changes
        // (e.g., trigger auto-save)
    }

    /**
     * Check if tool is valid for this canvas type
     */
    isToolValid(tool) {
        return this.projectConfig.tools.includes(tool);
    }

    /**
     * Clear all annotations
     */
    clearAnnotations() {
        this.annotations = [];
        this.activeAnnotation = null;
        this.renderChart();
        this.onAnnotationsChanged();
    }

    /**
     * Clear unsaved changes flag
     */
    clearUnsavedChanges() {
        this.hasUnsavedChanges = false;
    }

    /**
     * Mark as having unsaved changes
     */
    markAsChanged() {
        this.hasUnsavedChanges = true;
    }

    /**
     * Dummy updateAnnotationsBar for compatibility
     */
    updateAnnotationsBar() {
        // Time series doesn't use the annotations bar yet
        // This is for compatibility with the existing interface
    }

    /**
     * Update tool availability based on project type
     * Hides/shows tools in the UI
     */
    updateToolAvailability() {
        // Hide image annotation tools (bbox, mask, obb)
        const bboxBtn = document.querySelector('[data-tool="bbox"]');
        const obbBtn = document.querySelector('[data-tool="obb"]');
        const maskBtn = document.querySelector('[data-tool="mask"]');
        const eraseBtn = document.getElementById('btnEraseMode');
        const maskControls = document.getElementById('maskControls');
        const rotationControls = document.getElementById('rotationControls');

        if (bboxBtn) bboxBtn.style.display = 'none';
        if (obbBtn) obbBtn.style.display = 'none';
        if (maskBtn) maskBtn.style.display = 'none';
        if (eraseBtn) eraseBtn.style.display = 'none';
        if (maskControls) maskControls.style.display = 'none';
        if (rotationControls) rotationControls.style.display = 'none';

        // Show/hide time series tools based on project config
        const pointBtn = document.querySelector('[data-tool="point"]');
        const rangeBtn = document.querySelector('[data-tool="range"]');

        if (pointBtn) {
            pointBtn.style.display = this.projectConfig.allowPoint ? 'flex' : 'none';
        }
        if (rangeBtn) {
            rangeBtn.style.display = this.projectConfig.allowRange ? 'flex' : 'none';
        }
    }

    /**
     * Destroy canvas and cleanup
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        if (this.chartContainer && this.chartContainer.parentNode) {
            this.chartContainer.parentNode.removeChild(this.chartContainer);
        }

        // Show original canvas again
        if (this.canvas) {
            this.canvas.style.display = 'block';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSeriesCanvasManager;
}
