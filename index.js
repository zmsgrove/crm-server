console.log("MY SERVER VERSION 123");

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db.sqlite");

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


// ===== HELPERS =====
function normalizePhone(phone) {
  const clean = phone.replace(/\D/g, '');

  if (clean.length === 11 && clean.startsWith('8')) {
    return clean.slice(1);
  }

  if (clean.length === 11 && clean.startsWith('7')) {
    return clean.slice(1);
  }

  return clean.slice(-10);
}

function findLeadByPhone(phone) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM leads 
      WHERE substr(phone, -10) = ?
      LIMIT 1
    `, [phone], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// ===== TEST ROUTE (ДОБАВИЛ) =====
app.get("/test", (req, res) => {
  res.json({ ok: true, version: 123 });
});

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("CRM SERVER WORKING");
});

db.serialize(() => {
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

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      phone TEXT,
      text TEXT,
      direction TEXT,
      external_id TEXT UNIQUE,
      created_at DATETIME,
      read INTEGER DEFAULT 0
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id)`);
});
app.get('/messages/:leadId', (req, res) => {
  db.all(`
    SELECT * FROM messages
    WHERE lead_id = ?
    ORDER BY created_at ASC
  `, [req.params.leadId], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});
app.post('/messages', (req, res) => {
  const { leadId, text } = req.body;

  db.get(`SELECT * FROM leads WHERE id = ?`, [leadId], (err, lead) => {
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    db.run(`
      INSERT INTO messages (lead_id, phone, text, direction, created_at)
      VALUES (?, ?, ?, 'outgoing', datetime('now'))
    `, [leadId, lead.phone, text]);

    res.json({ success: true });
  });
});





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

// ===== TILDA WEBHOOK =====
app.get("/tilda", (req, res) => {
  res.send("TILDA OK");
});
app.post("/tilda", (req, res) => {
  console.log("🔥 TILDA RAW BODY:", req.body);

  const data = req.body;

  // адаптация под Tilda (поля могут отличаться)
  const name = data.name || data.Name || data["Имя"] || "";
  const phone = data.phone || data.Phone || data["Телефон"] || "";
  const product = data.product || data.Product || data["Товар"] || "";
  const city = data.city || data.City || data["Город"] || "";

  db.run(
    `
    INSERT INTO leads (name, phone, product, city, status, created_at)
    VALUES (?, ?, ?, ?, 'new', datetime('now'))
    `,
    [name, phone, product, city],
    (err) => {
      if (err) {
        console.error("❌ DB INSERT ERROR:", err);
        return res.status(500).json({ error: err });
      }

      console.log("✅ ЛИД СОХРАНЕН В БД");
      res.sendStatus(200);
    }
  );
});
// ===== WAZZUP WEBHOOK =====
app.post('/wazzup/webhook', async (req, res) => {
  try {
    console.log("📩 WAZZUP:", req.body);

    const event = req.body;

    if (event.type === 'message') {
      const msg = event.payload;

      if (!msg.chatId) {
  console.log("⚠️ Нет chatId");
  return res.sendStatus(200);
}

const phone = normalizePhone(msg.chatId);
      const text = msg.text || '';
      const direction = msg.isFromMe ? 'outgoing' : 'incoming';
      const externalId = msg.messageId;
      const createdAt = new Date(msg.timestamp || Date.now()).toISOString();

      const lead = await findLeadByPhone(phone);

      if (!lead) {
        console.log("❌ Лид не найден:", phone);
        return res.sendStatus(200);
      }
if (!externalId) {
  console.log("⚠️ Нет externalId");
  return res.sendStatus(200);
}
db.run(`
  INSERT OR IGNORE INTO messages 
  (lead_id, phone, text, direction, external_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`, [lead.id, phone, text, direction, externalId, createdAt], (err) => {
  if (err) {
    console.error("DB ERROR:", err);
  } else {
    console.log("✅ Сообщение сохранено");
  }
});

}

    res.sendStatus(200);
  } catch (err) {
    console.error("WAZZUP ERROR:", err);
    res.sendStatus(500);
  }
});

// ===== START =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
});
