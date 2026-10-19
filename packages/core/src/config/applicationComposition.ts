import { createRequire } from "node:module";
import { z } from "zod";
import { mergeRegistry } from "./mergeRegistry.js";
import type { Registry } from "./mergeRegistry.js";
import { ToolExecutionError } from "../errors.js";
import { ExampleMolecule } from "../molecules/ExampleMolecule.js";
import { LedgerMolecule } from "../molecules/LedgerMolecule.js";
import { domainProfile } from "./domain-profile.js";
import type {
  CellComposition,
  CellRuntimeContext,
} from "../cells/CellComposition.js";

const require = createRequire(import.meta.url);
const coreRegistry = require("./registry.json") as Registry;
const domainRegistry = require("./domain-registry.json") as Registry;

const applicationRegistry = mergeRegistry(coreRegistry, domainRegistry);
const STATUS_SCHEMA = z.enum(["active", "inactive", "pending"]);
const TX_TYPE_SCHEMA = z.enum(["ingreso", "egreso"]);

function getExampleMolecule(context: CellRuntimeContext): ExampleMolecule {
  const molecule = context.getResource<ExampleMolecule>("example");
  if (!molecule) {
    throw new ToolExecutionError(
      "example",
      "La molécula de ejemplo no está inicializada.",
    );
  }
  return molecule;
}

function getLedgerMolecule(context: CellRuntimeContext): LedgerMolecule {
  const molecule = context.getResource<LedgerMolecule>("ledger_ocr");
  if (!molecule) {
    throw new ToolExecutionError(
      "ledger_ocr",
      "La molécula de Ledger OCR no está inicializada.",
    );
  }
  return molecule;
}

/**
 * Composition root del template.
 * El registry y los handlers de dominio se ensamblan aquí, fuera de @bio/core.
 */
export function createApplicationComposition(): CellComposition {
  return {
    registry: applicationRegistry,
    allowedCells: domainProfile.allowedCells,
    registrations: [
      {
        type: "example",
        factory: (context) => {
          const resource = {
            key: "example",
            molecule: new ExampleMolecule(context.tenantDbPath),
          };
          context.trackResource(resource);
          return [resource];
        },
        registerTools: (server, context) => {
          server.registerTool(
            "create_record",
            {
              description: "Crea un registro del dominio",
              inputSchema: {
                name: z.string().min(1),
                data: z.record(z.unknown()).optional(),
              },
            },
            async ({ name, data }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getExampleMolecule(context).create(
                      name,
                      data ?? {},
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "get_record",
            {
              description: "Obtiene un registro del dominio por ID",
              inputSchema: {
                id: z.number().int().positive(),
              },
            },
            async ({ id }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getExampleMolecule(context).getById(id, context.tenantId),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "list_records",
            {
              description: "Lista registros del dominio",
              inputSchema: {
                status: STATUS_SCHEMA.optional(),
                limit: z.number().int().positive().max(100).optional(),
              },
            },
            async ({ status, limit }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getExampleMolecule(context).list(
                      status,
                      limit,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "update_record_status",
            {
              description: "Actualiza el estado de un registro",
              inputSchema: {
                id: z.number().int().positive(),
                status: STATUS_SCHEMA,
              },
            },
            async ({ id, status }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getExampleMolecule(context).updateStatus(
                      id,
                      status,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "delete_record",
            {
              description: "Elimina un registro del dominio",
              inputSchema: {
                id: z.number().int().positive(),
              },
            },
            async ({ id }) => ({
              content: [
                {
                  type: "text",
                  text: String(
                    getExampleMolecule(context).delete(id, context.tenantId),
                  ),
                },
              ],
            }),
          );
        },
      },
      {
        type: "ledger_ocr",
        factory: (context) => {
          const resource = {
            key: "ledger_ocr",
            molecule: new LedgerMolecule(context.tenantDbPath),
          };
          context.trackResource(resource);
          return [resource];
        },
        registerTools: (server, context) => {
          server.registerTool(
            "create_ledger_account",
            {
              description:
                "Crea una nueva cuenta contable (libro/cuenta bancaria)",
              inputSchema: {
                name: z.string().min(1),
                currency: z.string().optional(),
              },
            },
            async ({ name, currency }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getLedgerMolecule(context).createAccount(
                      name,
                      currency,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "add_transaction",
            {
              description: "Registra una transacción (ingreso/egreso)",
              inputSchema: {
                accountId: z.number().int().positive(),
                type: TX_TYPE_SCHEMA,
                amount: z.number().positive(),
                category: z.string().min(1),
                concept: z.string().min(1),
                date: z.number().optional(),
              },
            },
            async ({ accountId, type, amount, category, concept, date }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getLedgerMolecule(context).addTransaction(
                      accountId,
                      type,
                      amount,
                      category,
                      concept,
                      date,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "get_balance",
            {
              description: "Obtiene el saldo actual de una cuenta",
              inputSchema: {
                accountId: z.number().int().positive(),
              },
            },
            async ({ accountId }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getLedgerMolecule(context).getBalance(
                      accountId,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "get_transactions_by_category",
            {
              description: "Lista transacciones de una categoría",
              inputSchema: {
                accountId: z.number().int().positive(),
                category: z.string().min(1),
                limit: z.number().int().positive().max(100).optional(),
              },
            },
            async ({ accountId, category, limit }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getLedgerMolecule(context).getTransactionsByCategory(
                      accountId,
                      category,
                      limit,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "generate_statement",
            {
              description: "Genera un reporte contable (extracto)",
              inputSchema: {
                accountId: z.number().int().positive(),
                period: z.enum(["month", "quarter", "year"]).optional(),
              },
            },
            async ({ accountId, period }) => ({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    getLedgerMolecule(context).generateStatement(
                      accountId,
                      period,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );

          server.registerTool(
            "delete_transaction",
            {
              description: "Elimina una transacción (requiere confirmación)",
              inputSchema: {
                txId: z.number().int().positive(),
                accountId: z.number().int().positive(),
              },
            },
            async ({ txId, accountId }) => ({
              content: [
                {
                  type: "text",
                  text: String(
                    getLedgerMolecule(context).deleteTransaction(
                      txId,
                      accountId,
                      context.tenantId,
                    ),
                  ),
                },
              ],
            }),
          );
        },
      },
    ],
  };
}
