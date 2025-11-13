/**
 * TRAINING CODE GENERATOR
 * Generates training scripts for various ML frameworks (YOLO, Detectron2, PyTorch, etc.)
 */

class TrainingCodeGenerator {
    constructor(projectManager, canvasManager, ui) {
        this.projectManager = projectManager;
        this.canvasManager = canvasManager;
        this.ui = ui;
    }

    // Helper method to get translations
    t(key) {
        return window.i18n ? window.i18n.t(key) : key;
    }

    // Get project modality from project type
    getProjectModality(projectType) {
        // Map project types to modalities
        const typeToModality = {
            // Images
            'classification': 'images',
            'multiLabel': 'images',
            'detection': 'images',
            'segmentation': 'images',
            'instanceSeg': 'images',
            'semanticSeg': 'images',
            'panopticSeg': 'images',
            'keypoints': 'images',
            'polygon': 'images',
            'landmarks': 'images',
            'obb': 'images',
            'ocr': 'images',
            'depthEstimation': 'images',
            // Time Series
            'timeSeriesClassification': 'timeSeries',
            'timeSeriesForecasting': 'timeSeries',
            'anomalyDetection': 'timeSeries',
            'timeSeriesSegmentation': 'timeSeries',
            'patternRecognition': 'timeSeries',
            'eventDetection': 'timeSeries',
            'timeSeriesRegression': 'timeSeries',
            'clustering': 'timeSeries',
            'imputation': 'timeSeries',
            // Audio
            'audioClassification': 'audio',
            'speechRecognition': 'audio',
            'soundEventDetection': 'audio',
            'speakerIdentification': 'audio',
            'audioTagging': 'audio',
            'musicGenreClassification': 'audio',
            'emotionRecognition': 'audio',
            'voiceActivityDetection': 'audio',
            'keywordSpotting': 'audio',
            'environmentalSound': 'audio',
            // Video
            'actionRecognition': 'video',
            'objectTracking': 'video',
            'temporalActionLocalization': 'video',
            'videoClassification': 'video',
            'videoSegmentation': 'video',
            'activityDetection': 'video',
            'poseTracking': 'video',
            'videoAnomalyDetection': 'video',
            'spatiotemporalAction': 'video',
            // 3D
            'object3DDetection': 'threeD',
            'semantic3DSegmentation': 'threeD',
            'instance3DSegmentation': 'threeD',
            'pointCloudClassification': 'threeD',
            'meshSegmentation': 'threeD',
            'pose3DEstimation': 'threeD',
            'keypoint3DDetection': 'threeD',
            'surfaceReconstruction': 'threeD',
            'slamAnnotation': 'threeD',
            // Text
            'textClassification': 'text',
            'namedEntityRecognition': 'text',
            'sentimentAnalysis': 'text',
            'intentClassification': 'text',
            'relationExtraction': 'text',
            'posTagging': 'text',
            'dependencyParsing': 'text',
            'questionAnswering': 'text',
            'keyphraseExtraction': 'text',
            'entityLinking': 'text',
            'toxicityClassification': 'text',
            'languageIdentification': 'text'
        };

        return typeToModality[projectType] || 'images';
    }

    updateConfigUI() {
        const projectType = this.projectManager.currentProject?.type || 'detection';
        const modality = this.getProjectModality(projectType);

        // Show/hide controls based on modality
        const imageControls = document.querySelectorAll('.modality-images');
        const timeSeriesControls = document.querySelectorAll('.modality-timeSeries');
        const audioControls = document.querySelectorAll('.modality-audio');
        const videoControls = document.querySelectorAll('.modality-video');

        // Hide all first
        imageControls.forEach(el => el.style.display = 'none');
        timeSeriesControls.forEach(el => el.style.display = 'none');
        audioControls.forEach(el => el.style.display = 'none');
        videoControls.forEach(el => el.style.display = 'none');

        // Show only relevant ones
        if (modality === 'images') {
            imageControls.forEach(el => el.style.display = '');
        } else if (modality === 'timeSeries') {
            timeSeriesControls.forEach(el => el.style.display = '');
        } else if (modality === 'audio') {
            audioControls.forEach(el => el.style.display = '');
        } else if (modality === 'video') {
            videoControls.forEach(el => el.style.display = '');
        }

        // Update frameworks after UI is updated
        this.populateFrameworks();
    }

    populateFrameworks() {
        const projectType = this.projectManager.currentProject?.type || 'detection';
        const modality = this.getProjectModality(projectType);
        const frameworkSelect = document.getElementById('codeFramework');
        if (!frameworkSelect) return;

        let frameworks = [];

        // Define frameworks based on modality and project type
        if (modality === 'images') {
            if (projectType === 'detection') {
                frameworks = [
                    { value: 'yolov8', label: 'YOLOv8 (Ultralytics)' },
                    { value: 'yolov5', label: 'YOLOv5' },
                    { value: 'yolov11', label: 'YOLOv11' },
                    { value: 'yolo-nas', label: 'YOLO-NAS' },
                    { value: 'detectron2', label: 'Detectron2 (Faster R-CNN)' }
                ];
            } else if (projectType === 'segmentation' || projectType === 'instanceSeg' || projectType === 'polygon' || projectType === 'semanticSeg') {
                frameworks = [
                    { value: 'yolov8-seg', label: 'YOLOv8 Segmentation' },
                    { value: 'yolov11-seg', label: 'YOLOv11 Segmentation' },
                    { value: 'detectron2-mask', label: 'Detectron2 (Mask R-CNN)' },
                    { value: 'smp', label: 'segmentation_models.pytorch' }
                ];
            } else if (projectType === 'classification' || projectType === 'multiLabel') {
                frameworks = [
                    { value: 'yolov8-cls', label: 'YOLOv8 Classification' },
                    { value: 'yolov11-cls', label: 'YOLOv11 Classification' },
                    { value: 'timm', label: 'PyTorch timm (ResNet, EfficientNet, ViT)' },
                    { value: 'torchvision', label: 'TorchVision Models' }
                ];
            } else if (projectType === 'keypoints' || projectType === 'landmarks') {
                frameworks = [
                    { value: 'yolov8-pose', label: 'YOLOv8 Pose' },
                    { value: 'yolov11-pose', label: 'YOLOv11 Pose' },
                    { value: 'mmpose', label: 'MMPose' }
                ];
            } else if (projectType === 'obb') {
                frameworks = [
                    { value: 'yolov8-obb', label: 'YOLOv8 OBB' },
                    { value: 'yolov11-obb', label: 'YOLOv11 OBB' },
                    { value: 'detectron2-rotated', label: 'Detectron2 (Rotated)' }
                ];
            } else {
                // Default to detection
                frameworks = [
                    { value: 'yolov8', label: 'YOLOv8 (Ultralytics)' },
                    { value: 'yolov5', label: 'YOLOv5' },
                    { value: 'yolov11', label: 'YOLOv11' }
                ];
            }
        } else if (modality === 'timeSeries') {
            // Time Series frameworks
            if (projectType === 'timeSeriesClassification' || projectType === 'clustering') {
                frameworks = [
                    { value: 'ts-pytorch', label: 'PyTorch (LSTM/GRU/Transformer)' },
                    { value: 'ts-tensorflow', label: 'TensorFlow/Keras' },
                    { value: 'sktime', label: 'sktime (sklearn-based)' },
                    { value: 'tsai', label: 'tsai (fastai for time series)' }
                ];
            } else if (projectType === 'timeSeriesForecasting') {
                frameworks = [
                    { value: 'ts-pytorch-forecast', label: 'PyTorch (LSTM/Transformer)' },
                    { value: 'ts-tensorflow-forecast', label: 'TensorFlow/Keras' },
                    { value: 'prophet', label: 'Prophet (Facebook)' },
                    { value: 'neuralforecast', label: 'NeuralForecast (Nixtla)' },
                    { value: 'gluonts', label: 'GluonTS (Amazon)' }
                ];
            } else if (projectType === 'anomalyDetection') {
                frameworks = [
                    { value: 'ts-pytorch-anomaly', label: 'PyTorch (AutoEncoder)' },
                    { value: 'ts-tensorflow-anomaly', label: 'TensorFlow/Keras' },
                    { value: 'pyod', label: 'PyOD (sklearn-based)' },
                    { value: 'luminaire', label: 'Luminaire (Zillow)' }
                ];
            } else {
                // Default time series frameworks
                frameworks = [
                    { value: 'ts-pytorch', label: 'PyTorch (LSTM/GRU/Transformer)' },
                    { value: 'ts-tensorflow', label: 'TensorFlow/Keras' },
                    { value: 'sktime', label: 'sktime' }
                ];
            }
        } else {
            // Default to detection for other modalities
            frameworks = [
                { value: 'yolov8', label: 'YOLOv8 (Ultralytics)' },
                { value: 'yolov5', label: 'YOLOv5' },
                { value: 'yolov11', label: 'YOLOv11' }
            ];
        }

        // Populate select
        frameworkSelect.innerHTML = frameworks.map(fw =>
            `<option value="${fw.value}">${fw.label}</option>`
        ).join('');
    }

