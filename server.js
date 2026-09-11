const express = require("express");
const session = require("express-session");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data.json");

// =========================
// 基本設定
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// 靜態網站
app.use(express.static(path.join(__dirname, "public")));

// 上傳檔案
const upload = multer({
  storage: multer.memoryStorage()
});

// =========================
// 預設資料
// =========================

const defaultArmSlots = Array.from({ length: 8 }, (_, i) => ({
  slotId: i + 1,
  roomName: `教室 ${i + 1}`,
  keyName: "",
  borrower: "",
  borrowTime: "",
  status: "空閒",
  bookingId: null
}));

const defaultClassrooms = {};

for (let i = 1; i <= 8; i++) {
  defaultClassrooms[i] = {
    id: i,
    name: `教室 ${i}`,
    schedules: []
  };
}

const defaultData = {
  armSlots: defaultArmSlots,
  classrooms: defaultClassrooms,
  temporaryBookings: []
};

// =========================
// 資料整理
// =========================

function normalizeData() {
  if (!Array.isArray(systemData.armSlots)) {
    systemData.armSlots = [];
  }

  if (!systemData.classrooms || typeof systemData.classrooms !== "object") {
    systemData.classrooms = {};
  }

  if (!Array.isArray(systemData.temporaryBookings)) {
    systemData.temporaryBookings = [];
  }

  // 確保一定有 8 個機械手臂格位
  for (let i = 1; i <= 8; i++) {
    const existing = systemData.armSlots.find(
      slot => Number(slot.slotId) === i
    );

    if (!existing) {
      systemData.armSlots.push({
        slotId: i,
        roomName: `教室 ${i}`,
        keyName: "",
        borrower: "",
        borrowTime: "",
        status: "空閒",
        bookingId: null
      });
    }
  }

  systemData.armSlots.sort(
    (a, b) => Number(a.slotId) - Number(b.slotId)
  );

  // 確保一定有 8 間教室
  for (let i = 1; i <= 8; i++) {
    if (!systemData.classrooms[i]) {
      systemData.classrooms[i] = {
        id: i,
        name: `教室 ${i}`,
        schedules: []
      };
    }

    if (!Array.isArray(systemData.classrooms[i].schedules)) {
      systemData.classrooms[i].schedules = [];
    }
  }

  // 確保機械手臂格位名稱與教室名稱同步
  for (let i = 1; i <= 8; i++) {
    const classroom = systemData.classrooms[i];
    const slot = systemData.armSlots.find(
      item => Number(item.slotId) === i
    );

    if (classroom && slot) {
      slot.roomName = classroom.name;
    }
  }
}

// =========================
// 載入 / 儲存資料
// =========================

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");

      if (raw.trim()) {
        systemData = JSON.parse(raw);
      } else {
        systemData = JSON.parse(JSON.stringify(defaultData));
      }
    } else {
      systemData = JSON.parse(JSON.stringify(defaultData));
      saveData();
    }
  } catch (error) {
    console.error("讀取 data.json 失敗：", error);

    systemData = JSON.parse(JSON.stringify(defaultData));
  }

  normalizeData();
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(systemData, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("儲存 data.json 失敗：", error);
  }
}

let systemData = JSON.parse(JSON.stringify(defaultData));

loadData();

// =========================
// 帳號資料
// =========================

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

// =========================
// Render Keep Alive
// =========================

app.get("/ping", (req, res) => {
  res.send("pong");
});

// =========================
// 登入
// =========================

app.post("/api/login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({
        success: false,
        message: "請輸入帳號與密碼"
      });
    }

    const account = accounts[username];

    if (!account || account.password !== password) {
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

// =========================
// 取得目前登入者
// =========================

app.get("/api/me", (req, res) => {
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

// =========================
// 登出
// =========================

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("登出錯誤：", err);

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

// =========================
// 權限 Middleware
// =========================

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "請先登入"
    });
  }

  next();
}

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

// ======================================================
// 教室課表
// ======================================================

