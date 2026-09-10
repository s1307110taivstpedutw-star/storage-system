const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'taivs-storage-system-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// 記憶體課表資料庫（格式：{ "101-1-1": { subject: "資訊概論", teacher: "張老師" } }）
let scheduleData = {};

// ===== 既有 Auth API =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'taivsctrl' && password === 'taivsctrl116116116') {
    req.session.user = { username };
    return res.json({ success: true, message: '登入成功！' });
  }
  return res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
});

// ===== 步驟二：新增 Schedule API =====

// 1. 取得所有課表資料
app.get('/api/schedule', (req, res) => {
  res.json({ success: true, data: scheduleData });
});

// 2. 手動更新/新增單筆課表
app.post('/api/schedule/update', (req, res) => {
  const { classroom, day, period, subject, teacher } = req.body;
  if (!classroom || !day || !period) {
    return res.status(400).json({ success: false, message: '缺少必要欄位' });
  }
  const key = `${classroom}-${day}-${period}`;
  scheduleData[key] = { subject, teacher };
  res.json({ success: true, message: '課表更新成功！', data: scheduleData[key] });
});

// 3. 匯入 CSV 課表文字資料
app.post('/api/schedule/import-csv-text', (req, res) => {
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ success: false, message: '內容不能為空' });
  }

  const lines = csvText.trim().split('\n');
  let count = 0;

  lines.forEach((line, index) => {
    // 跳過標題列
    if (index === 0 && line.includes('classroom')) return;

    const [classroom, day, period, subject, teacher] = line.split(',').map(s => s?.trim());
    if (classroom && day && period) {
      const key = `${classroom}-${day}-${period}`;
      scheduleData[key] = { subject: subject || '', teacher: teacher || '' };
      count++;
    }
  });

  res.json({ success: true, message: `成功匯入 ${count} 筆課表資料！` });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
