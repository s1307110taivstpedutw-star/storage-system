// ==========================================
// 鑰匙與冷氣卡機械手臂倉儲管理系統
// server.js
// ==========================================

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');


// ==========================================
// 1. 建立 Express
// ==========================================

const app = express();


// ==========================================
// 2. 檔案上傳
// ==========================================

const upload = multer({
  storage: multer.memoryStorage()
});


// ==========================================
// 3. 接收資料
// ==========================================

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));


// ==========================================
// 4. 前端資料夾
// ==========================================

app.use(express.static(
  path.join(__dirname, 'public')
));


// ==========================================
// 5. Session
// ==========================================

app.use(session({

  secret:
    process.env.SESSION_SECRET ||
    'arm_key_secret_123',

  resave: false,

  saveUninitialized: false,

  cookie: {
    secure: false
  }

}));


// ==========================================
// 6. 資料檔案
// ==========================================

const DATA_FILE =
  path.join(__dirname, 'data.json');


// ==========================================
// 7. 預設機械手臂 8 格
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
// 8. 預設 8 個教室
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
// 9. 預設完整資料
// ==========================================

function getDefaultData() {

  return {

    armSlots:
      getDefaultArmSlots(),

    classrooms:
      getDefaultClassrooms()

  };

}


// ==========================================
// 10. 資料格式整理
// ==========================================

function normalizeData(data) {

  if (!data) {

    return getDefaultData();

  }


  // ----------------------------------------
  // 已經是新版格式
  // ----------------------------------------

  if (
    data.armSlots &&
    data.classrooms
  ) {

    return data;

  }


  // ----------------------------------------
  // 舊版只有機械手臂資料
  // ----------------------------------------

  const armSlots = {};


  for (let i = 1; i <= 8; i++) {

    if (data[i]) {

      armSlots[i] = data[i];

    }

  }


  return {

    armSlots:
      Object.keys(armSlots).length > 0
        ? armSlots
        : getDefaultArmSlots(),

    classrooms:
      getDefaultClassrooms()

  };

}


// ==========================================
// 11. 讀取資料
// ==========================================

function loadData() {

  try {

    if (
      fs.existsSync(DATA_FILE)
    ) {

      const text =
        fs.readFileSync(
          DATA_FILE,
          'utf8'
        );


      const data =
        JSON.parse(text);


      return normalizeData(data);

    }

  } catch (error) {

    console.error(
      '讀取 data.json 失敗：',
      error.message
    );

  }


  return getDefaultData();

}


// ==========================================
// 12. 儲存資料
// ==========================================

function saveData(data) {

  try {

    fs.writeFileSync(

      DATA_FILE,

      JSON.stringify(
        data,
        null,
        2
      ),

      'utf8'

    );


    console.log(
      '資料已儲存'
    );


    return true;

  } catch (error) {

    console.error(
      '儲存 data.json 失敗：',
      error.message
    );


    return false;

  }

}


// ==========================================
// 13. 載入系統資料
// ==========================================

let systemData =
  loadData();


// ==========================================
// 14. Ping
// ==========================================

app.get(
  '/ping',
  (req, res) => {

    res.send('pong');

  }
);


// ==========================================
// 15. 測試帳號
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
// 16. 登入
// ==========================================

app.post(
  '/api/login',
  (req, res) => {

    const {
      username,
      password
    } = req.body;


    if (
      !username ||
      !password
    ) {

      return res.status(400).json({

        success: false,

        message:
          '請輸入帳號與密碼！'

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

        message:
          '帳號或密碼錯誤！'

      });

    }


    req.session.user = {

      username,

      role:
        account.role

    };


    res.json({

      success: true,

      message:
        '登入成功！',

      role:
        account.role

    });

  }
);


// ==========================================
// 17. 取得目前登入者
// ==========================================

app.get(
  '/api/me',
  (req, res) => {

    if (!req.session.user) {

      return res.status(401).json({

        success: false,

        message:
          '尚未登入'

      });

    }


    res.json({

      success: true,

      user:
        req.session.user

    });

  }
);


// ==========================================
// 18. 登出
// ==========================================

app.post(
  '/api/logout',
  (req, res) => {

    req.session.destroy(
      () => {

        res.clearCookie(
          'connect.sid'
        );


        res.json({

          success: true,

          message:
            '已成功登出'

        });

      }
    );

  }
);


// ==========================================
// 19. 登入檢查
// ==========================================

function requireLogin(
  req,
  res,
  next
) {

  if (!req.session.user) {

    return res.status(401).json({

      success: false,

      message:
        '請先登入'

    });

  }


  next();

}


// ==========================================
// 20. 管理員檢查
// ==========================================

function requireAdmin(
  req,
  res,
  next
) {

  if (!req.session.user) {

    return res.status(401).json({

      success: false,

      message:
        '請先登入'

    });

  }


  if (
    req.session.user.role !==
    'admin'
  ) {

    return res.status(403).json({

      success: false,

      message:
        '只有管理員可以執行此操作'

    });

  }


  next();

}


