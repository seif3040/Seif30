import fs from "fs";
import path from "path";
import type { Express } from "express";
import { getSqlite, DB_PATH } from "./db";

const BACKUP_DIR = path.resolve(process.cwd(), "data", "backups");
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

let lastBackupTimestamp: number = 0;
let lastBackupFileName: string = "";

export async function createFullBackup(tag: string = "auto"): Promise<{
  success: boolean;
  timestamp: number;
  dbBackupPath: string;
  jsonBackupPath: string;
  tableCounts: Record<string, number>;
}> {
  ensureBackupDir();
  const timestamp = Date.now();
  const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, "-");
  const dbBackupName = `study_os_backup_${tag}_${dateStr}.db`;
  const jsonBackupName = `study_os_backup_${tag}_${dateStr}.json`;
  const dbBackupPath = path.join(BACKUP_DIR, dbBackupName);
  const jsonBackupPath = path.join(BACKUP_DIR, jsonBackupName);

  const sqlite = getSqlite();

  // 1. Force WAL checkpoint to flush all pending transactions to main DB file
  try {
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch (err) {
    console.warn("[BackupService] WAL checkpoint warning:", err);
  }

  // 2. Perform atomic sqlite backup
  try {
    if (typeof sqlite.backup === "function") {
      await sqlite.backup(dbBackupPath);
    } else {
      fs.copyFileSync(DB_PATH, dbBackupPath);
    }
  } catch (err) {
    console.warn("[BackupService] Fallback to file copy for DB backup:", err);
    fs.copyFileSync(DB_PATH, dbBackupPath);
  }

  // 3. Export all tables to human-readable & portable JSON format
  const tableCounts: Record<string, number> = {};
  const dumpData: Record<string, any[]> = {};

  try {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;

    for (const { name } of tables) {
      try {
        const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all();
        dumpData[name] = rows;
        tableCounts[name] = rows.length;
      } catch (err) {
        console.warn(`[BackupService] Could not read table ${name}:`, err);
      }
    }

    const jsonPayload = {
      meta: {
        app: "Seif Study OS",
        version: "2.0.0",
        createdAt: new Date().toISOString(),
        timestamp,
        tag,
        owner: "seif94803@gmail.com",
        tableCounts,
      },
      data: dumpData,
    };

    fs.writeFileSync(jsonBackupPath, JSON.stringify(jsonPayload, null, 2), "utf-8");

    // Also write to latest pointers for quick 1-click restore/download
    fs.copyFileSync(dbBackupPath, path.join(BACKUP_DIR, "latest_backup.db"));
    fs.copyFileSync(jsonBackupPath, path.join(BACKUP_DIR, "latest_backup.json"));

    lastBackupTimestamp = timestamp;
    lastBackupFileName = dbBackupName;

    pruneOldBackups();

    console.log(`[BackupService] Successfully created 6-hour backup: ${dbBackupName} (${Object.keys(tableCounts).length} tables saved)`);

    return {
      success: true,
      timestamp,
      dbBackupPath,
      jsonBackupPath,
      tableCounts,
    };
  } catch (err: any) {
    console.error("[BackupService] Error creating full JSON backup:", err);
    throw err;
  }
}

