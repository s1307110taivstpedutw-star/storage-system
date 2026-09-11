const express = require("express");

const router = express.Router();

// ======================================================
// 測試帳號
// ======================================================

const accounts = {
  admin: {
    password: "admin123",
    role: "admin",
    name: "系統管理員"
  },

  teacher: {
    password: "teacher123",
    role: "teacher",
    name: "教師"
  }
};

// ======================================================
// 登入
// ======================================================

router.post("/login", (req, res) => {
  try {
    const {
      username,
      password
    } = req.body;

    if (!username || !password) {
      return res.json({
        success: false,
        message: "請輸入帳號與密碼"
      });
    }

    const account = accounts[username];

    if (
      !account ||
      account.password !== password
    ) {
      return res.json({
        success: false,
        message: "帳號或密碼錯誤"
      });
    }

    req.session.user = {
      username,
      role: account.role,
      name: account.name
    };

    res.json({
      success: true,
      message: "登入成功",
      user: req.session.user
    });

  } catch (error) {
    console.error("登入錯誤：", error);

    res.status(500).json({
      success: false,
      message: "伺服器發生錯誤"
    });
  }
});

// ======================================================
// 取得目前登入者
// ======================================================

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.json({
      loggedIn: false
    });
  }

  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

// ======================================================
// 登出
// ======================================================

router.post("/logout", (req, res) => {
  req.session.destroy(error => {
    if (error) {
      console.error("登出錯誤：", error);

      return res.status(500).json({
        success: false,
        message: "登出失敗"
      });
    }

    res.json({
      success: true,
      message: "已登出"
    });
  });
});

// ======================================================
// 登入權限 Middleware
// ======================================================

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "請先登入"
    });
  }

  next();
}

// ======================================================
// 管理員權限 Middleware
// ======================================================

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "請先登入"
    });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "只有管理員可以執行此操作"
    });
  }

  next();
}

module.exports = {
  router,
  requireLogin,
  requireAdmin
};
