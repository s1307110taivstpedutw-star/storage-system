// ==========================================
// 鑰匙與冷氣卡機械手臂倉儲管理系統
// server.js
// ==========================================


// ==========================================
// 1. 載入需要的套件
// ==========================================

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');


// ==========================================
// 2. 建立 Express 伺服器
// ==========================================

const app = express();


// ==========================================
// 3. 檔案上傳設定
// ==========================================

const upload = multer({
  storage: multer.memoryStorage()
});


// ==========================================
// 4. Express 資料格式
// ==========================================

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));


// ==========================================
// 5. 前端 public 資料夾
// ==========================================

app.use(express.static(
  path.join(__dirname, 'public')
));


// ==========================================
// 6. Session 登入系統
// ==========================================

app.use(session({

  // 正式上線之後可以改成 Render 環境變數
  secret: process.env.SESSION_SECRET || 'arm_key_secret_123',

  resave: false,

  saveUninitialized: false,

  cookie: {
    secure: false
  }

}));


// ==========================================
// 7. 資料檔案
// ==========================================

const DATA_FILE = path.join(
  __dirname,
  'data.json'
);


// ==========================================
// 8. 建立預設機械手臂 8 格
// ==========================================

function getDefaultArmSlots() {

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


// ==========================================
// 9. 建立預設 8 個教室
// ==========================================

function getDefaultClassrooms() {

  const classrooms = {};

  for (let i = 1; i <= 8; i++) {

    classrooms[i] = {

      id: i,

      name: `教室 ${i}`,

      schedules: []

    };

  }

  return classrooms;
}


// ==========================================
// 10. 建立完整預設資料
// ==========================================

function getDefaultData() {

  return {

    armSlots: getDefaultArmSlots(),

    classrooms: getDefaultClassrooms()

  };

}


// ==========================================
// 11. 資料格式整理 / 舊資料轉換
// ==========================================

function normalizeData(data) {

  // ----------------------------------------
  // 如果完全沒有資料
  // ----------------------------------------

  if (!data) {

    return getDefaultData();

  }


  // ----------------------------------------
  // 新格式
  // ----------------------------------------

  if (
    data.armSlots &&
    data.classrooms
  ) {

    return data;

  }


  // ----------------------------------------
  // 舊版本 data.json
  //
  // 舊版本直接把 1～8 格放在最外層
  // 現在把它搬到 armSlots
  // ----------------------------------------

  const oldArmSlots = {};

  for (let i = 1; i <= 8; i++) {

    if (data[i]) {

      oldArmSlots[i] = data[i];

    }

  }


  // 如果舊資料不存在
  // 就建立新的 8 格

  const armSlots =
    Object.keys(oldArmSlots).length > 0
      ? oldArmSlots
      : getDefaultArmSlots();


  return {

    armSlots: armSlots,

    classrooms: getDefaultClassrooms()

  };

}


// ==========================================
// 12. 讀取 data.json
// ==========================================

function loadData() {

  try {

    if (fs.existsSync(DATA_FILE)) {

      const fileData =
        fs.readFileSync(
          DATA_FILE,
          'utf8'
        );


      const parsedData =
        JSON.parse(fileData);


      return normalizeData(parsedData);

    }

  } catch (err) {

    console.error(
      '讀取 data.json 失敗:',
      err.message
    );

  }


  return getDefaultData();

}


// ==========================================
// 13. 儲存 data.json
// ==========================================

function saveData(data) {

  try {

    const jsonData =
      JSON.stringify(
        data,
        null,
        2
      );


    fs.writeFileSync(
      DATA_FILE,
      jsonData,
      'utf8'
    );


    console.log(
      '資料已成功儲存到 data.json'
    );


    return true;

  } catch (err) {

    console.error(
      '寫入 data.json 失敗:',
      err.message
    );


    return false;

  }

}


// ==========================================
// 14. 啟動時讀取資料
// ==========================================

let systemData = loadData();


// ==========================================
// 15. Ping API
// ==========================================

app.get('/ping', (req, res) => {

  res.send('pong');

});


// ==========================================
// 16. 登入驗證
// ==========================================

const accounts = {

  admin: {

    password: 'admin123',

    role: 'admin'

  },

  teacher: {

    password: 'teacher123',

    role: 'teacher'

  }

};


// ==========================================
// 17. 登入 API
// ==========================================

app.post('/api/login', (req, res) => {

  const {
    username,
    password
  } = req.body;


  if (!username || !password) {

    return res.status(400).json({

      success: false,

      message: '請輸入帳號與密碼！'

    });

  }


  const account =
    accounts[username];


  if (
    !account ||
    account.password !== password
  ) {

    return res.status(401).json({

      success: false,

      message: '帳號或密碼錯誤！'

    });

  }


  req.session.user = {

    username: username,

    role: account.role

  };


  res.json({

    success: true,

    message: '登入成功！',

    role: account.role

  });

});


// ==========================================
// 18. 取得目前登入者
// ==========================================

app.get('/api/me', (req, res) => {

  if (!req.session.user) {

    return res.status(401).json({

      success: false,

      message: '尚未登入'

    });

  }


  res.json({

    success: true,

    user: req.session.user

  });

});


// ==========================================
// 19. 登出
// ==========================================

app.post('/api/logout', (req, res) => {

  req.session.destroy(() => {

    res.clearCookie('connect.sid');


    res.json({

      success: true,

      message: '已成功登出'

    });

  });

});


// ==========================================
// 20. 登入檢查 Middleware
// ==========================================

function requireLogin(req, res, next) {

  if (!req.session.user) {

    return res.status(401).json({

      success: false,

      message: '請先登入'

    });

  }


  next();

}


// ==========================================
// 21. 管理員檢查 Middleware
// ==========================================

function requireAdmin(req, res, next) {

  if (!req.session.user) {

    return res.status(401).json({

      success: false,

      message: '請先登入'

    });

  }


  if (
    req.session.user.role !== 'admin'
  ) {

    return res.status(403).json({

      success: false,

      message: '只有管理員可以執行此操作'

    });

  }


  next();

}


// ==================================================
// ==================================================
//                 教室課表 API
// ==================================================
// ==================================================


// ==========================================
// 22. 取得全部 8 個教室
// ==========================================

app.get(
  '/api/classrooms',
  requireLogin,
  (req, res) => {

    res.json({

      success: true,

      data: systemData.classrooms

    });

  }
);


// ==========================================
// 23. 取得單一教室
// ==========================================

app.get(
  '/api/classrooms/:id',
  requireLogin,
  (req, res) => {

    const id =
      parseInt(req.params.id);


    if (
      isNaN(id) ||
      id < 1 ||
      id > 8
    ) {

      return res.status(400).json({

        success: false,

        message: '教室編號必須為 1～8'

      });

    }


    const classroom =
      systemData.classrooms[id];


    res.json({

      success: true,

      data: classroom

    });

  }
);


// ==========================================
// 24. 修改教室名稱
// ==========================================

app.post(
  '/api/classrooms/:id',
  requireAdmin,
  (req, res) => {

    const id =
      parseInt(req.params.id);


    if (
      isNaN(id) ||
      id < 1 ||
      id > 8
    ) {

      return res.status(400).json({

        success: false,

        message: '教室編號必須為 1～8'

      });

    }


    const {
      name
    } = req.body;


    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {

      return res.status(400).json({

        success: false,

        message: '請輸入教室名稱'

      });

    }


    systemData.classrooms[id].name =
      name.trim();


    const saved =
      saveData(systemData);


    if (!saved) {

      return res.status(500).json({

        success: false,

        message: '教室名稱儲存失敗'

      });

    }


    res.json({

      success: true,

      message: `教室 ${id} 名稱已更新`,

      data:
        systemData.classrooms[id]

    });

  }
);


// ==========================================
// 25. 新增課表
// ==========================================

app.post(
  '/api/classrooms/:id/schedules',
  requireAdmin,
  (req, res) => {

    const classroomId =
      parseInt(req.params.id);


    if (
      isNaN(classroomId) ||
      classroomId < 1 ||
      classroomId > 8
    ) {

      return res.status(400).json({

        success: false,

        message: '教室編號必須為 1～8'

      });

    }


    const {
      teacherId,
      weekday,
      borrowTime,
      returnTime
    } = req.body;


    // ----------------------------------------
    // 檢查教師編號
    // ----------------------------------------

    const teacherNumber =
      parseInt(teacherId);


    if (
      isNaN(teacherNumber) ||
      teacherNumber < 1 ||
      teacherNumber > 8
    ) {

      return res.status(400).json({

        success: false,

        message: '教師編號必須為 1～8'

      });

    }


    // ----------------------------------------
    // 檢查星期
    // ----------------------------------------

    if (!weekday) {

      return res.status(400).json({

        success: false,

        message: '請選擇星期'

      });

    }


    // ----------------------------------------
    // 檢查時間
    // ----------------------------------------

    if (
      !borrowTime ||
      !returnTime
    ) {

      return res.status(400).json({

        success: false,

        message: '請輸入借用與歸還時間'

      });

    }


    // ----------------------------------------
    // 建立課表 ID
    // ----------------------------------------

    const scheduleId =
      Date.now().toString() +
      Math.floor(
        Math.random() * 1000
      ).toString();


    // ----------------------------------------
    // 建立課表資料
    // ----------------------------------------

    const newSchedule = {

      id: scheduleId,

      teacherId: teacherNumber,

      weekday: weekday,

      borrowTime: borrowTime,

      returnTime: returnTime

    };


    // ----------------------------------------
    // 放入指定教室
    // ----------------------------------------

    systemData.classrooms[
      classroomId
    ].schedules.push(
      newSchedule
    );


    // ----------------------------------------
    // 寫入 data.json
    // ----------------------------------------

    const saved =
      saveData(systemData);


    if (!saved) {

      return res.status(500).json({

        success: false,

        message: '課表儲存失敗'

      });

    }


    // ----------------------------------------
    // 回傳成功
    // ----------------------------------------

    res.json({

      success: true,

      message: '課表新增成功！',

      data: newSchedule

    });

  }
);


// ==========================================
// 26. 刪除課表
// ==========================================

app.delete(
  '/api/classrooms/:classroomId/schedules/:scheduleId',
  requireAdmin,
  (req, res) => {

    const classroomId =
      parseInt(
        req.params.classroomId
      );


    const scheduleId =
      req.params.scheduleId;


    if (
      isNaN(classroomId) ||
      classroomId < 1 ||
      classroomId > 8
    ) {

      return res.status(400).json({

        success: false,

        message: '教室編號錯誤'

      });

    }


    const schedules =
      systemData.classrooms[
        classroomId
      ].schedules;


    const originalLength =
      schedules.length;


    systemData.classrooms[
      classroomId
    ].schedules =
      schedules.filter(
        schedule =>
          String(schedule.id) !==
          String(scheduleId)
      );


    if (
      systemData.classrooms[
        classroomId
      ].schedules.length ===
      originalLength
    ) {

      return res.status(404).json({

        success: false,

        message: '找不到指定課表'

      });

    }


    const saved =
      saveData(systemData);


    if (!saved) {

      return res.status(500).json({

        success: false,

        message: '課表刪除後儲存失敗'

      });

    }


    res.json({

      success: true,

      message: '課表已刪除'

    });

  }
);


// ==========================================
// 27. 匯入課表 CSV / Excel
// ==========================================
//
// CSV 格式：
//
// 教師編號,教室,星期幾,借用時間,歸還時間
//
// 例如：
//
// 1,1,星期一,08:00,10:00
// 2,3,星期二,10:00,12:00
//
// 教室欄位目前接受 1～8
// ==========================================

app.post(
  '/api/classrooms/import-csv',
  requireAdmin,
  upload.single('file'),
  (req, res) => {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: '請選擇 CSV / Excel 檔案'

      });

    }


    try {

      const workbook =
        xlsx.read(
          req.file.buffer,
          {
            type: 'buffer'
          }
        );


      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];


      const rows =
        xlsx.utils.sheet_to_json(
          sheet,
          {
            header: 1
          }
        );


      let successCount = 0;

      let skipCount = 0;


      // ----------------------------------------
      // 清除原本課表
      // ----------------------------------------

      for (let i = 1; i <= 8; i++) {

        systemData.classrooms[i]
          .schedules = [];

      }


      // ----------------------------------------
      // 逐列讀取
      // ----------------------------------------

      rows.forEach(
        (row, index) => {

          // 第一列通常是標題
          if (index === 0) {

            return;

          }


          if (
            !row ||
            row.length < 5
          ) {

            skipCount++;

            return;

          }


          const teacherId =
            parseInt(row[0]);


          const classroomId =
            parseInt(row[1]);


          const weekday =
            String(row[2] || '').trim();


          const borrowTime =
            String(row[3] || '').trim();


          const returnTime =
            String(row[4] || '').trim();


          // --------------------------------------
          // 驗證資料
          // --------------------------------------

          if (
            isNaN(teacherId) ||
            teacherId < 1 ||
            teacherId > 8
          ) {

            skipCount++;

            return;

          }


          if (
            isNaN(classroomId) ||
            classroomId < 1 ||
            classroomId > 8
          ) {

            skipCount++;

            return;

          }


          if (
            !weekday ||
            !borrowTime ||
            !returnTime
          ) {

            skipCount++;

            return;

          }


          // --------------------------------------
          // 建立課表
          // --------------------------------------

          const schedule = {

            id:
              Date.now().toString() +
              Math.floor(
                Math.random() * 100000
              ).toString(),

            teacherId: teacherId,

            weekday: weekday,

            borrowTime: borrowTime,

            returnTime: returnTime

          };


          systemData.classrooms[
            classroomId
          ].schedules.push(
            schedule
          );


          successCount++;

        }
      );


      // ----------------------------------------
      // 儲存
      // ----------------------------------------

      const saved =
        saveData(systemData);


      if (!saved) {

        return res.status(500).json({

          success: false,

          message: 'CSV 匯入後儲存失敗'

        });

      }


      res.json({

        success: true,

        message:
          `CSV 匯入完成！成功 ${successCount} 筆，略過 ${skipCount} 筆。`

      });

    } catch (err) {

      console.error(
        'CSV 匯入錯誤:',
        err
      );


      res.status(500).json({

        success: false,

        message:
          'CSV / Excel 解析失敗：' +
          err.message

      });

    }

  }
);


