# Ledger OCR Integration Plan

**Date:** October 19, 2024  
**Branch:** `feature/ledger-ocr`  
**Status:** Investigation Complete

---

## Executive Summary

This document outlines the integration strategy for Ledger OCR capability into BioCore's core template. The system currently has **no dedicated ledger package** — all infrastructure is in `packages/core`. The integration will extend BioCore's domain-specific configuration without creating a new package, keeping the lightweight template structure intact.

---

## Current Project State

### Directory Structure
```
bio-auto-ledger/
├── packages/
│   └── core/                       ← Single package, monolithic template
│       └── src/
│           ├── atoms/              → Functional utilities (no state)
│           ├── cells/              → Dynamic MCP server
│           ├── config/
│           │   ├── registry.json              ← Core cell types
│           │   ├── domain-registry.json       ← Domain-specific cells
│           │   ├── domain-profile.ts          ← Domain cell configuration
│           │   ├── profileRegistry.ts         ← Profile registration
│           │   ├── domain-agent.md            ← System prompt (placeholder)
│           │   └── ILogger.ts, telemetry.ts, etc.
│           ├── molecules/          → Business logic (DB, HTTP, Scraper, etc.)
│           ├── organisms/          → MCP subprocess controllers
│           ├── infrastructure/     → Cross-cutting (CircuitBreaker, Scheduler, etc.)
│           └── system/             → Orchestrator + Cortex
├── local-tests/
│   ├── quick-test.ts               ← Testing ReflexMolecule with embeddings
│   ├── quick-test-simple.ts        ← Testing ReflexMolecule with dummy vectors
│   └── (other test files)
├── .agents/
│   └── tasks/                      ← Workflow placeholder
└── data/                           ← Runtime database (ignored in git)
```

### No packages/ledger/ Exists
- BioCore is **not yet split by domain**
- There is **no separate @bio/ledger package**
- All domain-specific code goes into `packages/core/src/config/` and `packages/core/src/molecules/`

---

## Current Configuration Files

### 1. packages/core/src/config/registry.json

**Purpose:** Core cell type catalog (all projects share this)

**Current cells:**
- `sensory` — Web scraping, APIs, RSS feeds
- `sensory_advanced` — Advanced scraping with pagination
- `memory` — SQLite queries, persistence
- `filesystem` — File I/O
- `communication` — Email, WhatsApp
- `versioncontrol` — Git operations
- `http` — HTTP requests (GET, POST, PUT, DELETE)
- `system` — CLI execution (ffmpeg, imagemagick, etc.)
- `realtime` — WebSocket bidirectional
- `monitor` — Combined sensory + HTTP + system
- `undifferentiated` — Initial state (no capabilities)

**Status:** ✅ Complete, ready for domain extension

### 2. packages/core/src/config/domain-registry.json

**Purpose:** Domain-specific cell types (extends registry.json at boot)

**Current content:**
```json
{
  "cells": [
    {
      "type": "example",
      "description": "Domain record management: create, list, update, delete",
      "tools": [
        "create_record",
        "get_record",
        "list_records",
        "update_record_status",
        "delete_record"
      ]
    }
  ]
}
```

**What needs to change for Ledger OCR:**
1. Rename `"type": "example"` → `"type": "ledger_ocr"`
2. Update `tools` array with actual Ledger OCR capabilities
3. Add `description` matching Ledger domain

### 3. packages/core/src/config/domain-profile.ts

**Purpose:** Which cells are active for this project

**Current content:**
```typescript
export const DOMAIN_PROFILE_ID = "domain";

export const domainProfile: ProfileConfig = {
  allowedCells: ["example", "memory", /* others commented */],
  agentFile: "config/domain-agent.md",
  description: "Profile of the domain — personalize this description",
};
```

**What needs to change for Ledger OCR:**
1. Change `DOMAIN_PROFILE_ID` from `"domain"` → `"ledger"` (matches TENANT_PROFILE in .env)
2. Update `allowedCells`:
   - Keep `"memory"` (for SQLite storage)
   - Replace `"example"` with `"ledger_ocr"` (or similar)
   - Add `"sensory"` (for web scraping receipts)
   - Add `"http"` (for external ledger APIs)
   - Add `"filesystem"` (for reading/writing ledger files)
   - Add `"communication"` (for notifications)
3. Update `agentFile` path (or keep `config/domain-agent.md`)
4. Update `description` to reflect Ledger OCR purpose

### 4. packages/core/src/config/profileRegistry.ts

**Purpose:** Registration system for domain profiles

**Current state:** ✅ Complete. No changes needed. The registry auto-registers `DOMAIN_PROFILE_ID` from `domain-profile.ts` at boot.

---

## Molecules to Integrate or Create

### Existing Molecules (Already in packages/core/src/molecules/)

