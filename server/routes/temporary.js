const express = require("express");

const router = express.Router();

const { loadData, saveData } = require("../data");
const { requireLogin, requireAdmin } = require("./auth");

// ==================================================
// 工具：依教室編號取得機械手臂格位
// 教室 1 → 第 1 格
// 教室 2 → 第 2 格
// ...
// 教室 8 → 第 8 格
// ==================================================

function getSlotByClassroom(data, classroomId) {
  const id = Number(classroomId);

  return data.armSlots.find(
    slot => Number(slot.slotId) === id
  );
}


// ==================================================
// GET /api/temporary-bookings
// 取得所有臨時借用申請
// ==================================================

router.get(
  "/temporary-bookings",
  requireLogin,
  (req, res) => {
    try {
      const data = loadData();

      res.json({
        success: true,
        bookings: data.temporaryBookings
      });

    } catch (error) {
      console.error("取得臨時借用資料錯誤：", error);

      res.status(500).json({
        success: false,
        message: "無法取得臨時借用資料"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings
// 新增臨時教室借用申請
// ==================================================

router.post(
  "/temporary-bookings",
  requireLogin,
  (req, res) => {
    try {
      const {
        classroom,
        startTime,
        endTime,
        borrower,
        reason
      } = req.body;

      // ----------------------------------------------
      // 基本檢查
      // ----------------------------------------------

      if (!classroom || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: "請完整填寫教室、開始時間與結束時間"
        });
      }

      const data = loadData();

      // ----------------------------------------------
      // 找教室
      // ----------------------------------------------

      const classroomId = Object.keys(data.classrooms).find(
        id =>
          id === String(classroom) ||
          data.classrooms[id].name === String(classroom).trim()
      );

      if (!classroomId) {
        return res.status(400).json({
          success: false,
          message: "找不到指定教室"
        });
      }

      const classroomData =
        data.classrooms[Number(classroomId)];

      // ----------------------------------------------
      // 固定對應機械手臂格位
      // ----------------------------------------------

      const slot = getSlotByClassroom(
        data,
        classroomId
      );

      if (!slot) {
        return res.status(400).json({
          success: false,
          message: "找不到對應的機械手臂格位"
        });
      }

      // ----------------------------------------------
      // 建立申請
      // ----------------------------------------------

      const booking = {
        id: Date.now(),

        classroom: classroomData.name,

        classroomId: Number(classroomId),

        slotId: Number(slot.slotId),

        startTime: String(startTime).trim(),

        endTime: String(endTime).trim(),

        borrower:
          borrower !== undefined
            ? String(borrower).trim()
            : req.session.user.name,

        username: req.session.user.username,

        reason:
          reason !== undefined
            ? String(reason).trim()
            : "",

        status: "申請中",

        createdAt: new Date().toISOString(),

        approvedAt: "",

        borrowedAt: "",

        returnedAt: "",

        overdueAt: "",

        manualCompleted: false
      };

      data.temporaryBookings.push(booking);

      saveData(data);

      res.json({
        success: true,
        message: "臨時借用申請已送出",
        booking
      });

    } catch (error) {
      console.error("新增臨時借用錯誤：", error);

      res.status(500).json({
        success: false,
        message: "新增臨時借用失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/approve
// 管理員核准臨時借用
//
// 注意：
// 核准 ≠ 已借出
// 核准後只會變成「已核准／待執行」
// ==================================================

router.post(
  "/temporary-bookings/:id/approve",
  requireAdmin,
  (req, res) => {
    try {
      const bookingId = Number(req.params.id);

      const data = loadData();

      const booking =
        data.temporaryBookings.find(
          item => Number(item.id) === bookingId
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到這筆借用申請"
        });
      }

      if (booking.status !== "申請中") {
        return res.status(400).json({
          success: false,
          message: "這筆申請目前無法核准"
        });
      }

      // ----------------------------------------------
      // 找對應格位
      // ----------------------------------------------

      const slot = getSlotByClassroom(
        data,
        booking.classroomId
      );

      if (!slot) {
        return res.status(400).json({
          success: false,
          message: "找不到對應的機械手臂格位"
        });
      }

      // ----------------------------------------------
      // 確認格位目前沒有其他借用
      // ----------------------------------------------

      if (
        slot.status !== "未借出" &&
        slot.bookingId !== booking.id
      ) {
        return res.status(400).json({
          success: false,
          message: `第 ${slot.slotId} 格目前無法使用`
        });
      }

      // ----------------------------------------------
      // 更新申請狀態
      // ----------------------------------------------

      booking.status = "已核准／待執行";

      booking.approvedAt =
        new Date().toISOString();

      // ----------------------------------------------
      // 更新機械手臂格位
      // ----------------------------------------------

      slot.status = "已核准／待執行";

      slot.borrower = booking.borrower;

      slot.borrowTime = booking.startTime;

      slot.bookingId = booking.id;

      saveData(data);

      res.json({
        success: true,
        message: "借用申請已核准，等待機械手臂執行",
        booking,
        slot
      });

    } catch (error) {
      console.error("核准臨時借用錯誤：", error);

      res.status(500).json({
        success: false,
        message: "核准失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/complete
// 管理員人工完成歸還
//
// 這是「人工備援」
// 正常情況應由 ESP32 回報實際歸還
// ==================================================

router.post(
  "/temporary-bookings/:id/complete",
  requireAdmin,
  (req, res) => {
    try {
      const bookingId = Number(req.params.id);

      const data = loadData();

      const booking =
        data.temporaryBookings.find(
          item => Number(item.id) === bookingId
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到這筆借用紀錄"
        });
      }

      // ----------------------------------------------
      // 找對應格位
      // ----------------------------------------------

      const slot = getSlotByClassroom(
        data,
        booking.classroomId
      );

      // ----------------------------------------------
      // 完成歸還
      // ----------------------------------------------

      booking.status = "已完成";

      booking.returnedAt =
        new Date().toISOString();

      booking.manualCompleted = true;

      if (slot) {
        slot.status = "未借出";

        slot.borrower = "";

        slot.borrowTime = "";

        slot.bookingId = null;
      }

      saveData(data);

      res.json({
        success: true,
        message: "已完成歸還",
        booking,
        slot: slot || null
      });

    } catch (error) {
      console.error("完成歸還錯誤：", error);

      res.status(500).json({
        success: false,
        message: "完成歸還失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/borrowed
// ESP32 / 機械手臂回報「實際已借出」
//
// 目前先建立 API
// 未來 ESP32 可以直接呼叫
// ==================================================

router.post(
  "/temporary-bookings/:id/borrowed",
  requireLogin,
  (req, res) => {
    try {
      const bookingId = Number(req.params.id);

      const data = loadData();

      const booking =
        data.temporaryBookings.find(
          item => Number(item.id) === bookingId
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到這筆借用紀錄"
        });
      }

      if (
        booking.status !== "已核准／待執行"
      ) {
        return res.status(400).json({
          success: false,
          message: "這筆借用目前不是等待執行狀態"
        });
      }

      const slot = getSlotByClassroom(
        data,
        booking.classroomId
      );

      if (!slot) {
        return res.status(400).json({
          success: false,
          message: "找不到對應的機械手臂格位"
        });
      }

      // ----------------------------------------------
      // 實際借出
      // ----------------------------------------------

      booking.status = "已借出";

      booking.borrowedAt =
        new Date().toISOString();

      slot.status = "已借出";

      saveData(data);

      res.json({
        success: true,
        message: "已記錄實際借出",
        booking,
        slot
      });

    } catch (error) {
      console.error("記錄實際借出錯誤：", error);

      res.status(500).json({
        success: false,
        message: "記錄借出失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/returned
// ESP32 / 機械手臂回報「實際已歸還」
//
// 正常歸還流程使用這個 API
// ==================================================

router.post(
  "/temporary-bookings/:id/returned",
  requireLogin,
  (req, res) => {
    try {
      const bookingId = Number(req.params.id);

      const data = loadData();

      const booking =
        data.temporaryBookings.find(
          item => Number(item.id) === bookingId
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到這筆借用紀錄"
        });
      }

      const slot = getSlotByClassroom(
        data,
        booking.classroomId
      );

      // ----------------------------------------------
      // 實際歸還
      // ----------------------------------------------

      booking.status = "已完成";

      booking.returnedAt =
        new Date().toISOString();

      booking.manualCompleted = false;

      if (slot) {
        slot.status = "未借出";

        slot.borrower = "";

        slot.borrowTime = "";

        slot.bookingId = null;
      }

      saveData(data);

      res.json({
        success: true,
        message: "歸還完成",
        booking,
        slot: slot || null
      });

    } catch (error) {
      console.error("記錄實際歸還錯誤：", error);

      res.status(500).json({
        success: false,
        message: "記錄歸還失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/overdue
// 將借用標記為「已逾期歸還」
//
// 注意：
// 目前先提供 API。
// 後續再由 GitHub Actions 定期觸發。
// 不使用 setInterval，避免 Render 休眠造成問題。
// ==================================================

router.post(
  "/temporary-bookings/:id/overdue",
  requireLogin,
  (req, res) => {
    try {
      const bookingId = Number(req.params.id);

      const data = loadData();

      const booking =
        data.temporaryBookings.find(
          item => Number(item.id) === bookingId
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到這筆借用紀錄"
        });
      }

      if (booking.status !== "已借出") {
        return res.status(400).json({
          success: false,
          message: "目前狀態不是已借出"
        });
      }

      booking.status = "已逾期歸還";

      booking.overdueAt =
        new Date().toISOString();

      saveData(data);

      res.json({
        success: true,
        message: "已標記為逾期歸還",
        booking
      });

    } catch (error) {
      console.error("標記逾期錯誤：", error);

      res.status(500).json({
        success: false,
        message: "標記逾期失敗"
      });
    }
  }
);


// ==================================================
// 匯出 Router
// ==================================================

module.exports = router;
