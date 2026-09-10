// ==========================================
// 鑰匙與冷氣卡機械手臂倉儲管理系統
// server.js
// ==========================================


// ==========================================
// 1. 載入需要使用的套件
// ==========================================

// Express：建立網站伺服器與 API
const express = require('express');

// express-session：讓伺服器記住使用者的登入狀態
const session = require('express-session');

// multer：處理使用者上傳的檔案
const multer = require('multer');

// xlsx：讀取 Excel / CSV 檔案
const xlsx = require('xlsx');

// path：處理檔案與資料夾路徑
const path = require('path');

// fs：讓 Node.js 可以讀取、寫入檔案
const fs = require('fs');


// ==========================================
// 2. 建立 Express 網站伺服器
// ==========================================

// 建立 Express 應用程式
const app = express();


// ==========================================
// 3. 設定檔案上傳功能
// ==========================================

// 使用記憶體暫存上傳的檔案
const upload = multer({
  storage: multer.memoryStorage()
});


// ==========================================
// 4. 設定 Express 可以接收的資料格式
// ==========================================

// 讓伺服器可以讀取 JSON
app.use(express.json());

// 讓伺服器可以讀取 HTML 表單資料
app.use(express.urlencoded({
  extended: true
}));


// ==========================================
// 5. 設定網站前端資料夾
// ==========================================

// public 裡面的 HTML、CSS、JavaScript
// 可以直接讓瀏覽器讀取
app.use(express.static(
  path.join(__dirname, 'public')
));


// ==========================================
// 6. 設定 Session 登入記憶功能
// ==========================================

// Session 可以想成：
// 「伺服器暫時記住現在登入的是誰」
app.use(session({

  // Session 的加密金鑰
  // ⚠️ 之後正式上線要改成 Render 環境變數
  secret: 'arm_key_secret_123',

  // Session 沒有修改時，不重新儲存
  resave: false,

  // 沒有真正使用 Session 時，不建立空 Session
  saveUninitialized: false,

  // Cookie 設定
  cookie: {
    // 目前測試階段使用 false
    secure: false
  }
}));


// ==========================================
// 7. 設定資料檔案位置
// ==========================================

// data.json 用來儲存 8 個格位資料
const DATA_FILE = path.join(
  __dirname,
  'data.json'
);


// ==========================================
// 8. 建立 8 個格位的預設資料
// ==========================================

function getDefaultSlots() {

  // 建立一個空物件
  const slots = {};

  // 建立第 1～8 格
  for (let i = 1; i <= 8; i++) {

    slots[i] = {

      // 格位編號
      slotId: i,

      // 預設教室名稱
      roomName: `第 ${i} 教室`,

      // 預設鑰匙名稱
      keyName: `教室 ${i} 鑰匙`,

      // 借用人
      borrower: '',

      // 借用時間
      borrowTime: ''
    };
  }

  // 回傳 8 個格位
  return slots;
}


// ==========================================
// 9. 讀取 data.json
// ==========================================

function loadData() {

  try {

    // 確認 data.json 是否存在
    if (fs.existsSync(DATA_FILE)) {

      // 讀取 data.json
      const fileData = fs.readFileSync(
        DATA_FILE,
        'utf8'
      );

      // 將 JSON 文字轉換成 JavaScript 資料
      return JSON.parse(fileData);
    }

  } catch (err) {

    // 如果讀取失敗
    console.error(
      '讀取 data.json 失敗:',
      err.message
    );
  }

  // 如果沒有資料，就建立預設 8 格
  return getDefaultSlots();
}


// ==========================================
// 10. 儲存資料到 data.json
// ==========================================

function saveData(data) {

  try {

    // 將 JavaScript 資料轉成 JSON
    const jsonData = JSON.stringify(
      data,
      null,
      2
    );

    // 寫入 data.json
    fs.writeFileSync(
      DATA_FILE,
      jsonData,
      'utf8'
    );

  } catch (err) {

    // 顯示寫入錯誤
    console.error(
      '寫入 data.json 失敗:',
      err.message
    );
  }
}


// ==========================================
// 11. 啟動時先讀取格位資料
// ==========================================

// 伺服器啟動時
// 將 data.json 的資料載入記憶體
let armSlotsStore = loadData();


// ==========================================
// 12. Ping API
// ==========================================

