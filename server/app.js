const express = require("express");
const session = require("express-session");
const path = require("path");

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
    secret: process.env.SESSION_SECRET || "arm_key_secret_123",
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

app.use(express.static(path.join(__dirname, "..", "public")));

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
// 匯出 App
// ================================

module.exports = app;
