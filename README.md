# bio-template 🧬

Template de arranque para crear un proyecto sobre BioCore. El checkout mínimo concentra el motor y la extensión de dominio en `packages/core`; no presupone `packages/domain` ni un dashboard instalado.

## Estructura

```
bio-template/
├── packages/core/          ← motor sincronizado + extensión de ejemplo
│   └── src/
│       ├── molecules/ExampleMolecule.ts
│       ├── config/domain-*.{json,ts,md}
│       ├── config/applicationComposition.ts
│       └── application-cell.ts
├── scripts/                ← utilidades sincronizadas desde bio-core
├── .kiro/steering/         ← steering canónico compartido
├── .kiro/hooks/            ← hooks oficiales compartidos
└── docs/START_HERE.md
```

Los archivos cuyo nombre comienza por `template-` son propiedad de este checkout. La sincronización nunca los sobrescribe.

## Inicio rápido

```bash
# 1. Copia este repositorio a tu proyecto
cp -r bio-template/ bio-mi-proyecto/
cd bio-mi-proyecto/

# 2. Configura tus variables locales (no se versionan)
cp .env.example .env

# 3. Instala y verifica
pnpm install
pnpm approve-builds  # Si se solicita (para sharp)
pnpm run validate-template
pnpm run build:ts
pnpm test
```

**Dependencias nativas:**

- `better-sqlite3` — Obligatoria para persistencia SQLite
- `sqlite-vec` — Búsqueda vectorial nativa O(log n) en SQLite
- `@xenova/transformers` — Generación local de embeddings 384D (sin API externa)

Todas están pre-compiladas y no requieren C++ toolchain en tu máquina.

### 📝 Nota: Migración de HNSW (v1.0) a sqlite-vec (v1.1+)

En **v1.0**, BioCore usaba `hnswlib-node` para búsqueda vectorial. Esto requería compilación C++ durante `npm install`, causando fallos frecuentes en CI/CD y incompatibilidades entre plataformas.

En **v1.1+**, se usa `sqlite-vec` directamente en SQLite:

- ✅ Sin compilación requerida (pre-compilado)
- ✅ 99%+ confiabilidad de instalación
- ✅ Instalación 5-8× más rápida
- ✅ Mismo resultado funcional (API sin cambios)
- ⚠️ Búsqueda O(log n) vs O(log n), imperceptible para usuarios

Si estás usando v1.0, actualiza a v1.1+ para mejor confiabilidad. Es transparente — no hay cambios de API.

## Registrar una cell de dominio

Una aplicación vertical registra sus capacidades en `packages/core/src/config/applicationComposition.ts`: combina `registry.json` con `domain-registry.json`, crea la molécula en un `factory` y registra sus tools en `registerTools`. `CellServer` recibe esa composición dentro del proceso MCP; no se serializan funciones por transporte.

Para que `BaseOrganisms` lance la composición de la aplicación, usa el entrypoint compilado y define `BIOCORE_CELL_SERVER_PATH` con la ruta absoluta a `packages/core/dist/application-cell.js`. Ese entrypoint importa `createApplicationComposition()` y llama a `runCellServer()`. Así una aplicación vertical añade una cell sin modificar ni editar switches de `@bio/core`.

## Mantener el template actualizado

`bio-core` es la fuente de verdad. El sincronizador usa `BIO_TEMPLATE_PATH` si está definido; si no, busca el checkout hermano `../bio-template`.

```bash
# Desde la raíz de bio-core, con el checkout hermano por defecto
pnpm run sync-template

# O con cualquier checkout explícito (ruta absoluta o relativa a bio-core)
BIO_TEMPLATE_PATH=C:/ruta/a/bio-template pnpm run sync-template
```

La sincronización actualiza `packages/core`, `packages/dashboard` cuando existe, configuraciones raíz, `scripts/validate-template-contract.ts`, `.kiro/steering` y `.kiro/hooks`. Copia archivos normales, nunca symlinks, y no elimina steering/hooks del template ni sobrescribe nombres `template-*`. También conserva los archivos de dominio `domain-*` y `ExampleMolecule.ts` del template.

Después de sincronizar, valida ambos checkouts cuando sus dependencias estén instaladas:

```bash
# En bio-core
pnpm run validate-template

# En bio-template
pnpm run validate-template
```

El contrato solo revisa estructura, JSON y configuración mínima. No necesita `.env`, bases SQLite, `data/`, `dist/` ni datos reales; el `.gitignore` del template debe protegerlos.
