const express = require("express");

const router = express.Router();

const { requireLogin, requireAdmin } = require("./auth");

// ========================================
// 📋 網站日誌
// ========================================
// 目前先使用記憶體保存日誌。
// 後續再把日誌正式寫入 data.json 或獨立
// 日誌檔案。
// ========================================

const logs = [];


// ========================================
// 工具：建立日誌
// ========================================

function createLog({
  action,
  category,
  message,
  username = "",
  name = "",
  role = "",
  success = true,
  details = ""
}) {
  const log = {
    id: Date.now() + Math.floor(Math.random() * 1000),

    time: new Date().toISOString(),

    username,

    name,

    role,

    category,

    action,

    message,

    success,

    details
  };

  logs.unshift(log);

  // 暫時最多保留 500 筆
  if (logs.length > 500) {
    logs.splice(500);
  }

  return log;
}


// ========================================
// POST /api/logs
// 新增一筆網站日誌
// ========================================

router.post("/logs", requireLogin, (req, res) => {
  try {
    const {
      category,
      action,
      message,
      details = "",
      success = true
    } = req.body;

    if (!category || !action || !message) {
      return res.status(400).json({
        success: false,
        message: "缺少必要的日誌資料"
      });
    }

    const log = createLog({
      category: String(category).trim(),
      action: String(action).trim(),
      message: String(message).trim(),
      details: String(details).trim(),
      success: Boolean(success),

      username: req.session.user.username,
      name: req.session.user.name,
      role: req.session.user.role
    });

    res.json({
      success: true,
      message: "日誌建立成功",
      log
    });

  } catch (error) {
    console.error("建立網站日誌錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法建立網站日誌"
    });
  }
});


// ========================================
// GET /api/logs
// 管理員取得全部網站日誌
// ========================================

router.get("/logs", requireAdmin, (req, res) => {
  try {
    res.json({
      success: true,
      total: logs.length,
      logs
    });

  } catch (error) {
    console.error("取得網站日誌錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法取得網站日誌"
    });
  }
});


// ========================================
// GET /api/logs/recent
// 取得最近幾筆日誌
// ========================================

router.get("/logs/recent", requireAdmin, (req, res) => {
  try {
    let limit = Number(req.query.limit || 20);

    if (!Number.isFinite(limit) || limit < 1) {
      limit = 20;
    }

    limit = Math.min(Math.floor(limit), 100);

    const recentLogs = logs.slice(0, limit);

    res.json({
      success: true,
      total: recentLogs.length,
      logs: recentLogs
    });

  } catch (error) {
    console.error("取得最近日誌錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法取得最近網站日誌"
    });
  }
});


// ========================================
// GET /api/logs/:id
// 管理員查看單筆日誌
// ========================================

router.get("/logs/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: "日誌 ID 無效"
      });
    }

    const log = logs.find(item => Number(item.id) === id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "找不到這筆日誌"
      });
    }

    res.json({
      success: true,
      log
    });

  } catch (error) {
    console.error("取得單筆日誌錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法取得日誌"
    });
  }
});


// ========================================
// DELETE /api/logs
// 清除全部網站日誌
// ========================================

router.delete("/logs", requireAdmin, (req, res) => {
  try {
    const count = logs.length;

    logs.length = 0;

    res.json({
      success: true,
      message: "網站日誌已清除",
      deleted: count
    });

  } catch (error) {
    console.error("清除網站日誌錯誤：", error);

    res.status(500).json({
      success: false,
      message: "清除網站日誌失敗"
    });
  }
});


// ========================================
// 匯出 Router
// ========================================

module.exports = {
  router,
  createLog
};