// 取得所有教室
app.get("/api/classrooms", requireLogin, (req, res) => {
  res.json({
    success: true,
    classrooms: systemData.classrooms
  });
});

// 取得單一教室
app.get("/api/classrooms/:id", requireLogin, (req, res) => {
  const id = Number(req.params.id);

  const classroom = systemData.classrooms[id];

  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: "找不到教室"
    });
  }

  res.json({
    success: true,
    classroom
  });
});

// 修改教室名稱
app.post(
  "/api/classrooms/:id",
  requireAdmin,
  (req, res) => {
    const id = Number(req.params.id);
    const { name } = req.body;

    if (!systemData.classrooms[id]) {
      return res.status(404).json({
        success: false,
        message: "找不到教室"
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "教室名稱不能為空"
      });
    }

    systemData.classrooms[id].name = name.trim();

    // 同步機械手臂格位
    const slot = systemData.armSlots.find(
      item => Number(item.slotId) === id
    );

    if (slot) {
      slot.roomName = name.trim();
    }

    saveData();

    res.json({
      success: true,
      message: "教室名稱已更新",
      classroom: systemData.classrooms[id]
    });
  }
);

// 新增課表
app.post(
  "/api/classrooms/:id/schedules",
  requireAdmin,
  (req, res) => {
    const id = Number(req.params.id);

    const {
      className,
      weekday,
      startTime,
      endTime
    } = req.body;

    const classroom = systemData.classrooms[id];

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: "找不到教室"
      });
    }

    if (!className || !weekday || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "請完整填寫課表資料"
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "結束時間必須晚於開始時間"
      });
    }

    const schedule = {
      id: Date.now(),
      className: className.trim(),
      weekday,
      startTime,
      endTime
    };

    classroom.schedules.push(schedule);

    saveData();

    res.json({
      success: true,
      message: "課表新增成功",
      schedule
    });
  }
);

// 刪除課表
app.delete(
  "/api/classrooms/:classroomId/schedules/:scheduleId",
  requireAdmin,
  (req, res) => {
    const classroomId = Number(req.params.classroomId);
    const scheduleId = Number(req.params.scheduleId);

    const classroom = systemData.classrooms[classroomId];

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: "找不到教室"
      });
    }

    const before = classroom.schedules.length;

    classroom.schedules = classroom.schedules.filter(
      schedule => Number(schedule.id) !== scheduleId
    );

    if (classroom.schedules.length === before) {
      return res.status(404).json({
        success: false,
        message: "找不到指定課表"
      });
    }

    saveData();

    res.json({
      success: true,
      message: "課表刪除成功"
    });
  }
);

// ======================================================
// CSV 匯入
// ======================================================

app.post(
  "/api/classrooms/import-csv",
  requireAdmin,
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "請選擇 CSV 檔案"
        });
      }

      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer"
      });

      const sheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet);

      let imported = 0;

      rows.forEach(row => {
        const className =
          row["班級"] ||
          row["className"] ||
          "";

        const classroomName =
          row["教室"] ||
          row["classroom"] ||
          "";

        const weekday =
          row["星期"] ||
          row["weekday"] ||
          "";

        const startTime =
          row["開始時間"] ||
          row["startTime"] ||
          "";

        const endTime =
          row["結束時間"] ||
          row["endTime"] ||
          "";

        if (
          !className ||
          !classroomName ||
          !weekday ||
          !startTime ||
          !endTime
        ) {
          return;
        }

        const classroomId = Object.keys(
          systemData.classrooms
        ).find(id => {
          return (
            String(systemData.classrooms[id].name).trim() ===
            String(classroomName).trim()
          );
        });

        if (!classroomId) {
          return;
        }

        systemData.classrooms[classroomId].schedules.push({
          id: Date.now() + imported,
          className: String(className).trim(),
          weekday: String(weekday).trim(),
          startTime: String(startTime).trim(),
          endTime: String(endTime).trim()
        });

        imported++;
      });

      saveData();

      res.json({
        success: true,
        message: `CSV 匯入完成，共匯入 ${imported} 筆資料`,
        imported
      });

    } catch (error) {
      console.error("CSV 匯入錯誤：", error);

      res.status(500).json({
        success: false,
        message: "CSV 匯入失敗"
      });
    }
  }
);