// ==================================================
// ==================================================
//                 教室課表系統
// ==================================================
// ==================================================


// ==========================================
// 21. 取得全部 8 間教室
// ==========================================

app.get(
  '/api/classrooms',
  requireLogin,
  (req, res) => {

    res.json({

      success: true,

      data:
        systemData.classrooms

    });

  }
);


// ==========================================
// 22. 取得單一教室
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

        message:
          '教室編號必須為 1～8'

      });

    }


    res.json({

      success: true,

      data:
        systemData.classrooms[id]

    });

  }
);


// ==========================================
// 23. 修改教室名稱
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

        message:
          '教室編號必須為 1～8'

      });

    }


    const name =
      String(
        req.body.name || ''
      ).trim();


    if (!name) {

      return res.status(400).json({

        success: false,

        message:
          '教室名稱不能為空白'

      });

    }


    systemData.classrooms[id].name =
      name;


    if (
      !saveData(systemData)
    ) {

      return res.status(500).json({

        success: false,

        message:
          '教室名稱儲存失敗'

      });

    }


    res.json({

      success: true,

      message:
        '教室名稱已更新',

      data:
        systemData.classrooms[id]

    });

  }
);


// ==========================================
// 24. 新增課表
// ==========================================
//
// 資料格式：
//
// {
//   className: "控制二甲",
//   weekday: "星期一",
//   startTime: "08:00",
//   endTime: "10:00"
// }
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

        message:
          '教室編號必須為 1～8'

      });

    }


    const className =
      String(
        req.body.className || ''
      ).trim();


    const weekday =
      String(
        req.body.weekday || ''
      ).trim();


    const startTime =
      String(
        req.body.startTime || ''
      ).trim();


    const endTime =
      String(
        req.body.endTime || ''
      ).trim();


    // ----------------------------------------
    // 檢查班級
    // ----------------------------------------

    if (!className) {

      return res.status(400).json({

        success: false,

        message:
          '請輸入班級'

      });

    }


    // ----------------------------------------
    // 檢查星期
    // ----------------------------------------

    if (!weekday) {

      return res.status(400).json({

        success: false,

        message:
          '請輸入星期'

      });

    }


    // ----------------------------------------
    // 檢查時間
    // ----------------------------------------

    if (
      !startTime ||
      !endTime
    ) {

      return res.status(400).json({

        success: false,

        message:
          '請輸入開始與結束時間'

      });

    }


    // ----------------------------------------
    // 建立唯一 ID
    // ----------------------------------------

    const scheduleId =
      Date.now().toString() +
      Math.floor(
        Math.random() * 10000
      ).toString();


    // ----------------------------------------
    // 建立課表
    // ----------------------------------------

    const newSchedule = {

      id:
        scheduleId,

      className:
        className,

      weekday:
        weekday,

      startTime:
        startTime,

      endTime:
        endTime

    };


    // ----------------------------------------
    // 放入指定教室
    // ----------------------------------------

    systemData
      .classrooms[classroomId]
      .schedules
      .push(newSchedule);


    // ----------------------------------------
    // 儲存
    // ----------------------------------------

    if (
      !saveData(systemData)
    ) {

      return res.status(500).json({

        success: false,

        message:
          '課表儲存失敗'

      });

    }


    res.json({

      success: true,

      message:
        '課表新增成功！',

      data:
        newSchedule

    });

  }
);


// ==========================================
// 25. 刪除課表
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
      String(
        req.params.scheduleId
      );


    if (
      isNaN(classroomId) ||
      classroomId < 1 ||
      classroomId > 8
    ) {

      return res.status(400).json({

        success: false,

        message:
          '教室編號錯誤'

      });

    }


    const classroom =
      systemData
        .classrooms[classroomId];


    const before =
      classroom.schedules.length;


    classroom.schedules =
      classroom.schedules.filter(
        schedule =>
          String(schedule.id) !==
          scheduleId
      );


    if (
      classroom.schedules.length ===
      before
    ) {

      return res.status(404).json({

        success: false,

        message:
          '找不到這筆課表'

      });

    }


    if (
      !saveData(systemData)
    ) {

      return res.status(500).json({

        success: false,

        message:
          '刪除後儲存失敗'

      });

    }


    res.json({

      success: true,

      message:
        '課表已刪除'

    });

  }
);


// ==========================================
// 26. 匯入 CSV
// ==========================================
//
// 格式：
//
// 班級,教室,星期,開始時間,結束時間
//
// 例如：
//
// 控制二甲,1,星期一,08:00,10:00
// 電子二甲,2,星期二,10:00,12:00
// ==========================================