    generateTrainingCode() {
        // Read basic parameters
        const framework = document.getElementById('codeFramework')?.value || 'yolov8';
        const model = document.getElementById('codeModel')?.value || 'm';
        const device = document.getElementById('codeDevice')?.value || 'cuda:0';
        const epochs = document.getElementById('codeEpochs')?.value || '100';
        const batch = document.getElementById('codeBatch')?.value || '16';
        const imgsz = document.getElementById('codeImgsz')?.value || '640';

        // Read advanced parameters
        const optimizer = document.getElementById('codeOptimizer')?.value || 'Adam';
        const lr = document.getElementById('codeLr')?.value || '0.001';
        const patience = document.getElementById('codePatience')?.value || '50';
        const valSplit = document.getElementById('codeValSplit')?.value || '20';

        // Read augmentation options
        const augMosaic = document.getElementById('augMosaic')?.checked || false;
        const augMixup = document.getElementById('augMixup')?.checked || false;
        const augHsv = document.getElementById('augHsv')?.checked || false;
        const augFlip = document.getElementById('augFlip')?.checked || false;
        const augRotate = document.getElementById('augRotate')?.checked || false;
        const augScale = document.getElementById('augScale')?.checked || false;

        // Read metrics/plots options
        const savePlots = document.getElementById('savePlots')?.checked || false;
        const saveConfMatrix = document.getElementById('saveConfMatrix')?.checked || false;
        const savePrCurves = document.getElementById('savePrCurves')?.checked || false;
        const savePredictions = document.getElementById('savePredictions')?.checked || false;
        const saveMetricsCsv = document.getElementById('saveMetricsCsv')?.checked || false;

        // Read export options
        const exportOnnx = document.getElementById('exportOnnx')?.checked || false;
        const exportTorchscript = document.getElementById('exportTorchscript')?.checked || false;
        const exportTflite = document.getElementById('exportTflite')?.checked || false;
        const exportOpenvino = document.getElementById('exportOpenvino')?.checked || false;
        const exportCoreml = document.getElementById('exportCoreml')?.checked || false;
        const exportTensorrt = document.getElementById('exportTensorrt')?.checked || false;

        const projectType = this.projectManager.currentProject?.type || 'detection';
        const projectName = this.projectManager.currentProject?.name || 'mi_proyecto';
        const numClasses = this.canvasManager.classes.length;
        const modality = this.getProjectModality(projectType);

        let code = '';

        // Read modality-specific parameters
        const seqLength = document.getElementById('codeSeqLength')?.value || '50';
        const forecastHorizon = document.getElementById('codeForecastHorizon')?.value || '10';
        const hiddenSize = document.getElementById('codeHiddenSize')?.value || '128';

        // Route to appropriate code generator based on modality and framework
        if (modality === 'timeSeries') {
            code = this._generateTimeSeriesCode(framework, projectName, projectType, device, numClasses, batch, epochs, lr, optimizer, saveMetricsCsv, savePlots, seqLength, forecastHorizon, hiddenSize);
        } else if (modality === 'images') {
            // Existing image-based frameworks
            code = this._generateImageCode(framework, projectName, projectType, model, device, epochs, batch, imgsz, optimizer, lr, patience, valSplit, augMosaic, augMixup, augHsv, augFlip, augRotate, augScale, savePlots, saveConfMatrix, savePredictions, saveMetricsCsv, exportOnnx, exportTorchscript, exportTflite, exportOpenvino, exportCoreml, exportTensorrt, numClasses);
        } else {
            code = `# ${this.t('export.code.template.important')}: ${modality} ${this.t('export.code.template.important').toLowerCase()}\n# Coming soon...`;
        }

        const codePreview = document.getElementById('codePreview');
        if (codePreview) {
            codePreview.textContent = code;
        }
    }

