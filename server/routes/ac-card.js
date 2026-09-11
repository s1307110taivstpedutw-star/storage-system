const express = require("express");

const router = express.Router();

const { loadData, saveData } = require("../data");
const { requireLogin, requireAdmin } = require("./auth");

// ==================================================
// GET /api/ac-card
// 取得 8 格冷氣卡資料
// ==================================================

router.get("/ac-card", requireLogin, (req, res) => {
  try {
    const data = loadData();

    const cards = data.armSlots.map(slot => ({
      slotId: slot.slotId,
      roomName: slot.roomName,

      acCardNfcId: slot.acCardNfcId || "",

      acCardBalance: Number(slot.acCardBalance || 0),

      lowBalance:
        Number(slot.acCardBalance || 0) < 300
    }));

    res.json({
      success: true,
      cards
    });

  } catch (error) {
    console.error("取得冷氣卡資料錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法取得冷氣卡資料"
    });
  }
});


// ==================================================
// GET /api/ac-card/:slotId
// 取得指定格位的冷氣卡資料
// ==================================================

router.get(
  "/ac-card/:slotId",
  requireLogin,
  (req, res) => {
    try {
      const slotId = Number(req.params.slotId);

      if (
        !Number.isInteger(slotId) ||
        slotId < 1 ||
        slotId > 8
      ) {
        return res.status(400).json({
          success: false,
          message: "格位編號必須是 1～8"
        });
      }

      const data = loadData();

      const slot = data.armSlots.find(
        item => Number(item.slotId) === slotId
      );

      if (!slot) {
        return res.status(404).json({
          success: false,
          message: "找不到指定格位"
        });
      }

      const balance =
        Number(slot.acCardBalance || 0);

      res.json({
        success: true,

        card: {
          slotId: slot.slotId,

          roomName: slot.roomName,

          acCardNfcId:
            slot.acCardNfcId || "",

          acCardBalance:
            balance,

          lowBalance:
            balance < 300
        }
      });

    } catch (error) {
      console.error("取得指定冷氣卡錯誤：", error);

      res.status(500).json({
        success: false,
        message: "無法取得冷氣卡資料"
      });
    }
  }
);


// ==================================================
// POST /api/ac-card/:slotId
// 管理員修改冷氣卡資料
// ==================================================

router.post(
  "/ac-card/:slotId",
  requireAdmin,
  (req, res) => {
    try {
      const slotId = Number(req.params.slotId);

      if (
        !Number.isInteger(slotId) ||
        slotId < 1 ||
        slotId > 8
      ) {
        return res.status(400).json({
          success: false,
          message: "格位編號必須是 1～8"
        });
      }

      const data = loadData();

      const slot = data.armSlots.find(
        item => Number(item.slotId) === slotId
      );

      if (!slot) {
        return res.status(404).json({
          success: false,
          message: "找不到指定格位"
        });
      }

      const {
        acCardNfcId,
        acCardBalance
      } = req.body;


      // ----------------------------------------------
      // 更新 NFC ID
      // ----------------------------------------------

      if (acCardNfcId !== undefined) {
        slot.acCardNfcId =
          String(acCardNfcId).trim();
      }


      // ----------------------------------------------
      // 更新餘額
      // ----------------------------------------------

      if (acCardBalance !== undefined) {
        const balance =
          Number(acCardBalance);

        if (
          !Number.isFinite(balance) ||
          balance < 0
        ) {
          return res.status(400).json({
            success: false,
            message: "冷氣卡餘額必須是 0 以上的數字"
          });
        }

        slot.acCardBalance = balance;
      }


      // ----------------------------------------------
      // 儲存
      // ----------------------------------------------

      saveData(data);

      const balance =
        Number(slot.acCardBalance || 0);

      res.json({
        success: true,

        message:
          `第 ${slotId} 格冷氣卡資料更新成功`,

        card: {
          slotId: slot.slotId,

          roomName: slot.roomName,

          acCardNfcId:
            slot.acCardNfcId || "",

          acCardBalance:
            balance,

          lowBalance:
            balance < 300
        }
      });

    } catch (error) {
      console.error("更新冷氣卡資料錯誤：", error);

      res.status(500).json({
        success: false,
        message: "更新冷氣卡資料失敗"
      });
    }
  }
);