// ======================================================
// CSV 匯出
// ======================================================

app.get(
  "/api/classrooms/export-csv",
  requireLogin,
  (req, res) => {
    try {
      const rows = [];

      Object.values(systemData.classrooms).forEach(classroom => {
        classroom.schedules.forEach(schedule => {
          rows.push({
            "班級": schedule.className,
            "教室": classroom.name,
            "星期": schedule.weekday,
            "開始時間": schedule.startTime,
            "結束時間": schedule.endTime
          });
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "教室課表"
      );

      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "csv"
      });

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="classroom_schedule.csv"'
      );

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      res.send(buffer);

    } catch (error) {
      console.error("CSV 匯出錯誤：", error);

      res.status(500).json({
        success: false,
        message: "CSV 匯出失敗"
      });
    }
  }
);

// ======================================================
// 機械手臂 8 格
// ======================================================

// 取得 8 個格位
app.get(
  "/api/arm/slots",
  requireLogin,
  (req, res) => {
    normalizeData();

    res.json({
      success: true,
      slots: systemData.armSlots
    });
  }
);

// 修改單一格位
app.post(
  "/api/arm/slot/:id",
  requireAdmin,
  (req, res) => {
    const id = Number(req.params.id);

    const slot = systemData.armSlots.find(
      item => Number(item.slotId) === id
    );

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "找不到機械手臂格位"
      });
    }

    const {
      roomName,
      keyName,
      borrower,
      borrowTime,
      status,
      bookingId
    } = req.body;

    if (roomName !== undefined) {
      slot.roomName = roomName;
    }

    if (keyName !== undefined) {
      slot.keyName = keyName;
    }

    if (borrower !== undefined) {
      slot.borrower = borrower;
    }

    if (borrowTime !== undefined) {
      slot.borrowTime = borrowTime;
    }

    if (status !== undefined) {
      slot.status = status;
    }

    if (bookingId !== undefined) {
      slot.bookingId = bookingId;
    }

    saveData();

    res.json({
      success: true,
      message: "格位更新成功",
      slot
    });
  }
);

// 重設所有格位
app.post(
  "/api/arm/reset-all",
  requireAdmin,
  (req, res) => {
    systemData.armSlots = defaultArmSlots.map(slot => ({
      ...slot
    }));

    // 同步目前教室名稱
    for (let i = 1; i <= 8; i++) {
      const classroom = systemData.classrooms[i];

      const slot = systemData.armSlots.find(
        item => Number(item.slotId) === i
      );

      if (classroom && slot) {
        slot.roomName = classroom.name;
      }
    }

    saveData();

    res.json({
      success: true,
      message: "所有機械手臂格位已重設"
    });
  }
);

// ======================================================
// 臨時教室借還核准
// ======================================================

// 取得臨時借用資料
app.get(
  "/api/temporary-bookings",
  requireLogin,
  (req, res) => {
    let bookings = [...systemData.temporaryBookings];

    // 非管理員只能看到自己的申請
    if (req.session.user.role !== "admin") {
      bookings = bookings.filter(
        item =>
          item.applicant === req.session.user.username
      );
    }

    bookings.sort((a, b) => {
      return Number(b.createdAtTimestamp || 0) -
        Number(a.createdAtTimestamp || 0);
    });

    res.json({
      success: true,
      bookings
    });
  }
);

// ======================================================
// 新增臨時借用
// ======================================================