    _generateImageCode(framework, projectName, projectType, model, device, epochs, batch, imgsz, optimizer, lr, patience, valSplit, augMosaic, augMixup, augHsv, augFlip, augRotate, augScale, savePlots, saveConfMatrix, savePredictions, saveMetricsCsv, exportOnnx, exportTorchscript, exportTflite, exportOpenvino, exportCoreml, exportTensorrt, numClasses) {
        let code = '';
        const t = (key) => this.t(key);

        if (framework === 'yolov8' || framework === 'yolov11' ||
            framework === 'yolov8-seg' || framework === 'yolov11-seg' ||
            framework === 'yolov8-cls' || framework === 'yolov11-cls' ||
            framework === 'yolov8-pose' || framework === 'yolov11-pose' ||
            framework === 'yolov8-obb' || framework === 'yolov11-obb') {

            const task = this.getYOLOTask(projectType);
            const isV11 = framework.includes('yolov11');
            const modelName = isV11 ? `yolo11${model}${task}.pt` : `yolov8${model}${task}.pt`;

            code = `"""
${projectName} - Training Script
${t('export.code.template.generatedBy')}
Framework: ${isV11 ? 'YOLOv11' : 'YOLOv8'} (Ultralytics)
${t('export.code.template.projectType')}: ${this.getProjectTypeLabel(projectType)}

${t('export.code.template.important')}: ${t('export.code.template.installDeps')}
"""

# ============================================
# 1. ${t('export.code.template.installation')}
# ============================================
# ${t('export.code.template.executeCmds')}:
# pip install ultralytics
# pip install torch torchvision${savePlots || saveConfMatrix ? '\n# pip install matplotlib seaborn  # ' + t('export.code.template.forVisualization') : ''}${saveMetricsCsv ? '\n# pip install pandas  # ' + t('export.code.template.forExportMetrics') : ''}
# pip install opencv-python pillow numpy

from ultralytics import YOLO
import torch${savePlots || saveConfMatrix || saveMetricsCsv ? '\nimport matplotlib.pyplot as plt' : ''}${saveMetricsCsv ? '\nimport pandas as pd' : ''}
from pathlib import Path

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
${device.includes('cuda') ? `print(f"CUDA device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A'}")` : ''}

# ============================================
# 2. ${t('export.code.template.configuration')}
# ============================================

# ${t('export.code.template.modelAndDevice')}
MODEL_NAME = '${modelName}'
DEVICE = '${device}'

# ${t('export.code.template.basicHyperparams')}
EPOCHS = ${epochs}
BATCH_SIZE = ${batch}
IMG_SIZE = ${imgsz}
LEARNING_RATE = ${lr}
PATIENCE = ${patience}  # Early stopping

# ${t('export.code.template.dataAugmentation')}
MOSAIC = ${augMosaic ? '1.0' : '0.0'}  # Combina 4 imágenes en una
MIXUP = ${augMixup ? '0.1' : '0.0'}   # Mezcla transparencias
HSV_H = ${augHsv ? '0.015' : '0.0'}   # Color jitter: Hue
HSV_S = ${augHsv ? '0.7' : '0.0'}     # Color jitter: Saturation
HSV_V = ${augHsv ? '0.4' : '0.0'}     # Color jitter: Value
FLIPLR = ${augFlip ? '0.5' : '0.0'}   # Flip horizontal
FLIPUD = ${augFlip ? '0.1' : '0.0'}   # Flip vertical
DEGREES = ${augRotate ? '10.0' : '0.0'}  # Rotación (grados)
SCALE = ${augScale ? '0.5' : '0.0'}   # Escala aleatoria

# ============================================
# 3. ${t('export.code.template.loadPretrainedModel')}
# ============================================

model = YOLO(MODEL_NAME)
print(f"✅ ${t('export.code.template.modelLoaded')}: {MODEL_NAME}")
print(f"📦 ${t('export.code.template.parameters')}: {sum(p.numel() for p in model.model.parameters()):,}")

# ============================================
# 4. ${t('export.code.template.trainModel')}
# ============================================

results = model.train(
    # ${t('export.code.template.dataset')}
    data='data.yaml',           # Archivo YAML con rutas del dataset

    # ${t('export.code.template.basics')}
    epochs=EPOCHS,
    batch=BATCH_SIZE,
    imgsz=IMG_SIZE,
    device=DEVICE,

    # ${t('export.code.template.optimization')}
    optimizer='${optimizer}',    # Adam, AdamW, SGD, RMSprop
    lr0=LEARNING_RATE,          # Learning rate inicial
    lrf=0.01,                   # Learning rate final (como fracción de lr0)
    momentum=0.937,             # Momentum para SGD
    weight_decay=0.0005,        # Weight decay (L2 regularization)

    # Data Augmentation
    mosaic=MOSAIC,
    mixup=MIXUP,
    hsv_h=HSV_H,
    hsv_s=HSV_S,
    hsv_v=HSV_V,
    degrees=DEGREES,
    translate=0.1,
    scale=SCALE,
    fliplr=FLIPLR,
    flipud=FLIPUD,

    # Callbacks y guardado
    patience=PATIENCE,          # Early stopping patience
    save=True,                  # Guardar checkpoints
    save_period=${Math.ceil(parseInt(epochs) / 10)},               # Guardar cada N epochs

    # Visualización y métricas
    plots=${savePlots},                 # Generar gráficas de entrenamiento${saveConfMatrix ? '\n    conf=0.001,                 # Confianza mínima para confusion matrix' : ''}

    # Performance
    cache=False,                # Cachear imágenes (usa más RAM)
    workers=8,                  # Número de workers para DataLoader
    project='runs/${projectType}',   # Carpeta de resultados
    name='${projectName}',      # Nombre del experimento
    exist_ok=True,              # Sobrescribir experimentos existentes

    # Validación
    val=True,                   # Validar durante entrenamiento
    split_val=${parseFloat(valSplit) / 100.0},            # Porcentaje de validación si no existe val split
    verbose=True                # Modo verbose
)

print("\\n" + "="*50)
print("✅ ENTRENAMIENTO COMPLETADO")
print("="*50)

# ============================================
# 5. EVALUAR EL MODELO
# ============================================

# Validar con el mejor modelo
best_model_path = results.save_dir / 'weights' / 'best.pt'
model_best = YOLO(best_model_path)

print("\\n🔍 Evaluando modelo...")
metrics = model_best.val()

# Imprimir métricas clave
print("\\n📊 MÉTRICAS FINALES:")
print("-" * 40)
${projectType === 'detection' || projectType === 'obb' ? `print(f"mAP50:     {metrics.box.map50:.4f}")
print(f"mAP50-95:  {metrics.box.map:.4f}")
print(f"Precision: {metrics.box.mp:.4f}")
print(f"Recall:    {metrics.box.mr:.4f}")` :
projectType === 'segmentation' || projectType === 'instanceSeg' ? `print(f"mAP50 (box):  {metrics.box.map50:.4f}")
print(f"mAP50 (mask): {metrics.seg.map50:.4f}")
print(f"mAP50-95 (box):  {metrics.box.map:.4f}")
print(f"mAP50-95 (mask): {metrics.seg.map:.4f}")` :
projectType === 'classification' || projectType === 'multiLabel' ? `print(f"Top-1 Accuracy: {metrics.top1:.4f}")
print(f"Top-5 Accuracy: {metrics.top5:.4f}")` :
projectType === 'keypoints' ? `print(f"mAP50 (box):  {metrics.box.map50:.4f}")
print(f"mAP50 (pose): {metrics.pose.map50:.4f}")` :
`print(f"mAP50: {metrics.box.map50:.4f}")`}
print("-" * 40)

${saveMetricsCsv ? `# ============================================
# 6. EXPORTAR MÉTRICAS A CSV
# ============================================

metrics_dict = {
    'epochs': results.epoch,
    'train_loss': results.results_dict.get('train/loss', []),
    'val_loss': results.results_dict.get('val/loss', []),
}

metrics_df = pd.DataFrame(metrics_dict)
metrics_path = results.save_dir / 'metrics.csv'
metrics_df.to_csv(metrics_path, index=False)
print(f"\\n💾 Métricas guardadas en: {metrics_path}")

` : ''}${savePredictions ? `# ============================================
# 7. VISUALIZAR PREDICCIONES
# ============================================

# Predecir en imágenes de validación
val_results = model_best.predict(
    source='path/to/val/images',  # Cambiar a tu carpeta de validación
    save=True,                     # Guardar imágenes con predicciones
    conf=0.25,                     # Confianza mínima
    save_txt=False,                # No guardar labels
    save_crop=False,               # No recortar detecciones
    project=results.save_dir,
    name='predictions'
)
print(f"\\n🎨 Predicciones guardadas en: {results.save_dir / 'predictions'}")

` : ''}${exportOnnx || exportTorchscript || exportTflite || exportOpenvino || exportCoreml || exportTensorrt ? `# ============================================
# 8. EXPORTAR MODELO PARA PRODUCCIÓN
# ============================================

print("\\n📦 Exportando modelo a formatos de producción...")
${exportOnnx ? "\nmodel_best.export(format='onnx')  # ONNX - Universal\nprint('✅ ONNX exportado')" : ''}${exportTorchscript ? "\nmodel_best.export(format='torchscript')  # TorchScript - PyTorch nativo\nprint('✅ TorchScript exportado')" : ''}${exportTflite ? "\nmodel_best.export(format='tflite')  # TensorFlow Lite - Móviles\nprint('✅ TFLite exportado')" : ''}${exportOpenvino ? "\nmodel_best.export(format='openvino')  # OpenVINO - Intel CPUs\nprint('✅ OpenVINO exportado')" : ''}${exportCoreml ? "\nmodel_best.export(format='coreml')  # CoreML - iOS/macOS\nprint('✅ CoreML exportado')" : ''}${exportTensorrt ? "\nmodel_best.export(format='engine')  # TensorRT - NVIDIA GPUs\nprint('✅ TensorRT exportado')" : ''}

` : ''}print("\\n🎉 Todo listo!")
print(f"📁 Resultados en: {results.save_dir}")
print(f"🏆 Mejor modelo: {best_model_path}")
`;
        } else if (framework === 'yolov5') {
            code = this._generateYOLOv5Code(projectName, projectType, epochs, batch, imgsz, device, model, optimizer, patience, augMosaic, augMixup, augHsv, augFlip, augRotate, augScale, saveConfMatrix);
        } else if (framework === 'yolo-nas') {
            code = this._generateYOLONASCode(projectName, batch, epochs, numClasses);
        } else if (framework === 'detectron2' || framework === 'detectron2-mask' || framework === 'detectron2-rotated') {
            code = this._generateDetectron2Code(framework, projectName, projectType, batch, lr, epochs, imgsz, numClasses, augFlip, savePlots);
        } else if (framework === 'timm' || framework === 'torchvision') {
            code = this._generateClassificationCode(framework, projectName, projectType, device, numClasses, batch, epochs, lr, imgsz, model, optimizer, augFlip, augRotate, augScale, augHsv, saveMetricsCsv, savePlots);
        } else if (framework === 'smp') {
            code = this._generateSMPCode(projectName, projectType, device, numClasses, batch, epochs, lr, imgsz, model, optimizer, augFlip, augRotate, augScale, augHsv, saveMetricsCsv);
        }

        const codePreview = document.getElementById('codePreview');
        if (codePreview) {
            codePreview.textContent = code;
        }
    }

