const express = require("express");
const session = require("express-session");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data.json");

// ================================
// 基本設定
// ================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "arm_key_secret_123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage()
});

// ================================
// 預設資料
// ================================

function getDefaultArmSlots() {
  const slots = {};

  for (let i = 1; i <= 8; i++) {
    slots[i] = {
      slotId: i,
      roomName: `第 ${i} 教室`,
      keyName: `教室 ${i} 鑰匙`,
      borrower: "",
      borrowTime: "",
      status: "空閒",
      bookingId: null
    };
  }

  return slots;
}

function getDefaultClassrooms() {
  const classrooms = {};

  for (let i = 1; i <= 8; i++) {
    classrooms[i] = {
      id: i,
      name: `教室 ${i}`,
      schedules: []
    };
  }

  return classrooms;
}

function getDefaultData() {
  return {
    armSlots: getDefaultArmSlots(),
    classrooms: getDefaultClassrooms(),
    temporaryBookings: []
  };
}

// ================================
// 資料格式整理
// ================================

function normalizeData(data) {
  const defaultData = getDefaultData();

  if (!data || typeof data !== "object") {
    return defaultData;
  }

  // 舊版資料可能只有 armSlots
  if (!data.armSlots) {
    data.armSlots = defaultData.armSlots;
  }

  if (!data.classrooms) {
    data.classrooms = defaultData.classrooms;
  }

  if (!data.temporaryBookings) {
    data.temporaryBookings = [];
  }

  // 確保 1~8 格都存在
  for (let i = 1; i <= 8; i++) {
    if (!data.armSlots[i]) {
      data.armSlots[i] = defaultData.armSlots[i];
    }

    if (!data.classrooms[i]) {
      data.classrooms[i] = defaultData.classrooms[i];
    }

    if (!Array.isArray(data.classrooms[i].schedules)) {
      data.classrooms[i].schedules = [];
    }

    if (!data.armSlots[i].status) {
      data.armSlots[i].status = "空閒";
    }

    if (!("bookingId" in data.armSlots[i])) {
      data.armSlots[i].bookingId = null;
    }
  }

  return data;
}

// ================================
// 載入資料
// ================================

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const newData = getDefaultData();
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(newData, null, 2),
        "utf8"
      );
      return newData;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      return getDefaultData();
    }

    const data = JSON.parse(raw);

    return normalizeData(data);
  } catch (error) {
    console.error("讀取 data.json 失敗：", error);
    return getDefaultData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(systemData, null, 2),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error("寫入 data.json 失敗：", error);
    return false;
  }
}

let systemData = loadData();

// ================================
// Keep Alive
// ================================

app.get("/ping", (req, res) => {
  res.send("pong");
});

// ================================
// 登入
// ================================

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

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const account = accounts[username];

  if (!account || account.password !== password) {
    return res.status(401).json({
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
    user: req.session.user
  });
});

// ================================
// 取得目前登入者
// ================================

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

// ================================
// 登出
// ================================

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true
    });
  });
});

// ================================
// 權限
// ================================

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

// 取得全部教室
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
app.post("/api/classrooms/:id", requireAdmin, (req, res) => {
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
      message: "教室名稱不可為空"
    });
  }

  systemData.classrooms[id].name = name.trim();

  // 同步機械手臂格位顯示名稱
  if (systemData.armSlots[id]) {
    systemData.armSlots[id].roomName = name.trim();
  }

  saveData();

  res.json({
    success: true,
    classroom: systemData.classrooms[id]
  });
});

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

    if (!systemData.classrooms[id]) {
      return res.status(404).json({
        success: false,
        message: "找不到教室"
      });
    }

    if (!className || !weekday || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "資料不完整"
      });
    }

    const newSchedule = {
      id: Date.now(),
      className,
      weekday,
      startTime,
      endTime
    };

    systemData.classrooms[id].schedules.push(newSchedule);

    saveData();

    res.json({
      success: true,
      schedule: newSchedule
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

    classroom.schedules = classroom.schedules.filter(
      item => item.id !== scheduleId
    );

    saveData();

    res.json({
      success: true
    });
  }
);

// ================================
// 課表 CSV 匯入
// ================================

