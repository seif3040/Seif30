import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { getSqlite, resetDbConnection, DB_PATH } from "./db";

// Helper to parse simple CSV text into array of objects
function parseCsv(csvText: string): Record<string, any>[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header line handling potential quotes
  const headers = parseCsvLine(lines[0]);
  const results: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, any> = {};
    headers.forEach((h, idx) => {
      let val: any = values[idx];
      if (val === undefined || val === "" || val === "NULL" || val === "null") {
        val = null;
      } else if (!isNaN(Number(val)) && val.trim() !== "") {
        // numeric
        val = Number(val);
      }
      row[h] = val;
    });
    results.push(row);
  }
  return results;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function registerMigrationRoutes(app: Express) {
  // 1. Status of all tables
  app.get("/api/migration/status", (req, res) => {
    try {
      const sqlite = getSqlite();
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const stats: Record<string, number> = {};
      let totalRows = 0;

      for (const t of tables) {
        try {
          const row = sqlite.prepare(`SELECT count(*) as c FROM "${t.name}"`).get() as { c: number };
          stats[t.name] = row.c;
          totalRows += row.c;
        } catch {
          stats[t.name] = 0;
        }
      }

      let fileSize = 0;
      if (fs.existsSync(DB_PATH)) {
        fileSize = fs.statSync(DB_PATH).size;
      }

      res.json({
        success: true,
        totalTables: tables.length,
        totalRows,
        fileSizeBytes: fileSize,
        fileSizeFormatted: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
        tables: stats,
      });
    } catch (err: any) {
      console.error("Migration status error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. Import JSON (either single table or all tables dump)
  app.post("/api/migration/import-json", (req, res) => {
    try {
      const { table, data } = req.body as { table?: string; data?: any };
      if (!data) {
        res.status(400).json({ success: false, message: "لم يتم تقديم أي بيانات للاستيراد." });
        return;
      }

      const sqlite = getSqlite();
      const summary: Record<string, number> = {};

      if (table && Array.isArray(data)) {
        // Single table import
        const count = importRowsIntoTable(sqlite, table, data);
        summary[table] = count;
      } else if (typeof data === "object" && !Array.isArray(data)) {
        // Multi-table bundle: { tasks: [...], subjects: [...], ... }
        for (const [tName, rows] of Object.entries(data)) {
          if (Array.isArray(rows) && rows.length > 0) {
            try {
              const count = importRowsIntoTable(sqlite, tName, rows);
              summary[tName] = count;
            } catch (err: any) {
              console.error(`Error importing table ${tName}:`, err);
            }
          }
        }
      } else if (Array.isArray(data) && !table) {
        res.status(400).json({ success: false, message: "يرجى تحديد اسم الجدول المناسب للبيانات." });
        return;
      }

      res.json({
        success: true,
        message: "تم استيراد البيانات بنجاح في قاعدة البيانات.",
        imported: summary,
      });
    } catch (err: any) {
      console.error("Import JSON error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. Import CSV
  app.post("/api/migration/import-csv", (req, res) => {
    try {
      const { tableName, csvContent } = req.body as { tableName?: string; csvContent?: string };
      if (!tableName || !csvContent) {
        res.status(400).json({ success: false, message: "يرجى تحديد اسم الجدول ومحتوى CSV." });
        return;
      }

      const rows = parseCsv(csvContent);
      if (rows.length === 0) {
        res.status(400).json({ success: false, message: "ملف CSV لا يحتوي على أي صفوف صالحة." });
        return;
      }

      const sqlite = getSqlite();
      const count = importRowsIntoTable(sqlite, tableName, rows);

      res.json({
        success: true,
        message: `تم استيراد ${count} سجل في جدول "${tableName}" بنجاح.`,
        tableName,
        count,
      });
    } catch (err: any) {
      console.error("Import CSV error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. Upload whole SQLite study_os.db
  app.post("/api/migration/upload-db", (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) {
        res.status(400).json({ success: false, message: "لم يتم استلام ملف قاعدة البيانات." });
        return;
      }

      const buffer = Buffer.from(fileBase64, "base64");
      // Check SQLite header: 'SQLite format 3\0'
      const header = buffer.subarray(0, 16).toString("utf-8");
      if (!header.startsWith("SQLite format 3")) {
        res.status(400).json({
          success: false,
          message: "الملف المرفوع ليس ملف قاعدة بيانات SQLite صالح.",
        });
        return;
      }

      // Backup current DB
      if (fs.existsSync(DB_PATH)) {
        const backupPath = `${DB_PATH}.backup_${Date.now()}`;
        fs.copyFileSync(DB_PATH, backupPath);
      }

      // Close current sqlite connection
      resetDbConnection();

      // Clean up wal / shm files if any
      try {
        if (fs.existsSync(`${DB_PATH}-wal`)) fs.unlinkSync(`${DB_PATH}-wal`);
        if (fs.existsSync(`${DB_PATH}-shm`)) fs.unlinkSync(`${DB_PATH}-shm`);
      } catch {}

      // Write new DB
      fs.writeFileSync(DB_PATH, buffer);

      // Re-open and verify
      const sqlite = getSqlite();
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const counts: Record<string, number> = {};
      let totalRows = 0;
      for (const t of tables) {
        try {
          const c = sqlite.prepare(`SELECT count(*) as c FROM "${t.name}"`).get() as { c: number };
          counts[t.name] = c.c;
          totalRows += c.c;
        } catch {
          counts[t.name] = 0;
        }
      }

      res.json({
        success: true,
        message: "تم استبدال قاعدة البيانات واستعادة جميع بياناتك بنجاح!",
        totalTables: tables.length,
        totalRows,
        tables: counts,
      });
    } catch (err: any) {
      console.error("Upload DB error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. Export all tables to JSON
  app.get("/api/migration/export-all", (req, res) => {
    try {
      const sqlite = getSqlite();
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const dump: Record<string, any[]> = {};
      for (const t of tables) {
        try {
          dump[t.name] = sqlite.prepare(`SELECT * FROM "${t.name}"`).all();
        } catch {
          dump[t.name] = [];
        }
      }

      res.setHeader("Content-Disposition", `attachment; filename="seif_study_os_export_${Date.now()}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json({
        exportedAt: new Date().toISOString(),
        version: "1.0",
        tables: dump,
      });
    } catch (err: any) {
      console.error("Export all error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. Direct Connect & Migrate from Remote MySQL / TiDB Cloud (from Manus)
  app.post("/api/migration/connect-mysql", async (req, res) => {
    let conn: mysql.Connection | null = null;
    try {
      const { connectionUrl, host, port, user, password, database, action = "test" } = req.body;

      // Build connection options
      let connConfig: any;
      if (connectionUrl && typeof connectionUrl === "string") {
        let uri = connectionUrl.trim();
        // Remove trailing quotes if copied with quotes
        uri = uri.replace(/^["']|["']$/g, "");
        connConfig = {
          uri,
          ssl: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: false,
          },
        };
      } else if (host && user && password) {
        connConfig = {
          host: host.trim(),
          port: port ? Number(port) : 4000,
          user: user.trim(),
          password: password.trim(),
          database: database ? database.trim() : undefined,
          ssl: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: false,
          },
        };
      } else {
        res.status(400).json({
          success: false,
          message: "يرجى توفير رابط الاتصال Connection URL أو بيانات المضيف والمستخدم وكلمة المرور.",
        });
        return;
      }

      conn = await mysql.createConnection(connConfig);

      // Fetch tables list
      const [tablesRaw] = await conn.query("SHOW TABLES");
      const remoteTables: string[] = (tablesRaw as any[]).map((row) => Object.values(row)[0] as string);

      if (action === "test") {
        // Just test and count rows
        const tableStats: Record<string, number> = {};
        let totalRecords = 0;
        for (const t of remoteTables) {
          try {
            const [cRaw] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
            const count = (cRaw as any[])[0]?.c || 0;
            tableStats[t] = count;
            totalRecords += count;
          } catch {
            tableStats[t] = 0;
          }
        }

        await conn.end();
        res.json({
          success: true,
          message: "تم الاتصال بقاعدة بيانات TiDB / MySQL بنجاح!",
          totalTables: remoteTables.length,
          totalRecords,
          tables: tableStats,
        });
        return;
      }

      // action === 'migrate'
      const sqlite = getSqlite();
      sqlite.pragma("foreign_keys = OFF");

      const localTablesRaw = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];
      const localTableSet = new Set(localTablesRaw.map((t) => t.name));

      const migrationReport: Record<string, number> = {};
      let grandTotalMigrated = 0;

      for (const t of remoteTables) {
        if (!localTableSet.has(t)) {
          // If table doesn't exist locally, skip
          continue;
        }

        try {
          const [rows] = await conn.query(`SELECT * FROM \`${t}\``);
          const data = rows as Record<string, any>[];
          if (data && data.length > 0) {
            const inserted = importRowsIntoTable(sqlite, t, data);
            migrationReport[t] = inserted;
            grandTotalMigrated += inserted;
          } else {
            migrationReport[t] = 0;
          }
        } catch (tableErr: any) {
          console.error(`Error migrating table ${t}:`, tableErr);
          migrationReport[t] = 0;
        }
      }

      // Cleanup: remove empty dummy cycles and activate cycle 150001
      try {
        sqlite.prepare("DELETE FROM studyCycles WHERE id NOT IN (SELECT DISTINCT cycleId FROM tasks UNION SELECT DISTINCT cycleId FROM subjects) AND id IN (SELECT id FROM studyCycles WHERE status = 'active' AND createdAt > 1788000000)").run();
        sqlite.prepare("UPDATE studyCycles SET status = 'active' WHERE id = 150001").run();
      } catch {}

      sqlite.pragma("foreign_keys = ON");
      await conn.end();

      res.json({
        success: true,
        message: `تم سحب ونقل ${grandTotalMigrated} سجلاً بنجاح من قاعدة بيانات مانوس إلى نظامك!`,
        totalMigrated: grandTotalMigrated,
        details: migrationReport,
      });
    } catch (err: any) {
      console.error("MySQL connection/migration error:", err);
      if (conn) {
        try {
          await conn.end();
        } catch {}
      }
      res.status(500).json({
        success: false,
        message: "تعذر الاتصال بقاعدة البيانات: " + (err.message || String(err)),
      });
    }
  });
}

function importRowsIntoTable(sqlite: any, tableName: string, rows: Record<string, any>[]): number {
  if (!rows || rows.length === 0) return 0;

  // Check valid table name
  const tableCheck = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName);
  if (!tableCheck) {
    throw new Error(`الجدول "${tableName}" غير موجود في قاعدة البيانات.`);
  }

  // Get table columns
  const colInfo = sqlite.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string; type: string }[];
  const validCols = new Set(colInfo.map((c) => c.name));
  const colTypes = Object.fromEntries(colInfo.map((c) => [c.name, c.type]));

  const insertTx = sqlite.transaction((items: Record<string, any>[]) => {
    let inserted = 0;
    for (const item of items) {
      const rowCols = Object.keys(item).filter((k) => validCols.has(k));
      if (rowCols.length === 0) continue;

      const placeholders = rowCols.map(() => "?").join(", ");
      const colNames = rowCols.map((c) => `"${c}"`).join(", ");
      const values = rowCols.map((k) => {
        let v = item[k];
        if (v === undefined || v === null) return null;
        // If Date object
        if (v instanceof Date) {
          return Math.floor(v.getTime() / 1000);
        }
        // If string date/ISO for timestamp column
        if (typeof v === "string" && (colTypes[k] === "INTEGER" || k.endsWith("At") || k.endsWith("Date") || k === "deadline" || k === "scheduledAt")) {
          const parsed = Date.parse(v);
          if (!isNaN(parsed) && v.includes("-") && v.includes("T")) {
            return Math.floor(parsed / 1000);
          }
        }
        // If ms timestamp (> 10 billion), convert to seconds
        if (typeof v === "number" && v > 10_000_000_000 && (colTypes[k] === "INTEGER" || k.endsWith("At") || k.endsWith("Date") || k === "deadline" || k === "scheduledAt")) {
          return Math.floor(v / 1000);
        }
        // If boolean
        if (typeof v === "boolean") return v ? 1 : 0;
        // If object/array
        if (typeof v === "object" && v !== null) return JSON.stringify(v);
        return v;
      });

      const query = `INSERT OR REPLACE INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
      sqlite.prepare(query).run(...values);
      inserted++;
    }
    return inserted;
  });

  return insertTx(rows);
}
