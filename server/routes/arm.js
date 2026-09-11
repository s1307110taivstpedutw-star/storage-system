const express = require("express");

const router = express.Router();

const { loadData, saveData } = require("../data");
const { requireLogin, requireAdmin } = require("./auth");

// ==================================================
// GET /api/arm/slots
// 取得 8 個機械手臂格位
// ==================================================

router.get("/arm/slots", requireLogin, (req, res) => {
  try {
    const data = loadData();

    res.json({
      success: true,
      slots: data.armSlots
    });

  } catch (error) {
    console.error("取得機械手臂格位錯誤：", error);

    res.status(500).json({
      success: false,
      message: "無法取得機械手臂格位資料"
    });
  }
});


// ==================================================
// POST /api/arm/slot/:id
// 修改指定機械手臂格位
// ==================================================

router.post("/arm/slot/:id", requireAdmin, (req, res) => {
  try {
    const slotId = Number(req.params.id);

    if (!Number.isInteger(slotId) || slotId < 1 || slotId > 8) {
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
      roomName,
      keyName,
      keyNfcId,
      acCardNfcId,
      acCardBalance,
      borrower,
      borrowTime,
      status,
      bookingId
    } = req.body;


    // ----------------------------------------------
    // 只更新有傳進來的欄位
    // ----------------------------------------------

    if (roomName !== undefined) {
      slot.roomName = String(roomName).trim();
    }

    if (keyName !== undefined) {
      slot.keyName = String(keyName).trim();
    }

    if (keyNfcId !== undefined) {
      slot.keyNfcId = String(keyNfcId).trim();
    }

    if (acCardNfcId !== undefined) {
      slot.acCardNfcId = String(acCardNfcId).trim();
    }

    if (acCardBalance !== undefined) {
      const balance = Number(acCardBalance);

      if (!Number.isFinite(balance) || balance < 0) {
        return res.status(400).json({
          success: false,
          message: "冷氣卡餘額格式錯誤"
        });
      }

      slot.acCardBalance = balance;
    }

    if (borrower !== undefined) {
      slot.borrower = String(borrower).trim();
    }

    if (borrowTime !== undefined) {
      slot.borrowTime = String(borrowTime).trim();
    }

    if (status !== undefined) {
      const validStatuses = [
        "未借出",
        "已核准／待執行",
        "已借出"
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "無效的格位狀態"
        });
      }

      slot.status = status;
    }

    if (bookingId !== undefined) {
      slot.bookingId =
        bookingId === null || bookingId === ""
          ? null
          : Number(bookingId);
    }


    // ----------------------------------------------
    // 儲存
    // ----------------------------------------------

    saveData(data);

    res.json({
      success: true,
      message: `第 ${slotId} 格更新成功`,
      slot
    });

  } catch (error) {
    console.error("更新機械手臂格位錯誤：", error);

    res.status(500).json({
      success: false,
      message: "更新機械手臂格位失敗"
    });
  }
});


// ==================================================
// POST /api/arm/reset-all
// 全部機械手臂格位重置
// ==================================================

router.post("/arm/reset-all", requireAdmin, (req, res) => {
  try {
    const data = loadData();

    data.armSlots.forEach((slot, index) => {
      slot.slotId = index + 1;

      slot.roomName =
        data.classrooms[index + 1]?.name ||
        `教室 ${index + 1}`;

      slot.keyName = "";

      // 保留 NFC 欄位，但重置內容
      slot.keyNfcId = "";
      slot.acCardNfcId = "";
      slot.acCardBalance = 0;

      slot.borrower = "";
      slot.borrowTime = "";

      slot.status = "未借出";

      slot.bookingId = null;
    });

    saveData(data);

    res.json({
      success: true,
      message: "全部機械手臂格位已重置",
      slots: data.armSlots
    });

  } catch (error) {
    console.error("重置機械手臂格位錯誤：", error);

    res.status(500).json({
      success: false,
      message: "重置機械手臂格位失敗"
    });
  }
});


// ==================================================
// 匯出 Router
// ==================================================

module.exports = router;
