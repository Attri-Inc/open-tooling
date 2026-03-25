import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number.parseInt(process.env.PORT ?? "8787", 10),
  dbPath: process.env.CRM_DB_PATH ?? "./data/crm.db",
  schemaVersion: process.env.CRM_SCHEMA_VERSION ?? "v0",
};

