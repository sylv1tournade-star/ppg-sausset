const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const index = trimmed.indexOf("=");
  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const tables = ["ppg_seasons", "ppg_sessions", "ppg_participants", "ppg_paid_members"];
  for (const table of tables) {
    const { error } = await client.from(table).select("id").limit(1);
    if (error) {
      console.error(`FAIL ${table}:`, error.message);
      process.exit(1);
    }
    console.log(`OK ${table}`);
  }

  const { data: seasons } = await client.from("ppg_seasons").select("id, label, is_active");
  console.log("Seasons:", seasons?.length ?? 0, seasons ?? []);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
