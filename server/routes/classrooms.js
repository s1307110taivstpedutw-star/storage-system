const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");

const {
  loadData,
  saveData
} = require("../data");

const {
  requireLogin,
  requireAdmin
} = require("./auth");

const router = express.Router();


// ============================================================
// 檔案上傳設定
// ============================================================

const upload = multer({
  storage: multer.memoryStorage()
});


// ============================================================
// 取得所有教室
// GET /api/classrooms
// ============================================================

router.get(
  "/classrooms",
  requireLogin,
  (req, res) => {
    try {
      const data = loadData();

      res.json({
        success: true,
        classrooms: data.classrooms
      });

    } catch (error) {
      console.error("取得教室資料錯誤：", error);

      res.status(500).json({
        success: false,
        message: "取得教室資料失敗"
      });
    }
  }
);


// ============================================================
// 取得單一教室
// GET /api/classrooms/:id
// ============================================================

router.get(
  "/classrooms/:id",
  requireLogin,
  (req, res) => {
    try {
      const id = Number(req.params.id);

      const data = loadData();

      const classroom = data.classrooms[id];

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: "找不到教室"
        });
      }

      res.json({
        success: true,
        classroom
      });

    } catch (error) {
      console.error("取得單一教室錯誤：", error);

      res.status(500).json({
        success: false,
        message: "取得教室資料失敗"
      });
    }
  }
);


// ============================================================
// 修改教室名稱
// POST /api/classrooms/:id
// ============================================================

router.post(
  "/classrooms/:id",
  requireAdmin,
  (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        name
      } = req.body;

      const data = loadData();

      const classroom = data.classrooms[id];

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: "找不到教室"
        });
      }

      if (
        !name ||
        !String(name).trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "教室名稱不能為空"
        });
      }

      const newName = String(name).trim();

      classroom.name = newName;


      // --------------------------------------------------------
      // 同步機械手臂格位名稱
      // 教室 1 ↔ 第 1 格
      // 教室 2 ↔ 第 2 格
      // ...
      // 教室 8 ↔ 第 8 格
      // --------------------------------------------------------

      const slot = data.armSlots.find(
        item =>
          Number(item.slotId) === id
      );

      if (slot) {
        slot.roomName = newName;
      }


      saveData(data);

      res.json({
        success: true,
        message: "教室名稱已更新",
        classroom
      });

    } catch (error) {
      console.error("修改教室名稱錯誤：", error);

      res.status(500).json({
        success: false,
        message: "修改教室名稱失敗"
      });
    }
  }
);


// ============================================================
// 新增課表
// POST /api/classrooms/:id/schedules
// ============================================================

router.post(
  "/classrooms/:id/schedules",
  requireAdmin,
  (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        className,
        weekday,
        startTime,
        endTime
      } = req.body;

      const data = loadData();

      const classroom = data.classrooms[id];

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: "找不到教室"
        });
      }


      // --------------------------------------------------------
      // 檢查資料
      // --------------------------------------------------------

      if (
        !className ||
        !weekday ||
        !startTime ||
        !endTime
      ) {
        return res.status(400).json({
          success: false,
          message: "請完整填寫課表資料"
        });
      }


      // --------------------------------------------------------
      // 檢查時間
      // --------------------------------------------------------

      if (startTime >= endTime) {
        return res.status(400).json({
          success: false,
          message: "結束時間必須晚於開始時間"
        });
      }


      // --------------------------------------------------------
      // 建立課表
      // --------------------------------------------------------

      const schedule = {
        id: Date.now(),

        className:
          String(className).trim(),

        weekday:
          String(weekday).trim(),

        startTime:
          String(startTime).trim(),

        endTime:
          String(endTime).trim()
      };


      classroom.schedules.push(schedule);

      saveData(data);


      res.json({
        success: true,
        message: "課表新增成功",
        schedule
      });

    } catch (error) {
      console.error("新增課表錯誤：", error);

      res.status(500).json({
        success: false,
        message: "課表新增失敗"
      });
    }
  }
);


// ============================================================
// 刪除課表
// DELETE /api/classrooms/:classroomId/schedules/:scheduleId
// ============================================================

router.delete(
  "/classrooms/:classroomId/schedules/:scheduleId",
  requireAdmin,
  (req, res) => {
    try {
      const classroomId =
        Number(req.params.classroomId);

      const scheduleId =
        Number(req.params.scheduleId);

      const data = loadData();

      const classroom =
        data.classrooms[classroomId];

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: "找不到教室"
        });
      }


      const before =
        classroom.schedules.length;


      classroom.schedules =
        classroom.schedules.filter(
          schedule =>
            Number(schedule.id) !==
            scheduleId
        );


      if (
        classroom.schedules.length ===
        before
      ) {
        return res.status(404).json({
          success: false,
          message: "找不到指定課表"
        });
      }


      saveData(data);


      res.json({
        success: true,
        message: "課表刪除成功"
      });

    } catch (error) {
      console.error("刪除課表錯誤：", error);

      res.status(500).json({
        success: false,
        message: "課表刪除失敗"
      });
    }
  }
);