app.post(
  "/api/classrooms/import-csv",
  requireAdmin,
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "沒有上傳檔案"
        });
      }

      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer"
      });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet);

      // 清除目前課表
      for (let i = 1; i <= 8; i++) {
        systemData.classrooms[i].schedules = [];
      }

      let count = 0;

      rows.forEach(row => {
        const className = row["班級"];
        const room = Number(row["教室"]);
        const weekday = row["星期"];
        const startTime = row["開始時間"];
        const endTime = row["結束時間"];

        if (
          className &&
          room >= 1 &&
          room <= 8 &&
          weekday &&
          startTime &&
          endTime
        ) {
          systemData.classrooms[room].schedules.push({
            id: Date.now() + count,
            className: String(className),
            weekday: String(weekday),
            startTime: String(startTime),
            endTime: String(endTime)
          });

          count++;
        }
      });

      saveData();

      res.json({
        success: true,
        message: `成功匯入 ${count} 筆課表`
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "CSV 匯入失敗"
      });
    }
  }
);

// ================================
// 課表 CSV 匯出
// ================================

app.get(
  "/api/classrooms/export-csv",
  requireAdmin,
  (req, res) => {
    const rows = [];

    for (let i = 1; i <= 8; i++) {
      const classroom = systemData.classrooms[i];

      classroom.schedules.forEach(schedule => {
        rows.push({
          "班級": schedule.className,
          "教室": i,
          "星期": schedule.weekday,
          "開始時間": schedule.startTime,
          "結束時間": schedule.endTime
        });
      });
    }

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
      "attachment; filename=classroom_schedule.csv"
    );

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.send(buffer);
  }
);

// ======================================================
// 機械手臂 8 格
// ======================================================

app.get(
  "/api/arm/slots",
  requireLogin,
  (req, res) => {
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

    if (!systemData.armSlots[id]) {
      return res.status(404).json({
        success: false,
        message: "找不到格位"
      });
    }

    const {
      roomName,
      keyName,
      borrower,
      borrowTime,
      status
    } = req.body;

    if (roomName !== undefined) {
      systemData.armSlots[id].roomName = roomName;
    }

    if (keyName !== undefined) {
      systemData.armSlots[id].keyName = keyName;
    }

    if (borrower !== undefined) {
      systemData.armSlots[id].borrower = borrower;
    }

    if (borrowTime !== undefined) {
      systemData.armSlots[id].borrowTime = borrowTime;
    }

    if (status !== undefined) {
      systemData.armSlots[id].status = status;
    }

    saveData();

    res.json({
      success: true,
      slot: systemData.armSlots[id]
    });
  }
);

// 重設所有格位
app.post(
  "/api/arm/reset-all",
  requireAdmin,
  (req, res) => {
    systemData.armSlots = getDefaultArmSlots();

    saveData();

    res.json({
      success: true,
      slots: systemData.armSlots
    });
  }
);

// ======================================================
// 臨時借用系統
// ======================================================

// 取得臨時借用申請
app.get(
  "/api/temporary-bookings",
  requireLogin,
  (req, res) => {

    let bookings = systemData.temporaryBookings;

    // 老師只能看到自己申請的
    if (req.session.user.role !== "admin") {
      bookings = bookings.filter(
        item => item.applicant === req.session.user.username
      );
    }

    res.json({
      success: true,
      bookings
    });
  }
);

// ======================================================
// 新增臨時借用申請
// ======================================================

app.post(
  "/api/temporary-bookings",
  requireLogin,
  (req, res) => {

    const {
      className,
      classroomId,
      date,
      startTime,
      endTime,
      reason
    } = req.body;

    const roomId = Number(classroomId);

    if (
      !className ||
      !roomId ||
      !date ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message: "請完整填寫申請資料"
      });
    }

    if (!systemData.classrooms[roomId]) {
      return res.status(400).json({
        success: false,
        message: "教室不存在"
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "結束時間必須晚於開始時間"
      });
    }

    // ================================
    // 檢查同一天臨時借用是否衝突
    // ================================

    const conflict = systemData.temporaryBookings.some(item => {

      if (item.classroomId !== roomId) {
        return false;
      }

      if (item.date !== date) {
        return false;
      }

      if (
        item.status === "rejected" ||
        item.status === "completed"
      ) {
        return false;
      }

      return (
        startTime < item.endTime &&
        endTime > item.startTime
      );
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "此教室在這個時間已有臨時借用申請"
      });
    }

    // ================================
    // 建立申請
    // ================================

    const booking = {
      id: Date.now(),

      className,

      classroomId: roomId,

      classroomName:
        systemData.classrooms[roomId].name,

      date,

      startTime,

      endTime,

      reason: reason || "",

      applicant:
        req.session.user.username,

      applicantName:
        req.session.user.name,

      status: "pending",

      statusText: "待審核",

      slotId: null,

      createdAt:
        new Date().toISOString(),

      approvedAt: null,

      rejectedAt: null
    };

    systemData.temporaryBookings.push(booking);

    saveData();

    res.json({
      success: true,
      booking
    });
  }
);

