const express = require('express');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const https = require('https');

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

// 記憶體資料庫（儲存課表紀錄）
let scheduleDatabase = {};

// 健康檢查 / 保活端點 (Self-Ping)
app.get('/ping', (req, res) => {
  res.send('pong');
});

// 每 10 分鐘自動對自己發送 Ping 請求，避免 Render 休眠
setInterval(() => {
  https.get('https://storage-system-kqwy.onrender.com/ping', (res) => {
    console.log(`Self-ping status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('Self-ping error:', err.message);
  });
}, 10 * 60 * 1000);

// 1. 取得所有課表
app.get('/api/schedule', (req, res) => {
  res.json({ success: true, data: scheduleDatabase });
});

// 2. 匯入 Excel/CSV 檔案
app.post('/api/schedule/upload-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '請選擇要上傳的檔案' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let count = 0;

    rows.forEach((row) => {
      if (!row || row.length < 5) return;

      const classroom = String(row[0]).trim();
      const day = String(row[1]).trim();
      const borrowTime = String(row[2]).trim();
      const returnTime = String(row[3]).trim();
      const className = String(row[4]).trim();
      const teacher = row[5] ? String(row[5]).trim() : '';

      if (classroom.includes('教室') || day.includes('星期')) return;

      const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      scheduleDatabase[id] = { id, classroom, day, borrowTime, returnTime, className, teacher };
      count++;
    });

    res.json({ success: true, message: `成功匯入 ${count} 筆資料！` });
  } catch (err) {
    res.status(500).json({ success: false, message: '檔案解析失敗：' + err.message });
  }
});

// 3. 新增 / 更新單筆資料
app.post('/api/schedule/save', (req, res) => {
  const { id, classroom, day, borrowTime, returnTime, className, teacher } = req.body;
  if (!classroom || !day || !borrowTime || !returnTime || !className) {
    return res.status(400).json({ success: false, message: '請填寫所有必填欄位！' });
  }

  const recordId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
  scheduleDatabase[recordId] = { id: recordId, classroom, day, borrowTime, returnTime, className, teacher: teacher || '' };

  res.json({ success: true, message: id ? '更新成功！' : '新增成功！' });
});

// 4. 刪除單筆資料
app.delete('/api/schedule/:id', (req, res) => {
  const { id } = req.params;
  if (scheduleDatabase[id]) {
    delete scheduleDatabase[id];
    res.json({ success: true, message: '刪除成功！' });
  } else {
    res.status(404).json({ success: false, message: '找不到該筆資料' });
  }
});

// 5. 清空所有資料
app.delete('/api/schedule-all', (req, res) => {
  scheduleDatabase = {};
  res.json({ success: true, message: '已清空所有課表資料！' });
});

// 6. 登出 API
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: '登出失敗' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: '已成功登出' });
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
