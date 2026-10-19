# ⚡ Quickstart — Prueba BioCore en 5 Minutos

## Paso 1: Instalación

```bash
cd /path/to/bio-auto-ledger

# Instalar dependencias
pnpm install

# Aprobar sharp build (si se solicita)
pnpm approve-builds

# Compilar
pnpm build:ts
```

**Esperado:** Sin errores

## Paso 2: Verificar Todo Funciona

```bash
pnpm test
```

**Esperado:** 
```
Test Files  10 passed (10)
     Tests  45 passed (45)
```

## Paso 3: Ejecutar Prueba Local

```bash
# Ejecutar script de prueba rápida
npx tsx local-tests/quick-test.ts
```

**Esperado:** Output similar a esto
```
🧪 Prueba Rápida de ReflexMolecule

============================================================

1️⃣  Inicializando...
   ✅ ReflexMolecule listo

2️⃣  Guardando reflexes de prueba...
   ✅ Reflex #1: "Scrapea example.com y guarda..."
   ✅ Reflex #2: "Descarga JSON de api.github..."
   ✅ Reflex #3: "Envía email de confirmación..."

3️⃣  Buscando reflexes similares...
   🔍 Query: "Scrapea otro sitio web..."
      ✅ Match: "Scrapea example.com y guarda..."
      📊 Similitud: 85.3%
      🎯 Modo: hint (sim=0.852)

... (más resultados)

✨ Prueba completada exitosamente!

💡 Próximos pasos:
   - Explora con tus propias tareas
   - Ajusta los ejemplos según tu negocio
   - Cuando tengas claro, crea packages/[tu-dominio]/

📚 Ver: docs/SQLITE_VEC_MIGRATION.md para más detalles
```

## ✅ Verificación Completa

Si ves esto, todo está funcionando:

- ✅ 45/45 tests pasando
- ✅ TypeScript compila limpio
- ✅ Reflexes se guardan correctamente
- ✅ Búsqueda de similitud funciona
- ✅ Embeddings calculados correctamente

## 🧪 Experimentar Más

### Prueba A: Agregar más reflexes
Edita `local-tests/quick-test.ts` y agrega más ejemplos:

```typescript
const examples = [
  {
    task: "Mi tarea de prueba 1",
    steps: ["step1", "step2"],
  },
  {
    task: "Mi tarea de prueba 2",
    steps: ["step1", "step2"],
  },
  // Agrega más aquí
];
```

Luego: `npx tsx local-tests/quick-test.ts`

### Prueba B: Verificar Embeddings
Crea `local-tests/test-embeddings.ts`:

```typescript
import { computeEmbedding, cosineSimilarity } from "../packages/core/src/atoms/embeddings.js";

async function main() {
  const emb1 = await computeEmbedding("Scrapea Google");
  const emb2 = await computeEmbedding("Extrae datos de Google");
  const emb3 = await computeEmbedding("Envía un email");

  console.log("Similitud entre emb1 y emb2:", cosineSimilarity(emb1, emb2)); // ~0.85
  console.log("Similitud entre emb1 y emb3:", cosineSimilarity(emb1, emb3)); // ~0.30
}

main();
```

Luego: `npx tsx local-tests/test-embeddings.ts`

### Prueba C: Explora ReflexMolecule manualmente
```bash
node --loader ts-node/esm --input-type=module
```

En el REPL:
```typescript
import { ReflexMolecule } from "./packages/core/src/molecules/ReflexMolecule.js";
const r = new ReflexMolecule("./test.db");
await r.initialize();
// ... experimenta aquí
await r.dispose();
```

## 🎯 Mientras Defines tu Negocio

Mantén esto cerca:

| Archivo | Propósito |
|---------|-----------|
| `local-tests/quick-test.ts` | Prueba rápida de funcionalidad |
| `docs/SQLITE_VEC_MIGRATION.md` | Detalles técnicos |
| `README.md` | Instrucciones principales |
| `.kiro/steering/` | Guías de arquitectura |

## 🚀 Cuando Tengas Clara la Estructura

1. **Identifica tu dominio:** Restaurante, Clínica, Ecommerce, etc.
2. **Crea directorio:** `packages/[tu-dominio]/`
3. **Define moléculas:** Operaciones específicas
4. **Registra en registry:** `domain-registry.json`
5. **Crea agente:** El prompt de dominio
6. **Mueve tests:** De `local-tests/` a `packages/[tu-dominio]/tests/`

## 📝 Checklist

- [ ] `pnpm install` sin errores
- [ ] `pnpm build:ts` sin warnings
- [ ] `pnpm test` pasa 45/45
- [ ] `npx tsx local-tests/quick-test.ts` funciona
- [ ] Embeddings tienen sentido (similares ~0.8+, diferentes ~0.3-)
- [ ] Puedo guardar y recuperar reflexes
- [ ] Entiendo la arquitectura general

## 🆘 Si Algo Falla

```bash
# Limpiar y reintentar
rm -rf node_modules pnpm-lock.yaml local-tests/*.db*
pnpm install
pnpm build:ts
pnpm test
npx tsx local-tests/quick-test.ts
```

## 💡 Tips

- **Local-tests es tu sandbox:** No necesitas versionear cambios ahí
- **Los embeddings son la magia:** Prueba con textos muy diferentes para entenderlos
- **No necesitas BD real:** Usa `test.db` temporal
- **Los tests son un mapa:** Si quieres entender algo, lee los tests correspondientes

---

**¿Listo?** `npx tsx local-tests/quick-test.ts` 🚀