app.post(
  "/api/temporary-bookings",
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

      // -------------------------
      // 身分檢查
      // -------------------------

      if (
        identity !== "teacher" &&
        identity !== "student"
      ) {
        return res.status(400).json({
          success: false,
          message: "請選擇正確的申請身分"
        });
      }

      // -------------------------
      // 姓名必填
      // -------------------------

      if (
        !applicantName ||
        !String(applicantName).trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "請輸入姓名"
        });
      }

      // -------------------------
      // 學生必須填班級與學號
      // -------------------------

      if (identity === "student") {
        if (
          !className ||
          !String(className).trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "學生申請時必須填寫班級"
          });
        }

        if (
          !studentId ||
          !String(studentId).trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "學生申請時必須填寫學號"
          });
        }
      }

      // -------------------------
      // 教室檢查
      // -------------------------

      const roomId = Number(classroomId);

      if (!Number.isInteger(roomId) || roomId < 1 || roomId > 8) {
        return res.status(400).json({
          success: false,
          message: "教室必須選擇 1～8"
        });
      }

      const classroom =
        systemData.classrooms[roomId];

      if (!classroom) {
        return res.status(400).json({
          success: false,
          message: "找不到指定教室"
        });
      }

      // -------------------------
      // 日期時間檢查
      // -------------------------

      if (!date) {
        return res.status(400).json({
          success: false,
          message: "請選擇借用日期"
        });
      }

      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: "請選擇開始與結束時間"
        });
      }

      if (startTime >= endTime) {
        return res.status(400).json({
          success: false,
          message: "結束時間必須晚於開始時間"
        });
      }

      // -------------------------
      // 檢查臨時借用時間衝突
      // -------------------------

      const conflict =
        systemData.temporaryBookings.some(item => {

          if (
            Number(item.classroomId) !== roomId
          ) {
            return false;
          }

          if (item.date !== date) {
            return false;
          }

          // 已駁回、已完成的不算衝突
          if (
            item.status === "rejected" ||
            item.status === "completed"
          ) {
            return false;
          }

          // 時間重疊判斷
          const existingStart = item.startTime;
          const existingEnd = item.endTime;

          return (
            startTime < existingEnd &&
            endTime > existingStart
          );
        });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message:
            "此教室在指定日期與時間已有臨時借用申請"
        });
      }

      // -------------------------
      // 建立申請
      // -------------------------

      const now = new Date();

      const booking = {
        id: Date.now(),

        identity,

        // 老師不需要班級
        className:
          identity === "student"
            ? String(className).trim()
            : "",

        applicantName:
          String(applicantName).trim(),

        // 老師不需要學號
        studentId:
          identity === "student"
            ? String(studentId).trim()
            : "",

        classroomId: roomId,

        classroomName:
          classroom.name,

        date,

        startTime,

        endTime,

        reason:
          reason
            ? String(reason).trim()
            : "",

        // 系統登入帳號
        applicant:
          req.session.user.username,

        applicantRole:
          req.session.user.role,

        status: "pending",

        statusText: "待審核",

        slotId: null,

        createdAt:
          now.toISOString(),

        createdAtTimestamp:
          now.getTime(),

        approvedAt: null,

        rejectedAt: null,

        completedAt: null
      };

      systemData.temporaryBookings.push(
        booking
      );

      saveData();

      console.log(
        "新增臨時借用：",
        booking
      );

      res.json({
        success: true,
        message: "臨時借用申請已送出",
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
          "伺服器發生錯誤，申請未成功"
      });
    }
  }
);

// ======================================================
// 審核臨時借用
// ======================================================