// ==========================================
// 28. 匯出課表 CSV
// ==========================================

app.get(
  '/api/classrooms/export-csv',
  requireLogin,
  (req, res) => {

    const rows = [];


    // CSV 標題
    rows.push([

      '教師編號',

      '教室',

      '星期幾',

      '借用時間',

      '歸還時間'

    ]);


    // ----------------------------------------
    // 8 間教室逐一輸出
    // ----------------------------------------

    for (let i = 1; i <= 8; i++) {

      const classroom =
        systemData.classrooms[i];


      classroom.schedules.forEach(
        schedule => {

          rows.push([

            schedule.teacherId,

            i,

            schedule.weekday,

            schedule.borrowTime,

            schedule.returnTime

          ]);

        }
      );

    }


    const worksheet =
      xlsx.utils.aoa_to_sheet(rows);


    const workbook =
      xlsx.utils.book_new();


    xlsx.utils.book_append_sheet(
      workbook,
      worksheet,
      '教室課表'
    );


    const buffer =
      xlsx.write(
        workbook,
        {
          type: 'buffer',
          bookType: 'csv'
        }
      );


    res.setHeader(
      'Content-Type',
      'text/csv; charset=utf-8'
    );


    res.setHeader(
      'Content-Disposition',
      'attachment; filename="classroom_schedule.csv"'
    );


    res.send(buffer);

  }
);


