# 🏷️ YOLO Annotator - Sistema Completo de Anotación

## 📦 Archivos del Sistema

```
yolo-annotator/
├── yolo-annotator.html      # Interfaz principal
├── yolo-annotator.css       # Estilos completos
├── yolo-annotator.js        # Lógica de la aplicación
├── i18n.js                  # Sistema de internacionalización
├── locales/                 # Carpeta de traducciones
│   ├── en.json             # Inglés
│   ├── es.json             # Español (predeterminado)
│   ├── fr.json             # Francés
│   ├── zh.json             # Chino
│   ├── ja.json             # Japonés
│   ├── de.json             # Alemán
│   ├── pt.json             # Portugués
│   ├── it.json             # Italiano
│   ├── ru.json             # Ruso
│   └── ko.json             # Coreano
└── README.md               # Este archivo
```

## 🚀 Instalación

1. **Descargar todos los archivos** y mantenerlos en la misma carpeta
2. **Crear la carpeta `locales/`** y copiar todos los archivos JSON de idiomas
3. **Abrir `yolo-annotator.html`** en un navegador moderno

## 🌍 Sistema de Idiomas

### Idiomas Disponibles

- 🇬🇧 **Inglés** (English)
- 🇪🇸 **Español** (Spanish) - Predeterminado
- 🇫🇷 **Francés** (Français)
- 🇨🇳 **Chino** (中文)
- 🇯🇵 **Japonés** (日本語)
- 🇩🇪 **Alemán** (Deutsch)
- 🇵🇹 **Portugués** (Português)
- 🇮🇹 **Italiano** (Italiano)
- 🇷🇺 **Ruso** (Русский)
- 🇰🇷 **Coreano** (한국어)

### Cambiar Idioma

1. Clic en el selector de idioma en el header (esquina superior derecha)
2. Seleccionar el idioma deseado
3. La interfaz se actualizará automáticamente
4. **La preferencia se guarda** en localStorage

### Agregar Nuevos Idiomas

1. Copiar `locales/es.json` como plantilla
2. Renombrar a `nuevo_codigo.json` (ej: `ar.json` para árabe)
3. Traducir todas las cadenas manteniendo la estructura JSON
4. Agregar el nuevo idioma en `i18n.js`:

```javascript
this.availableLanguages = [
    // ... idiomas existentes
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];
```

## ✨ Características Principales

### 1. **Sistema de Proyectos**
- Múltiples proyectos en IndexedDB
- Tipos: Bounding Box o Segmentación (Mask)
- Import/Export de proyectos completos
- Import/Export solo configuración (para equipos)

### 2. **Herramientas de Anotación**
- **Bbox**: Dibujar rectángulos (Bounding Boxes)
- **Mask**: Pintar máscaras de segmentación
- **Select**: Seleccionar y editar anotaciones
- **Pan**: Mover la vista del canvas

### 3. **Edición Avanzada**
- Redimensionar boxes arrastrando esquinas
- Mover boxes completos
- Eliminar anotaciones individuales
- Deshacer última anotación

### 4. **Navegación**
- Flechas ← → para cambiar entre imágenes
- Galería con vista previa
- Filtros: Todas / Anotadas / Sin anotar

### 5. **Gestión de Clases**
- Crear clases ilimitadas
- Cada clase con nombre y color personalizado
- Editar y eliminar clases
- Selección rápida con teclas 1-9

### 6. **Zoom y Visualización**
- Zoom con rueda del mouse
- Pan arrastrando (tecla H o middle-click)
- Controles de zoom (+, -, reset)
- Mostrar/ocultar etiquetas

### 7. **Export**
- **Dataset ZIP** completo en formato YOLO:
  - Carpeta `images/` con todas las imágenes
  - Carpeta `labels/` con archivos .txt (formato YOLO)
  - Archivo `classes.txt` con lista de clases
- **Proyecto completo** (.yoloproject) - Portabilidad
- **Configuración** (.yoloconfig) - Para trabajo en equipo

## ⌨️ Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| **1-9** | Seleccionar clase 1-9 |
| **B** | Herramienta Bbox |
| **M** | Herramienta Mask |
| **V** | Herramienta Select |
| **H** | Herramienta Pan |
| **Ctrl+S** | Guardar imagen actual |
| **Ctrl+Z** | Deshacer última anotación |
| **Delete** | Eliminar anotación seleccionada |
| **Esc** | Deseleccionar |
| **←** | Imagen anterior |
| **→** | Imagen siguiente |

## 📊 Flujo de Trabajo Recomendado

