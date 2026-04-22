console.log("MY SERVER VERSION SUPABASE");

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

// ✅ SQLITE ОСТАВЛЯЕМ (для чатов, задач и т.д.)
const db = new sqlite3.Database("./db.sqlite");

// ✅ SUPABASE
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
);

const app = express();

// ===== DEBUG =====
app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

app.use(cors());
app.use(express.json());

// ===== TEST =====
app.get("/test", (req, res) => {
  res.json({ ok: true, version: "SUPABASE" });
});

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("CRM SERVER SUPABASE");
});

// ===== SQLITE TABLES (НЕ ТРОГАЕМ) =====
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_login TEXT,
      title TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      user_login TEXT,
      text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      user_login TEXT
    )
  `);
});

// ===== USERS =====
db.serialize(() => {
  const users = [
    { login: "admin", password: "Skupka2026ad", role: "admin" },
    { login: "uralsk", password: "Oral2026uu", role: "uralsk" },
    { login: "atyrau", password: "Skupka26aa", role: "atyrau" },
    { login: "aktobe", password: "Begdos1020", role: "aktobe" },
  ];

  users.forEach((u) => {
    db.run(
      `INSERT OR IGNORE INTO users (login, password, role) VALUES (?, ?, ?)`,
      [u.login, u.password, u.role]
    );
  });
});

// ===== LOGIN =====
app.post("/api/auth/login", (req, res) => {
  const { login, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE login=? AND password=?",
    [login, password],
    (err, user) => {
      if (!user) return res.status(401).json({ error: "Неверный логин" });
      res.json(user);
    }
  );
});


// =======================================
// 🚀 LEADS → SUPABASE
// =======================================

// GET
app.get("/leads", async (req, res) => {
  const role = req.headers["x-role"];

  let query = supabase
    .from("leads")
    .select("*")
    .order("id", { ascending: false });

  if (role === "uralsk") query = query.eq("city", "Уральск");
  if (role === "atyrau") query = query.eq("city", "Атырау");
  if (role === "aktobe") query = query.eq("city", "Актобе");

  const { data, error } = await query;

  if (error) {
  console.error("SUPABASE GET ERROR:", error);
  return res.status(500).json(error);
}

  res.json(data);
});

// CREATE
app.post("/leads", async (req, res) => {
  const { name, phone, product, city, status } = req.body;

  const payload = {
    name: name || "",
    phone: phone || "",
    product: product || "",
    city: city || "",
    status: status || "new"
  };

  console.log("CREATE LEAD PAYLOAD:", payload);

  const { data, error } = await supabase
    .from("leads")
    .insert([payload])
    .select();

  if (error) {
    console.error("SUPABASE GET ERROR:", error);
    return res.status(500).json(error);
  }

  console.log("SUPABASE INSERT SUCCESS:", data);

  res.json(data[0]);
});


// UPDATE
app.put("/leads/:id", async (req, res) => {
  const { status } = req.body;

  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", req.params.id);

  if (error) {
  console.error("SUPABASE GET ERROR:", error);
  return res.status(500).json(error);
}

  res.json({ ok: true });
});


// ===== CHATS (SQLITE) =====
app.post("/chats", (req, res) => {
  const role = req.headers["x-role"];
  const { name, users } = req.body;

  if (role !== "admin") return res.sendStatus(403);

  db.run(`INSERT INTO chats (name, created_by) VALUES (?, ?)`,
    [name, role],
    function () {
      const chatId = this.lastID;

      users.forEach((u) => {
        db.run(`INSERT INTO chat_users (chat_id, user_login) VALUES (?, ?)`,
          [chatId, u]
        );
      });

      res.json({ id: chatId });
    }
  );
});

app.get("/chats", (req, res) => {
  const login = req.headers["x-login"];

  db.all(`
    SELECT c.* FROM chats c
    JOIN chat_users cu ON cu.chat_id = c.id
    WHERE cu.user_login = ?
  `, [login], (err, rows) => res.json(rows));
});

app.get("/chats/:id/messages", (req, res) => {
  db.all(`
    SELECT * FROM chat_messages
    WHERE chat_id = ?
    ORDER BY id ASC
  `, [req.params.id], (err, rows) => res.json(rows));
});

app.post("/chats/:id/messages", (req, res) => {
  const { text } = req.body;
  const login = req.headers["x-login"];
  const chatId = req.params.id;

  db.run(`
    INSERT INTO chat_messages (chat_id, user_login, text)
    VALUES (?, ?, ?)
  `, [chatId, login, text], () => res.json({ ok: true }));
});


// ===== TASKS =====
app.get("/tasks", (req, res) => {
  const login = req.headers["x-login"];

  db.all(`SELECT * FROM tasks WHERE user_login = ?`,
    [login],
    (err, rows) => res.json(rows)
  );
});

app.post("/tasks", (req, res) => {
  const login = req.headers["x-login"];
  const { title } = req.body;

  db.run(`
    INSERT INTO tasks (title, status, user_login)
    VALUES (?, 'new', ?)
  `, [title, login], () => res.json({ ok: true }));
});

app.put("/tasks/:id", (req, res) => {
  const { status } = req.body;

  db.run(`
    UPDATE tasks SET status=? WHERE id=?
  `, [status, req.params.id], () => res.json({ ok: true }));
});


// ===== START =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
});