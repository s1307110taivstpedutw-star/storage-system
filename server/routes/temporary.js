const express = require("express");

const router = express.Router();

const { loadData, saveData } = require("../data");
const { requireLogin, requireAdmin } = require("./auth");


// ==================================================
// 工具：依教室編號取得機械手臂格位
// ==================================================

function getSlotByClassroom(data, classroomId) {

  const id = Number(classroomId);

  return data.armSlots.find(
    slot =>
      Number(slot.slotId) === id
  );
}


// ==================================================
// 工具：判斷申請是否已結束
// ==================================================

function isClosedBooking(booking) {

  if (!booking) {
    return false;
  }

  return (
    booking.status === "rejected" ||
    booking.status === "已駁回" ||
    booking.status === "completed" ||
    booking.status === "已完成"
  );
}


// ==================================================
// 工具：取得申請的顯示狀態
// ==================================================

function getStatusText(status) {

  const statusMap = {

    pending: "待審核",

    approved: "已核准／待執行",

    borrowed: "已借出",

    completed: "已完成",

    rejected: "已駁回",

    "申請中": "待審核",

    "已核准／待執行":
      "已核准／待執行",

    "已借出":
      "已借出",

    "已完成":
      "已完成",

    "已駁回":
      "已駁回",

    "已逾期歸還":
      "已逾期歸還"

  };

  return (
    statusMap[status] ||
    status ||
    "未知"
  );
}


// ==================================================
// GET /api/temporary-bookings
// ==================================================

