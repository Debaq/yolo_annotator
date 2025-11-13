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
        this.hasUnsavedChanges = false;

        // Current tool - set default based on project type
        this.currentTool = this.projectConfig.tools[0] || 'select';
        this.currentClass = 0;

        // Compatibility properties (set before data loads)
        this.imageName = null;
        this.imageId = null;
        this.image = null;

        // View state
        this.showLabels = true;
        this.showGrid = true;
        this.showXAxisLabels = true;
        this.scaleY = 1.0;
        this.scaleX = 1.0;

        // Interaction state
        this.startX = null;
        this.tempRangeStart = null;

        // Preview state
        this.previewX = null;
        this.previewY = null;

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

        // Create overlay canvas for previews
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.id = 'timeseriesOverlay';
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCanvas.style.width = '100%';
        this.overlayCanvas.style.height = '100%';
        this.chartContainer.appendChild(this.overlayCanvas);
        this.overlayCtx = this.overlayCanvas.getContext('2d');

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
            this.originalImageBlob = dataEntry.image;  // Store original CSV blob for saving
            // Create pseudo-image object for compatibility with UI code
            this.image = {
                width: parsed.data.length,  // Number of time points
                height: parsed.headers ? parsed.headers.length - 1 : 1  // Number of series (excluding time column)
            };

            // Render chart
            this.renderChart();

            // Clear unsaved changes flag after loading
            this.hasUnsavedChanges = false;

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
                animation: false,  // Disable animations
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
                        animations: {
                            numbers: { duration: 0 }
                        },
                        annotations: this.getChartAnnotations()
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: this.timeSeriesMetadata.timeColumn || 'Índice'
                        },
                        ticks: {
                            display: this.showXAxisLabels
                        },
                        grid: {
                            display: this.showGrid
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Valor'
                        },
                        grid: {
                            display: this.showGrid
                        },
                        min: undefined,
                        max: undefined
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
     * Update only annotations without recreating chart
     */
    updateAnnotations() {
        if (!this.chart) return;

        // Update annotation plugin options
        this.chart.options.plugins.annotation.annotations = this.getChartAnnotations();

        // Update chart without animation
        this.chart.update('none');
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
        const rect = this.chartCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Update preview position
        this.previewX = x;
        this.previewY = y;

        // Draw preview based on tool and state
        if (this.currentTool === 'point' && !this.isDrawing) {
            this.drawPointPreview(x, y);
        } else if (this.currentTool === 'range') {
            if (this.isDrawing) {
                this.drawRangePreview(this.startX, x);
            } else {
                this.drawVerticalLinePreview(x);
            }
        } else {
            this.clearPreview();
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
        this.clearPreview();
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
        this.clearPreview();
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
            class: this.currentClass,
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
        this.updateAnnotations();
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
            class: this.currentClass,
            data: {
                start: start,
                end: end,
                startIndex: this.getClosestDataIndex(start),
                endIndex: this.getClosestDataIndex(end),
                rangeType: this.projectConfig.rangeType || 'generic'
            }
        };

        this.annotations.push(annotation);
        this.updateAnnotations();
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
     * Update overlay canvas size to match chart canvas
     */
    updateOverlaySize() {
        if (!this.chartCanvas || !this.overlayCanvas) return;

        const rect = this.chartCanvas.getBoundingClientRect();
        this.overlayCanvas.width = rect.width;
        this.overlayCanvas.height = rect.height;
    }

    /**
     * Clear preview overlay
     */
    clearPreview() {
        if (!this.overlayCtx || !this.overlayCanvas) return;
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    /**
     * Draw point preview (follows mouse on curves)
     */
    drawPointPreview(x, y) {
        if (!this.chart || !this.overlayCtx) return;

        this.updateOverlaySize();
        this.clearPreview();

        const xValue = this.getXValue(x);
        if (xValue === null) return;

        // Get chart area bounds
        const chartArea = this.chart.chartArea;
        if (x < chartArea.left || x > chartArea.right) return;

        const classColor = this.getClassColor(this.currentClass);

        // Draw vertical line at cursor position
        this.overlayCtx.strokeStyle = classColor + '40';
        this.overlayCtx.lineWidth = 1;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(x, chartArea.top);
        this.overlayCtx.lineTo(x, chartArea.bottom);
        this.overlayCtx.stroke();
        this.overlayCtx.setLineDash([]);

        // Draw points on each dataset at this x position
        const dataIndex = this.getClosestDataIndex(xValue);
        this.chart.data.datasets.forEach((dataset, i) => {
            const value = dataset.data[dataIndex];
            if (value === null || value === undefined) return;

            const yScale = this.chart.scales.y;
            const yPixel = yScale.getPixelForValue(value);

            // Draw preview point
            this.overlayCtx.fillStyle = classColor + '60';
            this.overlayCtx.strokeStyle = classColor;
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.beginPath();
            this.overlayCtx.arc(x, yPixel, 5, 0, Math.PI * 2);
            this.overlayCtx.fill();
            this.overlayCtx.stroke();
        });
    }

    /**
     * Draw vertical line preview
     */
    drawVerticalLinePreview(x) {
        if (!this.chart || !this.overlayCtx) return;

        this.updateOverlaySize();
        this.clearPreview();

        const chartArea = this.chart.chartArea;
        if (x < chartArea.left || x > chartArea.right) return;

        const classColor = this.getClassColor(this.currentClass);

        // Draw vertical line
        this.overlayCtx.strokeStyle = classColor + '60';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(x, chartArea.top);
        this.overlayCtx.lineTo(x, chartArea.bottom);
        this.overlayCtx.stroke();
        this.overlayCtx.setLineDash([]);
    }

    /**
     * Draw range preview (area between start and current position)
     */
    drawRangePreview(startX, endX) {
        if (!this.chart || !this.overlayCtx) return;

        this.updateOverlaySize();
        this.clearPreview();

        const chartArea = this.chart.chartArea;

        // Clamp to chart area
        startX = Math.max(chartArea.left, Math.min(chartArea.right, startX));
        endX = Math.max(chartArea.left, Math.min(chartArea.right, endX));

        const classColor = this.getClassColor(this.currentClass);

        // Draw filled area
        this.overlayCtx.fillStyle = classColor + '20';
        this.overlayCtx.fillRect(
            Math.min(startX, endX),
            chartArea.top,
            Math.abs(endX - startX),
            chartArea.bottom - chartArea.top
        );

        // Draw border lines
        this.overlayCtx.strokeStyle = classColor + '80';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);

        // Start line
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(startX, chartArea.top);
        this.overlayCtx.lineTo(startX, chartArea.bottom);
        this.overlayCtx.stroke();

        // End line
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(endX, chartArea.top);
        this.overlayCtx.lineTo(endX, chartArea.bottom);
        this.overlayCtx.stroke();

        this.overlayCtx.setLineDash([]);
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
            this.updateAnnotations();
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
        this.clearPreview();
    }

    /**
     * Set selected class
     */
    setSelectedClass(classId) {
        this.currentClass = classId;
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
        // Mark as having unsaved changes
        this.hasUnsavedChanges = true;

        // Override this method to handle annotation changes
        // (e.g., trigger auto-save)

        // Emit event for UI updates
        if (window.eventBus) {
            window.eventBus.emit('annotationModified', {
                imageId: this.imageId,
                annotations: this.annotations
            });
        }
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
        this.updateAnnotations();
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
     * Redraw chart (compatibility with image canvas)
     */
    redraw() {
        if (this.chart) {
            this.chart.update();
        }
    }

    /**
     * Toggle grid visibility
     */
    toggleGrid() {
        this.showGrid = !this.showGrid;
        if (this.chart) {
            this.chart.options.scales.x.grid.display = this.showGrid;
            this.chart.options.scales.y.grid.display = this.showGrid;
            this.chart.update();
        }
    }

    /**
     * Toggle annotation labels visibility
     */
    toggleLabels() {
        this.showLabels = !this.showLabels;
        // For now, just a placeholder - could hide annotation labels in future
        this.redraw();
    }

    /**
     * Toggle X-axis labels visibility
     */
    toggleXAxisLabels() {
        this.showXAxisLabels = !this.showXAxisLabels;
        if (this.chart) {
            this.chart.options.scales.x.ticks.display = this.showXAxisLabels;
            this.chart.update();
        }
    }

    /**
     * Zoom in (increase Y scale)
     */
    zoomIn() {
        this.scaleY *= 1.2;
        this.applyScale();
    }

    /**
     * Zoom out (decrease Y scale)
     */
    zoomOut() {
        this.scaleY /= 1.2;
        this.applyScale();
    }

    /**
     * Reset zoom to default
     */
    resetZoom() {
        this.scaleY = 1.0;
        this.scaleX = 1.0;
        this.applyScale();
    }

    /**
     * Apply current scale to chart
     */
    applyScale() {
        if (!this.chart || !this.parsedData || this.parsedData.length === 0) return;

        // Get original Y data range
        let minY = Infinity;
        let maxY = -Infinity;

        this.chart.data.datasets.forEach(dataset => {
            dataset.data.forEach(value => {
                if (typeof value === 'number') {
                    minY = Math.min(minY, value);
                    maxY = Math.max(maxY, value);
                }
            });
        });

        // Apply scale
        const center = (minY + maxY) / 2;
        const range = (maxY - minY) / this.scaleY;

        this.chart.options.scales.y.min = center - range / 2;
        this.chart.options.scales.y.max = center + range / 2;

        this.chart.update();
    }

    /**
     * Set zoom level (compatibility method)
     */
    setZoom(level) {
        this.scaleY = level;
        this.applyScale();
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

        // Clean up overlay
        this.overlayCanvas = null;
        this.overlayCtx = null;

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