    _generateYOLOv5Code(projectName, projectType, epochs, batch, imgsz, device, model, optimizer, patience, augMosaic, augMixup, augHsv, augFlip, augRotate, augScale, saveConfMatrix) {
        return `"""
${projectName} - Training Script (YOLOv5)
Generado automáticamente por Annotix
Framework: YOLOv5
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: YOLOv5 usa CLI, no API de Python
"""

# ============================================
# 1. INSTALACIÓN
# ============================================
# Clonar repositorio YOLOv5 (solo primera vez):
# !git clone https://github.com/ultralytics/yolov5
# %cd yolov5
# !pip install -r requirements.txt

# ============================================
# 2. ENTRENAR CON CLI
# ============================================

!python train.py \\
    --img ${imgsz} \\
    --batch ${batch} \\
    --epochs ${epochs} \\
    --data ../data.yaml \\
    --weights yolov5${model}.pt \\
    --device ${device === 'cuda:0' ? '0' : 'cpu'} \\
    --optimizer ${optimizer} \\
    --patience ${patience} \\
    --project ../runs/${projectType} \\
    --name ${projectName} \\${augMosaic ? '\n    --mosaic 1.0 \\' : ''}${augMixup ? '\n    --mixup 0.1 \\' : ''}${augHsv ? '\n    --hsv_h 0.015 --hsv_s 0.7 --hsv_v 0.4 \\' : ''}${augFlip ? '\n    --fliplr 0.5 --flipud 0.1 \\' : ''}${augRotate ? '\n    --degrees 10.0 \\' : ''}${augScale ? '\n    --scale 0.5 \\' : ''}
    --cache \\
    --save-period ${Math.ceil(parseInt(epochs) / 10)}

# ============================================
# 3. VALIDAR
# ============================================

!python val.py \\
    --weights runs/train/${projectName}/weights/best.pt \\
    --data ../data.yaml \\
    --img ${imgsz} \\
    --task val${saveConfMatrix ? ' \\\n    --save-json --save-conf' : ''}

print("✅ Entrenamiento YOLOv5 completado!")
print("📁 Resultados en: runs/train/${projectName}")
`;
    }

    _generateYOLONASCode(projectName, batch, epochs, numClasses) {
        return `"""
${projectName} - Training Script (YOLO-NAS)
Generado automáticamente por Annotix
"""

from super_gradients.training import Trainer
from super_gradients.training import dataloaders
from super_gradients.training import models
from super_gradients.training.losses import PPYoloELoss
from super_gradients.training.metrics import DetectionMetrics_050

# 1. Preparar trainer
trainer = Trainer(experiment_name='${projectName}', ckpt_root_dir='checkpoints')

# 2. Configurar dataset
train_data = dataloaders.coco_detection_yolo_format_train(
    dataset_params={
        'data_dir': 'dataset/',
        'images_dir': 'images/train',
        'labels_dir': 'labels/train',
        'classes': ${numClasses}
    },
    dataloader_params={
        'batch_size': ${batch},
        'num_workers': 2
    }
)

val_data = dataloaders.coco_detection_yolo_format_val(
    dataset_params={
        'data_dir': 'dataset/',
        'images_dir': 'images/val',
        'labels_dir': 'labels/val',
        'classes': ${numClasses}
    },
    dataloader_params={
        'batch_size': ${batch},
        'num_workers': 2
    }
)

# 3. Cargar modelo
model = models.get('yolo_nas_m', num_classes=${numClasses}, pretrained_weights="coco")

# 4. Entrenar
trainer.train(
    model=model,
    training_params={
        'max_epochs': ${epochs},
        'lr_mode': 'cosine',
        'initial_lr': 5e-4,
        'optimizer': 'Adam',
        'loss': PPYoloELoss(),
        'valid_metrics_list': [DetectionMetrics_050(num_cls=${numClasses})],
        'metric_to_watch': 'mAP@0.50',
        'save_checkpoints': True
    },
    train_loader=train_data,
    valid_loader=val_data
)

print("✅ Entrenamiento YOLO-NAS completado!")
`;
    }

