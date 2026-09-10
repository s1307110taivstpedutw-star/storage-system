// ==========================================
// 鑰匙與冷氣卡機械手臂倉儲管理系統
// server.js
// ==========================================


// ------------------------------------------
// 1. 載入需要使用的套件
// ------------------------------------------

// Express：建立網站伺服器與 API
const express = require('express');

// express-session：讓伺服器可以記住「誰已經登入」
const session = require('express-session');

// multer：處理使用者上傳的檔案
const multer = require('multer');

// xlsx：讀取 Excel / CSV 檔案
const xlsx = require('xlsx');

// path：處理檔案與資料夾路徑
const path = require('path');

// fs：讓 Node.js 可以讀取、寫入檔案
const fs = require('fs');


// ------------------------------------------
// 2. 建立 Express 網站伺服器
// ------------------------------------------

// 建立 Express 應用程式
const app = express();


// ------------------------------------------
// 3. 設定檔案上傳功能
// ------------------------------------------

// 使用記憶體暫存上傳的檔案
// 使用者上傳 CSV / Excel 時，檔案會先放在記憶體中
const upload = multer({
  storage: multer.memoryStorage()
});


// ------------------------------------------
// 4. 設定 Express 可以接收的資料格式
// ------------------------------------------

// 讓伺服器可以讀取 JSON 格式資料
app.use(express.json());

// 讓伺服器可以讀取 HTML 表單送過來的資料
app.use(express.urlencoded({
  extended: true
}));


// ------------------------------------------
// 5. 設定網站前端資料夾
// ------------------------------------------

// public 資料夾裡面的 HTML、CSS、JavaScript
// 可以直接被瀏覽器讀取
app.use(express.static(
  path.join(__dirname, 'public')
));


// ------------------------------------------
// 6. 設定 Session 登入記憶功能
// ------------------------------------------

// Session 可以想成：
// 「伺服器暫時記住現在是誰登入」
app.use(session({

  // Session 的加密金鑰
  // ⚠️ 正式上線後應該放到 Render Environment Variables
  secret: 'arm_key_secret_123',

  // 如果 Session 沒有修改，就不要一直重新儲存
  resave: false,

  // 沒有登入時，不要先建立空的 Session
  saveUninitialized: false,

  // Cookie 設定
  cookie: {
    // 目前 Render / 測試環境先使用 false
    secure: false
  }
}));


// ------------------------------------------
// 7. 設定資料檔案位置
// ------------------------------------------

// data.json 用來儲存目前 8 個格位的資料
const DATA_FILE = path.join(
  __dirname,
  'data.json'
);


// ==========================================
// 8. 建立 8 個格位的預設資料
// ==========================================

function getDefaultSlots() {

  // 建立一個空的物件
  const slots = {};

  // 使用 for 迴圈建立第 1～8 格
  for (let i = 1; i <= 8; i++) {

    // 建立每一個格位的資料
    slots[i] = {

      // 格位編號
      slotId: i,

      // 預設教室名稱
      roomName: `第 ${i} 教室`,

      // 預設鑰匙名稱
      keyName: `教室 ${i} 鑰匙`,

      // 目前借用人
      // 空白代表沒有借出
      borrower: '',

      // 借用時間
      // 空白代表目前沒有借出
      borrowTime: ''
    };
  }

  // 回傳建立好的 8 個格位
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

      // 把 JSON 文字轉換成 JavaScript 資料
      return JSON.parse(fileData);
    }

  } catch (err) {

    // 如果讀取失敗，在 Render 主控台顯示錯誤
    console.error(
      '讀取 data.json 失敗:',
      err.message
    );
  }

  // 如果沒有資料檔案
  // 就建立預設的 8 個格位
  return getDefaultSlots();
}


// ==========================================
// 10. 儲存資料到 data.json
// ==========================================

