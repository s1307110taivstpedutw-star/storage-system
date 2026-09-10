const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'storage_system_secret_key',
  resave: false,
  saveUninitialized: true
}));

// 第 1 頁：登入頁面與預設帳號驗證
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // 預設管理員帳密
  if (username === 'taivsctrl' && password === 'taivsctrl116116116') {
    req.session.user = { username, role: 'admin' };
    return res.json({ success: true, role: 'admin', message: '登入成功（管理員）' });
  }

  return res.status(401).json({ success: false, message: '帳號或密碼錯誤！' });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