    _generateDetectron2Code(framework, projectName, projectType, batch, lr, epochs, imgsz, numClasses, augFlip, savePlots) {
        const isSegmentation = framework === 'detectron2-mask';
        const isRotated = framework === 'detectron2-rotated';
        const modelType = isSegmentation ? 'mask_rcnn' : isRotated ? 'FCOS' : 'faster_rcnn';

        return `"""
${projectName} - Training Script (Detectron2)
Generado automáticamente por Annotix
Framework: Detectron2 (${isSegmentation ? 'Mask R-CNN' : isRotated ? 'Rotated Detection' : 'Faster R-CNN'})
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: Detectron2 es más avanzado pero complejo
"""

# ============================================
# 1. INSTALACIÓN DE DEPENDENCIAS
# ============================================
# pip install torch torchvision
# pip install 'git+https://github.com/facebookresearch/detectron2.git'
# pip install opencv-python pycocotools matplotlib

import os
import torch
from detectron2.engine import DefaultTrainer
from detectron2.config import get_cfg
from detectron2 import model_zoo
from detectron2.data import DatasetCatalog, MetadataCatalog
from detectron2.data.datasets import register_coco_instances
from detectron2.evaluation import COCOEvaluator
${savePlots ? 'import matplotlib.pyplot as plt' : ''}

print(f"PyTorch version: {torch.__version__}")
print(f"Detectron2 version: {torch.ops.detectron2._get_torch_version()}")

# ============================================
# 2. REGISTRAR DATASET
# ============================================

# Registrar tu dataset en formato COCO
register_coco_instances(
    "${projectName}_train",
    {},
    "./annotations/instances_train.json",
    "./images/train"
)

register_coco_instances(
    "${projectName}_val",
    {},
    "./annotations/instances_val.json",
    "./images/val"
)

# ============================================
# 3. CONFIGURACIÓN DEL MODELO
# ============================================

cfg = get_cfg()
cfg.merge_from_file(model_zoo.get_config_file(
    "COCO-${isSegmentation ? 'InstanceSegmentation' : isRotated ? 'Detection' : 'Detection'}/${modelType}_R_50_FPN_3x.yaml"
))

# Datasets
cfg.DATASETS.TRAIN = ("${projectName}_train",)
cfg.DATASETS.TEST = ("${projectName}_val",)
cfg.DATALOADER.NUM_WORKERS = 4

# Modelo preentrenado
cfg.MODEL.WEIGHTS = model_zoo.get_checkpoint_url(
    "COCO-${isSegmentation ? 'InstanceSegmentation' : 'Detection'}/${modelType}_R_50_FPN_3x.yaml"
)

# Hiperparámetros
cfg.SOLVER.IMS_PER_BATCH = ${batch}
cfg.SOLVER.BASE_LR = ${lr}
cfg.SOLVER.MAX_ITER = ${Math.ceil(parseInt(epochs) * 1000)}  # Aprox epochs
cfg.SOLVER.STEPS = []  # Learning rate schedule
cfg.SOLVER.CHECKPOINT_PERIOD = ${Math.ceil(parseInt(epochs) * 100)}

# Número de clases
cfg.MODEL.ROI_HEADS.NUM_CLASSES = ${numClasses}
${isSegmentation ? `cfg.MODEL.MASK_ON = True` : ''}

# Data Augmentation
cfg.INPUT.MIN_SIZE_TRAIN = (${Math.floor(parseInt(imgsz) * 0.8)}, ${imgsz})
cfg.INPUT.MAX_SIZE_TRAIN = ${Math.ceil(parseInt(imgsz) * 1.2)}
cfg.INPUT.MIN_SIZE_TEST = ${imgsz}
cfg.INPUT.MAX_SIZE_TEST = ${imgsz}${augFlip ? '\ncfg.INPUT.RANDOM_FLIP = "horizontal"' : ''}

# Output
cfg.OUTPUT_DIR = "./output/${projectName}"
os.makedirs(cfg.OUTPUT_DIR, exist_ok=True)

# ============================================
# 4. ENTRENAR
# ============================================

trainer = DefaultTrainer(cfg)
trainer.resume_or_load(resume=False)
trainer.train()

print("\\n✅ Entrenamiento completado!")
print(f"📁 Resultados en: {cfg.OUTPUT_DIR}")

# ============================================
# 5. EVALUAR
# ============================================

from detectron2.evaluation import inference_on_dataset
from detectron2.data import build_detection_test_loader

evaluator = COCOEvaluator("${projectName}_val", cfg, False, output_dir=cfg.OUTPUT_DIR)
val_loader = build_detection_test_loader(cfg, "${projectName}_val")
results = inference_on_dataset(trainer.model, val_loader, evaluator)

print("\\n📊 MÉTRICAS FINALES:")
print(results)
`;
    }