| Molecule | Used in Ledger OCR? | Status |
|----------|-------------------|--------|
| DatabaseMolecule | ✅ Yes | Ready (SQLite for ledger storage) |
| FileSystemMolecule | ✅ Yes | Ready (read/write ledger files) |
| HTTPMolecule | ✅ Yes | Ready (consume external ledger APIs) |
| GmailMolecule | ✅ Yes | Ready (send notifications) |
| GitMolecule | ⚠️ Maybe | Ready if version tracking needed |
| ScraperMolecule | ✅ Yes | Ready (web scraping receipts) |
| SystemMolecule | ⚠️ Maybe | Ready if CLI tools needed |
| ExampleMolecule | ❌ No | Replace with LedgerMolecule |
| ReflexMolecule | ✅ Yes | Ready (memory + embeddings) |
| HistoryMolecule | ✅ Yes | Ready (conversation history) |

### New Molecules to Create

If Ledger OCR has domain-specific logic that doesn't fit existing molecules:

1. **LedgerMolecule** (replaces ExampleMolecule)
   - File: `packages/core/src/molecules/LedgerMolecule.ts`
   - Implements: `IMolecule`
   - Responsibility:
     - Core ledger operations (create ledger, add transaction, balance check)
     - Domain validation (only transactions for known accounts)
     - Report generation (monthly statements, category summaries)
   - Tools exposed to LLM:
     - `create_ledger_account`
     - `add_transaction`
     - `get_balance`
     - `get_transactions_by_category`
     - `generate_statement`
   - NOT responsible for: OCR extraction, UI, HTTP integration (those are separate molecules)

2. **OCRMolecule** (optional, if OCR extraction is complex)
   - File: `packages/core/src/molecules/OCRMolecule.ts`
   - Implements: `IMolecule`
   - Responsibility:
     - Extract text from receipt images (tesseract or cloud API)
     - Parse invoice/receipt structure (amount, vendor, date)
     - Return structured JSON for LedgerMolecule to consume
   - Tools exposed to LLM:
     - `ocr_extract_text`
     - `parse_receipt_structure`
   - Alternative: embed this in FileSystemMolecule or call external OCR API via HTTPMolecule

---

## Current Reflex/Memory Setup

### ReflexMolecule Status

✅ **Operational** — Tests confirm initialization and save/retrieve cycle works

**Current behavior:**
- Stores successful tool sequences in SQLite
- Uses embeddings for semantic similarity search (via `@xenova/transformers`, 384-dim, $0 local)
- Supports 3 modes:
  - **REFLEX** (≥0.95 similarity + ≥3 successes): Direct execution, 0 LLM tokens
  - **HINT** (≥0.80 similarity): Inject context to LLM
  - **NORMAL** (< 0.80): Full LLM reasoning
- Includes temporal decay and adaptive threshold

**Known warnings (non-blocking):**
- `sqlite-vec` index not initialized (extension not available on this system)
- Falls back to linear scan for vector search (still functional, ~O(n) instead of O(log n))
- Embedding validation warns on invalid vectors (handled gracefully)

**For Ledger OCR:**
- Reflexes will automatically learn successful ledger workflows
- Examples: "add monthly expenses", "check account balance", "categorize transactions"
- No additional setup required; inherit system defaults

---

## Type/Interface Conflicts to Resolve

### No conflicts detected

**Reason:** Domain config uses separate files that merge at boot:
1. `registry.json` (core, immutable)
2. `domain-registry.json` (domain, merged in)
3. `domain-profile.ts` (domain, registered at startup)

The merger (`mergeRegistry.ts`) combines both registries by cell `type`. As long as Ledger OCR cell types don't duplicate core types (e.g., don't name a cell "memory" when "memory" already exists in core), there are no conflicts.

**Recommendation:**
- Use clear naming: `type: "ledger_ocr"` (not generic like "records")
- Match tools in domain-registry.json with molecule methods
- Validate in tests that merged registry contains all expected types

---

## Integration Steps (In Order)

### Step 1: Create LedgerMolecule
- [ ] File: `packages/core/src/molecules/LedgerMolecule.ts`
- [ ] Implements `IMolecule` interface (name, version, initialize, dispose)
- [ ] Define tools (e.g., add_transaction, get_balance, generate_statement)
- [ ] Add tests: `packages/core/tests/molecules/LedgerMolecule.spec.ts`
- [ ] Register molecule in cell's composition (CellServer)

### Step 2: Update domain-registry.json
- [ ] Replace `type: "example"` with `type: "ledger_ocr"`
- [ ] Add tools matching LedgerMolecule public methods
- [ ] Example structure:
  ```json
  {
    "type": "ledger_ocr",
    "description": "Ledger management: record transactions, query balance, generate reports",
    "tools": [
      "create_ledger_account",
      "add_transaction",
      "get_balance",
      "get_transactions_by_category",
      "generate_statement",
      "delete_transaction"
    ]
  }
  ```

### Step 3: Update domain-profile.ts
- [ ] Change `DOMAIN_PROFILE_ID = "domain"` → `"ledger"`
- [ ] Update `allowedCells: ["ledger_ocr", "memory", "sensory", "http", "filesystem", "communication"]`
- [ ] Update `agentFile: "config/domain-agent.md"`
- [ ] Update `description`

### Step 4: Create/Update domain-agent.md
- [ ] File: `packages/core/src/config/domain-agent.md`
- [ ] System prompt for Ledger OCR domain
- [ ] Include: role, vocabulary, typical workflows, safety rules
- [ ] Reference agent: `packages/core/src/config/agents/dev-agent.md` (template)

