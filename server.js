// ======================================================
// 新增臨時借用申請
// ======================================================

app.post(
  "/api/temporary-bookings",
  requireLogin,
  (req, res) => {

    const {
      identity,
      className,
      applicantName,
      studentId,
      classroomId,
      date,
      startTime,
      endTime,
      reason
    } = req.body;

    const roomId = Number(classroomId);


    // ================================
    // 基本資料整理
    // ================================

    const cleanIdentity =
      String(identity || "").trim();

    const cleanClassName =
      String(className || "").trim();

    const cleanApplicantName =
      String(applicantName || "").trim();

    const cleanStudentId =
      String(studentId || "").trim();

    const cleanReason =
      String(reason || "").trim();


    // ================================
    // 身分檢查
    // ================================

    if (
      cleanIdentity !== "teacher" &&
      cleanIdentity !== "student"
    ) {

      return res.status(400).json({
        success: false,
        message: "請選擇正確的身分"
      });

    }


    // ================================
    // 姓名必填
    // ================================

    if (!cleanApplicantName) {

      return res.status(400).json({
        success: false,
        message: "請輸入姓名"
      });

    }


    // ================================
    // 學生資料檢查
    // ================================

    if (cleanIdentity === "student") {

      if (!cleanClassName) {

        return res.status(400).json({
          success: false,
          message: "學生請填寫班級"
        });

      }

      if (!cleanStudentId) {

        return res.status(400).json({
          success: false,
          message: "學生請填寫學號"
        });

      }

    }


    // ================================
    // 教室、日期、時間檢查
    // ================================

    if (
      !roomId ||
      !date ||
      !startTime ||
      !endTime
    ) {

      return res.status(400).json({
        success: false,
        message: "請完整填寫教室、日期與時間"
      });

    }


    // ================================
    // 教室範圍
    // ================================

    if (
      roomId < 1 ||
      roomId > 8 ||
      !systemData.classrooms[roomId]
    ) {

      return res.status(400).json({
        success: false,
        message: "教室必須選擇 1～8 號教室"
      });

    }


    // ================================
    // 時間檢查
    // ================================

    if (startTime >= endTime) {

      return res.status(400).json({
        success: false,
        message: "結束時間必須晚於開始時間"
      });

    }


    // ================================
    // 檢查時間衝突
    // ================================

    const conflict =
      systemData.temporaryBookings.some(item => {

        if (
          Number(item.classroomId) !== roomId
        ) {
          return false;
        }

        if (item.date !== date) {
          return false;
        }

        if (
          item.status === "rejected" ||
          item.status === "completed"
        ) {
          return false;
        }

        return (
          startTime < item.endTime &&
          endTime > item.startTime
        );

      });


    if (conflict) {

      return res.status(409).json({
        success: false,
        message:
          "此教室在這個時間已有臨時借用申請"
      });

    }


    // ================================
    // 建立申請
    // ================================

    const booking = {

      id: Date.now(),

      // 身分
      identity: cleanIdentity,

      // 班級
      className: cleanClassName,

      // 姓名
      applicantName: cleanApplicantName,

      // 學號
      studentId: cleanStudentId,

      // 教室
      classroomId: roomId,

      classroomName:
        systemData.classrooms[roomId].name,

      // 日期
      date,

      // 時間
      startTime,

      endTime,

      // 原因，可空白
      reason: cleanReason,

      // 系統登入帳號
      applicant:
        req.session.user.username,

      // 狀態
      status: "pending",

      statusText: "待審核",

      // 機械手臂格位
      slotId: null,

      // 時間紀錄
      createdAt:
        new Date().toISOString(),

      approvedAt: null,

      rejectedAt: null

    };


    // ================================
    // 儲存
    // ================================

    systemData.temporaryBookings.push(
      booking
    );

    saveData();


    // ================================
    // 回傳
    // ================================

    res.json({
      success: true,
      booking
    });

  }
);