    _generateClassificationCode(framework, projectName, projectType, device, numClasses, batch, epochs, lr, imgsz, model, optimizer, augFlip, augRotate, augScale, augHsv, saveMetricsCsv, savePlots) {
        const useTorchvision = framework === 'torchvision';

        return `"""
${projectName} - Training Script
Generado automáticamente por Annotix
Framework: ${useTorchvision ? 'TorchVision' : 'PyTorch timm'}
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: Clasificación con arquitecturas modernas
"""

# ============================================
# 1. INSTALACIÓN DE DEPENDENCIAS
# ============================================
# pip install torch torchvision${!useTorchvision ? '\n# pip install timm  # PyTorch Image Models' : ''}
# pip install pillow numpy${saveMetricsCsv ? ' pandas' : ''}${savePlots ? ' matplotlib seaborn' : ''}

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import transforms, datasets${useTorchvision ? ', models' : ''}${!useTorchvision ? '\nimport timm' : ''}
from pathlib import Path${saveMetricsCsv ? '\nimport pandas as pd' : ''}${savePlots ? '\nimport matplotlib.pyplot as plt' : ''}

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

# ============================================
# 2. CONFIGURACIÓN
# ============================================

DEVICE = torch.device('${device.replace('cuda:0', 'cuda')}')
NUM_CLASSES = ${numClasses}
BATCH_SIZE = ${batch}
EPOCHS = ${epochs}
LEARNING_RATE = ${lr}
IMG_SIZE = ${imgsz}

# ============================================
# 3. DATA AUGMENTATION Y LOADERS
# ============================================

# Transformaciones de entrenamiento
train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),${augFlip ? '\n    transforms.RandomHorizontalFlip(0.5),' : ''}${augRotate ? '\n    transforms.RandomRotation(10),' : ''}${augScale ? '\n    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.8, 1.0)),' : ''}${augHsv ? '\n    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),' : ''}
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                       std=[0.229, 0.224, 0.225])
])

# Transformaciones de validación
val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                       std=[0.229, 0.224, 0.225])
])

# Cargar dataset (estructura: train/class1, train/class2, ...)
train_dataset = datasets.ImageFolder('path/to/train', transform=train_transform)
val_dataset = datasets.ImageFolder('path/to/val', transform=val_transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE,
                         shuffle=True, num_workers=4, pin_memory=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE,
                       shuffle=False, num_workers=4, pin_memory=True)

print(f"📦 Train samples: {len(train_dataset)}")
print(f"📦 Val samples: {len(val_dataset)}")
print(f"📦 Classes: {train_dataset.classes}")

# ============================================
# 4. MODELO
# ============================================

${useTorchvision ? `# TorchVision models
model = models.resnet50(pretrained=True)  # Opciones: resnet18, resnet50, efficientnet_b0
model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)` : `# timm models (más modelos disponibles)
model = timm.create_model('efficientnet_b${model === 'n' ? '0' : model === 's' ? '1' : model === 'm' ? '2' : model === 'l' ? '3' : '4'}',
                         pretrained=True,
                         num_classes=NUM_CLASSES)`}

model = model.to(DEVICE)
print(f"✅ Modelo cargado")
print(f"📦 Parámetros: {sum(p.numel() for p in model.parameters()):,}")

# ============================================
# 5. LOSS Y OPTIMIZER
# ============================================

criterion = nn.CrossEntropyLoss()
optimizer = optim.${optimizer}(model.parameters(), lr=LEARNING_RATE)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

# ============================================
# 6. ENTRENAMIENTO
# ============================================

best_acc = 0.0
history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}

for epoch in range(EPOCHS):
    # Training
    model.train()
    train_loss = 0.0
    train_correct = 0
    train_total = 0

    for inputs, labels in train_loader:
        inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()
        _, predicted = outputs.max(1)
        train_total += labels.size(0)
        train_correct += predicted.eq(labels).sum().item()

    # Validation
    model.eval()
    val_loss = 0.0
    val_correct = 0
    val_total = 0

    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
            outputs = model(inputs)
            loss = criterion(outputs, labels)

            val_loss += loss.item()
            _, predicted = outputs.max(1)
            val_total += labels.size(0)
            val_correct += predicted.eq(labels).sum().item()

    # Metrics
    train_acc = 100. * train_correct / train_total
    val_acc = 100. * val_correct / val_total

    history['train_loss'].append(train_loss / len(train_loader))
    history['val_loss'].append(val_loss / len(val_loader))
    history['train_acc'].append(train_acc)
    history['val_acc'].append(val_acc)

    print(f"Epoch [{epoch+1}/{EPOCHS}] - "
          f"Train Loss: {train_loss/len(train_loader):.4f}, "
          f"Train Acc: {train_acc:.2f}%, "
          f"Val Loss: {val_loss/len(val_loader):.4f}, "
          f"Val Acc: {val_acc:.2f}%")

    # Save best model
    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), 'best_model.pth')
        print(f"💾 Mejor modelo guardado (accuracy: {best_acc:.2f}%)")

    scheduler.step()

print("\\n✅ Entrenamiento completado!")
print(f"🏆 Mejor accuracy: {best_acc:.2f}%")

${saveMetricsCsv ? `# Guardar métricas
metrics_df = pd.DataFrame(history)
metrics_df.to_csv('training_metrics.csv', index=False)
print("💾 Métricas guardadas en: training_metrics.csv")` : ''}

${savePlots ? `# Graficar resultados
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

ax1.plot(history['train_loss'], label='Train')
ax1.plot(history['val_loss'], label='Val')
ax1.set_title('Loss')
ax1.legend()

ax2.plot(history['train_acc'], label='Train')
ax2.plot(history['val_acc'], label='Val')
ax2.set_title('Accuracy')
ax2.legend()

plt.savefig('training_curves.png')
print("📊 Gráficos guardados en: training_curves.png")` : ''}
`;
    }

    _generateSMPCode(projectName, projectType, device, numClasses, batch, epochs, lr, imgsz, model, optimizer, augFlip, augRotate, augScale, augHsv, saveMetricsCsv) {
        return `"""
${projectName} - Training Script
Generado automáticamente por Annotix
Framework: segmentation_models.pytorch
Tipo de proyecto: ${this.getProjectTypeLabel(projectType)}

IMPORTANTE: Segmentación semántica con arquitecturas modernas
"""

# ============================================
# 1. INSTALACIÓN DE DEPENDENCIAS
# ============================================
# pip install segmentation-models-pytorch
# pip install torch torchvision
# pip install albumentations opencv-python${saveMetricsCsv ? ' pandas' : ''}

import torch
import segmentation_models_pytorch as smp
from torch.utils.data import Dataset, DataLoader
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np
from pathlib import Path${saveMetricsCsv ? '\nimport pandas as pd' : ''}

print(f"PyTorch version: {torch.__version__}")
print(f"SMP version: {smp.__version__}")

# ============================================
# 2. CONFIGURACIÓN
# ============================================

DEVICE = torch.device('${device.replace('cuda:0', 'cuda')}')
NUM_CLASSES = ${numClasses}
BATCH_SIZE = ${batch}
EPOCHS = ${epochs}
LEARNING_RATE = ${lr}
IMG_SIZE = ${imgsz}

# ============================================
# 3. DATASET PERSONALIZADO
# ============================================

class SegmentationDataset(Dataset):
    def __init__(self, images_dir, masks_dir, transform=None):
        self.images_dir = Path(images_dir)
        self.masks_dir = Path(masks_dir)
        self.transform = transform
        self.images = sorted(list(self.images_dir.glob('*.png')) + list(self.images_dir.glob('*.jpg')))

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_path = self.images[idx]
        mask_path = self.masks_dir / f"{img_path.stem}.png"

        image = cv2.imread(str(img_path))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)

        if self.transform:
            transformed = self.transform(image=image, mask=mask)
            image = transformed['image']
            mask = transformed['mask']

        return image, mask.long()

# Data Augmentation
train_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),${augFlip ? '\n    A.HorizontalFlip(p=0.5),' : ''}${augRotate ? '\n    A.Rotate(limit=10, p=0.5),' : ''}${augScale ? '\n    A.RandomScale(scale_limit=0.2, p=0.5),' : ''}${augHsv ? '\n    A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1, p=0.5),' : ''}
    A.Normalize(),
    ToTensorV2(),
])

val_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.Normalize(),
    ToTensorV2(),
])

train_dataset = SegmentationDataset('path/to/train/images', 'path/to/train/masks', train_transform)
val_dataset = SegmentationDataset('path/to/val/images', 'path/to/val/masks', val_transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)

# ============================================
# 4. MODELO
# ============================================

# Arquitecturas disponibles: Unet, UnetPlusPlus, MAnet, Linknet, FPN, PSPNet, DeepLabV3, DeepLabV3Plus
model = smp.Unet(
    encoder_name="resnet${model === 'n' ? '18' : model === 's' ? '34' : model === 'm' ? '50' : model === 'l' ? '101' : '152'}",
    encoder_weights="imagenet",
    in_channels=3,
    classes=NUM_CLASSES,
)

model = model.to(DEVICE)
print(f"✅ Modelo U-Net cargado")

# ============================================
# 5. LOSS Y OPTIMIZER
# ============================================

loss_fn = smp.losses.DiceLoss(mode='multiclass')
optimizer = torch.optim.${optimizer}(model.parameters(), lr=LEARNING_RATE)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

metrics = [
    smp.utils.metrics.IoU(threshold=0.5),
    smp.utils.metrics.Fscore(threshold=0.5),
]

# ============================================
# 6. ENTRENAMIENTO
# ============================================

best_iou = 0.0
history = {'train_loss': [], 'val_loss': [], 'val_iou': []}

for epoch in range(EPOCHS):
    # Training
    model.train()
    train_loss = 0.0

    for images, masks in train_loader:
        images, masks = images.to(DEVICE), masks.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(images)
        loss = loss_fn(outputs, masks)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()

    # Validation
    model.eval()
    val_loss = 0.0
    val_ious = []

    with torch.no_grad():
        for images, masks in val_loader:
            images, masks = images.to(DEVICE), masks.to(DEVICE)
            outputs = model(images)
            loss = loss_fn(outputs, masks)
            val_loss += loss.item()

            # Calculate IoU
            tp, fp, fn, tn = smp.metrics.get_stats(outputs.argmax(1), masks, mode='multiclass', num_classes=NUM_CLASSES)
            iou = smp.metrics.iou_score(tp, fp, fn, tn, reduction="micro")
            val_ious.append(iou.item())

    avg_val_iou = np.mean(val_ious)

    history['train_loss'].append(train_loss / len(train_loader))
    history['val_loss'].append(val_loss / len(val_loader))
    history['val_iou'].append(avg_val_iou)

    print(f"Epoch [{epoch+1}/{EPOCHS}] - "
          f"Train Loss: {train_loss/len(train_loader):.4f}, "
          f"Val Loss: {val_loss/len(val_loader):.4f}, "
          f"Val IoU: {avg_val_iou:.4f}")

    if avg_val_iou > best_iou:
        best_iou = avg_val_iou
        torch.save(model.state_dict(), 'best_unet.pth')
        print(f"💾 Mejor modelo guardado (IoU: {best_iou:.4f})")

    scheduler.step()

print("\\n✅ Entrenamiento completado!")
print(f"🏆 Mejor IoU: {best_iou:.4f}")
`;
    }

    getYOLOTask(projectType) {
        if (projectType === 'classification' || projectType === 'multiLabel') return '-cls';
        if (projectType === 'segmentation' || projectType === 'instanceSeg') return '-seg';
        if (projectType === 'keypoints') return '-pose';
        if (projectType === 'obb') return '-obb';
        return '';  // detection
    }

    getProjectTypeLabel(projectType) {
        const labels = {
            'classification': 'Clasificación Simple',
            'multiLabel': 'Clasificación Multi-Etiqueta',
            'detection': 'Detección de Objetos',
            'segmentation': 'Segmentación Semántica',
            'instanceSeg': 'Segmentación de Instancias',
            'keypoints': 'Puntos Clave',
            'obb': 'Cajas Rotadas (OBB)'
        };
        return labels[projectType] || projectType;
    }

    async copyCode() {
        const code = document.getElementById('codePreview')?.textContent;
        if (code) {
            try {
                await navigator.clipboard.writeText(code);
                this.ui.showToast('Código copiado al portapapeles', 'success');
            } catch (err) {
                this.ui.showToast('Error al copiar código', 'error');
            }
        }
    }

    downloadCode(format) {
        const code = document.getElementById('codePreview')?.textContent;
        const projectName = this.projectManager.currentProject?.name || 'training';

        if (format === 'py') {
            const blob = new Blob([code], { type: 'text/x-python' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}_train.py`;
            a.click();
            URL.revokeObjectURL(url);
            this.ui.showToast('Archivo .py descargado', 'success');
        } else if (format === 'ipynb') {
            // Create Jupyter notebook format
            const notebook = {
                cells: [
                    {
                        cell_type: 'markdown',
                        metadata: {},
                        source: [`# ${projectName} - Training Notebook\n\nGenerado automáticamente por Annotix`]
                    },
                    {
                        cell_type: 'code',
                        execution_count: null,
                        metadata: {},
                        outputs: [],
                        source: code.split('\n')
                    }
                ],
                metadata: {
                    kernelspec: {
                        display_name: 'Python 3',
                        language: 'python',
                        name: 'python3'
                    },
                    language_info: {
                        name: 'python',
                        version: '3.8.0'
                    }
                },
                nbformat: 4,
                nbformat_minor: 4
            };

            const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}_train.ipynb`;
            a.click();
            URL.revokeObjectURL(url);
            this.ui.showToast('Notebook .ipynb descargado', 'success');
        }
    }

    _generateTimeSeriesCode(framework, projectName, projectType, device, numClasses, batch, epochs, lr, optimizer, saveMetricsCsv, savePlots, seqLength, forecastHorizon, hiddenSize) {
        const t = (key) => this.t(key);
        const projectTypeLabel = this.getProjectTypeLabel(projectType);

        if (framework === 'ts-pytorch' || framework === 'ts-pytorch-forecast' || framework === 'ts-pytorch-anomaly') {
            const isForecasting = framework === 'ts-pytorch-forecast';
            const isAnomaly = framework === 'ts-pytorch-anomaly';
            const isClassification = !isForecasting && !isAnomaly;

            return `"""
${projectName} - ${t('export.code.template.trainModel')}
${t('export.code.template.generatedBy')}
Framework: PyTorch (LSTM/GRU/Transformer)
${t('export.code.template.projectType')}: ${projectTypeLabel}

${t('export.code.template.important')}: ${t('export.code.template.installDeps')}
"""

