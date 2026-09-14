const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const auth = require("./routes/auth");
const classroomsRouter = require("./routes/classrooms");
const armRouter = require("./routes/arm");
const temporaryRouter = require("./routes/temporary");
const acCardRouter = require("./routes/ac-card");
const accountsRouter = require("./routes/accounts");

const app = express();

// ================================
// 基本設定
// ================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================
// Session 登入系統
// ================================

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "arm_key_secret_123",

    resave: false,

    saveUninitialized: false,

    cookie: {
      secure: false,
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

// ================================
// 前端靜態檔案
// ================================

app.use(
  express.static(
    path.join(__dirname, "..", "public")
  )
);

// ================================
// API 路由
// ================================

// 登入 / 登出 / 使用者資訊
app.use("/api", auth.router);

// 教室課表
app.use("/api", classroomsRouter);

// 機械手臂
app.use("/api", armRouter);

// 臨時教室借還核准
app.use("/api", temporaryRouter);

// 冷氣卡管理
app.use("/api", acCardRouter);

// 帳號管理
app.use("/api", accountsRouter);

// ================================
// Render Keep Alive
// ================================

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.get("/api/debug/data", auth.requireAdmin, (req, res) => {
  try {
    const dataFile = path.join(__dirname, "..", "data.json");
    const exists = fs.existsSync(dataFile);

    if (!exists) {
      return res.json({
        success: true,
        exists: false,
        message: "目前找不到 data.json"
      });
    }

    const raw = fs.readFileSync(dataFile, "utf8");

    if (!raw.trim()) {
      return res.json({
        success: true,
        exists: true,
        empty: true,
        message: "data.json 存在，但內容是空的"
      });
    }

    const data = JSON.parse(raw);

    const classrooms = data.classrooms || {};
    const accounts = data.accounts || {};

    const classroomInfo = Object.keys(classrooms).map((id) => ({
      id: classrooms[id].id,
      name: classrooms[id].name,
      scheduleCount: Array.isArray(classrooms[id].schedules)
        ? classrooms[id].schedules.length
        : 0
    }));

    res.json({
      success: true,
      exists: true,
      empty: false,
      dataFile,
      classroomCount: Object.keys(classrooms).length,
      classroomInfo,
      accountCount: Object.keys(accounts).length,
      temporaryBookingCount: Array.isArray(data.temporaryBookings)
        ? data.temporaryBookings.length
        : 0
    });

  } catch (error) {
    console.error("資料診斷錯誤：", error);

    res.status(500).json({
      success: false,
      message: "讀取 data.json 失敗"
    });
  }
});
// ================================
// 首頁
// ================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "..",
      "public",
      "index.html"
    )
  );
});

// ================================
// API 404
// ================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "找不到指定的 API"
  });
});

// ================================
// 匯出 App
// ================================

module.exports = app;
