const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.json");


// ==============================
// 建立預設資料
// ==============================

function createDefaultData() {
  const armSlots = Array.from({ length: 8 }, (_, i) => ({
    slotId: i + 1,
    roomName: `教室 ${i + 1}`,

    // 鑰匙
    keyName: "",
    keyNfcId: "",

    // 冷氣卡
    acCardNfcId: "",
    acCardBalance: 0,

    // 借用資訊
    borrower: "",
    borrowTime: "",

    // 狀態
    status: "未借出",

    // 對應臨時借用
    bookingId: null
  }));


  const classrooms = {};

  for (let i = 1; i <= 8; i++) {
    classrooms[i] = {
      id: i,
      name: `教室 ${i}`,
      schedules: []
    };
  }


  return {
    armSlots,
    classrooms,
    temporaryBookings: []
  };
}


// ==============================
// 資料格式整理
// ==============================

function normalizeData(data) {
  const defaultData = createDefaultData();

  if (!data || typeof data !== "object") {
    return defaultData;
  }


  // ------------------------------
  // 機械手臂格位
  // ------------------------------

  if (!Array.isArray(data.armSlots)) {
    data.armSlots = defaultData.armSlots;
  }

  while (data.armSlots.length < 8) {
    const i = data.armSlots.length;

    data.armSlots.push({
      ...defaultData.armSlots[i]
    });
  }

  data.armSlots = data.armSlots.slice(0, 8);


  data.armSlots.forEach((slot, index) => {
    slot.slotId = index + 1;

    if (!slot.roomName) {
      slot.roomName = `教室 ${index + 1}`;
    }

    if (slot.keyName === undefined) {
      slot.keyName = "";
    }

    if (slot.keyNfcId === undefined) {
      slot.keyNfcId = "";
    }

    if (slot.acCardNfcId === undefined) {
      slot.acCardNfcId = "";
    }

    if (slot.acCardBalance === undefined) {
      slot.acCardBalance = 0;
    }

    if (slot.borrower === undefined) {
      slot.borrower = "";
    }

    if (slot.borrowTime === undefined) {
      slot.borrowTime = "";
    }

    if (slot.bookingId === undefined) {
      slot.bookingId = null;
    }


    // 舊版狀態轉換
    if (slot.status === "空閒") {
      slot.status = "未借出";
    }

    if (slot.status === "借用中") {
      slot.status = "未借出";
    }


    const validStatuses = [
      "未借出",
      "已核准／待執行",
      "已借出"
    ];

    if (!validStatuses.includes(slot.status)) {
      slot.status = "未借出";
    }
  });


  // ------------------------------
  // 教室
  // ------------------------------

  if (
    !data.classrooms ||
    typeof data.classrooms !== "object" ||
    Array.isArray(data.classrooms)
  ) {
    data.classrooms = {};
  }


  for (let i = 1; i <= 8; i++) {
    if (!data.classrooms[i]) {
      data.classrooms[i] = {
        id: i,
        name: `教室 ${i}`,
        schedules: []
      };
    }

    if (!data.classrooms[i].name) {
      data.classrooms[i].name = `教室 ${i}`;
    }

    if (!Array.isArray(data.classrooms[i].schedules)) {
      data.classrooms[i].schedules = [];
    }
  }


  // ------------------------------
  // 同步格位與教室名稱
  // ------------------------------

  data.armSlots.forEach((slot) => {
    const classroom = data.classrooms[slot.slotId];

    if (classroom) {
      slot.roomName = classroom.name;
    }
  });


  // ------------------------------
  // 臨時借用
  // ------------------------------

  if (!Array.isArray(data.temporaryBookings)) {
    data.temporaryBookings = [];
  }


  return data;
}


// ==============================
// 載入資料
// ==============================

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const data = createDefaultData();

      saveData(data);

      return data;
    }


    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      const data = createDefaultData();

      saveData(data);

      return data;
    }


    const data = JSON.parse(raw);

    const normalizedData = normalizeData(data);

    saveData(normalizedData);

    return normalizedData;

  } catch (error) {
    console.error("讀取 data.json 失敗：", error);

    const data = createDefaultData();

    saveData(data);

    return data;
  }
}


// ==============================
// 儲存資料
// ==============================

function saveData(data) {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("儲存 data.json 失敗：", error);
  }
}


module.exports = {
  DATA_FILE,
  createDefaultData,
  normalizeData,
  loadData,
  saveData
};
