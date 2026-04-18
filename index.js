const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 🔥 для Tilda

// ✅ допустимые статусы
const STATUSES = [
  "new",
  "evaluation",
  "priced",
  "waiting",
  "success",
  "fail",
];

// БД
const db = new sqlite3.Database("./db.sqlite");

// таблица
db.run(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  product TEXT,
  city TEXT,
  condition TEXT,
  description TEXT,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// проверка
app.get("/", (req, res) => {
  res.send("CRM SERVER WORKING");
});

// получить все заявки
app.get("/leads", (req, res) => {
  db.all("SELECT * FROM leads ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

// ручное добавление
app.post("/leads", (req, res) => {
  const { name, phone } = req.body;

  db.run(
    "INSERT INTO leads (name, phone) VALUES (?, ?)",
    [name, phone],
    function (err) {
      if (err) return res.status(500).json({ error: err });
      res.json({ id: this.lastID });
    }
  );
});

// 🔥 обновление статуса (с проверкой)
app.put("/leads/:id", (req, res) => {
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  db.run(
    "UPDATE leads SET status=? WHERE id=?",
    [status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err });
      res.json({ ok: true });
    }
  );
});

// 🔥 Webhook от Tilda
app.post("/tilda", (req, res) => {
  console.log("🔥 TILDA:", req.body);

  const data = req.body;

  const product = data.name?.trim() || "";        // товар
  const description = data.about?.trim() || "";   // описание товара
  const phone = data.phone?.trim() || "";
  const city = data.city?.trim() || "";
  const condition = data.description?.trim() || ""; // состояние

  db.run(
    `INSERT INTO leads 
    (name, product, phone, city, condition, description) 
    VALUES (?, ?, ?, ?, ?, ?)`,
    [product, product, phone, city, condition, description],
    function () {
      res.json({ success: true });
    }
  );
});

// запуск
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
});