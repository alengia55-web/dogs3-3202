import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { seedTestUser } from "./test-auth-fixture";

const dir = await mkdtemp(join(tmpdir(), "shelter-owner-auth-"));
process.env.DATABASE_URL = `file:${dir}/test.sqlite`;
delete process.env.DATABASE_AUTH_TOKEN;
process.env.WEBSITE_URL = "http://localhost:4200";
process.env.BETTER_AUTH_SECRET = "isolated-owner-test-secret-not-for-production-12345";
const db = createClient({ url: process.env.DATABASE_URL });
const snapshot = JSON.parse(await readFile(new URL("./current-public-data.json", import.meta.url), "utf8"));
for (const sql of snapshot.schema) await db.execute(sql);
const owner = await seedTestUser(db);
const other = await seedTestUser(db, "old-owner@example.invalid", "admin", "old-owner");
const { default: app } = await import("../packages/web/src/api/index");
const { readStaff } = await import("../packages/web/src/api/lib/guards");

async function auth(path: string, body: object, token?: string) {
  return app.fetch(new Request(`${process.env.WEBSITE_URL}/api/auth/${path}`, {
    method: "POST", headers: { origin: process.env.WEBSITE_URL!, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
  }));
}
const login = await auth("sign-in/email", owner);
assert.equal(login.status, 200);
const token = login.headers.get("set-auth-token")!;
assert.ok(token);
assert.equal((await readStaff(new Headers({ authorization: `Bearer ${token}` })))?.id, owner.id);
assert.equal((await auth("sign-in/email", { ...owner, email: owner.email.toUpperCase() })).status, 200);
assert.equal((await auth("sign-in/email", { ...owner, password: "wrong-password" })).status, 401);
assert.equal((await auth("sign-in/email", other)).status, 401);

// An existing non-owner bearer session must also fail backend authorization.
const now = Date.now();
await db.execute({sql: "INSERT INTO session (id,expires_at,token,created_at,updated_at,user_id) VALUES (?,?,?,?,?,?)", args: ["old-session",now+3600000,"old-test-session-token",now,now,other.id]});
assert.equal(await readStaff(new Headers({authorization: "Bearer old-test-session-token"})), null);

for (const [path, body] of [
  ["sign-up/email", {name:"Intruder",email:"intruder@example.invalid",password:owner.password}],
  ["request-password-reset", {email:owner.email,redirectTo:"/admin/login"}],
  ["reset-password", {token:"fake",newPassword:owner.password}],
  ["change-password", {currentPassword:owner.password,newPassword:"another-test-password"}],
  ["change-email", {newEmail:other.email}],
  ["set-password", {newPassword:"another-test-password"}],
] as const) {
  const status = (await auth(path, body, token)).status;
  if (path === "set-password") assert.ok(status === 403 || status === 404, path);
  else assert.equal(status, 403, path);
}
async function rpc(path: string, input: object, authorized = true) {
  return app.fetch(new Request(`${process.env.WEBSITE_URL}/api/rpc/staff/${path}`, {method:"POST",headers:{"content-type":"application/json",...(authorized?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({json:input})}));
}
assert.equal((await rpc("register", {name:"Test",email:other.email,password:owner.password,inviteCode:"any-invite"},false)).status,403);
assert.equal((await rpc("setRole", {id:other.id,role:"admin"})).status,403);
assert.equal((await rpc("remove", {id:owner.id})).status,403);
assert.equal((await db.execute("SELECT count(*) AS n FROM user")).rows[0].n,2);
assert.equal((await auth("sign-out", {}, token)).status,200);
assert.equal(await readStaff(new Headers({authorization:`Bearer ${token}`})),null);
db.close();
console.log("PASS: isolated owner login, case normalization, wrong password/other identity rejection, legacy-session denial, signup/invite/role/account/password/email mutation rejection and sign-out. No production writes.");