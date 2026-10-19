/**
 * LedgerMolecule — Gestión de transacciones y contabilidad.
 *
 * Proporciona capacidades de ledger para crear cuentas, registrar transacciones,
 * mantener saldos y generar reportes contables.
 *
 * ─── REGLAS ──────────────────────────────────────────────────────────────────
 * ✅ Implementa IMolecule (name, version, initialize, dispose)
 * ✅ Usa createLogger para todos los logs
 * ✅ Inicializa conexiones en initialize(), no en el constructor
 * ✅ Cierra conexiones en dispose()
 * ✅ Valida inputs con Zod antes de operaciones
 * ❌ No depende de otras moléculas
 * ❌ No usa estado global
 */

import Database from "better-sqlite3";
import { z } from "zod";
import { createLogger } from "../config/logger.js";
import { MoleculeError } from "../errors.js";
import type { IMolecule } from "./interfaces/IMolecule.js";

const log = createLogger("LedgerMolecule");

// ─── Tipos del dominio ────────────────────────────────────────────────────────

/**
 * Representa una cuenta en el sistema de contabilidad.
 */
export interface Account {
  id: number;
  name: string;
  currency: string;
  balance: number;
  createdAt: number;
}

/**
 * Representa una transacción individual en el ledger.
 */
export interface Transaction {
  id: number;
  accountId: number;
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  concept: string;
  date: number;
  createdAt: number;
}

/**
 * Representa un estado de cuenta dentro de un período de tiempo.
 */
export interface Statement {
  accountId: number;
  period?: "month" | "quarter" | "year";
  balance: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  transactions: Transaction[];
}

type TransactionRow = {
  id: number;
  account_id: number;
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  concept: string;
  date: number;
  created_at: number;
};

type AccountRow = {
  id: number;
  name: string;
  currency: string;
  balance: number;
  created_at: number;
};

const AccountRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  currency: z.string(),
  balance: z.number(),
  created_at: z.number().int(),
});

const TransactionRowSchema = z.object({
  id: z.number().int(),
  account_id: z.number().int(),
  type: z.enum(["ingreso", "egreso"]),
  amount: z.number(),
  category: z.string(),
  concept: z.string(),
  date: z.number().int(),
  created_at: z.number().int(),
});

// Input validation schemas
const CreateAccountSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  currency: z.string().min(1, "Currency es requerida"),
});

const AddTransactionSchema = z.object({
  accountId: z.number().int().positive(),
  type: z.enum(["ingreso", "egreso"]),
  amount: z.number().positive("Amount debe ser positivo"),
  category: z.string().min(1, "Category es requerida"),
  concept: z.string().min(1, "Concept es requerido"),
});

const GetBalanceSchema = z.object({
  accountId: z.number().int().positive(),
});

const GetTransactionsByCategorySchema = z.object({
  accountId: z.number().int().positive(),
  category: z.string().min(1),
});

const GenerateStatementSchema = z.object({
  accountId: z.number().int().positive(),
});

// ─── Molécula ────────────────────────────────────────────────────────────────

export class LedgerMolecule implements IMolecule {
  readonly name = "ledger";
  readonly version = "1.0.0";

