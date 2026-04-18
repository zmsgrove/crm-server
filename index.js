const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

// БД (локально ок; на Render для демо тоже ок)
const db = new sqlite3.Database("./db.sqlite");

// Создание таблицы
db.run(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// Проверка сервера
app.get("/", (req, res) => {
  res.send("CRM SERVER WORKING");
});

// Получить все заявки
app.get("/leads", (req, res) => {
  db.all("SELECT * FROM leads ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

// Добавить заявку вручную
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

// Обновить статус
app.put("/leads/:id", (req, res) => {
  const { status } = req.body;

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
  const data = req.body;

  const name = data.Name || data.name || "Без имени";
  const phone = data.Phone || data.phone || "Нет телефона";

  db.run(
    "INSERT INTO leads (name, phone) VALUES (?, ?)",
    [name, phone],
    function () {
      res.json({ success: true });
    }
  );
});

// Порт (ВАЖНО для Render)
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
});