// ==================================================
// ==================================================
//                 機械手臂 8 格 API
// ==================================================
// ==================================================


// ==========================================
// 29. 取得機械手臂 8 格
// ==========================================

app.get(
  '/api/arm/slots',
  requireLogin,
  (req, res) => {

    res.json({

      success: true,

      data: systemData.armSlots

    });

  }
);


// ==========================================
// 30. 更新單一機械手臂格位
// ==========================================

app.post(
  '/api/arm/slot/:id',
  requireAdmin,
  (req, res) => {

    const slotId =
      req.params.id;


    if (
      !systemData.armSlots[slotId]
    ) {

      return res.status(404).json({

        success: false,

        message: '無此格位編號（僅限 1～8）'

      });

    }


    const {
      roomName,
      keyName,
      borrower
    } = req.body;


    // ----------------------------------------
    // 修改教室名稱
    // ----------------------------------------

    if (
      roomName !== undefined
    ) {

      systemData.armSlots[
        slotId
      ].roomName =
        String(roomName).trim();

    }


    // ----------------------------------------
    // 修改鑰匙名稱
    // ----------------------------------------

    if (
      keyName !== undefined
    ) {

      systemData.armSlots[
        slotId
      ].keyName =
        String(keyName).trim();

    }


    // ----------------------------------------
    // 修改借用人
    // ----------------------------------------

    if (
      borrower !== undefined
    ) {

      const trimmedBorrower =
        String(borrower).trim();


      systemData.armSlots[
        slotId
      ].borrower =
        trimmedBorrower;


      if (trimmedBorrower) {

        systemData.armSlots[
          slotId
        ].borrowTime =
          new Date().toLocaleString(
            'zh-TW',
            {
              timeZone:
                'Asia/Taipei'
            }
          );

      } else {

        systemData.armSlots[
          slotId
        ].borrowTime = '';

      }

    }


    const saved =
      saveData(systemData);


    if (!saved) {

      return res.status(500).json({

        success: false,

        message: '格位資料儲存失敗'

      });

    }


    res.json({

      success: true,

      message:
        `格位 ${slotId} 資料已成功更新！`

    });

  }
);


