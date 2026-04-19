console.log("MY SERVER VERSION 123");

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();

// ===== DEBUG REQUESTS (ДОБАВИЛ) =====
app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const STATUSES = [
  "new",
  "evaluation",
  "priced",
  "waiting",
  "success",
  "fail",
];

const db = new sqlite3.Database("./db.sqlite");

// ===== TEST ROUTE (ДОБАВИЛ) =====
app.get("/test", (req, res) => {
  res.json({ ok: true, version: 123 });
});

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("CRM SERVER WORKING");
});

// ===== LEADS =====
db.run(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  product TEXT,
  city TEXT,
  condition TEXT,
  description TEXT,
  history TEXT,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// ===== USERS =====
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT UNIQUE,
  password TEXT,
  role TEXT
)
`);

// ===== USERS SEED =====
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
  console.log("LOGIN HIT BODY:", req.body);

  let { login, password } = req.body;

  // 🔥 fallback если вдруг тело пустое
  if (!login && req.query.login) {
    login = req.query.login;
    password = req.query.password;
  }

  db.get(
    "SELECT * FROM users WHERE login=? AND password=?",
    [login, password],
    (err, user) => {
      if (err) {
        console.error("DB ERROR:", err);
        return res.status(500).json({ error: err });
      }

      if (!user) {
        console.log("LOGIN FAILED:", login);
        return res.status(401).json({ error: "Неверный логин или пароль" });
      }

      console.log("LOGIN SUCCESS:", login);

      res.json(user);
    }
  );
});

// ===== LEADS =====
app.get("/leads", (req, res) => {
  const role = req.headers["x-role"];

  console.log("GET LEADS ROLE:", role);

  let query = "SELECT * FROM leads";
  let params = [];

  if (role === "uralsk") {
    query += " WHERE city=?";
    params.push("Уральск");
  }

  if (role === "atyrau") {
    query += " WHERE city=?";
    params.push("Атырау");
  }

  if (role === "aktobe") {
    query += " WHERE city=?";
    params.push("Актобе");
  }

  query += " ORDER BY id DESC";

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

// ===== UPDATE =====
app.put("/leads/:id", (req, res) => {
  const { status } = req.body;
  const role = req.headers["x-role"];

  db.get("SELECT * FROM leads WHERE id=?", [req.params.id], (err, lead) => {
    if (!lead) return res.status(404).json({ error: "Not found" });

    if (role === "uralsk" && lead.city !== "Уральск") return res.sendStatus(403);
    if (role === "atyrau" && lead.city !== "Атырау") return res.sendStatus(403);
    if (role === "aktobe" && lead.city !== "Актобе") return res.sendStatus(403);

    let history = [];
    try {
      history = JSON.parse(lead.history || "[]");
    } catch {}

    history.push({
      status,
      time: new Date().toLocaleString(),
    });

    db.run(
      "UPDATE leads SET status=?, history=? WHERE id=?",
      [status, JSON.stringify(history), req.params.id],
      () => res.json({ ok: true })
    );
  });
});

// ===== START =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
});