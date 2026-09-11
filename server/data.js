const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.json");

function createDefaultData() {
  return {
    armSlots: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `第 ${i + 1} 格`,
      status: "未借出"
    })),

    classrooms: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `教室 ${i + 1}`,
      schedules: []
    })),

    temporaryBookings: [],

    logs: []
  };
}

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

    if (!Array.isArray(data.armSlots)) {
      data.armSlots = createDefaultData().armSlots;
    }

    if (!Array.isArray(data.classrooms)) {
      data.classrooms = createDefaultData().classrooms;
    }

    if (!Array.isArray(data.temporaryBookings)) {
      data.temporaryBookings = [];
    }

    if (!Array.isArray(data.logs)) {
      data.logs = [];
    }

    return data;
  } catch (error) {
    console.error("讀取 data.json 失敗：", error);

    const data = createDefaultData();
    saveData(data);

    return data;
  }
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

module.exports = {
  DATA_FILE,
  createDefaultData,
  loadData,
  saveData
};