// 用來確認伺服器有沒有正常運作
app.get('/ping', (req, res) => {

  // 伺服器正常就回傳 pong
  res.send('pong');
});


// ==========================================
// 13. 登入 API
// ==========================================

// 前端把帳號密碼送到 /api/login
app.post('/api/login', (req, res) => {

  // 從前端送來的資料取得帳號與密碼
  const {
    username,
    password
  } = req.body;


  // ----------------------------------------
  // 檢查帳號與密碼是否有輸入
  // ----------------------------------------

  if (!username || !password) {

    return res.status(400).json({

      // 登入失敗
      success: false,

      // 顯示錯誤訊息
      message: '請輸入帳號與密碼！'
    });
  }


  // ----------------------------------------
  // 暫時建立測試帳號
  // ----------------------------------------

  // ⚠️ 目前只是測試
  // 之後會改成真正的帳號資料系統
  const accounts = {

    // 管理員
    admin: {

      // 管理員密碼
      password: 'admin123',

      // 管理員身份
      role: 'admin'
    },

    // 老師
    teacher: {

      // 老師密碼
      password: 'teacher123',

      // 老師身份
      role: 'teacher'
    }
  };


  // ----------------------------------------
  // 尋找帳號
  // ----------------------------------------

  // 例如 username = admin
  // 就會取得 accounts.admin
  const account = accounts[username];


  // ----------------------------------------
  // 檢查帳號與密碼
  // ----------------------------------------

  if (
    !account ||
    account.password !== password
  ) {

    // 401 = 身份驗證失敗
    return res.status(401).json({

      success: false,

      message: '帳號或密碼錯誤！'
    });
  }


  // ----------------------------------------
  // 登入成功
  // ----------------------------------------

  // 把使用者資料存進 Session
  // 之後伺服器就知道現在登入的是誰
  req.session.user = {

    // 使用者帳號
    username: username,

    // 使用者身份
    role: account.role
  };


  // ----------------------------------------
  // 回傳登入成功
  // ----------------------------------------

  res.json({

    success: true,

    message: '登入成功！',

    // 把身份一起傳給前端
    role: account.role
  });
});


// ==========================================
// 14. 查看目前登入者
// ==========================================

// 前端可以使用這個 API 問伺服器：
// 「現在登入的人是誰？」
app.get('/api/me', (req, res) => {

  // 檢查 Session 裡面有沒有使用者
  if (!req.session.user) {

    // 沒有登入
    return res.status(401).json({

      success: false,

      message: '尚未登入'
    });
  }


  // 已經登入
  // 將登入者資料傳回前端
  res.json({

    success: true,

    // 回傳帳號與身份
    user: req.session.user
  });
});


// ==========================================
// 15. 登出 API
// ==========================================

// 前端送出 POST /api/logout
app.post('/api/logout', (req, res) => {

  // 刪除目前使用者的 Session
  req.session.destroy(() => {

    // 清除瀏覽器裡的 Session Cookie
    res.clearCookie('connect.sid');

    // 回傳登出成功
    res.json({

      success: true,

      message: '已成功登出'
    });
  });
});


// ==========================================
// 16. 取得機械手臂 8 個格位
// ==========================================

// 前端向這個 API 要求格位資料
app.get('/api/arm/slots', (req, res) => {

  // 回傳目前 8 格資料
  res.json({

    success: true,

    data: armSlotsStore
  });
});


// ==========================================
// 17. 更新單一格位
// ==========================================

