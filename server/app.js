const express = require("express");
const session = require("express-session");
const path = require("path");

const auth = require("./routes/auth");

const app = express();


// ==============================
// 基本 Middleware
// ==============================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ==============================
// Session
// ==============================

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


// ==============================
// 靜態網站
// ==============================

app.use(express.static(path.join(__dirname, "..", "public")));


// ==============================
// 登入系統 API
// ==============================

app.use("/api", auth.router);


// ==============================
// 匯出 App
// ==============================

module.exports = app;