// ============================================================
// CSV 匯入
// POST /api/classrooms/import-csv
// ============================================================

router.post(
  "/classrooms/import-csv",
  requireAdmin,
  upload.single("file"),
  (req, res) => {
    try {

      // --------------------------------------------------------
      // 檢查檔案
      // --------------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "請選擇 CSV 檔案"
        });
      }


      // --------------------------------------------------------
      // 讀取 CSV
      // --------------------------------------------------------

      const workbook =
        XLSX.read(
          req.file.buffer,
          {
            type: "buffer"
          }
        );


      const sheetName =
        workbook.SheetNames[0];


      if (!sheetName) {
        return res.status(400).json({
          success: false,
          message: "CSV 檔案沒有資料"
        });
      }


      const worksheet =
        workbook.Sheets[sheetName];


      const rows =
        XLSX.utils.sheet_to_json(
          worksheet
        );


      let imported = 0;


      // --------------------------------------------------------
      // 一筆一筆匯入
      // --------------------------------------------------------

      rows.forEach(
        (row, index) => {

          const className =
            row["班級"] ||
            row["className"] ||
            "";

          const classroomName =
            row["教室"] ||
            row["classroom"] ||
            "";

          const weekday =
            row["星期"] ||
            row["weekday"] ||
            "";

          const startTime =
            row["開始時間"] ||
            row["startTime"] ||
            "";

          const endTime =
            row["結束時間"] ||
            row["endTime"] ||
            "";


          // ------------------------------------------------------
          // 必填欄位檢查
          // ------------------------------------------------------

          if (
            !className ||
            !classroomName ||
            !weekday ||
            !startTime ||
            !endTime
          ) {
            return;
          }


          // ------------------------------------------------------
          // 找教室
          // ------------------------------------------------------

          const classroomId =
            Object.keys(
              data.classrooms
            ).find(
              id => {

                return (
                  String(
                    data.classrooms[id].name
                  ).trim() ===
                  String(
                    classroomName
                  ).trim()
                );

              }
            );


          if (!classroomId) {
            return;
          }


          // ------------------------------------------------------
          // 新增課表
          // ------------------------------------------------------

          data.classrooms[classroomId]
            .schedules
            .push({

              id:
                Date.now() +
                imported +
                index,

              className:
                String(
                  className
                ).trim(),

              weekday:
                String(
                  weekday
                ).trim(),

              startTime:
                String(
                  startTime
                ).trim(),

              endTime:
                String(
                  endTime
                ).trim()

            });


          imported++;

        }
      );


      saveData(data);


      res.json({
        success: true,

        message:
          "CSV 匯入完成，共匯入 " +
          imported +
          " 筆資料",

        imported
      });

    } catch (error) {

      console.error(
        "CSV 匯入錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message: "CSV 匯入失敗"
      });
    }
  }
);


// ============================================================
// CSV 匯出
// GET /api/classrooms/export-csv
// ============================================================

router.get(
  "/classrooms/export-csv",
  requireLogin,
  (req, res) => {
    try {

      const data = loadData();

      const rows = [];


      // --------------------------------------------------------
      // 整理成 CSV 格式
      // --------------------------------------------------------

      Object.values(
        data.classrooms
      ).forEach(
        classroom => {

          classroom.schedules.forEach(
            schedule => {

              rows.push({

                "班級":
                  schedule.className,

                "教室":
                  classroom.name,

                "星期":
                  schedule.weekday,

                "開始時間":
                  schedule.startTime,

                "結束時間":
                  schedule.endTime

              });

            }
          );

        }
      );


      // --------------------------------------------------------
      // 建立 Excel 工作表
      // --------------------------------------------------------

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );


      const workbook =
        XLSX.utils.book_new();


      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "教室課表"
      );


      // --------------------------------------------------------
      // 轉成 CSV
      // --------------------------------------------------------

      const buffer =
        XLSX.write(
          workbook,
          {
            type: "buffer",
            bookType: "csv"
          }
        );


      // --------------------------------------------------------
      // 回傳檔案
      // --------------------------------------------------------

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="classroom_schedule.csv"'
      );

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );


      res.send(buffer);

    } catch (error) {

      console.error(
        "CSV 匯出錯誤：",
        error
      );

      res.status(500).json({
        success: false,
        message: "CSV 匯出失敗"
      });
    }
  }
);


// ============================================================
// 匯出 Router
// ============================================================

module.exports = router;