### Step 5: Update .env
- [ ] Change `TENANT_PROFILE=domain` → `TENANT_PROFILE=ledger`
- [ ] Ensure other vars are correct (LLM key, log level, etc.)

### Step 6: Test Integration
- [ ] Run: `npm run build:ts` (type check)
- [ ] Run: `npm test` (unit tests + integration)
- [ ] Run manual test: `npx tsx local-tests/integration-test.ts`
  - Create sample ledger
  - Add transactions
  - Query balance
  - Verify Reflex stores successful sequences

### Step 7: Verify Invariants
- [ ] Run: `npx tsx scripts/verify-invariants.ts` (complete gate)
  - Build all packages
  - Type check core + dashboard
  - Run full test suite
  - Verify MCP tools export

### Step 8: Git Commit
- [ ] Stage: `git add packages/core/src/molecules/LedgerMolecule.ts`
- [ ] Stage: `git add packages/core/src/config/domain-registry.json`
- [ ] Stage: `git add packages/core/src/config/domain-profile.ts`
- [ ] Stage: `git add packages/core/src/config/domain-agent.md`
- [ ] Commit: `git commit -m "feat: add ledger OCR domain with molecule and configuration"`

---

## File Dependency Map

```
domain-profile.ts
  ├── profileRegistry.ts    (imports DOMAIN_PROFILE_ID)
  └── domain-agent.md       (referenced as string path)

domain-registry.json
  └── CellServer.ts         (merged into registry at boot)

LedgerMolecule.ts
  ├── IMolecule             (interface from molecules/interfaces/)
  ├── DatabaseMolecule      (composition: store ledger data)
  ├── errors.ts             (MoleculeError, ToolExecutionError)
  └── ILogger.ts            (inject logger)

CellServer.ts
  ├── domain-registry.json  (load ledger_ocr tools)
  ├── LedgerMolecule        (instantiate if type="ledger_ocr")
  └── IMolecule             (interface)

BaseOrchestrator.ts
  ├── profileRegistry       (get allowed cells)
  ├── CellServer            (instantiate for active cells)
  └── ReflexMolecule        (store successful sequences)
```

---

## Technology Stack (No Changes Needed)

| Layer | Technology | Status |
|-------|-----------|--------|
| Language | TypeScript 5.x | ✅ |
| Runtime | Node.js 20+ | ✅ |
| Validation | Zod | ✅ |
| Database | SQLite (better-sqlite3) | ✅ |
| Logging | Pino | ✅ |
| Memory | Xenova (transformers.js) | ✅ |
| Testing | Vitest | ✅ |
| Build | esbuild (via package.json) | ✅ |

---

## Risk Assessment

### Low Risk
- ✅ Adding new cell type (domain-registry.json) — isolated change
- ✅ Creating LedgerMolecule — follows IMolecule contract
- ✅ Updating domain-profile.ts — only affects this tenant

### Medium Risk
- ⚠️ Registry merge logic — must not break core cells (mitigation: add test for merged registry)

### No Breaking Changes
- ✅ Existing core molecules remain unchanged
- ✅ Existing tests remain valid
- ✅ Existing profiles (if any) unaffected

---

## Testing Checklist

- [ ] `LedgerMolecule.spec.ts`: Unit tests for all public methods
  - Initialize/dispose lifecycle
  - Add transaction, get balance, generate statement
  - Error handling (invalid account, negative balance, etc.)

- [ ] Registry merge test: Confirm domain + core cells merged correctly
  - `registry.json` has 11 core cells
  - `domain-registry.json` adds 1 ledger cell
  - Merged registry has 12 cells total
  - No duplicates

- [ ] Profile test: Confirm profile registration works
  - DOMAIN_PROFILE_ID loads successfully
  - allowedCells includes ledger_ocr
  - agentFile path is valid

- [ ] Invariants gate:
  - `npm run build:ts` passes
  - `npm test` passes
  - `npx tsx scripts/verify-invariants.ts` passes (5 checks)

---

## Known Limitations / Future Work

### Phase 1 (Current)
- ✅ Basic ledger CRUD (create, read, update, delete transactions)
- ✅ Integration with existing molecules (DB, HTTP, Filesystem)
- ✅ Automatic Reflex learning of successful workflows

### Phase 2 (Future)
- ⏳ OCRMolecule for receipt image parsing (if needed)
- ⏳ Receipt import API (multi-file batch processing)
- ⏳ Dashboard widgets for ledger visualization
- ⏳ Multi-currency support
- ⏳ Tax category inference (AI-powered)

---

## References

- **BioCore Architecture:** [Steering: biocore-architecture]
- **Molecule Creation Guide:** [Skill: create-molecule]
- **Domain Integration:** [docs/biocore/biocore-architecture.md]
- **Glossary:** [Steering: biocore-glossary]
- **Execution Flow:** [Steering: biocore-execution-flow]

---

**Document Version:** 1.0  
**Last Updated:** October 19, 2024  
**Next Review:** After integration step 3 (profile + registry validation)
