const express = require("express");

const router = express.Router();

const { requireAdmin } = require("./auth");

// ==================================================
// 目前帳號資料
//
// 注意：
// 這一版先獨立建立帳號管理模組。
// 下一階段再把帳號正式移到 data.json。
// ==================================================

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


// ==================================================
// GET /api/accounts
// 取得所有帳號
// ==================================================

router.get(
  "/accounts",
  requireAdmin,
  (req, res) => {
    try {
      const accountList = Object.entries(accounts).map(
        ([username, account]) => ({
          username,
          role: account.role,
          name: account.name
        })
      );

      res.json({
        success: true,
        accounts: accountList
      });

    } catch (error) {
      console.error("取得帳號列表錯誤：", error);

      res.status(500).json({
        success: false,
        message: "無法取得帳號列表"
      });
    }
  }
);


// ==================================================
// POST /api/accounts
// 新增帳號
// ==================================================

router.post(
  "/accounts",
  requireAdmin,
  (req, res) => {
    try {
      const {
        username,
        password,
        role,
        name
      } = req.body;

      // ----------------------------------------------
      // 基本檢查
      // ----------------------------------------------

      if (
        !username ||
        !password ||
        !role ||
        !name
      ) {
        return res.status(400).json({
          success: false,
          message: "請完整填寫帳號、密碼、角色與姓名"
        });
      }

      const accountUsername =
        String(username).trim();

      const accountPassword =
        String(password);

      const accountName =
        String(name).trim();

      // ----------------------------------------------
      // 檢查帳號格式
      // ----------------------------------------------

      if (accountUsername.length < 3) {
        return res.status(400).json({
          success: false,
          message: "帳號至少需要 3 個字元"
        });
      }

      if (accountPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "密碼至少需要 6 個字元"
        });
      }

      // ----------------------------------------------
      // 檢查角色
      // ----------------------------------------------

      if (
        role !== "admin" &&
        role !== "teacher"
      ) {
        return res.status(400).json({
          success: false,
          message: "角色只能是 admin 或 teacher"
        });
      }

      // ----------------------------------------------
      // 檢查帳號是否已存在
      // ----------------------------------------------

      if (accounts[accountUsername]) {
        return res.status(409).json({
          success: false,
          message: "這個帳號已經存在"
        });
      }

      // ----------------------------------------------
      // 建立帳號
      // ----------------------------------------------

      accounts[accountUsername] = {
        password: accountPassword,
        role,
        name: accountName
      };

      res.json({
        success: true,
        message: "帳號新增成功",

        account: {
          username: accountUsername,
          role,
          name: accountName
        }
      });

    } catch (error) {
      console.error("新增帳號錯誤：", error);

      res.status(500).json({
        success: false,
        message: "新增帳號失敗"
      });
    }
  }
);


// ==================================================
// DELETE /api/accounts/:username
// 刪除帳號
// ==================================================

router.delete(
  "/accounts/:username",
  requireAdmin,
  (req, res) => {
    try {
      const username =
        String(req.params.username).trim();

      // ----------------------------------------------
      // 確認帳號存在
      // ----------------------------------------------

      if (!accounts[username]) {
        return res.status(404).json({
          success: false,
          message: "找不到指定帳號"
        });
      }

      // ----------------------------------------------
      // 不允許刪除目前登入中的帳號
      // ----------------------------------------------

      if (
        req.session.user &&
        req.session.user.username === username
      ) {
        return res.status(400).json({
          success: false,
          message: "不能刪除目前正在登入的帳號"
        });
      }

      // ----------------------------------------------
      // 刪除帳號
      // ----------------------------------------------

      delete accounts[username];

      res.json({
        success: true,
        message: `帳號 ${username} 已刪除`
      });

    } catch (error) {
      console.error("刪除帳號錯誤：", error);

      res.status(500).json({
        success: false,
        message: "刪除帳號失敗"
      });
    }
  }
);


// ==================================================
// POST /api/accounts/:username
// 修改帳號
// ==================================================

router.post(
  "/accounts/:username",
  requireAdmin,
  (req, res) => {
    try {
      const username =
        String(req.params.username).trim();

      const account = accounts[username];

      if (!account) {
        return res.status(404).json({
          success: false,
          message: "找不到指定帳號"
        });
      }

      const {
        password,
        role,
        name
      } = req.body;

      // ----------------------------------------------
      // 修改密碼
      // ----------------------------------------------

      if (password !== undefined) {
        const newPassword =
          String(password);

        if (newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message: "密碼至少需要 6 個字元"
          });
        }

        account.password = newPassword;
      }

      // ----------------------------------------------
      // 修改角色
      // ----------------------------------------------

      if (role !== undefined) {
        if (
          role !== "admin" &&
          role !== "teacher"
        ) {
          return res.status(400).json({
            success: false,
            message: "角色只能是 admin 或 teacher"
          });
        }

        account.role = role;
      }

      // ----------------------------------------------
      // 修改姓名
      // ----------------------------------------------

      if (name !== undefined) {
        account.name =
          String(name).trim();
      }

      // ----------------------------------------------
      // 回傳
      // ----------------------------------------------

      res.json({
        success: true,
        message: "帳號資料更新成功",

        account: {
          username,
          role: account.role,
          name: account.name
        }
      });

    } catch (error) {
      console.error("修改帳號錯誤：", error);

      res.status(500).json({
        success: false,
        message: "修改帳號失敗"
      });
    }
  }
);


// ==================================================
// GET /api/accounts/:username
// 取得指定帳號
// ==================================================

router.get(
  "/accounts/:username",
  requireAdmin,
  (req, res) => {
    try {
      const username =
        String(req.params.username).trim();

      const account = accounts[username];

      if (!account) {
        return res.status(404).json({
          success: false,
          message: "找不到指定帳號"
        });
      }

      // 絕對不要把密碼回傳給前端
      res.json({
        success: true,

        account: {
          username,
          role: account.role,
          name: account.name
        }
      });

    } catch (error) {
      console.error("取得指定帳號錯誤：", error);

      res.status(500).json({
        success: false,
        message: "無法取得帳號資料"
      });
    }
  }
);


// ==================================================
// 匯出 Router
// ==================================================

module.exports = {
  router,
  accounts
};
