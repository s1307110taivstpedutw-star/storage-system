const express = require("express");
const session = require("express-session");
const path = require("path");

const auth = require("./routes/auth");
const classroomsRouter = require("./routes/classrooms");

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

// ================================
// 匯出 App
// ================================

module.exports = app;