# ============================================
# 1. ${t('export.code.template.installation')}
# ============================================
# ${t('export.code.template.executeCmds')}:
# pip install torch numpy pandas scikit-learn${saveMetricsCsv ? '\n# pip install pandas  # ' + t('export.code.template.forExportMetrics') : ''}${savePlots ? '\n# pip install matplotlib seaborn  # ' + t('export.code.template.forVisualization') : ''}

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split${savePlots ? '\nimport matplotlib.pyplot as plt\nimport seaborn as sns' : ''}

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

# ============================================
# 2. ${t('export.code.template.configuration')}
# ============================================

DEVICE = torch.device('${device.replace('cuda:0', 'cuda')}' if torch.cuda.is_available() else 'cpu')
NUM_CLASSES = ${numClasses}
BATCH_SIZE = ${batch}
EPOCHS = ${epochs}
LEARNING_RATE = ${lr}
HIDDEN_SIZE = ${hiddenSize}
SEQUENCE_LENGTH = ${seqLength}
${isForecasting ? `FORECAST_HORIZON = ${forecastHorizon}  # Pasos a predecir` : ''}

print(f"Device: {DEVICE}")

# ============================================
# 3. ${t('export.code.template.dataLoading')}
# ============================================

# Cargar tus datos de series temporales
# Formato esperado: CSV con columnas [timestamp, feature1, feature2, ..., target]
df = pd.read_csv('path/to/your/timeseries.csv')

# ${t('export.code.template.prepareData')}
${isClassification ? `# Para clasificación: última columna debe ser la clase (0 a ${numClasses-1})
features = df.iloc[:, :-1].values
labels = df.iloc[:, -1].values` : isForecasting ? `# Para pronóstico: todas las columnas son features, predeciremos la primera
features = df.values` : `# Para detección de anomalías: todas las columnas son features
features = df.values`}

# Escalar datos
scaler = StandardScaler()
features_scaled = scaler.fit_transform(features)

# Crear secuencias
def create_sequences(data, seq_length${isForecasting ? ', forecast_horizon' : ''}):
    xs, ys = [], []
    for i in range(len(data) - seq_length${isForecasting ? ' - forecast_horizon + 1' : ''}):
        x = data[i:(i + seq_length)]
        ${isForecasting ? `y = data[(i + seq_length):(i + seq_length + forecast_horizon), 0]  # Predecir primera columna` : isClassification ? `y = labels[i + seq_length - 1]` : `y = data[i + seq_length]`}
        xs.append(x)
        ys.append(y)
    return np.array(xs), np.array(ys)

${isForecasting ? `X, y = create_sequences(features_scaled, SEQUENCE_LENGTH, FORECAST_HORIZON)` : `X, y = create_sequences(features_scaled, SEQUENCE_LENGTH)`}

# Train/Test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=${!isForecasting})

print(f"${t('export.code.template.trainSamples')}: {len(X_train)}")
print(f"${t('export.code.template.testSamples')}: {len(X_test)}")
print(f"${t('export.code.template.sequenceLength')}: {SEQUENCE_LENGTH}")
print(f"${t('export.code.template.numFeatures')}: {X_train.shape[2]}")

# ============================================
# 4. DATASET Y DATALOADER
# ============================================

class TimeSeriesDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.FloatTensor(X)
        self.y = torch.${isClassification ? 'LongTensor' : 'FloatTensor'}(y)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

train_dataset = TimeSeriesDataset(X_train, y_train)
test_dataset = TimeSeriesDataset(X_test, y_test)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