function saveData(data) {

  try {

    // 將 JavaScript 資料轉成 JSON
    // null, 2 代表讓檔案比較容易閱讀
    const jsonData = JSON.stringify(
      data,
      null,
      2
    );

    // 將資料寫入 data.json
    fs.writeFileSync(
      DATA_FILE,
      jsonData,
      'utf8'
    );

  } catch (err) {

    // 如果寫入失敗
    // 在 Render 主控台顯示錯誤
    console.error(
      '寫入 data.json 失敗:',
      err.message
    );
  }
}


// ------------------------------------------
// 11. 啟動時先讀取格位資料
// ------------------------------------------

// 伺服器啟動時
// 把 data.json 裡面的資料載入記憶體
let armSlotsStore = loadData();


// ==========================================
// 12. Ping API
// ==========================================

// /ping 可以用來確認伺服器目前有沒有正常運作
app.get('/ping', (req, res) => {

  // 如果伺服器正常，就回傳 pong
  res.send('pong');
});


// ==========================================
// 13. 登入 API
// ==========================================

// 前端使用 POST 方法
// 將帳號密碼送到 /api/login
app.post('/api/login', (req, res) => {

  // 從前端送來的資料中取得帳號與密碼
  const {
    username,
    password
  } = req.body;


  // ----------------------------------------
  // 檢查使用者有沒有輸入帳號密碼
  // ----------------------------------------

  if (!username || !password) {

    // 400 = 使用者送來的資料不完整
    return res.status(400).json({

      // 告訴前端登入失敗
      success: false,

      // 顯示給使用者的訊息
      message: '請輸入帳號與密碼！'
    });
  }


  // ----------------------------------------
  // 暫時建立測試帳號
  // ----------------------------------------

  // ⚠️ 這只是目前測試用
  // 之後會改成真正的帳號資料系統
  const accounts = {

    // -------------------------
    // 管理員帳號
    // -------------------------
    admin: {

      // 管理員密碼
      password: 'admin123',

      // 使用者身份
      role: 'admin'
    },


    // -------------------------
    // 老師帳號
    // -------------------------
    teacher: {

      // 老師密碼
      password: 'teacher123',

      // 使用者身份
      role: 'teacher'
    }
  };


  // ----------------------------------------
  // 尋找使用者輸入的帳號
  // ----------------------------------------

  // 例如使用者輸入 admin
  // 就會取得 accounts.admin
  const account = accounts[username];


  // ----------------------------------------
  // 檢查帳號與密碼
  // ----------------------------------------

  // 如果：
  // ① 找不到帳號
  // 或
  // ② 密碼不正確
  // 就拒絕登入
  if (
    !account ||
    account.password !== password
  ) {

    // 401 = 身份驗證失敗
    return res.status(401).json({

      // 登入失敗
      success: false,

      // 顯示錯誤訊息
      message: '帳號或密碼錯誤！'
    });
  }


  // ----------------------------------------
  // 登入成功
  // ----------------------------------------

  // 將使用者資料存進 Session
  // 讓伺服器記住目前登入的人
  req.session.user = {

    // 儲存帳號
    username: username,

    // 儲存身份
    // admin = 管理員
    // teacher = 老師
    role: account.role
  };


  // ----------------------------------------
  // 回傳登入成功
  // ----------------------------------------

  res.json({

    // 登入成功
    success: true,

    // 給前端的訊息
    message: '登入成功！',

    // 把使用者身份傳回前端
    role: account.role
  });
});


// ==========================================
// 14. 登出 API
// ==========================================

// 前端送出 POST /api/logout
app.post('/api/logout', (req, res) => {

  // 刪除目前使用者的 Session
  req.session.destroy(() => {

    // 清除瀏覽器中的 Session Cookie
    res.clearCookie('connect.sid');

    // 回傳登出成功
    res.json({
      success: true,
      message: '已成功登出'
    });
  });
});


// ==========================================
// 15. 取得機械手臂 8 個格位
// ==========================================

// 前端向這個 API 要求資料時
// 伺服器會回傳目前 8 個格位的狀態
app.get('/api/arm/slots', (req, res) => {

  // 回傳成功
  // 並附上 8 個格位資料
  res.json({
    success: true,
    data: armSlotsStore
  });
});