// ======================================================
// 管理員核准
// ======================================================

app.post(
  "/api/temporary-bookings/:id/approve",
  requireAdmin,
  (req, res) => {

    const id = Number(req.params.id);

    const booking =
      systemData.temporaryBookings.find(
        item => item.id === id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "找不到申請"
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "此申請目前無法核准"
      });
    }

    const slotId =
      Number(req.body.slotId);

    if (!slotId || !systemData.armSlots[slotId]) {
      return res.status(400).json({
        success: false,
        message: "請選擇有效的機械手臂格位"
      });
    }

    const slot =
      systemData.armSlots[slotId];

    if (
      slot.status !== "空閒"
    ) {
      return res.status(409).json({
        success: false,
        message: `機械手臂第 ${slotId} 格目前不是空閒狀態`
      });
    }

    // ================================
    // 核准
    // ================================

    booking.status = "approved";
    booking.statusText = "已核准";

    booking.slotId = slotId;

    booking.approvedAt =
      new Date().toISOString();

    // ================================
    // 更新機械手臂格位
    // ================================

    slot.status = "待借出";

    slot.bookingId = booking.id;

    slot.borrower =
      booking.className;

    slot.borrowTime =
      `${booking.date} ${booking.startTime}~${booking.endTime}`;

    slot.roomName =
      booking.classroomName;

    saveData();

    res.json({
      success: true,
      booking,
      slot
    });
  }
);

// ======================================================
// 管理員拒絕
// ======================================================

app.post(
  "/api/temporary-bookings/:id/reject",
  requireAdmin,
  (req, res) => {

    const id = Number(req.params.id);

    const booking =
      systemData.temporaryBookings.find(
        item => item.id === id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "找不到申請"
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "此申請目前無法拒絕"
      });
    }

    booking.status = "rejected";
    booking.statusText = "已拒絕";

    booking.rejectedAt =
      new Date().toISOString();

    saveData();

    res.json({
      success: true,
      booking
    });
  }
);

// ======================================================
// 標記為完成
// ======================================================

app.post(
  "/api/temporary-bookings/:id/complete",
  requireAdmin,
  (req, res) => {

    const id = Number(req.params.id);

    const booking =
      systemData.temporaryBookings.find(
        item => item.id === id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "找不到申請"
      });
    }

    if (booking.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "只有已核准的申請可以完成"
      });
    }

    booking.status = "completed";
    booking.statusText = "已完成";

    // ================================
    // 釋放機械手臂格位
    // ================================

    if (
      booking.slotId &&
      systemData.armSlots[booking.slotId]
    ) {

      const slot =
        systemData.armSlots[booking.slotId];

      slot.status = "空閒";
      slot.bookingId = null;
      slot.borrower = "";
      slot.borrowTime = "";
    }

    saveData();

    res.json({
      success: true,
      booking
    });
  }
);

// ======================================================
// 取得單一臨時申請
// ======================================================

app.get(
  "/api/temporary-bookings/:id",
  requireLogin,
  (req, res) => {

    const id = Number(req.params.id);

    const booking =
      systemData.temporaryBookings.find(
        item => item.id === id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "找不到申請"
      });
    }

    // 老師不能查看別人的申請
    if (
      req.session.user.role !== "admin" &&
      booking.applicant !== req.session.user.username
    ) {
      return res.status(403).json({
        success: false,
        message: "沒有權限"
      });
    }

    res.json({
      success: true,
      booking
    });
  }
);

// ======================================================
// 啟動伺服器
// ======================================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