### Para un solo usuario:

1. **Crear proyecto** → Definir nombre, tipo (bbox/mask), clases iniciales
2. **Cargar imágenes** → Subir una o múltiples imágenes
3. **Anotar** → Usar herramientas para marcar objetos
4. **Guardar** → Ctrl+S después de cada imagen
5. **Repetir** → Navegar con flechas ← →
6. **Exportar** → Descargar dataset ZIP cuando termines

### Para trabajo en equipo:

#### Líder del equipo:
1. Crear proyecto con todas las clases definidas
2. Exportar configuración (.yoloconfig)
3. Compartir archivo con el equipo

#### Miembros del equipo:
1. Importar configuración recibida
2. Anotar sus imágenes asignadas
3. Exportar su dataset ZIP individual
4. Enviar al líder

#### Líder (combinar):
1. Juntar todos los ZIP
2. Combinar carpetas images/ y labels/
3. Usar el dataset completo para entrenar

## 🔧 Integración de i18n en HTML

Para que las traducciones funcionen, agregar estos atributos a los elementos HTML:

```html
<!-- Texto simple -->
<h1 data-i18n="app.title">YOLO Annotator</h1>

<!-- Placeholder en inputs -->
<input data-i18n="classes.placeholder" placeholder="Class name">

<!-- Tooltip/title -->
<button data-i18n-title="canvas.zoomIn" title="Zoom In">
    <i class="fas fa-search-plus"></i>
</button>

<!-- Contenido HTML (permite tags) -->
<div data-i18n-html="tour.welcome"></div>
```

### Desde JavaScript:

```javascript
// Obtener traducción
const text = window.i18n.t('app.title');

// Con parámetros
const msg = window.i18n.t('project.created', { name: 'Mi Proyecto' });

// Actualizar toda la página
window.i18n.updateDOM();
```

## 🎯 Formato YOLO

Los archivos generados siguen el formato estándar YOLO:

### Estructura del archivo .txt:
```
<class_id> <x_center> <y_center> <width> <height>
```

Donde:
- `class_id`: ID de la clase (0, 1, 2, ...)
- `x_center`, `y_center`: Centro del bbox (normalizado 0-1)
- `width`, `height`: Dimensiones del bbox (normalizado 0-1)

### Ejemplo:
```
0 0.501953 0.532407 0.117188 0.237037
1 0.714844 0.654630 0.156250 0.287037
```

### classes.txt:
```
person
car
dog
```

## 💾 Almacenamiento

- **IndexedDB**: Todos los proyectos e imágenes anotadas
- **LocalStorage**: Preferencia de idioma
- **Sin servidor**: Todo funciona 100% en el cliente

## 🐛 Solución de Problemas

### Las imágenes no cargan:
- Verificar formato soportado (JPG, PNG, WebP)
- Revisar consola del navegador (F12)

### No se guardan las anotaciones:
- Verificar que hay un proyecto seleccionado
- Click en "Guardar" o Ctrl+S después de anotar

### El idioma no cambia:
- Verificar que la carpeta `locales/` existe
- Verificar que el archivo JSON del idioma está presente
- Abrir consola (F12) y buscar errores

### IndexedDB llena:
- Chrome/Edge: ~500MB-1GB límite
- Firefox: Sin límite específico
- Safari: ~1GB límite
- Exportar y limpiar proyectos viejos si necesario

## 📱 Compatibilidad

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

### Características requeridas:
- IndexedDB
- Canvas API
- Fetch API
- File API
- ES6+ JavaScript

## 🔐 Privacidad y Seguridad

- **Sin tracking**: No se envía información a servidores externos
- **Sin cuentas**: No requiere registro ni login
- **Datos locales**: Todo se almacena en el navegador del usuario
- **Sin cookies**: Solo usa localStorage para preferencias

## 📄 Licencia

Desarrollado por **FabLab TecMedHub** - Universidad Austral de Chile, Sede Puerto Montt

## 🤝 Contribuir

### Agregar traducciones:
1. Fork el proyecto
2. Crear archivo de idioma en `locales/`
3. Seguir estructura de `es.json`
4. Pull request

### Reportar bugs:
- Descripción detallada del problema
- Pasos para reproducir
- Navegador y versión
- Screenshot si es posible

## 📞 Soporte

Para preguntas o problemas:
- 📧 Email: tecmedhub@uach.cl
- 🌐 Web: [FabLab TecMedHub]

---

**Desarrollado con ❤️ en Puerto Montt, Chile 🇨🇱**