router.get(
  "/temporary-bookings",
  requireLogin,
  (req, res) => {

    try {

      const data =
        loadData();

      let bookings = [
        ...data.temporaryBookings
      ];


      if (
        req.session.user.role !==
        "admin"
      ) {

        bookings =
          bookings.filter(
            booking =>
              booking.applicant ===
                req.session.user.username ||
              booking.username ===
                req.session.user.username
          );

      }


      bookings =
        bookings.map(
          booking => ({
            ...booking,

            statusText:
              booking.statusText ||
              getStatusText(
                booking.status
              )
          })
        );


      bookings.sort(
        (a, b) => {

          const timeA =
            Number(
              a.createdAtTimestamp
            ) ||
            new Date(
              a.createdAt || 0
            ).getTime() ||
            0;

          const timeB =
            Number(
              b.createdAtTimestamp
            ) ||
            new Date(
              b.createdAt || 0
            ).getTime() ||
            0;

          return timeB - timeA;
        }
      );


      res.json({
        success: true,
        bookings
      });

    } catch (error) {

      console.error(
        "取得臨時借用資料錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "無法取得臨時借用資料"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings
// ==================================================

router.post(
  "/temporary-bookings",
  requireLogin,
  (req, res) => {

    try {

      const {
        identity,
        className,
        applicantName,
        studentId,
        classroomId,
        date,
        startTime,
        endTime,
        reason
      } = req.body;


      if (
        identity !== "teacher" &&
        identity !== "student"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "請選擇正確的申請身分"
        });
      }


      if (
        !applicantName ||
        !String(applicantName).trim()
      ) {

        return res.status(400).json({
          success: false,
          message:
            "請輸入姓名"
        });
      }


      if (identity === "student") {

        if (
          !className ||
          !String(className).trim()
        ) {

          return res.status(400).json({
            success: false,
            message:
              "學生申請時必須填寫班級"
          });
        }


        if (
          !studentId ||
          !String(studentId).trim()
        ) {

          return res.status(400).json({
            success: false,
            message:
              "學生申請時必須填寫學號"
          });
        }
      }


      const roomId =
        Number(classroomId);


      if (
        !Number.isInteger(roomId) ||
        roomId < 1 ||
        roomId > 8
      ) {

        return res.status(400).json({
          success: false,
          message:
            "教室必須選擇 1～8"
        });
      }


      const data =
        loadData();


      const classroom =
        data.classrooms[roomId];


      if (!classroom) {

        return res.status(400).json({
          success: false,
          message:
            "找不到指定教室"
        });
      }


      if (
        !date ||
        !String(date).trim()
      ) {

        return res.status(400).json({
          success: false,
          message:
            "請選擇借用日期"
        });
      }


      if (
        !startTime ||
        !endTime
      ) {

        return res.status(400).json({
          success: false,
          message:
            "請選擇開始與結束時間"
        });
      }


      const normalizedStartTime =
        String(startTime).trim();

      const normalizedEndTime =
        String(endTime).trim();


      if (
        normalizedStartTime >=
        normalizedEndTime
      ) {

        return res.status(400).json({
          success: false,
          message:
            "結束時間必須晚於開始時間"
        });
      }


      const conflict =
        data.temporaryBookings.some(
          booking => {

            if (
              Number(
                booking.classroomId
              ) !== roomId
            ) {
              return false;
            }


            if (
              booking.date !==
              String(date).trim()
            ) {
              return false;
            }


            if (
              isClosedBooking(
                booking
              )
            ) {
              return false;
            }


            if (
              booking.status ===
              "已逾期歸還"
            ) {
              return true;
            }


            const existingStart =
              String(
                booking.startTime || ""
              );

            const existingEnd =
              String(
                booking.endTime || ""
              );


            if (
              !existingStart ||
              !existingEnd
            ) {
              return false;
            }


            return (
              normalizedStartTime <
                existingEnd &&
              normalizedEndTime >
                existingStart
            );
          }
        );


      if (conflict) {

        return res.status(409).json({
          success: false,
          message:
            "此教室在指定日期與時間已有臨時借用申請"
        });
      }


      const now =
        new Date();


      const booking = {

        id:
          Date.now(),

        identity,

        className:
          identity === "student"
            ? String(
                className
              ).trim()
            : "",

        studentId:
          identity === "student"
            ? String(
                studentId
              ).trim()
            : "",

        applicantName:
          String(
            applicantName
          ).trim(),

        applicant:
          req.session.user.username,

        applicantRole:
          req.session.user.role,

        username:
          req.session.user.username,

        classroomId:
          roomId,

        classroomName:
          classroom.name,

        classroom:
          classroom.name,

        date:
          String(date).trim(),

        startTime:
          normalizedStartTime,

        endTime:
          normalizedEndTime,

        reason:
          reason !== undefined
            ? String(
                reason
              ).trim()
            : "",

        status:
          "pending",

        statusText:
          "待審核",

        slotId:
          null,

        createdAt:
          now.toISOString(),

        createdAtTimestamp:
          now.getTime(),

        approvedAt:
          null,

        borrowedAt:
          null,

        returnedAt:
          null,

        overdueAt:
          null,

        completedAt:
          null,

        rejectedAt:
          null,

        manualCompleted:
          false
      };


      data.temporaryBookings.push(
        booking
      );


      saveData(data);


      console.log(
        "新增臨時借用：",
        booking
      );


      res.json({
        success: true,
        message:
          "臨時借用申請已送出",
        booking
      });

    } catch (error) {

      console.error(
        "新增臨時借用錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "新增臨時借用失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/approve
// ==================================================

router.post(
  "/temporary-bookings/:id/approve",
  requireAdmin,
  (req, res) => {

    try {

      const bookingId =
        Number(
          req.params.id
        );

      const data =
        loadData();


      const booking =
        data.temporaryBookings.find(
          item =>
            Number(item.id) ===
            bookingId
        );


      if (!booking) {

        return res.status(404).json({
          success: false,
          message:
            "找不到這筆借用申請"
        });
      }


      if (
        booking.status !== "pending" &&
        booking.status !== "申請中"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "這筆申請目前無法核准"
        });
      }


      const classroomId =
        Number(
          booking.classroomId
        );


      if (
        !Number.isInteger(
          classroomId
        ) ||
        classroomId < 1 ||
        classroomId > 8
      ) {

        return res.status(400).json({
          success: false,
          message:
            "此申請的教室編號無法對應機械手臂格位"
        });
      }


      const slot =
        getSlotByClassroom(
          data,
          classroomId
        );


      if (!slot) {

        return res.status(404).json({
          success: false,
          message:
            "找不到對應的機械手臂格位"
        });
      }


      const slotAvailable =
        slot.status === "未借出" ||
        slot.status === "空閒" ||
        Number(
          slot.bookingId
        ) === bookingId;


      if (!slotAvailable) {

        return res.status(409).json({
          success: false,
          message:
            `機械手臂第 ${slot.slotId} 格目前無法使用`
        });
      }


      booking.status =
        "approved";

      booking.statusText =
        "已核准／待執行";

      booking.slotId =
        Number(
          slot.slotId
        );

      booking.approvedAt =
        new Date().toISOString();


      slot.status =
        "已核准／待執行";

      slot.bookingId =
        booking.id;

      slot.borrower =
        booking.applicantName ||
        booking.borrower ||
        "";

      slot.borrowTime =
        booking.date +
        " " +
        booking.startTime +
        "~" +
        booking.endTime;

      slot.roomName =
        booking.classroomName ||
        booking.classroom ||
        `教室 ${classroomId}`;


      saveData(data);


      console.log(
        `申請 ${bookingId} 已核准，` +
        `教室 ${classroomId} → ` +
        `機械手臂第 ${slot.slotId} 格`
      );


      res.json({
        success: true,
        message:
          `申請已核准，教室 ${classroomId} ` +
          `已自動對應機械手臂第 ${slot.slotId} 格，` +
          `等待 ESP32 執行`,
        booking,
        slot
      });

    } catch (error) {

      console.error(
        "核准臨時借用錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "核准失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/reject
// ==================================================

router.post(
  "/temporary-bookings/:id/reject",
  requireAdmin,
  (req, res) => {

    try {

      const bookingId =
        Number(
          req.params.id
        );

      const data =
        loadData();


      const booking =
        data.temporaryBookings.find(
          item =>
            Number(item.id) ===
            bookingId
        );


      if (!booking) {

        return res.status(404).json({
          success: false,
          message:
            "找不到這筆借用申請"
        });
      }


      if (
        booking.status !== "pending" &&
        booking.status !== "申請中"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "這筆申請目前無法駁回"
        });
      }


      booking.status =
        "rejected";

      booking.statusText =
        "已駁回";

      booking.rejectedAt =
        new Date().toISOString();


      saveData(data);


      res.json({
        success: true,
        message:
          "申請已駁回",
        booking
      });

    } catch (error) {

      console.error(
        "駁回臨時借用錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "駁回失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/complete
// ==================================================

router.post(
  "/temporary-bookings/:id/complete",
  requireAdmin,
  (req, res) => {

    try {

      const bookingId =
        Number(
          req.params.id
        );

      const data =
        loadData();


      const booking =
        data.temporaryBookings.find(
          item =>
            Number(item.id) ===
            bookingId
        );


      if (!booking) {

        return res.status(404).json({
          success: false,
          message:
            "找不到這筆借用紀錄"
        });
      }


      if (
        booking.status !== "approved" &&
        booking.status !== "borrowed" &&
        booking.status !== "已核准／待執行" &&
        booking.status !== "已借出" &&
        booking.status !== "已逾期歸還"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "目前狀態無法完成借還"
        });
      }


      booking.status =
        "completed";

      booking.statusText =
        "已完成";

      booking.completedAt =
        new Date().toISOString();

      booking.returnedAt =
        new Date().toISOString();

      booking.manualCompleted =
        true;


      // ★ 完成才釋放格位
      if (
        booking.slotId !== null &&
        booking.slotId !== undefined
      ) {

        const slot =
          data.armSlots.find(
            item =>
              Number(item.slotId) ===
              Number(booking.slotId)
          );


        if (slot) {

          slot.status =
            "未借出";

          slot.borrower =
            "";

          slot.borrowTime =
            "";

          slot.bookingId =
            null;
        }
      }


      saveData(data);


      res.json({
        success: true,
        message:
          "借還流程已完成，機械手臂格位已釋放",
        booking
      });

    } catch (error) {

      console.error(
        "完成借還錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "完成借還失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/borrowed
// ==================================================

router.post(
  "/temporary-bookings/:id/borrowed",
  requireLogin,
  (req, res) => {

    try {

      const bookingId =
        Number(
          req.params.id
        );

      const data =
        loadData();


      const booking =
        data.temporaryBookings.find(
          item =>
            Number(item.id) ===
            bookingId
        );


      if (!booking) {

        return res.status(404).json({
          success: false,
          message:
            "找不到這筆借用紀錄"
        });
      }


      if (
        booking.status !== "approved" &&
        booking.status !== "已核准／待執行"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "這筆借用目前不是等待執行狀態"
        });
      }


      const slot =
        getSlotByClassroom(
          data,
          booking.classroomId
        );


      if (!slot) {

        return res.status(400).json({
          success: false,
          message:
            "找不到對應的機械手臂格位"
        });
      }


      if (
        Number(slot.bookingId) !==
        bookingId
      ) {

        return res.status(409).json({
          success: false,
          message:
            "機械手臂格位與借用申請不一致"
        });
      }


      booking.status =
        "borrowed";

      booking.statusText =
        "已借出";

      booking.borrowedAt =
        new Date().toISOString();


      slot.status =
        "已借出";


      saveData(data);


      console.log(
        `ESP32 回報：申請 ${bookingId} 已實際借出，第 ${slot.slotId} 格`
      );


      res.json({
        success: true,
        message:
          "已記錄實際借出",
        booking,
        slot
      });

    } catch (error) {

      console.error(
        "記錄實際借出錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "記錄借出失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/returned
// ==================================================

router.post(
  "/temporary-bookings/:id/returned",
  requireLogin,
  (req, res) => {

    try {

      const bookingId =
        Number(
          req.params.id
        );

      const data =
        loadData();


      const booking =
        data.temporaryBookings.find(
          item =>
            Number(item.id) ===
            bookingId
        );


      if (!booking) {

        return res.status(404).json({
          success: false,
          message:
            "找不到這筆借用紀錄"
        });
      }


      if (
        booking.status !== "borrowed" &&
        booking.status !== "已借出" &&
        booking.status !== "已逾期歸還"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "這筆借用目前不是借出狀態"
        });
      }


      const slot =
        getSlotByClassroom(
          data,
          booking.classroomId
        );


      booking.status =
        "completed";

      booking.statusText =
        "已完成";

      booking.returnedAt =
        new Date().toISOString();

      booking.completedAt =
        new Date().toISOString();

      booking.manualCompleted =
        false;


      // ★ 實際歸還才釋放
      if (slot) {

        slot.status =
          "未借出";

        slot.borrower =
          "";

        slot.borrowTime =
          "";

        slot.bookingId =
          null;
      }


      saveData(data);


      console.log(
        `ESP32 回報：申請 ${bookingId} 已歸還`
      );


      res.json({
        success: true,
        message:
          "歸還完成",
        booking,
        slot:
          slot || null
      });

    } catch (error) {

      console.error(
        "記錄實際歸還錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "記錄歸還失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/:id/overdue
//
// 管理員測試用
//
// 已借出
//    ↓
// 已逾期歸還
//
// ★ 同步機械手臂格位
// ★ 不釋放格位
// ==================================================

router.post(
  "/temporary-bookings/:id/overdue",
  requireAdmin,
  (req, res) => {

    try {

      const bookingId =
        Number(
          req.params.id
        );

      const data =
        loadData();


      const booking =
        data.temporaryBookings.find(
          item =>
            Number(item.id) ===
            bookingId
        );


      if (!booking) {

        return res.status(404).json({
          success: false,
          message:
            "找不到這筆借用紀錄"
        });
      }


      if (
        booking.status !== "borrowed" &&
        booking.status !== "已借出"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "目前狀態不是已借出"
        });
      }


      booking.status =
        "已逾期歸還";

      booking.statusText =
        "已逾期歸還";

      booking.overdueAt =
        new Date().toISOString();


      // ==================================================
      // ★ 關鍵修正
      // 逾期後同步機械手臂格位
      // ==================================================

      if (
        booking.slotId !== null &&
        booking.slotId !== undefined
      ) {

        const slot =
          data.armSlots.find(
            item =>
              Number(item.slotId) ===
              Number(booking.slotId)
          );


        if (slot) {

          slot.status =
            "已逾期歸還";


          // ★ 故意保留
          // borrower
          // borrowTime
          // bookingId

          console.log(
            `機械手臂第 ${slot.slotId} 格 ` +
            `已同步為「已逾期歸還」`
          );
        }
      }


      saveData(data);


      console.log(
        `申請 ${bookingId} 已標記為逾期歸還`
      );


      res.json({
        success: true,
        message:
          "已標記為逾期歸還，機械手臂格位也已同步",
        booking
      });

    } catch (error) {

      console.error(
        "標記逾期錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "標記逾期失敗"
      });
    }
  }
);


// ==================================================
// GET /api/temporary-bookings/:id
// ==================================================

router.get(
  "/temporary-bookings/:id",
  requireLogin,
  (req, res) => {

    try {

      const bookingId =
        Number(
          req.params.id
        );

      const data =
        loadData();


      const booking =
        data.temporaryBookings.find(
          item =>
            Number(item.id) ===
            bookingId
        );


      if (!booking) {

        return res.status(404).json({
          success: false,
          message:
            "找不到此申請"
        });
      }


      if (
        req.session.user.role !==
          "admin" &&
        booking.applicant !==
          req.session.user.username &&
        booking.username !==
          req.session.user.username
      ) {

        return res.status(403).json({
          success: false,
          message:
            "沒有權限查看此申請"
        });
      }


      res.json({
        success: true,
        booking: {
          ...booking,

          statusText:
            booking.statusText ||
            getStatusText(
              booking.status
            )
        }
      });

    } catch (error) {

      console.error(
        "查詢臨時借用錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "查詢失敗"
      });
    }
  }
);


// ==================================================
// POST /api/temporary-bookings/check-overdue
//
// ★ 即時逾期檢查核心
//
// 1. 找出已借出且超過結束時間
// 2. 改成「已逾期歸還」
// 3. 同步機械手臂格位
// 4. 不釋放格位
// ==================================================

router.post(
  "/temporary-bookings/check-overdue",
  requireAdmin,
  (req, res) => {

    try {

      const data =
        loadData();

      const now =
        new Date();

      let updatedCount =
        0;

      const updatedBookings =
        [];


      data.temporaryBookings.forEach(
        booking => {

          if (
            booking.status !== "已借出" &&
            booking.status !== "borrowed"
          ) {
            return;
          }


          if (
            !booking.date ||
            !booking.endTime
          ) {
            return;
          }


          const endDateTime =
            `${booking.date}T${booking.endTime}:00+08:00`;


          const endTime =
            new Date(
              endDateTime
            );


          if (
            Number.isNaN(
              endTime.getTime()
            )
          ) {
            return;
          }


          if (
            endTime.getTime() <
            now.getTime()
          ) {

            booking.status =
              "已逾期歸還";

            booking.statusText =
              "已逾期歸還";

            booking.overdueAt =
              now.toISOString();


            // ==================================================
            // ★ 關鍵修正
            // 同步機械手臂格位
            // ==================================================

            if (
              booking.slotId !== null &&
              booking.slotId !== undefined
            ) {

              const slot =
                data.armSlots.find(
                  item =>
                    Number(item.slotId) ===
                    Number(booking.slotId)
                );


              if (slot) {

                slot.status =
                  "已逾期歸還";


                console.log(
                  `自動逾期：機械手臂第 ` +
                  `${slot.slotId} 格同步為「已逾期歸還」`
                );
              }
            }


            updatedCount++;

            updatedBookings.push(
              booking
            );
          }
        }
      );


      if (
        updatedCount > 0
      ) {

        saveData(data);
      }


      console.log(
        `逾期檢查完成：` +
        `發現 ${updatedCount} 筆逾期借用`
      );


      res.json({
        success: true,

        checkedAt:
          now.toISOString(),

        updatedCount,

        bookings:
          updatedBookings
      });

    } catch (error) {

      console.error(
        "檢查逾期借用錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "檢查逾期借用失敗"
      });
    }
  }
);


module.exports = router;
