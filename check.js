import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function checkTables() {
  const tables =
    await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log("Tables:", tables);

  if (tables.some((t) => t.table_name === "events")) {
    const columns =
      await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND table_schema = 'public'`;
    console.log("Events columns:", columns);
  }
}

checkTables();
