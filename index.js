require('dotenv').config();

console.log("MY SERVER VERSION SUPABASE");

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

// ✅ SQLITE ОСТАВЛЯЕМ (для чатов, задач и т.д.)
const db = new sqlite3.Database("./db.sqlite");

// ✅ SUPABASE
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
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
    role TEXT,
    name TEXT,
    position TEXT
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
  {
    login: "MaksatovS",
    password: "Syrym10599",
    role: "dir",
    name: "Максатов Сырым",
    position: "Директор"
  },
  {
    login: "KoshaB",
    password: "Begdos10102",
    role: "zamdir",
    name: "Кожа Бегдос",
    position: "Зам. Директора"
  },
  {
    login: "KylyshbaevaM",
    password: "Makpal10321",
    role: "sysadmin",
    name: "Кылышбаева Макпал",
    position: "Системный Администратор"
  },
  {
    login: "AleksandrovD",
    password: "Daniil99876",
    role: "rgmu",
    name: "Александров Даниил",
    position: "РГМ г. Уральск"
  },
  {
    login: "AminovN",
    password: "Nyrlan10102",
    role: "rgma",
    name: "Аминов Нурлан",
    position: "РГМ г. Атырау"
  },
  {
    login: "Revizor",
    password: "Revizor2026skupka",
    role: "rev",
    name: "СТРевизор",
    position: "Ревизор Компании"
  },
  {
    login: "ShatanovR",
    password: "RustemSMM1",
    role: "smm",
    name: "Шатанов Рустем",
    position: "Маркетолог"
  },
  {
    login: "zmsgrove",
    password: "Marakoda8585",
    role: "admin",
    name: "Админ",
    position: "Админ"
  },
  {
    login: "k162",
    password: "Kyrman1621",
    role: "uralsk",
    name: "Филиал к162",
    position: "СПО г. Уральск"
  },
  {
    login: "sv47",
    password: "Sever7055",
    role: "uralsk",
    name: "Филиал св47",
    position: "СПО г. Уральск"
  },
  {
    login: "a21",
    password: "Abyl60333",
    role: "aktobe",
    name: "Филиал a21",
    position: "СПО г. Актобе"
  },
  {
    login: "s32",
    password: "Satpaeva1010",
    role: "atyrau",
    name: "Филиал с32",
    position: "СПО г. Атырау"
  },
];

users.forEach((u) => {
  db.run(
    `INSERT OR IGNORE INTO users (login, password, role, name, position)
     VALUES (?, ?, ?, ?, ?)`,
    [u.login, u.password, u.role, u.name, u.position]
  );
});

});

// ===== USERS LIST =====
app.get("/users", (req, res) => {
  db.all(
    "SELECT login, name, position FROM users",
    [],
    (err, rows) => {
      if (err) {
        console.error("GET USERS ERROR:", err);
        return res.status(500).json({ error: "db_error" });
      }

      res.json(rows);
    }
  );
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

if (role === "uralsk") query = query.ilike("city", "%урал%");
if (role === "atyrau") query = query.ilike("city", "%атыр%");
if (role === "aktobe") query = query.ilike("city", "%актоб%");

  const { data, error } = await query;

  if (error) {
  console.error("SUPABASE GET ERROR:", error);
  return res.status(500).json(error);
}

  res.json(data);
});

// CREATE
app.post("/leads", async (req, res) => {
  const { name, phone, product, city, status, description } = req.body;

const payload = {
  name: name || "",
  phone: phone || "",
  product: product || "",
  city: city || "",
  description: description || "",
  status: status || "new",
  created_at: new Date().toISOString() // 🔥 КРИТИЧНО
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

// DELETE LEAD
app.delete("/leads/:id", async (req, res) => {
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", req.params.id);

  if (error) {
    console.error("DELETE LEAD ERROR:", error);
    return res.status(500).json(error);
  }

  res.json({ ok: true });
});

// ===== CHATS (SQLITE) =====
app.get("/chats", async (req, res) => {
  const login = req.headers["x-login"];

  const { data, error } = await supabase
    .from("chats")
    .select(`
      id,
      name,
      created_at,
      chat_users!inner(user_login),
      chat_messages (
        id,
        text,
        created_at,
        user_login
      )
    `)
    .eq("chat_users.user_login", login);

  if (error) {
    console.error("GET CHATS ERROR:", error);
    return res.status(500).json(error);
  }

  const chats = data.map(chat => {
    const last = chat.chat_messages
      ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    return {
      id: chat.id,
      name: chat.name,
      created_at: chat.created_at,
      last_message: last || null
    };
  });

  res.json(chats);
});

app.get("/chats/:id/messages", async (req, res) => {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_id", req.params.id)
    .order("id", { ascending: true });

  if (error) {
    console.error("GET MSG ERROR:", error);
    return res.status(500).json(error);
  }

  res.json(data);
});

app.post("/chats", async (req, res) => {
  const { name, users } = req.body;
  const login = req.headers["x-login"];

  // 1. создаём чат
  const { data: chat, error } = await supabase
    .from("chats")
    .insert([{ name, created_by: login }])
    .select()
    .single();

  if (error) return res.status(500).json(error);

  // 2. добавляем участников
  const usersToInsert = users.map(u => ({
    chat_id: chat.id,
    user_login: u
  }));

  await supabase.from("chat_users").insert(usersToInsert);

  res.json(chat);
});

app.post("/chats/:id/messages", async (req, res) => {
  const { text } = req.body;
  const login = req.headers["x-login"];

  const { data, error } = await supabase
    .from("chat_messages")
    .insert([{
      chat_id: req.params.id,
      text,
      user_login: login
    }])
    .select();

  if (error) {
    console.error("SEND MSG ERROR:", error);
    return res.status(500).json(error);
  }

  res.json(data[0]);
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
app.delete('/chats/:id', async (req, res) => {
  const id = req.params.id;

  try {
    await supabase.from('chat_messages').delete().eq('chat_id', id);
    await supabase.from('chat_users').delete().eq('chat_id', id);
    await supabase.from('chats').delete().eq('id', id);

    res.json({ success: true });
  } catch (e) {
    console.error("DELETE CHAT ERROR:", e);
    res.status(500).json({ error: 'delete_failed' });
  }
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
  });
 
