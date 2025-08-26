#!/usr/bin/env node
import fs from "fs";
import path from "path";
import "dotenv/config";
import readline from "readline";

let PB_URL = process.argv[2] || null;
if (!PB_URL) {
  // tiny .env loader (pas de dépendance)
  try {
    const envPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
      "config",
      ".env"
    );
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2].replace(/^['"]|['"]$/g, ""); // strip quotes
      if (!process.env[k]) process.env[k] = v;
    }
    const host = process.env.PB_HOST || "127.0.0.1";
    const port = process.env.POCKETBASE_PORT || "8090"; // port depuis .env
    PB_URL = `http://${host}:${port}`;
  } catch (_) {
    PB_URL = "http://127.0.0.1:8090";
  }
}
const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const SCHEMA_DIR = path.join(ROOT, "config", "schema");
const COLLECTIONS_FILE = path.join(SCHEMA_DIR, "collections.json");
const RULES_FILE = path.join(SCHEMA_DIR, "rules.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q, silent = false) =>
  new Promise((res) => {
    if (!silent) return rl.question(q, (ans) => res(ans));
    // mot de passe masqué
    const stdin = process.openStdin();
    process.stdout.write(q);
    let input = "";
    const onData = (char) => {
      char = char + "";
      switch (char) {
        case "\n":
        case "\r":
        case "\u0004":
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          res(input);
          break;
        case "\u0003":
          process.exit();
        default:
          if (char !== "*") process.stdout.write("*");
          input += char;
          break;
      }
    };
    stdin.on("data", onData);
  });

async function adminLogin(email, password) {
  const r = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Auth failed: ${r.status} ${t}`);
  }
  return r.json(); // { token, admin }
}

async function getCollections(token) {
  const r = await fetch(`${PB_URL}/api/collections`, {
    headers: { Authorization: token },
  });
  if (!r.ok) throw new Error(`GET collections failed: ${r.status}`);
  const j = await r.json();
  return j?.items?.map((c) => c.name) || [];
}

async function createCollection(token, name) {
  const r = await fetch(`${PB_URL}/api/collections`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      type: "base",
      name,
      schema: [
        // aucun champ métier : tout est dans `payload` chiffré côté client.
        // les champs techniques (id, created, updated) sont gérés par PB.
        // si tu veux forcer des index/constraints, tu pourras le faire ici plus tard.
      ],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Create ${name} failed: ${r.status} ${t}`);
  }
}

async function patchRules(token, name, rulesObj) {
  // récupère la collection pour avoir son id
  const all = await (
    await fetch(`${PB_URL}/api/collections`, {
      headers: { Authorization: token },
    })
  ).json();
  const col = (all.items || []).find((c) => c.name === name);
  if (!col) throw new Error(`Collection ${name} not found to patch rules`);

  const payload = {};
  ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"].forEach(
    (k) => {
      if (rulesObj[k] !== undefined) payload[k] = rulesObj[k];
    }
  );

  if (Object.keys(payload).length === 0) return;

  const r = await fetch(`${PB_URL}/api/collections/${col.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Patch rules ${name} failed: ${r.status} ${t}`);
  }
}

async function waitForPocketBaseReady(url, maxTries = 40, delayMs = 250) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const r = await fetch(url + "/api/health");
      if (r.ok) return true;
    } catch (e) {}
    await new Promise((res) => setTimeout(res, delayMs));
  }
  throw new Error("PocketBase n'est pas prêt après attente.");
}

async function main() {
  console.log(`🔗 PocketBase: ${PB_URL}`);
  await waitForPocketBaseReady(PB_URL);
  const email = await ask("Admin email: ");
  const password = await ask("Admin password: ", true);
  const { token } = await adminLogin(email, password);

  // collections attendues
  const wanted = JSON.parse(fs.readFileSync(COLLECTIONS_FILE, "utf8"));
  const existing = await getCollections(token);

  // création si manquantes
  for (const name of wanted) {
    if (!existing.includes(name)) {
      console.log(`➕ create collection: ${name}`);
      await createCollection(token, name);
    } else {
      console.log(`✔︎ exists: ${name}`);
    }
  }

  // appliquer rules si présentes
  if (fs.existsSync(RULES_FILE)) {
    const rules = JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
    for (const [name, rulesObj] of Object.entries(rules)) {
      console.log(`⚙︎ rules → ${name}`);
      await patchRules(token, name, rulesObj);
    }
  } else {
    console.log("ℹ️  Aucun rules.json trouvé — étape ignorée.");
  }

  rl.close();
  console.log("✅ Schéma appliqué.");
}

main().catch((e) => {
  rl.close();
  console.error("❌", e.message);
  process.exit(1);
});