// ==================================================
// POST /api/ac-card/:slotId/balance
// 更新冷氣卡餘額
//
// 之後可以讓 ESP32 / LINE 流程使用
// ==================================================

router.post(
  "/ac-card/:slotId/balance",
  requireLogin,
  (req, res) => {
    try {
      const slotId = Number(req.params.slotId);

      const balance =
        Number(req.body.balance);

      if (
        !Number.isInteger(slotId) ||
        slotId < 1 ||
        slotId > 8
      ) {
        return res.status(400).json({
          success: false,
          message: "格位編號必須是 1～8"
        });
      }

      if (
        !Number.isFinite(balance) ||
        balance < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "冷氣卡餘額格式錯誤"
        });
      }

      const data = loadData();

      const slot = data.armSlots.find(
        item => Number(item.slotId) === slotId
      );

      if (!slot) {
        return res.status(404).json({
          success: false,
          message: "找不到指定格位"
        });
      }

      slot.acCardBalance = balance;

      saveData(data);

      res.json({
        success: true,

        message:
          `第 ${slotId} 格冷氣卡餘額已更新`,

        slotId,

        balance,

        lowBalance:
          balance < 300
      });

    } catch (error) {
      console.error("更新冷氣卡餘額錯誤：", error);

      res.status(500).json({
        success: false,
        message: "更新冷氣卡餘額失敗"
      });
    }
  }
);


// ==================================================
// POST /api/ac-card/:slotId/nfc
// 更新冷氣卡 NFC ID
// ==================================================

router.post(
  "/ac-card/:slotId/nfc",
  requireAdmin,
  (req, res) => {
    try {
      const slotId = Number(req.params.slotId);

      const nfcId =
        req.body.nfcId !== undefined
          ? String(req.body.nfcId).trim()
          : "";

      if (
        !Number.isInteger(slotId) ||
        slotId < 1 ||
        slotId > 8
      ) {
        return res.status(400).json({
          success: false,
          message: "格位編號必須是 1～8"
        });
      }

      const data = loadData();

      const slot = data.armSlots.find(
        item => Number(item.slotId) === slotId
      );

      if (!slot) {
        return res.status(404).json({
          success: false,
          message: "找不到指定格位"
        });
      }

      slot.acCardNfcId = nfcId;

      saveData(data);

      res.json({
        success: true,

        message:
          `第 ${slotId} 格冷氣卡 NFC ID 已更新`,

        slotId,

        acCardNfcId:
          slot.acCardNfcId
      });

    } catch (error) {
      console.error("更新冷氣卡 NFC 錯誤：", error);

      res.status(500).json({
        success: false,
        message: "更新冷氣卡 NFC ID 失敗"
      });
    }
  }
);


// ==================================================
// GET /api/ac-card/low-balance
// 取得所有低於 300 元的冷氣卡
// ==================================================

router.get(
  "/ac-card/low-balance",
  requireLogin,
  (req, res) => {
    try {
      const data = loadData();

      const lowBalanceCards =
        data.armSlots
          .filter(
            slot =>
              Number(slot.acCardBalance || 0) < 300
          )
          .map(slot => ({
            slotId: slot.slotId,

            roomName: slot.roomName,

            acCardNfcId:
              slot.acCardNfcId || "",

            acCardBalance:
              Number(slot.acCardBalance || 0),

            lowBalance: true
          }));

      res.json({
        success: true,

        count:
          lowBalanceCards.length,

        cards:
          lowBalanceCards
      });

    } catch (error) {
      console.error(
        "取得低餘額冷氣卡錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message: "無法取得低餘額冷氣卡"
      });
    }
  }
);


// ==================================================
// 匯出 Router
// ==================================================

module.exports = router;
