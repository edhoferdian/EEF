const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  one: async (sql, params) => (await pool.query(sql, params)).rows[0],
  none: async (sql, params) => { await pool.query(sql, params); },
};
