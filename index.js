const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= СТАТУСЫ =================
const STATUSES = [
  "new",
  "evaluation",
  "priced",
  "waiting",
  "success",
  "fail",
];

// ================= БАЗА =================
const db = new sqlite3.Database("./db.sqlite");

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

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("CRM SERVER WORKING");
});

// ================= GET LEADS =================
app.get("/leads", (req, res) => {
  db.all("SELECT * FROM leads ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

// ================= UPDATE STATUS =================
app.put("/leads/:id", (req, res) => {
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  db.get(
    "SELECT history FROM leads WHERE id=?",
    [req.params.id],
    (err, row) => {
      let history = [];

      try {
        history = JSON.parse(row?.history || "[]");
      } catch {}

      history.push({
        status,
        time: new Date().toLocaleString(),
      });

      db.run(
        "UPDATE leads SET status=?, history=? WHERE id=?",
        [status, JSON.stringify(history), req.params.id],
        function (err) {
          if (err) return res.status(500).json({ error: err });
          res.json({ ok: true });
        }
      );
    }
  );
});

// ================= TILDA WEBHOOK =================
app.post("/tilda", (req, res) => {
  console.log("🔥 TILDA:", req.body);

  const data = req.body;

  const product =
    data.name ||
    data.product ||
    data["Название товара"] ||
    "";

  const description =
    data.about ||
    data.description ||
    data.message ||
    data.text ||
    data.comment ||
    "";

  const phone = data.phone || data.tel || "";

  const city =
    data.city ||
    data["Город"] ||
    "";

  const condition =
    data.condition ||
    data.state ||
    data.status ||
    "";

  const name =
    data.client ||
    data.username ||
    "";

  db.run(
    `INSERT INTO leads 
    (name, product, phone, city, condition, description, history) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      product,
      phone,
      city,
      condition,
      description,
      JSON.stringify([
        { status: "new", time: new Date().toLocaleString() },
      ]),
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err });
      }

      res.json({ success: true });
    }
  );
});

// ================= СТАРТ =================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
});