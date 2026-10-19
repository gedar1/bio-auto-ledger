# Ledger OCR

## Status: MVP Verificado ✅

**Fecha de Verificación:** 2024-10-19  
**Componentes Probados:**

- ✅ TypeScript compilation (0 errors)
- ✅ ReceiptMolecule - almacenamiento y gestión de recibos
- ✅ CategoryMolecule - categorización de gastos
- ✅ Local test - ciclo completo OCR

---

## Descripción del negocio

Ledger OCR es una plataforma de gestión y control de gastos empresariales que combina carga de comprobantes, reconocimiento óptico de caracteres (OCR) y revisión asistida por inteligencia artificial.

Su objetivo es reducir el trabajo manual asociado a la digitación, clasificación y validación de facturas y recibos, proporcionando una fuente centralizada de información financiera para clientes, contadores y administradores.

La plataforma permite transformar comprobantes en registros de gastos estructurados, manteniendo un flujo de revisión humana para garantizar la calidad de los datos antes de utilizarlos en reportes contables o financieros.

## Problema que resuelve

Las empresas y profesionales suelen administrar sus gastos mediante fotografías, archivos PDF, correos electrónicos y hojas de cálculo. Este proceso genera varios problemas:

- Digitación manual de la información de cada comprobante.
- Pérdida o duplicación de recibos.
- Errores en fechas, valores, impuestos o proveedores.
- Dificultad para clasificar los gastos correctamente.
- Falta de visibilidad sobre los gastos de cada cliente.
- Retrasos en la preparación de reportes contables.
- Ausencia de trazabilidad sobre quién revisó o modificó la información.

Ledger OCR centraliza estos comprobantes y automatiza la extracción inicial de la información, permitiendo que un usuario revise y confirme los datos antes de considerarlos confiables.

## Propuesta de valor

Ledger OCR ofrece:

1. **Captura centralizada de comprobantes**
   Los usuarios pueden cargar imágenes o documentos relacionados con sus gastos.

2. **Extracción automática de datos**
   El sistema identifica información como proveedor, fecha, subtotal, impuestos, total y número de comprobante.

3. **Revisión humana asistida**
   Los resultados del OCR pueden revisarse y corregirse antes de ser aprobados.

4. **Clasificación de gastos**
   Cada gasto puede asociarse a una categoría, cliente, proyecto o centro de costo.

5. **Colaboración entre clientes y contadores**
   Los clientes pueden registrar sus gastos y los contadores pueden revisarlos, validarlos y darles seguimiento.

6. **Reportes y análisis**
   La información aprobada puede utilizarse para visualizar tendencias, distribución de gastos y comportamiento financiero.

7. **Trazabilidad**
   Los cambios y estados de revisión permiten conocer el progreso de cada comprobante.

## Actores del sistema

### Cliente

Es la persona o empresa que registra y administra sus propios gastos.

Puede:

- Cargar comprobantes.
- Consultar sus gastos.
- Revisar la información detectada por OCR.
- Corregir datos incorrectos.
- Asignar categorías.
- Consultar reportes básicos.
- Ver el estado de aprobación de sus gastos.

### Contador

Es el profesional responsable de revisar y validar la información financiera de uno o varios clientes.

Puede:

- Consultar los clientes asignados.
- Revisar comprobantes pendientes.
- Validar o rechazar resultados del OCR.
- Corregir información contable.
- Administrar categorías.
- Consultar análisis y reportes.
- Dar seguimiento a gastos incompletos o inconsistentes.

### Administrador

Gestiona la configuración general de la plataforma.

Puede:

- Administrar usuarios.
- Gestionar clientes y contadores.
- Configurar categorías.
- Supervisar el flujo de revisión.
- Consultar indicadores globales.
- Mantener reglas generales del sistema.

## Dominio principal

El dominio principal de Ledger OCR es la **gestión digital de gastos y comprobantes para procesos contables**.

El sistema no se limita a almacenar imágenes. Cada comprobante representa una unidad de información financiera que atraviesa un ciclo de vida:

```text
Carga
  ↓
Procesamiento OCR
  ↓
Revisión
  ↓
Corrección
  ↓
Clasificación
  ↓
Aprobación
  ↓
Análisis o reporte
```