function pruneOldBackups(maxKeep: number = 24) {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const dbBackups = files
      .filter((f) => f.startsWith("study_os_backup_") && f.endsWith(".db"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (dbBackups.length > maxKeep) {
      const toDelete = dbBackups.slice(maxKeep);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, item.name));
          const jsonName = item.name.replace(/\.db$/, ".json");
          const jsonPath = path.join(BACKUP_DIR, jsonName);
          if (fs.existsSync(jsonPath)) {
            fs.unlinkSync(jsonPath);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[BackupService] Error pruning old backups:", err);
  }
}

export function startAutomatedBackupScheduler() {
  ensureBackupDir();

  // Check when was the last backup created
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const dbBackups = files
      .filter((f) => f.startsWith("study_os_backup_") && f.endsWith(".db"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (dbBackups.length > 0) {
      lastBackupTimestamp = dbBackups[0].time;
      lastBackupFileName = dbBackups[0].name;
    }
  } catch {}

  const timeSinceLast = Date.now() - lastBackupTimestamp;
  if (timeSinceLast >= SIX_HOURS_MS || lastBackupTimestamp === 0) {
    console.log("[BackupService] Initializing first backup snapshot now...");
    createFullBackup("init").catch((err) => console.error("[BackupService] Init backup failed:", err));
  } else {
    console.log(`[BackupService] Last backup is recent (${Math.round(timeSinceLast / 60000)} minutes ago). Next backup in ${Math.round((SIX_HOURS_MS - timeSinceLast) / 60000)} minutes.`);
  }

  // Periodic timer running every 6 hours
  setInterval(() => {
    console.log("[BackupService] Running scheduled 6-hour backup job...");
    createFullBackup("scheduled").catch((err) => console.error("[BackupService] Scheduled backup error:", err));
  }, SIX_HOURS_MS);
}

export function registerBackupRoutes(app: Express) {
  // Status of the 6-hour backup system
  app.get("/api/backup/status", (_req, res) => {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("study_os_backup_"));
    const timeSinceLast = lastBackupTimestamp > 0 ? Date.now() - lastBackupTimestamp : 0;
    const nextBackupInMs = Math.max(0, SIX_HOURS_MS - timeSinceLast);

    res.json({
      success: true,
      lastBackupTimestamp,
      lastBackupTimeIso: lastBackupTimestamp ? new Date(lastBackupTimestamp).toISOString() : null,
      lastBackupFormatted: lastBackupTimestamp
        ? new Date(lastBackupTimestamp).toLocaleString("ar-EG", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "لا توجد بعد",
      nextBackupInHours: Number((nextBackupInMs / (1000 * 60 * 60)).toFixed(1)),
      totalBackupFiles: files.length,
      lastBackupFileName,
      frequency: "كل 6 ساعات تلقائياً 🛡️",
    });
  });

  // Trigger manual immediate backup
  app.post("/api/backup/create-now", async (_req, res) => {
    try {
      const result = await createFullBackup("manual_user");
      res.json({
        success: true,
        message: "تم أخذ نسخة احتياطية كاملة بنجاح وحفظها في الخادم! 🛡️",
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || "فشل إنشاء النسخة الاحتياطية" });
    }
  });

  // Download latest full database (.db)
  app.get("/api/backup/download-db", (_req, res) => {
    const latestDb = path.join(BACKUP_DIR, "latest_backup.db");
    const sourceDb = fs.existsSync(latestDb) ? latestDb : DB_PATH;
    if (!fs.existsSync(sourceDb)) {
      res.status(404).send("ملف قاعدة البيانات غير موجود بعد.");
      return;
    }
    const filename = `seif_study_os_database_${new Date().toISOString().split("T")[0]}.db`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/x-sqlite3");
    fs.createReadStream(sourceDb).pipe(res);
  });

  // Download latest full JSON dump (Google Drive / Portable friendly)
  app.get("/api/backup/download-json", (_req, res) => {
    const latestJson = path.join(BACKUP_DIR, "latest_backup.json");
    if (!fs.existsSync(latestJson)) {
      // Create on demand
      createFullBackup("ondemand")
        .then(() => {
          const filename = `seif_study_os_drive_backup_${new Date().toISOString().split("T")[0]}.json`;
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          res.setHeader("Content-Type", "application/json");
          fs.createReadStream(path.join(BACKUP_DIR, "latest_backup.json")).pipe(res);
        })
        .catch((err) => res.status(500).send("فشل استخراج النسخة: " + err.message));
      return;
    }
    const filename = `seif_study_os_drive_backup_${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    fs.createReadStream(latestJson).pipe(res);
  });
}
