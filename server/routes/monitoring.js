const express = require("express");

const router = express.Router();

const { requireLogin } = require("./auth");

// ========================================
// 📡 連線監測
// ========================================
// 目前先建立監測 API 骨架。
// LINE、ESP32、TalkBack、Google Analytics
// 之後再分別接入真正的服務。
// ========================================


// ========================================
// 工具：建立監測項目
// ========================================

function createMonitorItem(name, status, message, lastCheck = null) {
  return {
    name,
    status,
    message,
    lastCheck
  };
}


// ========================================
// GET /api/monitoring
// 取得目前系統所有監測狀態
// ========================================

router.get("/monitoring", requireLogin, (req, res) => {
  try {
    const now = new Date().toISOString();

    const monitoring = {
      success: true,

      checkedAt: now,

      services: [
        createMonitorItem(
          "5 分鐘觸發",
          "待接線",
          "GitHub Actions Keep Alive 尚未納入即時監測",
          null
        ),

        createMonitorItem(
          "網站伺服器",
          "正常",
          "API 監測模組目前可以正常回應",
          now
        ),

        createMonitorItem(
          "LINE",
          "待接線",
          "LINE Messaging API 尚未接入",
          null
        ),

        createMonitorItem(
          "ESP32",
          "待接線",
          "ESP32 尚未接入監測服務",
          null
        ),

        createMonitorItem(
          "API",
          "正常",
          "監測 API 本身可以正常回應",
          now
        ),

        createMonitorItem(
          "TalkBack",
          "待接線",
          "TalkBack 回傳機制尚未接入",
          null
        ),

        createMonitorItem(
          "網站流量",
          "待接線",
          "Google Analytics 尚未接入",
          null
        )
      ]
    };

    res.json(monitoring);

  } catch (error) {
    console.error("取得監測資料錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法取得監測資料"
    });
  }
});


// ========================================
// GET /api/monitoring/ping
// 監測 API 是否正常
// ========================================

router.get("/monitoring/ping", requireLogin, (req, res) => {
  try {
    res.json({
      success: true,
      service: "API",
      status: "正常",
      message: "Monitoring API 正常運作",
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Monitoring API ping 錯誤：", error);

    res.status(500).json({
      success: false,
      service: "API",
      status: "異常",
      message: "Monitoring API 發生錯誤"
    });
  }
});


// ========================================
// GET /api/monitoring/summary
// 提供前端首頁使用的簡易總結
// ========================================

router.get("/monitoring/summary", requireLogin, (req, res) => {
  try {
    const summary = {
      success: true,

      total: 7,

      normal: 2,

      warning: 0,

      error: 0,

      pending: 5,

      checkedAt: new Date().toISOString()
    };

    res.json(summary);

  } catch (error) {
    console.error("取得監測摘要錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法取得監測摘要"
    });
  }
});


// ========================================
// 匯出 Router
// ========================================

module.exports = router;