app.post(
  '/api/classrooms/import-csv',
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


      let successCount = 0;

      let skipCount = 0;


      // ----------------------------------------
      // CSV 匯入前清空目前 8 間教室課表
      // ----------------------------------------

      for (let i = 1; i <= 8; i++) {

        systemData
          .classrooms[i]
          .schedules = [];

      }


      // ----------------------------------------
      // 逐列讀取
      // ----------------------------------------

      rows.forEach(
        (row, index) => {

          // 第一列標題跳過

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


          const className =
            String(
              row[0] || ''
            ).trim();


          const classroomId =
            parseInt(row[1]);


          const weekday =
            String(
              row[2] || ''
            ).trim();


          const startTime =
            String(
              row[3] || ''
            ).trim();


          const endTime =
            String(
              row[4] || ''
            ).trim();


          if (
            !className ||
            isNaN(classroomId) ||
            classroomId < 1 ||
            classroomId > 8 ||
            !weekday ||
            !startTime ||
            !endTime
          ) {

            skipCount++;

            return;

          }


          const schedule = {

            id:
              Date.now().toString() +
              Math.floor(
                Math.random() * 1000000
              ).toString(),

            className,

            weekday,

            startTime,

            endTime

          };


          systemData
            .classrooms[classroomId]
            .schedules
            .push(schedule);


          successCount++;

        }
      );


      if (
        !saveData(systemData)
      ) {

        return res.status(500).json({

          success: false,

          message:
            'CSV 匯入後儲存失敗'

        });

      }


      res.json({

        success: true,

        message:
          `CSV 匯入完成！成功 ${successCount} 筆，略過 ${skipCount} 筆。`

      });

    } catch (error) {

      console.error(
        'CSV 匯入失敗：',
        error
      );


      res.status(500).json({

        success: false,

        message:
          'CSV 解析失敗：' +
          error.message

      });

    }

  }
);


// ==========================================
// 27. 匯出課表
// ==========================================

app.get(
  '/api/classrooms/export-csv',
  requireLogin,
  (req, res) => {

    const rows = [];


    rows.push([

      '班級',

      '教室',

      '星期',

      '開始時間',

      '結束時間'

    ]);


    for (let i = 1; i <= 8; i++) {

      const classroom =
        systemData.classrooms[i];


      classroom.schedules.forEach(
        schedule => {

          rows.push([

            schedule.className,

            i,

            schedule.weekday,

            schedule.startTime,

            schedule.endTime

          ]);

        }
      );

    }


    const worksheet =
      xlsx.utils.aoa_to_sheet(
        rows
      );


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
//                 機械手臂 8 格
// ==================================================
// ==================================================


// ==========================================
// 28. 取得機械手臂格位
// ==========================================

app.get(
  '/api/arm/slots',
  requireLogin,
  (req, res) => {

    res.json({

      success: true,

      data:
        systemData.armSlots

    });

  }
);


// ==========================================
// 29. 更新機械手臂格位
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

        message:
          '無此格位編號（僅限 1～8）'

      });

    }


    const {
      roomName,
      keyName,
      borrower
    } = req.body;


    if (
      roomName !== undefined
    ) {

      systemData
        .armSlots[slotId]
        .roomName =
        String(roomName).trim();

    }


    if (
      keyName !== undefined
    ) {

      systemData
        .armSlots[slotId]
        .keyName =
        String(keyName).trim();

    }


    if (
      borrower !== undefined
    ) {

      const name =
        String(borrower).trim();


      systemData
        .armSlots[slotId]
        .borrower =
        name;


      if (name) {

        systemData
          .armSlots[slotId]
          .borrowTime =
          new Date().toLocaleString(
            'zh-TW',
            {
              timeZone:
                'Asia/Taipei'
            }
          );

      } else {

        systemData
          .armSlots[slotId]
          .borrowTime = '';

      }

    }


    if (
      !saveData(systemData)
    ) {

      return res.status(500).json({

        success: false,

        message:
          '格位資料儲存失敗'

      });

    }


    res.json({

      success: true,

      message:
        `格位 ${slotId} 已更新`

    });

  }
);


// ==========================================
// 30. 機械手臂 CSV
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
            String(
              row[1] || ''
            ).trim();


          const keyName =
            row[2]
              ? String(row[2]).trim()
              : `教室 ${slotId} 鑰匙`;


          const borrower =
            row[3]
              ? String(row[3]).trim()
              : '';


          systemData.armSlots[slotId] = {

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


      if (
        !saveData(systemData)
      ) {

        return res.status(500).json({

          success: false,

          message:
            '機械手臂資料儲存失敗'

        });

      }


      res.json({

        success: true,

        message:
          `成功更新 ${count} 個格位`

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          '解析失敗：' +
          error.message

      });

    }

  }
);


// ==========================================
// 31. 重置機械手臂
// ==========================================

app.post(
  '/api/arm/reset-all',
  requireAdmin,
  (req, res) => {

    systemData.armSlots =
      getDefaultArmSlots();


    if (
      !saveData(systemData)
    ) {

      return res.status(500).json({

        success: false,

        message:
          '重置失敗'

      });

    }


    res.json({

      success: true,

      message:
        '機械手臂 8 格已重置'

    });

  }
);


// ==========================================
// 32. 啟動
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