# ============================================
# 5. ${t('export.code.template.modelArchitecture')}
# ============================================

class ${isClassification ? 'TimeSeriesClassifier' : isForecasting ? 'TimeSeriesForecaster' : 'TimeSeriesAnomalyDetector'}(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers=2${isClassification ? ', num_classes=' + numClasses : isForecasting ? ', forecast_horizon=' + 'FORECAST_HORIZON' : ''}):
        super().__init__()

        # LSTM layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                           batch_first=True, dropout=0.2 if num_layers > 1 else 0)

        # Fully connected layers
        ${isClassification ? `self.fc = nn.Linear(hidden_size, num_classes)` : isForecasting ? `self.fc = nn.Linear(hidden_size, forecast_horizon)` : `self.fc = nn.Linear(hidden_size, input_size)  # Reconstrucción`}

    def forward(self, x):
        # x shape: (batch, seq_length, features)
        lstm_out, (hidden, cell) = self.lstm(x)

        # Usar último estado oculto
        ${isClassification || isForecasting ? `out = self.fc(lstm_out[:, -1, :])` : `out = self.fc(lstm_out[:, -1, :])  # Reconstruir última secuencia`}
        return out

model = ${isClassification ? 'TimeSeriesClassifier' : isForecasting ? 'TimeSeriesForecaster' : 'TimeSeriesAnomalyDetector'}(
    input_size=X_train.shape[2],
    hidden_size=HIDDEN_SIZE${isClassification ? '' : isForecasting ? ',\n    forecast_horizon=FORECAST_HORIZON' : ''}
).to(DEVICE)

print(f"✅ ${t('export.code.template.modelLoaded')}")
print(f"📦 ${t('export.code.template.parameters')}: {sum(p.numel() for p in model.parameters()):,}")

# ============================================
# 6. ${t('export.code.template.lossAndOptimizer')}
# ============================================

criterion = nn.${isClassification ? 'CrossEntropyLoss' : 'MSELoss'}()
optimizer = optim.${optimizer}(model.parameters(), lr=LEARNING_RATE)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=10, factor=0.5)

# ============================================
# 7. ${t('export.code.template.trainTest')}
# ============================================

history = {'train_loss': [], 'test_loss': []${isClassification ? ", 'train_acc': [], 'test_acc': []" : ''}}
best_loss = float('inf')

for epoch in range(EPOCHS):
    # ${t('export.code.template.trainEpoch')}
    model.train()
    train_loss = 0.0
    ${isClassification ? `train_correct = 0
    train_total = 0` : ''}

    for batch_X, batch_y in train_loader:
        batch_X, batch_y = batch_X.to(DEVICE), batch_y.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(batch_X)
        loss = criterion(outputs, batch_y)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()
        ${isClassification ? `
        _, predicted = outputs.max(1)
        train_total += batch_y.size(0)
        train_correct += predicted.eq(batch_y).sum().item()` : ''}

    # ${t('export.code.template.testEpoch')}
    model.eval()
    test_loss = 0.0
    ${isClassification ? `test_correct = 0
    test_total = 0` : ''}

    with torch.no_grad():
        for batch_X, batch_y in test_loader:
            batch_X, batch_y = batch_X.to(DEVICE), batch_y.to(DEVICE)
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            test_loss += loss.item()
            ${isClassification ? `
            _, predicted = outputs.max(1)
            test_total += batch_y.size(0)
            test_correct += predicted.eq(batch_y).sum().item()` : ''}

    # Métricas
    avg_train_loss = train_loss / len(train_loader)
    avg_test_loss = test_loss / len(test_loader)
    ${isClassification ? `train_acc = 100. * train_correct / train_total
    test_acc = 100. * test_correct / test_total` : ''}

    history['train_loss'].append(avg_train_loss)
    history['test_loss'].append(avg_test_loss)
    ${isClassification ? `history['train_acc'].append(train_acc)
    history['test_acc'].append(test_acc)` : ''}

    print(f"Epoch [{epoch+1}/{EPOCHS}] - "
          f"${t('export.code.template.trainLoss')}: {avg_train_loss:.4f}, "
          f"${t('export.code.template.testLoss')}: {avg_test_loss:.4f}"
          ${isClassification ? `f", ${t('export.code.template.trainAcc')}: {train_acc:.2f}%, "
          f"${t('export.code.template.testAcc')}: {test_acc:.2f}%"` : ''})

    # Guardar mejor modelo
    if avg_test_loss < best_loss:
        best_loss = avg_test_loss
        torch.save(model.state_dict(), 'best_model.pth')
        print(f"💾 ${t('export.code.template.saveBestModel')}: {best_loss:.4f})")

    scheduler.step(avg_test_loss)

print(f"\\n✅ ${t('export.code.template.trainingCompleted')}")
${saveMetricsCsv ? `
# ${t('export.code.template.saveMetrics')}
metrics_df = pd.DataFrame(history)
metrics_df.to_csv('training_metrics.csv', index=False)
print(f"💾 ${t('export.code.template.metricsSaved')}: training_metrics.csv")` : ''}
${savePlots ? `
# ${t('export.code.template.plotResults')}
plt.figure(figsize=(12, 4))

plt.subplot(1, ${isClassification ? '2' : '1'}, 1)
plt.plot(history['train_loss'], label='Train')
plt.plot(history['test_loss'], label='Test')
plt.title('Loss')
plt.xlabel('Epoch')
plt.ylabel('Loss')
plt.legend()
${isClassification ? `
plt.subplot(1, 2, 2)
plt.plot(history['train_acc'], label='Train')
plt.plot(history['test_acc'], label='Test')
plt.title('Accuracy')
plt.xlabel('Epoch')
plt.ylabel('Accuracy (%)')
plt.legend()` : ''}

plt.tight_layout()
plt.savefig('training_curves.png')
print("📊 Gráficos guardados en: training_curves.png")` : ''}
${isForecasting ? `
# ============================================
# 8. ${t('export.code.template.forecasting')}
# ============================================

model.load_state_dict(torch.load('best_model.pth'))
model.eval()

# ${t('export.code.template.makePredictions')}
with torch.no_grad():
    sample_X = torch.FloatTensor(X_test[:5]).to(DEVICE)
    predictions = model(sample_X).cpu().numpy()

    # Desescalar predicciones
    predictions_descaled = scaler.inverse_transform(
        np.concatenate([predictions, np.zeros((predictions.shape[0], features.shape[1] - predictions.shape[1]))], axis=1)
    )[:, :predictions.shape[1]]

    print(f"\\n${t('export.code.template.predictionsMade')}:")
    print(predictions_descaled)` : ''}

print("\\n🎉 ${t('export.code.template.allDone')}")
`;
        } else if (framework === 'ts-tensorflow' || framework === 'ts-tensorflow-forecast' || framework === 'ts-tensorflow-anomaly') {
            // Similar structure for TensorFlow/Keras
            return `# TensorFlow/Keras ${t('export.code.template.important')}\n# Coming soon...`;
        } else if (framework === 'sktime') {
            return `# sktime ${t('export.code.template.important')}\n# Coming soon...`;
        } else if (framework === 'prophet') {
            return `# Prophet ${t('export.code.template.important')}\n# Coming soon...`;
        } else {
            return `# ${framework} ${t('export.code.template.important')}\n# Coming soon...`;
        }
    }
}