// ==========================================
// 31. 機械手臂 CSV / Excel
// ==========================================

app.post(
  '/api/arm/upload-csv',
  requireAdmin,
  upload.single('file'),
  (req, res) => {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message:
          '請選擇 CSV / Excel 檔案'

      });

    }


    try {

      const workbook =
        xlsx.read(
          req.file.buffer,
          {
            type: 'buffer'
          }
        );


      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];


      const rows =
        xlsx.utils.sheet_to_json(
          sheet,
          {
            header: 1
          }
        );


      let count = 0;


      rows.forEach(
        (row) => {

          if (
            !row ||
            row.length < 2
          ) {

            return;

          }


          const slotId =
            parseInt(row[0]);


          if (
            isNaN(slotId) ||
            slotId < 1 ||
            slotId > 8
          ) {

            return;

          }


          const roomName =
            String(row[1]).trim();


          const keyName =
            row[2]
              ? String(row[2]).trim()
              : `教室 ${slotId} 鑰匙`;


          const borrower =
            row[3]
              ? String(row[3]).trim()
              : '';


          systemData.armSlots[
            slotId
          ] = {

            slotId,

            roomName,

            keyName,

            borrower,

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


          count++;

        }
      );


      const saved =
        saveData(systemData);


      if (!saved) {

        return res.status(500).json({

          success: false,

          message: '機械手臂資料儲存失敗'

        });

      }


      res.json({

        success: true,

        message:
          `成功更新 ${count} 個格位的對應設定！`

      });

    } catch (err) {

      res.status(500).json({

        success: false,

        message:
          '解析失敗：' +
          err.message

      });

    }

  }
);


// ==========================================
// 32. 重置機械手臂 8 格
// ==========================================

app.post(
  '/api/arm/reset-all',
  requireAdmin,
  (req, res) => {

    systemData.armSlots =
      getDefaultArmSlots();


    const saved =
      saveData(systemData);


    if (!saved) {

      return res.status(500).json({

        success: false,

        message: '重置後儲存失敗'

      });

    }


    res.json({

      success: true,

      message:
        '已重置 8 個格位為預設狀態！'

    });

  }
);


// ==========================================
// 33. 啟動伺服器
// ==========================================

const PORT =
  process.env.PORT || 10000;


app.listen(
  PORT,
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);
