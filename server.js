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
  secret: 'arm_key_secret_123',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

const DATA_FILE = path.join(__dirname, 'data.json');

// 初始化工廠 8 個格位預設值
function getDefaultSlots() {
  const slots = {};
  for (let i = 1; i <= 8; i++) {
    slots[i] = {
      slotId: i,
      roomName: `第 ${i} 教室`,
      keyName: `教室 ${i} 鑰匙`,
      borrower: '',
      borrowTime: ''
    };
  }
  return slots;
}

// 讀取永久儲存檔 data.json
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('讀取 data.json 失敗:', err.message);
  }
  return getDefaultSlots();
}

// 寫入檔案永久保存
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('寫入 data.json 失敗:', err.message);
  }
}

let armSlotsStore = loadData();

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

// 2. 取得機械手臂 8 個格位資料
app.get('/api/arm/slots', (req, res) => {
  res.json({ success: true, data: armSlotsStore });
});

// 3. 更新單一格位設定（教室名稱、鑰匙名稱、借用狀態）
app.post('/api/arm/slot/:id', (req, res) => {
  const slotId = req.params.id;
  if (!armSlotsStore[slotId]) {
    return res.status(404).json({ success: false, message: '無此格位编号（僅限 1-8）' });
  }

  const { roomName, keyName, borrower } = req.body;

  if (roomName !== undefined) armSlotsStore[slotId].roomName = roomName.trim();
  if (keyName !== undefined) armSlotsStore[slotId].keyName = keyName.trim();

  // 若登記借用人，紀錄當下時間；若清空則代表還鑰匙
  if (borrower !== undefined) {
    const trimmedBorrower = borrower.trim();
    armSlotsStore[slotId].borrower = trimmedBorrower;
    armSlotsStore[slotId].borrowTime = trimmedBorrower ? new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
  }

  saveData(armSlotsStore);
  res.json({ success: true, message: `格位 ${slotId} 資料已成功更新！` });
});

// 4. 上傳 CSV / Excel 批次設定 8 間教室鑰匙名稱
app.post('/api/arm/upload-csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '請選擇 CSV/Excel 檔案' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let count = 0;
    rows.forEach((row) => {
      if (!row || row.length < 2) return;

      const slotId = parseInt(row[0]);               // 1 ~ 8
      const roomName = String(row[1]).trim();        // 教室名稱 (如: 101 PLC教室)
      const keyName = row[2] ? String(row[2]).trim() : `教室 ${slotId} 鑰匙`; // 鑰匙名稱
      const borrower = row[3] ? String(row[3]).trim() : '';                  // 借用人

      if (isNaN(slotId) || slotId < 1 || slotId > 8) return; // 跳過非 1-8 格位

      armSlotsStore[slotId] = {
        slotId,
        roomName,
        keyName,
        borrower,
        borrowTime: borrower ? new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : ''
      };
      count++;
    });

    saveData(armSlotsStore);
    res.json({ success: true, message: `成功更新 ${count} 個格位的對應設定！` });
  } catch (err) {
    res.status(500).json({ success: false, message: '解析失敗：' + err.message });
  }
});

// 5. 重置所有格位為預設狀態
app.post('/api/arm/reset-all', (req, res) => {
  armSlotsStore = getDefaultSlots();
  saveData(armSlotsStore);
  res.json({ success: true, message: '已重置 8 個格位為預設狀態！' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