  private db!: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string = process.env.DATABASE_PATH ?? "./biocore.db") {
    this.dbPath = dbPath;
  }

  // ─── Ciclo de vida ──────────────────────────────────────────────────────────

  /**
   * Inicializa la molécula: abre conexión y crea el schema.
   */
  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");
      this.initSchema();
      log.info({ path: this.dbPath }, "LedgerMolecule inicializada");
    } catch (error: any) {
      throw new MoleculeError(
        this.name,
        `Error al inicializar: ${error.message}`,
        { path: this.dbPath },
      );
    }
  }

  /**
   * Libera recursos: cierra la conexión a la base de datos.
   */
  async dispose(): Promise<void> {
    try {
      this.db?.close();
      log.debug("LedgerMolecule liberada");
    } catch (error: any) {
      log.warn({ error: error.message }, "Error al cerrar base de datos");
    }
  }

  // ─── Schema ──────────────────────────────────────────────────────────────────

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        name     TEXT    NOT NULL,
        currency TEXT    NOT NULL,
        balance  REAL    NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        type       TEXT    NOT NULL,
        amount     REAL    NOT NULL,
        category   TEXT    NOT NULL,
        concept    TEXT    NOT NULL,
        date       INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_account
        ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category
        ON transactions(account_id, category);
      CREATE INDEX IF NOT EXISTS idx_transactions_date
        ON transactions(date);
    `);
  }

  // ─── Métodos públicos = herramientas MCP ────────────────────────────────────

  /**
   * Crea una nueva cuenta en el sistema de contabilidad.
   *
   * @param name - Nombre de la cuenta
   * @param currency - Moneda (ej: "USD", "ARS", "EUR"), opcional
   * @param tenantId - ID del tenant (para aislamiento de datos)
   * @returns La cuenta creada
   * @throws MoleculeError si la validación falla o hay error de BD
   */
  createAccount(
    name: string,
    currency?: string,
    tenantId: string = "default",
  ): Account {
    try {
      CreateAccountSchema.parse({ name, currency: currency || "USD" });

      const now = Date.now();
      const currencyToUse = currency || "USD";
      const result = this.db
        .prepare(
          `INSERT INTO accounts (name, currency, balance, created_at)
           VALUES (?, ?, 0, ?)`,
        )
        .run(name, currencyToUse, now);

      const id = Number(result.lastInsertRowid);
      log.info(
        { id, name, currency: currencyToUse, tenantId },
        "Cuenta creada",
      );

      const account = this.getAccountById(id);
      if (!account) {
        throw new MoleculeError(
          this.name,
          `No se pudo recuperar la cuenta recién creada (${id})`,
          { tenantId },
        );
      }
      return account;
    } catch (error: any) {
      if (error.code === "VALIDATION_ERROR" || error instanceof MoleculeError) {
        throw error;
      }
      throw new MoleculeError(
        this.name,
        `Error al crear cuenta: ${error.message}`,
        { tenantId },
      );
    }
  }

  /**
   * Registra una nueva transacción en el ledger.
   *
   * @param accountId - ID numérico de la cuenta
   * @param type - Tipo de transacción: "ingreso" o "egreso"
   * @param amount - Monto de la transacción (debe ser positivo)
   * @param category - Categoría de la transacción
   * @param concept - Concepto/descripción de la transacción
   * @param date - Fecha de la transacción (timestamp, opcional)
   * @param tenantId - ID del tenant (para aislamiento de datos)
   * @returns La transacción creada
   * @throws MoleculeError si la validación falla o hay error de BD
   */
  addTransaction(
    accountId: number,
    type: "ingreso" | "egreso",
    amount: number,
    category: string,
    concept: string,
    date?: number,
    tenantId: string = "default",
  ): Transaction {
    try {
      AddTransactionSchema.parse({
        accountId,
        type,
        amount,
        category,
        concept,
      });

      const now = Date.now();
      const transactionDate = date ?? now;

      // Calcular el monto con signo según el tipo
      const signedAmount = type === "ingreso" ? amount : -amount;

      const result = this.db
        .prepare(
          `INSERT INTO transactions 
           (account_id, type, amount, category, concept, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          accountId,
          type,
          signedAmount,
          category,
          concept,
          transactionDate,
          now,
        );

      const id = Number(result.lastInsertRowid);

      // Actualizar balance de la cuenta
      this.db
        .prepare(`UPDATE accounts SET balance = balance + ? WHERE id = ?`)
        .run(signedAmount, accountId);

      log.info(
        { id, accountId, type, amount, category },
        "Transacción agregada",
      );

      const transaction = this.getTransactionById(id);
      if (!transaction) {
        throw new MoleculeError(
          this.name,
          `No se pudo recuperar la transacción recién creada (${id})`,
          { accountId, tenantId },
        );
      }
      return transaction;
    } catch (error: any) {
      if (
        error.name === "ValidationError" ||
        error.code === "VALIDATION_ERROR" ||
        error instanceof MoleculeError
      ) {
        throw error;
      }
      throw new MoleculeError(
        this.name,
        `Error al agregar transacción: ${error.message}`,
        { accountId, tenantId },
      );
    }
  }

  /**
   * Obtiene el saldo actual de una cuenta.
   *
   * @param accountId - ID numérico de la cuenta
   * @param tenantId - ID del tenant (para aislamiento de datos)
   * @returns El saldo actual
   * @throws MoleculeError si hay error de BD
   */
  getBalance(accountId: number, tenantId: string = "default"): number {
    try {
      GetBalanceSchema.parse({ accountId });

      const account = this.db
        .prepare(`SELECT balance FROM accounts WHERE id = ?`)
        .get(accountId) as { balance: number } | undefined;

      if (!account) {
        throw new MoleculeError(
          this.name,
          `Cuenta no encontrada (${accountId})`,
          { accountId, tenantId },
        );
      }

      log.debug({ accountId, balance: account.balance }, "Saldo consultado");
      return account.balance;
    } catch (error: any) {
      if (error.code === "VALIDATION_ERROR" || error instanceof MoleculeError) {
        throw error;
      }
      throw new MoleculeError(
        this.name,
        `Error al obtener saldo: ${error.message}`,
        { accountId, tenantId },
      );
    }
  }

  /**
   * Obtiene todas las transacciones de una cuenta filtradas por categoría.
   *
   * @param accountId - ID numérico de la cuenta
   * @param category - Categoría a filtrar
   * @param limit - Límite de resultados (máximo 100)
   * @param tenantId - ID del tenant (para aislamiento de datos)
   * @returns Lista de transacciones que coinciden
   * @throws MoleculeError si hay error de BD
   */
  getTransactionsByCategory(
    accountId: number,
    category: string,
    limit: number = 50,
    tenantId: string = "default",
  ): Transaction[] {
    try {
      GetTransactionsByCategorySchema.parse({ accountId, category });

      const effectiveLimit = Math.min(limit, 100);
      const rows: unknown[] = this.db
        .prepare(
          `SELECT * FROM transactions
           WHERE account_id = ? AND category = ?
           ORDER BY date DESC
           LIMIT ?`,
        )
        .all(accountId, category, effectiveLimit);

      const transactions = rows.map((row) => this.mapTransactionRow(row));
      log.debug(
        { accountId, category, count: transactions.length },
        "Transacciones por categoría recuperadas",
      );
      return transactions;
    } catch (error: any) {
      if (error.code === "VALIDATION_ERROR" || error instanceof MoleculeError) {
        throw error;
      }
      throw new MoleculeError(
        this.name,
        `Error al obtener transacciones: ${error.message}`,
        { accountId, category, tenantId },
      );
    }
  }

  /**
   * Genera un estado de cuenta (extracto) para un período específico.
   * Incluye saldo actual, totales de ingresos/egresos y lista de transacciones.
   *
   * @param accountId - ID numérico de la cuenta
   * @param period - Período opcional ("month", "quarter", "year")
   * @param tenantId - ID del tenant (para aislamiento de datos)
   * @returns Estado de cuenta con métricas y transacciones
   * @throws MoleculeError si hay error de BD
   */
  generateStatement(
    accountId: number,
    period?: "month" | "quarter" | "year",
    tenantId: string = "default",
  ): Statement {
    try {
      GenerateStatementSchema.parse({ accountId });

      // Obtener saldo actual
      const account = this.db
        .prepare(`SELECT balance FROM accounts WHERE id = ?`)
        .get(accountId) as { balance: number } | undefined;

      if (!account) {
        throw new MoleculeError(
          this.name,
          `Cuenta no encontrada (${accountId})`,
          { accountId, tenantId },
        );
      }

      // Obtener transacciones (todas o filtradas por período)
      let transactionRows: unknown[] = [];
      let totalIncome = 0;
      let totalExpense = 0;

      if (period) {
        const now = Date.now();
        let startDate: number;

        switch (period) {
          case "month":
            startDate = now - 30 * 24 * 60 * 60 * 1000;
            break;
          case "quarter":
            startDate = now - 90 * 24 * 60 * 60 * 1000;
            break;
          case "year":
            startDate = now - 365 * 24 * 60 * 60 * 1000;
            break;
        }

        transactionRows = this.db
          .prepare(
            `SELECT * FROM transactions
             WHERE account_id = ? AND date >= ?
             ORDER BY date DESC`,
          )
          .all(accountId, startDate);
      } else {
        transactionRows = this.db
          .prepare(
            `SELECT * FROM transactions
             WHERE account_id = ?
             ORDER BY date DESC`,
          )
          .all(accountId);
      }

      const transactions = transactionRows.map((row) =>
        this.mapTransactionRow(row),
      );

      // Calcular totales
      for (const tx of transactions) {
        if (tx.amount > 0) {
          totalIncome += tx.amount;
        } else {
          totalExpense += Math.abs(tx.amount);
        }
      }

      const statement: Statement = {
        accountId,
        period,
        balance: account.balance,
        totalIncome,
        totalExpense,
        transactionCount: transactions.length,
        transactions,
      };

      log.info(
        { accountId, period, transactionCount: transactions.length },
        "Estado de cuenta generado",
      );
      return statement;
    } catch (error: any) {
      if (error instanceof MoleculeError) {
        throw error;
      }
      throw new MoleculeError(
        this.name,
        `Error al generar estado: ${error.message}`,
        { accountId, period, tenantId },
      );
    }
  }

  /**
   * Elimina una transacción del ledger.
   * Esta operación es destructiva y afecta el saldo de la cuenta.
   *
   * @param txId - ID de la transacción a eliminar
   * @param accountId - ID de la cuenta propietaria
   * @param tenantId - ID del tenant (para aislamiento de datos)
   * @returns true si la transacción se eliminó, false si no existía
   * @throws MoleculeError si hay error de BD
   */
  deleteTransaction(
    txId: number,
    accountId: number,
    tenantId: string = "default",
  ): boolean {
    try {
      // Obtener la transacción antes de eliminarla para revertir balance
      const transaction = this.db
        .prepare(
          `SELECT amount FROM transactions WHERE id = ? AND account_id = ?`,
        )
        .get(txId, accountId) as { amount: number } | undefined;

      if (!transaction) {
        log.debug(
          { txId, accountId },
          "Transacción no encontrada para eliminación",
        );
        return false;
      }

      // Eliminar transacción
      const result = this.db
        .prepare(`DELETE FROM transactions WHERE id = ? AND account_id = ?`)
        .run(txId, accountId);

      if (result.changes > 0) {
        // Revertir el balance
        this.db
          .prepare(`UPDATE accounts SET balance = balance - ? WHERE id = ?`)
          .run(transaction.amount, accountId);

        log.info({ txId, accountId }, "Transacción eliminada");
        return true;
      }

      return false;
    } catch (error: any) {
      throw new MoleculeError(
        this.name,
        `Error al eliminar transacción: ${error.message}`,
        { txId, accountId, tenantId },
      );
    }
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  /**
   * Mapea una fila de BD a objeto Transaction.
   */
  private mapTransactionRow(row: unknown): Transaction {
    const parsedRow: TransactionRow = TransactionRowSchema.parse(row);
    return {
      id: parsedRow.id,
      accountId: parsedRow.account_id,
      type: parsedRow.type,
      amount: parsedRow.amount,
      category: parsedRow.category,
      concept: parsedRow.concept,
      date: parsedRow.date,
      createdAt: parsedRow.created_at,
    };
  }

  /**
   * Mapea una fila de BD a objeto Account.
   */
  private mapAccountRow(row: unknown): Account {
    const parsedRow: AccountRow = AccountRowSchema.parse(row);
    return {
      id: parsedRow.id,
      name: parsedRow.name,
      currency: parsedRow.currency,
      balance: parsedRow.balance,
      createdAt: parsedRow.created_at,
    };
  }

  /**
   * Obtiene una transacción por ID (uso interno).
   */
  private getTransactionById(id: number): Transaction | null {
    const row = this.db
      .prepare(`SELECT * FROM transactions WHERE id = ?`)
      .get(id);
    return row ? this.mapTransactionRow(row) : null;
  }

  /**
   * Obtiene una cuenta por ID (uso interno).
   */
  private getAccountById(id: number): Account | null {
    const row = this.db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id);
    return row ? this.mapAccountRow(row) : null;
  }
}
