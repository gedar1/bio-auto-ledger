/**
 * domain-profile.ts — Perfil de tu caso de uso.
 *
 * Define qué células están activas para este proyecto.
 * El LLM solo ve las células del perfil activo — todo lo demás no existe para él.
 *
 * ─── QUÉ CAMBIAR ────────────────────────────────────────────────────────────
 * 1. DOMAIN_PROFILE_ID → nombre de tu caso de uso (mismo que TENANT_PROFILE en .env)
 * 2. allowedCells      → solo las células que necesitas
 * 3. agentFile         → ruta al system prompt de tu agente
 * 4. description       → descripción legible del perfil
 *
 * ─── GUÍA DE CÉLULAS POR CASO DE USO ─────────────────────────────────────────
 * Restaurante:   ["example", "memory"]
 * SmartAlerts:   ["example", "memory"]           + agregar "http" si haces health checks
 * MotoFleet:     ["example", "memory"]           + agregar "communication" si notificas
 * Con emails:    agrega "communication"           + instalar nodemailer
 * Con scraping:  agrega "sensory"                 + instalar cheerio
 * Con git:       agrega "versioncontrol"          + instalar simple-git
 * Con archivos:  agrega "filesystem"
 * Con CLI:       agrega "system"
 *
 * REGLA: menos células = LLM más enfocado. Solo activa lo que realmente necesitas.
 */

import type { ProfileConfig } from "./profileRegistry.js";

/** Debe coincidir con TENANT_PROFILE en .env */
export const DOMAIN_PROFILE_ID = "ledger"; // ← Ledger OCR

export const domainProfile: ProfileConfig = {
  allowedCells: [
    "ledger_ocr", // ← célula de dominio para operaciones contables
    "memory", // ← SQLite genérico para queries ad-hoc
    "sensory", // ← Web scraping de datos externos
    "http", // ← Consumo de APIs de terceros
    "filesystem", // ← Lectura/escritura de archivos contables
    "communication", // ← Notificaciones (email, alertas)
  ],
  agentFile: "./domain-agent.md",
  description:
    "Ledger OCR — Automatización contable con OCR y análisis inteligente",
};