// ==========================================
// 16. 更新單一格位
// ==========================================

// :id 代表格位編號
// 例如：/api/arm/slot/1
// 就代表第 1 格
app.post('/api/arm/slot/:id', (req, res) => {

  // 取得網址上的格位編號
  const slotId = req.params.id;


  // ----------------------------------------
  // 確認格位是否存在
  // ----------------------------------------

  if (!armSlotsStore[slotId]) {

    // 找不到格位就回傳 404
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

    // trim() 可以去掉前後多餘空白
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

    // 去除借用人姓名前後空白
    const trimmedBorrower =
      borrower.trim();


    // 記錄借用人
    armSlotsStore[slotId].borrower =
      trimmedBorrower;


    // --------------------------------------
    // 如果有借用人
    // 就記錄現在的時間
    // --------------------------------------

    if (trimmedBorrower) {

      armSlotsStore[slotId].borrowTime =
        new Date().toLocaleString(
          'zh-TW',
          {
            timeZone: 'Asia/Taipei'
          }
        );

    } else {

      // 如果借用人被清空
      // 代表鑰匙已經歸還
      armSlotsStore[slotId].borrowTime = '';
    }
  }


  // ----------------------------------------
  // 儲存更新後的資料
  // ----------------------------------------

  saveData(armSlotsStore);


  // 回傳更新成功
  res.json({
    success: true,
    message:
      `格位 ${slotId} 資料已成功更新！`
  });
});


// ==========================================
// 17. 上傳 CSV / Excel
// ==========================================

// 使用者上傳檔案到 /api/arm/upload-csv
app.post(
  '/api/arm/upload-csv',
  upload.single('file'),
  (req, res) => {

    // 確認使用者是否真的有上傳檔案
    if (!req.file) {

      return res.status(400).json({

        success: false,

        message:
          '請選擇 CSV/Excel 檔案'
      });
    }


    try {

      // --------------------------------------
      // 讀取上傳的 Excel / CSV 檔案
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


      // 計算成功更新幾個格位
      let count = 0;


      // --------------------------------------
      // 一列一列處理 Excel / CSV
      // --------------------------------------

      rows.forEach((row) => {

        // 如果這一列不存在
        // 或資料少於兩欄
        // 就跳過
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
        // 如果沒有填，就使用預設名稱
        const keyName =
          row[2]
            ? String(row[2]).trim()
            : `教室 ${slotId} 鑰匙`;


        // 第 4 欄：借用人
        // 如果沒有填，就使用空白
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
        // 更新格位資料
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

          // 如果有人借用
          // 就記錄現在時間
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


        // 成功處理一個格位
        count++;
      });


      // --------------------------------------
      // 儲存更新後的資料
      // --------------------------------------

      saveData(armSlotsStore);


      // 回傳成功
      res.json({

        success: true,

        message:
          `成功更新 ${count} 個格位的對應設定！`
      });


    } catch (err) {

      // 如果 Excel / CSV 解析失敗
      return res.status(500).json({

        success: false,

        message:
          '解析失敗：' + err.message
      });
    }
  }
);


// ==========================================
// 18. 重置所有格位
// ==========================================

// POST /api/arm/reset-all
app.post('/api/arm/reset-all', (req, res) => {

  // 把 8 個格位恢復成預設資料
  armSlotsStore =
    getDefaultSlots();


  // 儲存到 data.json
  saveData(armSlotsStore);


  // 回傳成功
  res.json({

    success: true,

    message:
      '已重置 8 個格位為預設狀態！'
  });
});


// ==========================================
// 19. 啟動伺服器
// ==========================================

// Render 會提供 PORT
// 如果沒有，就使用 10000
const PORT =
  process.env.PORT || 10000;


// 啟動 Express 伺服器
app.listen(
  PORT,
  () => {

    // 在 Render Log 顯示伺服器啟動成功
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
