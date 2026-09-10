const express = require('express');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'storage_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

const DATA_FILE = path.join(__dirname, 'data.json');

// 載入持久化 JSON 資料
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('讀取 data.json 失敗:', err.message);
  }
  return {
    "room_101": {
      id: "room_101",
      name: "101 機械教室",
      rows: 4, // 4 列
      cols: 6, // 6 行
      slots: {} // 格位資料 { "1_1": { itemName: "螺絲起子組", borrower: "張老師" } }
    }
  };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('寫入 data.json 失敗:', err.message);
  }
}

let classroomStore = loadData();

app.get('/ping', (req, res) => res.send('pong'));

// 1. 登入 / 登出
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: '請輸入帳號與密碼！' });
  req.session.user = { username };
  res.json({ success: true, message: '登入成功！' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true, message: '已成功登出' });
  });
});

// 2. 教室 / 倉儲區管理
app.get('/api/classrooms', (req, res) => {
  res.json({ success: true, data: classroomStore });
});

// 新增或更新教室與格位矩陣 (列 x 行)
app.post('/api/classrooms/save', (req, res) => {
  const { id, name, rows, cols } = req.body;
  if (!name) return res.status(400).json({ success: false, message: '教室名稱為必填！' });

  const classId = id || ('room_' + Date.now().toString(36));
  const r = parseInt(rows) || 4;
  const c = parseInt(cols) || 6;

  if (!classroomStore[classId]) {
    classroomStore[classId] = { id: classId, name, rows: r, cols: c, slots: {} };
  } else {
    classroomStore[classId].name = name;
    classroomStore[classId].rows = r;
    classroomStore[classId].cols = c;
  }

  saveData(classroomStore);
  res.json({ success: true, message: '教室與格位矩陣設定已儲存！', id: classId });
});

// 刪除教室
app.delete('/api/classrooms/:id', (req, res) => {
  const { id } = req.params;
  if (classroomStore[id]) {
    delete classroomStore[id];
    saveData(classroomStore);
    res.json({ success: true, message: '教室已刪除！' });
  } else {
    res.status(404).json({ success: false, message: '找不到該教室' });
  }
});

// 3. 單格格位更新 API
app.post('/api/classrooms/:id/slot', (req, res) => {
  const { id } = req.params;
  const { row, col, itemName, borrower } = req.body;
  if (!classroomStore[id]) return res.status(404).json({ success: false, message: '找不到該教室' });

  const slotKey = `${row}_${col}`;
  if (!itemName && !borrower) {
    delete classroomStore[id].slots[slotKey]; // 清空該格
  } else {
    classroomStore[id].slots[slotKey] = { row, col, itemName: itemName || '', borrower: borrower || '' };
  }

  saveData(classroomStore);
  res.json({ success: true, message: '格位資料已更新！' });
});

// 4. 機械手臂格位 CSV / Excel 批次匯入
app.post('/api/classrooms/:id/upload-csv', upload.single('file'), (req, res) => {
  const { id } = req.params;
  if (!classroomStore[id]) return res.status(404).json({ success: false, message: '找不到該教室' });
  if (!req.file) return res.status(400).json({ success: false, message: '請選擇 CSV/Excel 檔案' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let count = 0;
    rows.forEach((row) => {
      if (!row || row.length < 3) return;

      const r = String(row[0]).trim();         // 列 (Row)
      const c = String(row[1]).trim();         // 行 (Col)
      const itemName = String(row[2]).trim();  // 存放物品/器材
      const borrower = row[3] ? String(row[3]).trim() : ''; // 借用人/班級

      if (r.includes('列') || c.includes('行')) return; // 忽略標題列

      const slotKey = `${r}_${c}`;
      classroomStore[id].slots[slotKey] = { row: r, col: c, itemName, borrower };
      count++;
    });

    saveData(classroomStore);
    res.json({ success: true, message: `成功匯入 ${count} 個格位資料至「${classroomStore[id].name}」！` });
  } catch (err) {
    res.status(500).json({ success: false, message: '解析失敗：' + err.message });
  }
});

// 清空教室所有格位
app.delete('/api/classrooms/:id/clear-slots', (req, res) => {
  const { id } = req.params;
  if (classroomStore[id]) {
    classroomStore[id].slots = {};
    saveData(classroomStore);
    res.json({ success: true, message: '已清空該教室所有機械手臂格位資料！' });
  } else {
    res.status(404).json({ success: false, message: '找不到該教室' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
