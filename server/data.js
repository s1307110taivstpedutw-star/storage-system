const fs = require("fs");
const path = require("path");


/* ==================================================
   資料檔案
   ================================================== */

const DATA_FILE =
  path.join(
    __dirname,
    "..",
    "data.json"
  );


/* ==================================================
   預設機械手臂 8 格
   ================================================== */

function getDefaultArmSlots() {

  const armSlots = {};

  for (
    let i = 1;
    i <= 8;
    i++
  ) {

    armSlots[i] = {

      slotId: i,

      roomName:
        `教室 ${i}`,

      keyName:
        "",

      borrower:
        "",

      borrowTime:
        "",

      status:
        "未借出",

      bookingId:
        null

    };

  }

  return armSlots;

}


/* ==================================================
   預設 8 間教室
   ================================================== */

function getDefaultClassrooms() {

  const classrooms = {};

  for (
    let i = 1;
    i <= 8;
    i++
  ) {

    classrooms[i] = {

      id: i,

      name:
        `教室 ${i}`,

      schedules:
        []

    };

  }

  return classrooms;

}


/* ==================================================
   預設帳號
   ================================================== */

function getDefaultAccounts() {

  return {

    admin: {

      username:
        "admin",

      password:
        "admin123",

      role:
        "admin",

      name:
        "系統管理員"

    },

    teacher: {

      username:
        "teacher",

      password:
        "teacher123",

      role:
        "teacher",

      name:
        "教師"

    }

  };

}


/* ==================================================
   預設系統資料
   ================================================== */

function getDefaultData() {

  return {

    armSlots:
      getDefaultArmSlots(),

    classrooms:
      getDefaultClassrooms(),

    temporaryBookings:
      [],

    accounts:
      getDefaultAccounts()

  };

}


/* ==================================================
   有效的機械手臂狀態
   ================================================== */

const validStatuses = [

  "未借出",

  "已核准／待執行",

  "已借出",

  "已逾期歸還"

];


/* ==================================================
   資料格式整理
   ================================================== */

function normalizeData(
  data
) {

  const defaultData =
    getDefaultData();


  if (
    !data ||
    typeof data !== "object"
  ) {

    return defaultData;

  }


  /* armSlots */

  if (
    !data.armSlots
  ) {

    data.armSlots =
      defaultData.armSlots;

  }


  /* classrooms */

  if (
    !data.classrooms
  ) {

    data.classrooms =
      defaultData.classrooms;

  }


  /* temporaryBookings */

  if (
    !Array.isArray(
      data.temporaryBookings
    )
  ) {

    data.temporaryBookings =
      [];

  }


  /* accounts */

  if (
    !data.accounts ||
    typeof data.accounts !==
      "object"
  ) {

    data.accounts =
      defaultData.accounts;

  }


  /* ==================================================
     確保 1～8 格都存在
     ================================================== */

  for (
    let i = 1;
    i <= 8;
    i++
  ) {

    if (
      !data.armSlots[i]
    ) {

      data.armSlots[i] =
        defaultData.armSlots[i];

    }


    if (
      !data.classrooms[i]
    ) {

      data.classrooms[i] =
        defaultData.classrooms[i];

    }


    if (
      !Array.isArray(
        data.classrooms[i]
          .schedules
      )
    ) {

      data.classrooms[i]
        .schedules = [];

    }


    /*
      舊版空閒
      → 新版未借出
    */

    if (
      data.armSlots[i].status ===
      "空閒"
    ) {

      data.armSlots[i].status =
        "未借出";

    }


    /*
      舊版借用中
      → 不直接視為已借出
    */

    if (
      data.armSlots[i].status ===
      "借用中"
    ) {

      data.armSlots[i].status =
        "未借出";

    }


    /*
      ★ 新增：

      已逾期歸還

      必須保留，
      不能再被正規化成未借出。
    */

    if (
      !validStatuses.includes(
        data.armSlots[i].status
      )
    ) {

      data.armSlots[i].status =
        "未借出";

    }


    if (
      !(
        "bookingId"
        in data.armSlots[i]
      )
    ) {

      data.armSlots[i].bookingId =
        null;

    }

  }


  /* ==================================================
     同步教室名稱
     ================================================== */

  for (
    let i = 1;
    i <= 8;
    i++
  ) {

    if (
      data.armSlots[i]
    ) {

      data.armSlots[i].roomName =
        data.classrooms[i].name ||
        `教室 ${i}`;

    }

  }


  /* ==================================================
     整理帳號
     ================================================== */

  Object.keys(
    data.accounts
  ).forEach(
    username => {

      const account =
        data.accounts[
          username
        ];


      if (
        !account ||
        typeof account !==
          "object"
      ) {

        delete data.accounts[
          username
        ];

        return;

      }


      if (
        !account.username
      ) {

        account.username =
          username;

      }


      if (
        !account.role
      ) {

        account.role =
          "teacher";

      }


      if (
        !account.name
      ) {

        account.name =
          username;

      }

    }
  );


  /*
    確保基本 admin / teacher
    存在。
  */

  if (
    !data.accounts.admin
  ) {

    data.accounts.admin =
      defaultData.accounts.admin;

  }


  if (
    !data.accounts.teacher
  ) {

    data.accounts.teacher =
      defaultData.accounts.teacher;

  }


  return data;

}


/* ==================================================
   載入資料
   ================================================== */

function loadData() {

  try {

    if (
      !fs.existsSync(
        DATA_FILE
      )
    ) {

      const newData =
        getDefaultData();


      fs.writeFileSync(

        DATA_FILE,

        JSON.stringify(
          newData,
          null,
          2
        ),

        "utf8"

      );


      return newData;

    }


    const raw =
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      );


    if (
      !raw.trim()
    ) {

      const newData =
        getDefaultData();


      fs.writeFileSync(

        DATA_FILE,

        JSON.stringify(
          newData,
          null,
          2
        ),

        "utf8"

      );


      return newData;

    }


    const data =
      JSON.parse(
        raw
      );


    const normalized =
      normalizeData(
        data
      );


    /*
      如果資料結構有新增，
      順便寫回 data.json。
    */

    fs.writeFileSync(

      DATA_FILE,

      JSON.stringify(
        normalized,
        null,
        2
      ),

      "utf8"

    );


    return normalized;

  } catch (error) {

    console.error(
      "讀取 data.json 失敗：",
      error
    );


    return getDefaultData();

  }

}


/* ==================================================
   儲存資料
   ================================================== */

function saveData(
  data
) {

  try {

    const normalized =
      normalizeData(
        data
      );


    fs.writeFileSync(

      DATA_FILE,

      JSON.stringify(
        normalized,
        null,
        2
      ),

      "utf8"

    );


    return true;

  } catch (error) {

    console.error(
      "寫入 data.json 失敗：",
      error
    );


    return false;

  }

}


/* ==================================================
   匯出
   ================================================== */

module.exports = {

  loadData,

  saveData,

  normalizeData

};