// :id 代表格位編號
// 例如 /api/arm/slot/1 = 第 1 格
app.post('/api/arm/slot/:id', (req, res) => {

  // 取得網址上的格位編號
  const slotId = req.params.id;


  // ----------------------------------------
  // 確認格位是否存在
  // ----------------------------------------

  if (!armSlotsStore[slotId]) {

    return res.status(404).json({

      success: false,

      message: '無此格位編號（僅限 1-8）'
    });
  }


  // ----------------------------------------
  // 取得前端傳來的資料
  // ----------------------------------------

  const {
    roomName,
    keyName,
    borrower
  } = req.body;


  // ----------------------------------------
  // 修改教室名稱
  // ----------------------------------------

  if (roomName !== undefined) {

    armSlotsStore[slotId].roomName =
      roomName.trim();
  }


  // ----------------------------------------
  // 修改鑰匙名稱
  // ----------------------------------------

  if (keyName !== undefined) {

    armSlotsStore[slotId].keyName =
      keyName.trim();
  }


  // ----------------------------------------
  // 修改借用人
  // ----------------------------------------

  if (borrower !== undefined) {

    // 去掉前後空白
    const trimmedBorrower =
      borrower.trim();


    // 儲存借用人
    armSlotsStore[slotId].borrower =
      trimmedBorrower;


    // 如果有借用人
    // 就記錄現在時間
    if (trimmedBorrower) {

      armSlotsStore[slotId].borrowTime =
        new Date().toLocaleString(
          'zh-TW',
          {
            timeZone: 'Asia/Taipei'
          }
        );

    } else {

      // 沒有借用人
      // 代表鑰匙已歸還
      armSlotsStore[slotId].borrowTime = '';
    }
  }


  // 儲存資料
  saveData(armSlotsStore);


  // 回傳更新成功
  res.json({

    success: true,

    message:
      `格位 ${slotId} 資料已成功更新！`
  });
});


// ==========================================
// 18. 上傳 CSV / Excel
// ==========================================

app.post(
  '/api/arm/upload-csv',
  upload.single('file'),
  (req, res) => {

    // 確認有沒有上傳檔案
    if (!req.file) {

      return res.status(400).json({

        success: false,

        message:
          '請選擇 CSV/Excel 檔案'
      });
    }


    try {

      // --------------------------------------
      // 讀取上傳的檔案
      // --------------------------------------

      const workbook = xlsx.read(
        req.file.buffer,
        {
          type: 'buffer'
        }
      );


      // 取得第一個工作表
      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];


      // 將工作表轉成陣列
      const rows =
        xlsx.utils.sheet_to_json(
          sheet,
          {
            header: 1
          }
        );


      // 計算更新幾個格位
      let count = 0;


      // --------------------------------------
      // 一列一列讀取資料
      // --------------------------------------

      rows.forEach((row) => {

        // 資料不足兩欄就跳過
        if (!row || row.length < 2) {
          return;
        }


        // 第 1 欄：格位編號
        const slotId =
          parseInt(row[0]);


        // 第 2 欄：教室名稱
        const roomName =
          String(row[1]).trim();


        // 第 3 欄：鑰匙名稱
        const keyName =
          row[2]
            ? String(row[2]).trim()
            : `教室 ${slotId} 鑰匙`;


        // 第 4 欄：借用人
        const borrower =
          row[3]
            ? String(row[3]).trim()
            : '';


        // ------------------------------------
        // 確認格位編號是不是 1～8
        // ------------------------------------

        if (
          isNaN(slotId) ||
          slotId < 1 ||
          slotId > 8
        ) {

          // 不符合就跳過
          return;
        }


        // ------------------------------------
        // 更新格位
        // ------------------------------------

        armSlotsStore[slotId] = {

          // 格位編號
          slotId,

          // 教室名稱
          roomName,

          // 鑰匙名稱
          keyName,

          // 借用人
          borrower,

          // 如果有人借用，就記錄時間
          borrowTime:
            borrower
              ? new Date().toLocaleString(
                  'zh-TW',
                  {
                    timeZone:
                      'Asia/Taipei'
                  }
                )
              : ''
        };


        // 成功更新一格
        count++;
      });


      // 儲存資料
      saveData(armSlotsStore);


      // 回傳成功
      res.json({

        success: true,

        message:
          `成功更新 ${count} 個格位的對應設定！`
      });


    } catch (err) {

      // Excel / CSV 解析失敗
      return res.status(500).json({

        success: false,

        message:
          '解析失敗：' + err.message
      });
    }
  }
);


// ==========================================
// 19. 重置所有格位
// ==========================================

app.post('/api/arm/reset-all', (req, res) => {

  // 恢復 8 格預設資料
  armSlotsStore =
    getDefaultSlots();


  // 儲存資料
  saveData(armSlotsStore);


  // 回傳成功
  res.json({

    success: true,

    message:
      '已重置 8 個格位為預設狀態！'
  });
});


// ==========================================
// 20. 啟動伺服器
// ==========================================

// Render 會提供 PORT
// 如果沒有，就使用 10000
const PORT =
  process.env.PORT || 10000;


// 啟動 Express 伺服器
app.listen(
  PORT,
  () => {

    // 在 Render Log 顯示啟動成功
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
