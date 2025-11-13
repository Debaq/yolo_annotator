# Ejemplos de CSV para Series Temporales

Esta carpeta contiene archivos CSV de ejemplo para probar el sistema de anotación de series temporales de Annotix.

## 📁 Archivos Incluidos

### 1️⃣ **Serie Univariada (1 variable)**

#### `ejemplo_1serie_con_headers_timestamp.csv`
- **Descripción**: Datos de temperatura horaria durante 2 días
- **Estructura**: Con encabezados y timestamp
- **Formato**: `timestamp,temperatura`
- **Filas**: 48 mediciones (2 días × 24 horas)
- **Uso recomendado**: Forecasting, Anomaly Detection, Pattern Recognition

#### `ejemplo_1serie_sin_headers.csv`
- **Descripción**: Datos de frecuencia cardíaca (latidos por minuto)
- **Estructura**: Sin encabezados, solo valores numéricos
- **Formato**: Una columna de valores
- **Filas**: 48 mediciones
- **Uso recomendado**: Anomaly Detection, Classification, Event Detection

---

### 3️⃣ **Serie Multivariada (3 variables)**

#### `ejemplo_3series_con_headers_timestamp.csv`
- **Descripción**: Datos meteorológicos (temperatura, humedad, presión)
- **Estructura**: Con encabezados y timestamp
- **Formato**: `timestamp,temperatura,humedad,presion`
- **Filas**: 48 mediciones (2 días × 24 horas)
- **Columnas**:
  - `timestamp`: Fecha y hora de la medición
  - `temperatura`: Temperatura en °C (20-33°C)
  - `humedad`: Humedad relativa en % (43-70%)
  - `presion`: Presión atmosférica en hPa (1013-1016 hPa)
- **Uso recomendado**: Segmentation, Forecasting, Pattern Recognition

#### `ejemplo_3series_sin_headers.csv`
- **Descripción**: Datos de acelerómetro (ejes X, Y, Z)
- **Estructura**: Sin encabezados, 3 columnas numéricas
- **Formato**: `valor_x,valor_y,valor_z`
- **Filas**: 48 mediciones
- **Columnas**:
  - Columna 1: Aceleración en eje X (m/s²)
  - Columna 2: Aceleración en eje Y (m/s²)
  - Columna 3: Aceleración en eje Z (m/s² - aprox. gravedad)
- **Uso recomendado**: Event Detection, Classification, Segmentation

---

## 🔧 Cómo Usar Estos Archivos

### Paso 1: Crear Proyecto
1. Abrir Annotix
2. Crear nuevo proyecto
3. Seleccionar modalidad "Series Temporales"
4. Elegir tipo de proyecto según tu objetivo:
   - **Anomaly Detection**: Para detectar puntos anómalos
   - **Forecasting**: Para marcar ventanas de predicción
   - **Classification**: Para clasificar series completas
   - **Segmentation**: Para dividir en segmentos
   - etc.

### Paso 2: Importar CSV
1. Cargar uno de estos archivos CSV de ejemplo
2. El wizard detectará automáticamente:
   - Delimitador (`,`)
   - Si tiene encabezados o no
   - Tipos de columnas (numérico, fecha, texto)
3. Seleccionar columna de tiempo si existe (opcional)
4. Confirmar importación

### Paso 3: Anotar
- **Point annotations**: Click en puntos específicos (anomalías, eventos)
- **Range annotations**: Click y arrastrar para rangos (segmentos, patrones)
- Asignar clases según el proyecto

---

## 📊 Patrones en los Datos

### Temperatura (1 serie con timestamp)
- Patrón diario: Mínimo a las 4-5 AM, máximo a las 14-15 PM
- Tendencia: Día 2 ligeramente más caluroso que día 1
- Útil para: Detectar anomalías de temperatura, forecasting

### Frecuencia Cardíaca (1 serie sin headers)
- Patrón cíclico: Simula latidos con aceleración y desaceleración
- Rango: 69-102 bpm
- Útil para: Detectar arritmias (anomalías), clasificar estados de actividad

### Datos Meteorológicos (3 series con timestamp)
- **Temperatura**: Inversamente correlacionada con humedad
- **Humedad**: Máxima en madrugada, mínima en tarde
- **Presión**: Tendencia ascendente, estable
- Útil para: Segmentar por períodos del día, forecasting multivariado

### Acelerómetro (3 series sin headers)
- **Eje Z**: ~9.8 m/s² (gravedad) con pequeñas variaciones
- **Ejes X, Y**: Movimiento oscilatorio simulando actividad
- Útil para: Detectar eventos de movimiento, clasificar gestos

---

## 💡 Tips

- **Con timestamp**: Permite análisis temporal real (fechas específicas)
- **Sin timestamp**: Usa índice secuencial (útil para datos sintéticos)
- **Con headers**: Más descriptivo, nombres de columnas claros
- **Sin headers**: Wizard asigna nombres automáticos (Column_1, Column_2, etc.)

---

## 🎯 Casos de Uso Sugeridos

| Archivo | Tipo de Proyecto | Qué Anotar |
|---------|------------------|------------|
| `ejemplo_1serie_con_headers_timestamp.csv` | Forecasting | Marcar ventana de 24h para predecir siguiente día |
| `ejemplo_1serie_sin_headers.csv` | Anomaly Detection | Marcar latidos anormalmente altos (>100 bpm) |
| `ejemplo_3series_con_headers_timestamp.csv` | Segmentation | Segmentar en períodos: madrugada/mañana/tarde/noche |
| `ejemplo_3series_sin_headers.csv` | Event Detection | Marcar picos de aceleración (eventos de movimiento) |

---

**Generado por Annotix - Sistema de anotación para Machine Learning**
