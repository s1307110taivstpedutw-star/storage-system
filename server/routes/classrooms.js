const express = require("express");

const router = express.Router();

const {
  loadData,
  saveData
} = require("../data");


// ============================================================
// 取得全部教室
// GET /api/classrooms
// ============================================================

router.get("/classrooms", (req, res) => {
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
});


// ============================================================
// 取得單一教室
// GET /api/classrooms/:id
// ============================================================

router.get("/classrooms/:id", (req, res) => {
  try {
    const classroomId = Number(req.params.id);

    const data = loadData();

    const classroom = data.classrooms[classroomId];

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: "找不到這間教室"
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
});


// ============================================================
// 修改教室名稱
// POST /api/classrooms/:id
// ============================================================

router.post("/classrooms/:id", (req, res) => {
  try {
    const classroomId = Number(req.params.id);

    const { name } = req.body;

    const data = loadData();

    const classroom = data.classrooms[classroomId];

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: "找不到這間教室"
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "教室名稱不可為空"
      });
    }

    classroom.name = name.trim();


    // --------------------------------------------------------
    // 同步機械手臂格位名稱
    // 教室 1 ↔ 第 1 格
    // 教室 2 ↔ 第 2 格
    // ...
    // 教室 8 ↔ 第 8 格
    // --------------------------------------------------------

    const slot = data.armSlots.find(
      item => item.slotId === classroomId
    );

    if (slot) {
      slot.roomName = classroom.name;
    }


    saveData(data);

    res.json({
      success: true,
      message: "教室名稱修改成功",
      classroom
    });

  } catch (error) {
    console.error("修改教室名稱錯誤：", error);

    res.status(500).json({
      success: false,
      message: "修改教室名稱失敗"
    });
  }
});


// ============================================================
// 新增課表
// POST /api/classrooms/:id/schedules
// ============================================================

router.post("/classrooms/:id/schedules", (req, res) => {
  try {
    const classroomId = Number(req.params.id);

    const {
      className,
      dayOfWeek,
      startTime,
      endTime
    } = req.body;

    const data = loadData();

    const classroom = data.classrooms[classroomId];

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: "找不到這間教室"
      });
    }


    // --------------------------------------------------------
    // 檢查資料
    // --------------------------------------------------------

    if (
      !className ||
      !dayOfWeek ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message: "請完整填寫班級、星期、開始時間與結束時間"
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

      className: className.trim(),

      dayOfWeek,

      startTime,

      endTime
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
});


// ============================================================
// 匯出 Router
// ============================================================

module.exports = router;
