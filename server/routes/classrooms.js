const express = require("express");

const router = express.Router();

const {
  loadData,
  saveData
} = require("../data");


// ==============================
// 取得全部教室
// GET /api/classrooms
// ==============================

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


// ==============================
// 取得單一教室
// GET /api/classrooms/:id
// ==============================

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


module.exports = router;