app.post(
  "/api/temporary-bookings/:id/approve",
  requireAdmin,
  (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        slotId
      } = req.body;

      const booking =
        systemData.temporaryBookings.find(
          item => Number(item.id) === id
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到此申請"
        });
      }

      if (booking.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "此申請目前無法審核"
        });
      }

      const selectedSlot =
        Number(slotId);

      if (
        !Number.isInteger(selectedSlot) ||
        selectedSlot < 1 ||
        selectedSlot > 8
      ) {
        return res.status(400).json({
          success: false,
          message: "請選擇 1～8 的機械手臂格位"
        });
      }

      const slot =
        systemData.armSlots.find(
          item =>
            Number(item.slotId) ===
            selectedSlot
        );

      if (!slot) {
        return res.status(404).json({
          success: false,
          message: "找不到指定格位"
        });
      }

      // -------------------------
      // 格位是否已被使用
      // -------------------------

      if (
        slot.status !== "空閒" &&
        slot.bookingId !== id
      ) {
        return res.status(409).json({
          success: false,
          message:
            `機械手臂第 ${selectedSlot} 格目前不是空閒狀態`
        });
      }

      // -------------------------
      // 寫入申請
      // -------------------------

      booking.status = "approved";

      booking.statusText = "已核准";

      booking.slotId =
        selectedSlot;

      booking.approvedAt =
        new Date().toISOString();

      // -------------------------
      // 寫入機械手臂格位
      // -------------------------

      slot.status = "借用中";

      slot.bookingId =
        booking.id;

      slot.borrower =
        booking.applicantName;

      slot.borrowTime =
        `${booking.date} ${booking.startTime}~${booking.endTime}`;

      slot.roomName =
        booking.classroomName;

      saveData();

      console.log(
        `申請 ${id} 已核准，使用機械手臂第 ${selectedSlot} 格`
      );

      res.json({
        success: true,
        message:
          `申請已核准，使用機械手臂第 ${selectedSlot} 格`,
        booking,
        slot
      });

    } catch (error) {
      console.error(
        "核准申請錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message: "核准失敗"
      });
    }
  }
);

// ======================================================
// 駁回申請
// ======================================================

app.post(
  "/api/temporary-bookings/:id/reject",
  requireAdmin,
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const booking =
        systemData.temporaryBookings.find(
          item =>
            Number(item.id) === id
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到此申請"
        });
      }

      if (booking.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "此申請目前無法駁回"
        });
      }

      booking.status =
        "rejected";

      booking.statusText =
        "已駁回";

      booking.rejectedAt =
        new Date().toISOString();

      saveData();

      res.json({
        success: true,
        message: "申請已駁回",
        booking
      });

    } catch (error) {
      console.error(
        "駁回申請錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message: "駁回失敗"
      });
    }
  }
);

// ======================================================
// 完成借用
// ======================================================

app.post(
  "/api/temporary-bookings/:id/complete",
  requireAdmin,
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const booking =
        systemData.temporaryBookings.find(
          item =>
            Number(item.id) === id
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "找不到此申請"
        });
      }

      if (booking.status !== "approved") {
        return res.status(400).json({
          success: false,
          message:
            "只有已核准的申請可以完成"
        });
      }

      booking.status =
        "completed";

      booking.statusText =
        "已完成";

      booking.completedAt =
        new Date().toISOString();

      // -------------------------
      // 釋放機械手臂格位
      // -------------------------

      if (booking.slotId) {
        const slot =
          systemData.armSlots.find(
            item =>
              Number(item.slotId) ===
              Number(booking.slotId)
          );

        if (slot) {
          slot.status = "空閒";
          slot.borrower = "";
          slot.borrowTime = "";
          slot.bookingId = null;
        }
      }

      saveData();

      res.json({
        success: true,
        message:
          "借用已完成，機械手臂格位已釋放",
        booking
      });

    } catch (error) {
      console.error(
        "完成借用錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message: "完成借用失敗"
      });
    }
  }
);

// ======================================================
// 查詢單一臨時借用
// ======================================================

app.get(
  "/api/temporary-bookings/:id",
  requireLogin,
  (req, res) => {
    const id =
      Number(req.params.id);

    const booking =
      systemData.temporaryBookings.find(
        item =>
          Number(item.id) === id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "找不到此申請"
      });
    }

    // 老師不能查看別人的申請
    if (
      req.session.user.role !== "admin" &&
      booking.applicant !==
        req.session.user.username
    ) {
      return res.status(403).json({
        success: false,
        message: "沒有權限查看此申請"
      });
    }

    res.json({
      success: true,
      booking
    });
  }
);

// ======================================================
// 首頁
// ======================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ======================================================
// 啟動伺服器
// ======================================================

app.listen(PORT, () => {
  console.log(
    `Storage System server running on port ${PORT}`
  );

  console.log(
    `http://localhost:${PORT}`
  );
});
