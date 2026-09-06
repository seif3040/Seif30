import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";

const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");

export function registerStorageProxy(app: Express) {
  const handler = (req: any, res: any) => {
    const rawKey = req.params[0];
    if (!rawKey) {
      res.status(400).send("Missing storage key");
      return;
    }
    const safeKey = path.basename(rawKey);
    const filePath = path.join(UPLOADS_DIR, safeKey);

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send("File not found");
    }
  };

  app.get("/manus-storage/*", handler);
  app.get("/uploads/*", handler);
}
