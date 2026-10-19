import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LedgerMolecule,
  type Transaction,
  type Statement,
  type Account,
} from "../../src/molecules/LedgerMolecule.js";
import { MoleculeError } from "../../src/errors.js";

describe("LedgerMolecule", () => {
  let temporaryDatabaseDir: string;
  let molecule: LedgerMolecule | undefined;

  beforeEach(() => {
    temporaryDatabaseDir = mkdtempSync(
      join(tmpdir(), "biocore-ledger-molecule-"),
    );
    molecule = new LedgerMolecule(join(temporaryDatabaseDir, "ledger.db"));
  });

  afterEach(async () => {
    await molecule?.dispose();
    molecule = undefined;
    rmSync(temporaryDatabaseDir, { recursive: true, force: true });
  });

  describe("Lifecycle", () => {
    it("expone identidad estable y completa su lifecycle", async () => {
      expect(molecule).toBeDefined();
      if (!molecule) return;

      expect(molecule.name).toBe("ledger");
      expect(molecule.version).toBe("1.0.0");

      await molecule.initialize();
      const dbPath = join(temporaryDatabaseDir, "ledger.db");
      expect(dbPath).toContain("ledger");

      await molecule.dispose();
    });

    it("puede ser reinicializado después de dispose", async () => {
      if (!molecule) return;

      await molecule.initialize();
      await molecule.dispose();
      await molecule.initialize();

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      expect(account.id).toBeGreaterThan(0);
      await molecule.dispose();
    });
  });

  describe("createAccount", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("crea una cuenta con éxito", async () => {
      if (!molecule) return;

      const account = molecule.createAccount("Mi Cuenta", "USD", "tenant-1");

      expect(account).toMatchObject({
        name: "Mi Cuenta",
        currency: "USD",
        balance: 0,
      });
      expect(account.id).toBeGreaterThan(0);
      expect(account.createdAt).toBeGreaterThan(0);
    });

    it("rechaza nombre vacío", () => {
      if (!molecule) return;

      expect(() => {
        molecule.createAccount("", "USD", "tenant-1");
      }).toThrow(MoleculeError);
    });

    it("usa USD por defecto cuando currency es vacío", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "", "tenant-1");

      expect(account.currency).toBe("USD");
    });

    it("persiste múltiples cuentas", () => {
      if (!molecule) return;

      const acc1 = molecule.createAccount("Cuenta 1", "USD", "tenant-1");
      const acc2 = molecule.createAccount("Cuenta 2", "ARS", "tenant-1");

      expect(acc1.id).not.toBe(acc2.id);
      expect(acc1.currency).toBe("USD");
      expect(acc2.currency).toBe("ARS");
    });
  });

  describe("addTransaction", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("agrega transacción de ingreso", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const tx = molecule.addTransaction(
        account.id,
        "ingreso",
        100.5,
        "salary",
        "Salary deposit",
      );

      expect(tx).toMatchObject({
        accountId: account.id,
        type: "ingreso",
        amount: 100.5,
        category: "salary",
        concept: "Salary deposit",
      });
      expect(tx.id).toBeGreaterThan(0);
      expect(tx.date).toBeGreaterThan(0);
      expect(tx.createdAt).toBeGreaterThan(0);
    });

    it("agrega transacción de egreso", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const tx = molecule.addTransaction(
        account.id,
        "egreso",
        50,
        "expense",
        "Office supplies",
      );

      expect(tx.type).toBe("egreso");
      expect(tx.amount).toBe(-50); // Internamente negativo
    });

    it("rechaza accountId inválido", () => {
      if (!molecule) return;

      expect(() => {
        molecule.addTransaction(999, "ingreso", 100, "test", "Test");
      }).toThrow();
    });

    it("rechaza amount cero", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");

      expect(() => {
        molecule.addTransaction(account.id, "ingreso", 0, "test", "Zero");
      }).toThrow(MoleculeError);
    });

    it("rechaza amount negativo", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");

      expect(() => {
        molecule.addTransaction(
          account.id,
          "ingreso",
          -100,
          "test",
          "Negative",
        );
      }).toThrow(MoleculeError);
    });

    it("permite fecha personalizada", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const customDate = Date.now() - 86400000; // hace 1 día

      const tx = molecule.addTransaction(
        account.id,
        "ingreso",
        100,
        "test",
        "Test",
        customDate,
      );

      expect(tx.date).toBe(customDate);
    });
  });

  describe("getBalance", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("retorna saldo inicial cero", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const balance = molecule.getBalance(account.id);

      expect(balance).toBe(0);
    });

    it("calcula saldo con ingresos", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      molecule.addTransaction(account.id, "ingreso", 100, "salary", "Tx1");
      molecule.addTransaction(account.id, "ingreso", 50, "bonus", "Tx2");

      const balance = molecule.getBalance(account.id);
      expect(balance).toBe(150);
    });

    it("calcula saldo con egresos", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      molecule.addTransaction(account.id, "egreso", 100, "expense", "Tx1");
      molecule.addTransaction(account.id, "egreso", 50, "fee", "Tx2");

      const balance = molecule.getBalance(account.id);
      expect(balance).toBe(-150);
    });

    it("calcula saldo mixto", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      molecule.addTransaction(account.id, "ingreso", 1000, "salary", "Tx1");
      molecule.addTransaction(account.id, "egreso", 200, "rent", "Tx2");
      molecule.addTransaction(account.id, "ingreso", 100, "bonus", "Tx3");
      molecule.addTransaction(account.id, "egreso", 50, "expense", "Tx4");

      const balance = molecule.getBalance(account.id);
      expect(balance).toBe(850); // 1000 - 200 + 100 - 50
    });

    it("rechaza accountId inválido", () => {
      if (!molecule) return;

      expect(() => {
        molecule.getBalance(999);
      }).toThrow(MoleculeError);
    });
  });

  describe("getTransactionsByCategory", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("filtra transacciones por categoría", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      molecule.addTransaction(
        account.id,
        "ingreso",
        1000,
        "salary",
        "Salary 1",
      );
      molecule.addTransaction(account.id, "ingreso", 500, "salary", "Salary 2");
      molecule.addTransaction(account.id, "egreso", 100, "expense", "Rent");
      molecule.addTransaction(account.id, "egreso", 50, "expense", "Food");

      const salaries = molecule.getTransactionsByCategory(account.id, "salary");
      expect(salaries).toHaveLength(2);
      expect(salaries.every((tx) => tx.category === "salary")).toBe(true);
    });

    it("retorna lista vacía cuando no hay transacciones en categoría", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      molecule.addTransaction(account.id, "ingreso", 100, "salary", "Tx");

      const expenses = molecule.getTransactionsByCategory(
        account.id,
        "expense",
      );
      expect(expenses).toHaveLength(0);
    });

    it("respeta límite de resultados", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");

      // Crear 25 transacciones
      for (let i = 0; i < 25; i++) {
        molecule.addTransaction(
          account.id,
          "ingreso",
          100,
          "salary",
          `Tx ${i}`,
        );
      }

      const result = molecule.getTransactionsByCategory(
        account.id,
        "salary",
        10,
      );
      expect(result).toHaveLength(10);
    });

    it("limita máximo a 100 transacciones", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");

      // Crear 150 transacciones
      for (let i = 0; i < 150; i++) {
        molecule.addTransaction(
          account.id,
          "ingreso",
          100,
          "salary",
          `Tx ${i}`,
        );
      }

      const result = molecule.getTransactionsByCategory(
        account.id,
        "salary",
        200, // Solicita 200, pero máximo es 100
      );
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it("retorna transacciones en orden descendente por fecha", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const now = Date.now();

      molecule.addTransaction(
        account.id,
        "ingreso",
        100,
        "salary",
        "Tx1",
        now - 1000,
      );
      molecule.addTransaction(account.id, "ingreso", 100, "salary", "Tx2", now);
      molecule.addTransaction(
        account.id,
        "ingreso",
        100,
        "salary",
        "Tx3",
        now - 500,
      );

      const txs = molecule.getTransactionsByCategory(account.id, "salary");
      expect(txs).toHaveLength(3);
      expect(txs[0]?.concept).toBe("Tx2"); // más reciente
      expect(txs[1]?.concept).toBe("Tx3");
      expect(txs[2]?.concept).toBe("Tx1"); // más antiguo
    });
  });

  describe("generateStatement", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("genera estado sin período especificado", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      molecule.addTransaction(account.id, "ingreso", 1000, "salary", "Tx1");
      molecule.addTransaction(account.id, "egreso", 200, "expense", "Tx2");
      molecule.addTransaction(account.id, "ingreso", 100, "bonus", "Tx3");

      const statement = molecule.generateStatement(account.id);

      expect(statement.accountId).toBe(account.id);
      expect(statement.balance).toBe(900);
      expect(statement.totalIncome).toBe(1100);
      expect(statement.totalExpense).toBe(200);
      expect(statement.transactionCount).toBe(3);
      expect(statement.transactions).toHaveLength(3);
    });

    it("genera estado vacío para cuenta sin transacciones", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");

      const statement = molecule.generateStatement(account.id);

      expect(statement.balance).toBe(0);
      expect(statement.totalIncome).toBe(0);
      expect(statement.totalExpense).toBe(0);
      expect(statement.transactionCount).toBe(0);
      expect(statement.transactions).toHaveLength(0);
    });

    it("filtra por período 'month'", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const now = Date.now();
      const twoMonthsAgo = now - 65 * 24 * 60 * 60 * 1000;

      // Transacción hace 2 meses
      molecule.addTransaction(
        account.id,
        "ingreso",
        100,
        "salary",
        "Old",
        twoMonthsAgo,
      );

      // Transacción reciente
      molecule.addTransaction(account.id, "ingreso", 200, "salary", "Recent");

      const statement = molecule.generateStatement(account.id, "month");

      expect(statement.transactionCount).toBe(1);
      expect(statement.totalIncome).toBe(200);
      expect(statement.transactions[0]?.concept).toBe("Recent");
    });

    it("filtra por período 'quarter'", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const now = Date.now();
      const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;

      molecule.addTransaction(
        account.id,
        "ingreso",
        100,
        "salary",
        "Old",
        sixMonthsAgo,
      );
      molecule.addTransaction(account.id, "ingreso", 200, "salary", "Recent");

      const statement = molecule.generateStatement(account.id, "quarter");

      expect(statement.transactionCount).toBe(1);
      expect(statement.totalIncome).toBe(200);
    });

    it("rechaza accountId inválido", () => {
      if (!molecule) return;

      expect(() => {
        molecule.generateStatement(999);
      }).toThrow(MoleculeError);
    });

    it("incluye todas las transacciones con período 'year'", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const now = Date.now();

      // Transacciones variadas
      for (let i = 0; i < 10; i++) {
        const date = now - i * 30 * 24 * 60 * 60 * 1000;
        molecule.addTransaction(
          account.id,
          i % 2 === 0 ? "ingreso" : "egreso",
          100,
          "test",
          `Tx${i}`,
          date,
        );
      }

      const statement = molecule.generateStatement(account.id, "year");

      expect(statement.transactionCount).toBe(10);
    });
  });

  describe("deleteTransaction", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("elimina transacción y revierte balance", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      const tx1 = molecule.addTransaction(
        account.id,
        "ingreso",
        100,
        "salary",
        "Tx1",
      );
      const tx2 = molecule.addTransaction(
        account.id,
        "ingreso",
        50,
        "bonus",
        "Tx2",
      );

      expect(molecule.getBalance(account.id)).toBe(150);

      const deleted = molecule.deleteTransaction(tx1.id, account.id);

      expect(deleted).toBe(true);
      expect(molecule.getBalance(account.id)).toBe(50);
    });

    it("retorna false para transacción inexistente", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");

      const deleted = molecule.deleteTransaction(999, account.id);

      expect(deleted).toBe(false);
    });

    it("aísla por cuenta", () => {
      if (!molecule) return;

      const acc1 = molecule.createAccount("Acc1", "USD", "tenant-1");
      const acc2 = molecule.createAccount("Acc2", "USD", "tenant-1");

      const tx1 = molecule.addTransaction(
        acc1.id,
        "ingreso",
        100,
        "salary",
        "Tx1",
      );
      const tx2 = molecule.addTransaction(
        acc2.id,
        "ingreso",
        50,
        "salary",
        "Tx2",
      );

      // Intentar eliminar tx1 con account_id=acc2
      const deleted = molecule.deleteTransaction(tx1.id, acc2.id);

      expect(deleted).toBe(false);
      expect(molecule.getBalance(acc1.id)).toBe(100); // sin cambios
    });

    it("revierte egreso correctamente", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test", "USD", "tenant-1");
      molecule.addTransaction(account.id, "ingreso", 200, "salary", "Tx1");
      const egreso = molecule.addTransaction(
        account.id,
        "egreso",
        100,
        "expense",
        "Tx2",
      );

      expect(molecule.getBalance(account.id)).toBe(100);

      molecule.deleteTransaction(egreso.id, account.id);

      expect(molecule.getBalance(account.id)).toBe(200);
    });
  });

  describe("Error handling", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("propaga errores de BD cuando la tabla está corrupta", async () => {
      if (!molecule) return;

      const db = new Database(join(temporaryDatabaseDir, "ledger.db"));
      db.exec("DROP TABLE transactions");
      db.close();

      const account = molecule.createAccount("Test", "USD", "tenant-1");

      expect(() => {
        molecule.addTransaction(account.id, "ingreso", 100, "test", "Test");
      }).toThrow(MoleculeError);
    });
  });

  describe("Data integrity", () => {
    beforeEach(async () => {
      await molecule?.initialize();
    });

    it("mantiene integridad de datos complejos", () => {
      if (!molecule) return;

      const account = molecule.createAccount("Test Account", "ARS", "tenant-1");

      // Operaciones variadas
      molecule.addTransaction(account.id, "ingreso", 5000, "salary", "Salary");
      molecule.addTransaction(account.id, "egreso", 1000, "rent", "Rent");
      molecule.addTransaction(account.id, "egreso", 500, "utilities", "Bills");
      molecule.addTransaction(
        account.id,
        "ingreso",
        200,
        "freelance",
        "Side gig",
      );
      const toDelete = molecule.addTransaction(
        account.id,
        "egreso",
        100,
        "entertainment",
        "Movie",
      );

      // Verificar balance antes de eliminación
      expect(molecule.getBalance(account.id)).toBe(3600); // 5000 - 1000 - 500 + 200 - 100

      // Eliminar una transacción
      molecule.deleteTransaction(toDelete.id, account.id);

      // Verificar balance después
      expect(molecule.getBalance(account.id)).toBe(3700); // 5000 - 1000 - 500 + 200

      // Verificar statement
      const statement = molecule.generateStatement(account.id);
      expect(statement.balance).toBe(3700);
      expect(statement.totalIncome).toBe(5200);
      expect(statement.totalExpense).toBe(1500);
      expect(statement.transactionCount).toBe(4); // 5 - 1 eliminada
    });
  });
});
