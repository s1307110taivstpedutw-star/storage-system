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
  secret: 'key_cabinet_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

const DATA_FILE = path.join(__dirname, 'data.json');

// 讀取永久儲存的資料（若無則建立預設鑰匙櫃）
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('讀取 data.json 失敗:', err.message);
  }
  return {
    "cabinet_main": {
      id: "cabinet_main",
      name: "主機械手臂鑰匙櫃",
      rows: 5, // 預設 5 列
      cols: 8, // 預設 8 行
      slots: {} // 格位資料 { "1_1": { keyName: "101 教室鑰匙", borrower: "張老師", status: "borrowed" } }
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

let cabinetStore = loadData();

app.get('/ping', (req, res) => res.send('pong'));

// 1. 帳號登入 / 登出
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

// 2. 鑰匙櫃管理 API
app.get('/api/cabinets', (req, res) => {
  res.json({ success: true, data: cabinetStore });
});

// 新增或修改鑰匙櫃矩陣
app.post('/api/cabinets/save', (req, res) => {
  const { id, name, rows, cols } = req.body;
  if (!name) return res.status(400).json({ success: false, message: '鑰匙櫃名稱為必填！' });

  const cabinetId = id || ('cab_' + Date.now().toString(36));
  const r = parseInt(rows) || 5;
  const c = parseInt(cols) || 8;

  if (!cabinetStore[cabinetId]) {
    cabinetStore[cabinetId] = { id: cabinetId, name, rows: r, cols: c, slots: {} };
  } else {
    cabinetStore[cabinetId].name = name;
    cabinetStore[cabinetId].rows = r;
    cabinetStore[cabinetId].cols = c;
  }

  saveData(cabinetStore);
  res.json({ success: true, message: '鑰匙櫃矩陣設定已儲存！', id: cabinetId });
});

// 刪除鑰匙櫃
app.delete('/api/cabinets/:id', (req, res) => {
  const { id } = req.params;
  if (cabinetStore[id]) {
    delete cabinetStore[id];
    saveData(cabinetStore);
    res.json({ success: true, message: '鑰匙櫃已刪除！' });
  } else {
    res.status(404).json({ success: false, message: '找不到該鑰匙櫃' });
  }
});

// 3. 個別鑰匙格位設定 / 借還更新 API
app.post('/api/cabinets/:id/slot', (req, res) => {
  const { id } = req.params;
  const { row, col, keyName, borrower } = req.body;
  if (!cabinetStore[id]) return res.status(404).json({ success: false, message: '找不到該鑰匙櫃' });

  const slotKey = `${row}_${col}`;
  if (!keyName) {
    delete cabinetStore[id].slots[slotKey]; // 清空該格（無掛設鑰匙）
  } else {
    cabinetStore[id].slots[slotKey] = {
      row,
      col,
      keyName: keyName.trim(),
      borrower: borrower ? borrower.trim() : ''
    };
  }

  saveData(cabinetStore);
  res.json({ success: true, message: '鑰匙格位狀態已更新！' });
});

// 4. 批次匯入鑰匙設定 CSV / Excel
app.post('/api/cabinets/:id/upload-csv', upload.single('file'), (req, res) => {
  const { id } = req.params;
  if (!cabinetStore[id]) return res.status(404).json({ success: false, message: '找不到該鑰匙櫃' });
  if (!req.file) return res.status(400).json({ success: false, message: '請選擇 CSV/Excel 檔案' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let count = 0;
    rows.forEach((row) => {
      if (!row || row.length < 3) return;

      const r = String(row[0]).trim();        // 列 (Row)
      const c = String(row[1]).trim();        // 行 (Col)
      const keyName = String(row[2]).trim();  // 鑰匙名稱 (如: 101教室鑰匙)
      const borrower = row[3] ? String(row[3]).trim() : ''; // 借用人/狀態 (如: 張老師 或 留空代表在位)

      if (r.includes('列') || c.includes('行')) return; // 跳過標題列

      const slotKey = `${r}_${c}`;
      cabinetStore[id].slots[slotKey] = { row: r, col: c, keyName, borrower };
      count++;
    });

    saveData(cabinetStore);
    res.json({ success: true, message: `成功匯入 ${count} 個鑰匙格位資料！` });
  } catch (err) {
    res.status(500).json({ success: false, message: '解析失敗：' + err.message });
  }
});

// 清空所有鑰匙格位
app.delete('/api/cabinets/:id/clear-slots', (req, res) => {
  const { id } = req.params;
  if (cabinetStore[id]) {
    cabinetStore[id].slots = {};
    saveData(cabinetStore);
    res.json({ success: true, message: '已清空該櫃所有鑰匙格位！' });
  } else {
    res.status(404).json({ success: false, message: '找不到該鑰匙櫃' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
