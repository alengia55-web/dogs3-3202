import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { Client } from "@libsql/client";
import { ADMIN_EMAIL } from "../packages/web/src/shared/admin-access";

/** Test-only fixture. Refuses remote databases; never runs in the installer. */
export async function seedTestUser(db: Client, email = ADMIN_EMAIL, role = "admin", id = "isolated-owner") {
  if (!process.env.DATABASE_URL?.startsWith("file:")) throw new Error("Test fixtures require an isolated file database");
  const require = createRequire(new URL("../packages/web/package.json", import.meta.url));
  const { hashPassword } = await import(pathToFileURL(require.resolve("better-auth/crypto")).href);
  const now = Date.now();
  const password = "isolated-test-password";
  await db.execute({sql: "INSERT INTO user (id,name,email,email_verified,created_at,updated_at,role) VALUES (?,?,?,?,?,?,?)", args: [id,"Isolated test",email,0,now,now,role]});
  await db.execute({sql: "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)", args: [id+"-credential",id,"credential",id,await hashPassword(password),now,now]});
  return { id, email, password };
}