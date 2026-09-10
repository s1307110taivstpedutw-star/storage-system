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

// 資料存檔路徑
const DATA_FILE = path.join(__dirname, 'data.json');

// 讀取永久儲存的資料（若無則給予預設值）
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(fileData);
    }
  } catch (err) {
    console.error('讀取 data.json 失敗:', err.message);
  }
  return {
    "default_101": {
      id: "default_101",
      name: "101 教室",
      slots: 8,
      schedule: {}
    }
  };
}

// 將資料寫入檔案永久保存
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('寫入 data.json 失敗:', err.message);
  }
}

// 初始化資料庫
let classroomStore = loadData();

app.get('/ping', (req, res) => res.send('pong'));

// 1. 帳號驗證 API
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

// 2. 教室管理 API
// 取得所有教室列表與設定
app.get('/api/classrooms', (req, res) => {
  res.json({ success: true, data: classroomStore });
});

// 新增 / 更新教室 (設定名稱與格位數)
app.post('/api/classrooms/save', (req, res) => {
  const { id, name, slots } = req.body;
  if (!name) return res.status(400).json({ success: false, message: '教室名稱為必填！' });

  const classId = id || ('c_' + Date.now().toString(36));
  if (!classroomStore[classId]) {
    classroomStore[classId] = { id: classId, name, slots: parseInt(slots) || 8, schedule: {} };
  } else {
    classroomStore[classId].name = name;
    classroomStore[classId].slots = parseInt(slots) || 8;
  }

  saveData(classroomStore); // 存入檔案
  res.json({ success: true, message: '教室設定已儲存！', id: classId });
});

// 刪除教室
app.delete('/api/classrooms/:id', (req, res) => {
  const { id } = req.params;
  if (classroomStore[id]) {
    delete classroomStore[id];
    saveData(classroomStore); // 存入檔案
    res.json({ success: true, message: '教室已刪除！' });
  } else {
    res.status(404).json({ success: false, message: '找不到該教室' });
  }
});

// 3. 該教室專屬課表與 CSV 匯入 API
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
      
      const day = String(row[0]).trim();        // 星期 (1-7)
      const slot = String(row[1]).trim();       // 節次/格位 (1-8)
      const className = String(row[2]).trim();  // 班級/課程
      const teacher = row[3] ? String(row[3]).trim() : ''; // 教師

      if (day.includes('星期') || slot.includes('節')) return;

      const itemKey = `${day}_${slot}`;
      classroomStore[id].schedule[itemKey] = { day, slot, className, teacher };
      count++;
    });

    saveData(classroomStore); // 存入檔案
    res.json({ success: true, message: `成功匯入 ${count} 筆課表資料至「${classroomStore[id].name}」！` });
  } catch (err) {
    res.status(500).json({ success: false, message: '解析失敗：' + err.message });
  }
});

// 清空指定教室課表
app.delete('/api/classrooms/:id/clear-schedule', (req, res) => {
  const { id } = req.params;
  if (classroomStore[id]) {
    classroomStore[id].schedule = {};
    saveData(classroomStore); // 存入檔案
    res.json({ success: true, message: '已清空該教室所有課表資料！' });
  } else {
    res.status(404).json({ success: false, message: '找不到該教室' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
