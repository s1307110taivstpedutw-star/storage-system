// ===============================
// 臨時教室借用申請
// ===============================
app.post("/api/temporary-bookings", requireLogin, (req, res) => {
  try {
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

    // -------------------------------
    // 基本資料驗證
    // -------------------------------
    if (!identity || !applicantName || !classroomId || !date || !startTime || !endTime) {
      return res.json({
        success: false,
        message: "請填寫完整的必要資料"
      });
    }

    // 身分只能是老師或學生
    if (identity !== "teacher" && identity !== "student") {
      return res.json({
        success: false,
        message: "身分資料錯誤"
      });
    }

    // -------------------------------
    // 學生必須填班級與學號
    // -------------------------------
    if (identity === "student") {
      if (!className || !studentId) {
        return res.json({
          success: false,
          message: "學生申請必須填寫班級與學號"
        });
      }
    }

    // -------------------------------
    // 老師不用填班級與學號
    // -------------------------------
    let finalClassName = "";
    let finalStudentId = "";

    if (identity === "student") {
      finalClassName = className.trim();
      finalStudentId = studentId.trim();
    }

    // -------------------------------
    // 教室編號
    // -------------------------------
    const roomId = Number(classroomId);

    if (!Number.isInteger(roomId) || roomId < 1 || roomId > 8) {
      return res.json({
        success: false,
        message: "教室必須是 1～8 號教室"
      });
    }

    if (!systemData.classrooms[roomId]) {
      return res.json({
        success: false,
        message: "找不到指定教室"
      });
    }

    // -------------------------------
    // 時間檢查
    // -------------------------------
    if (startTime >= endTime) {
      return res.json({
        success: false,
        message: "結束時間必須晚於開始時間"
      });
    }

    // -------------------------------
    // 檢查時間衝突
    // -------------------------------
    const hasConflict = systemData.temporaryBookings.some(item => {
      if (item.classroomId !== roomId) {
        return false;
      }

      if (item.date !== date) {
        return false;
      }

      // 已拒絕或已完成的不算衝突
      if (
        item.status === "rejected" ||
        item.status === "completed"
      ) {
        return false;
      }

      // 判斷時間是否重疊
      return (
        startTime < item.endTime &&
        endTime > item.startTime
      );
    });

    if (hasConflict) {
      return res.json({
        success: false,
        message: "此教室在指定時間已有借用申請，請選擇其他時間"
      });
    }

    // -------------------------------
    // 建立申請
    // -------------------------------
    const booking = {
      id: Date.now(),

      // 老師 / 學生
      identity,

      // 學生才有班級、學號
      className: finalClassName,
      applicantName: applicantName.trim(),
      studentId: finalStudentId,

      // 教室
      classroomId: roomId,
      classroomName: systemData.classrooms[roomId].name,

      // 時間
      date,
      startTime,
      endTime,

      // 原因可以不填
      reason: reason ? reason.trim() : "",

      // 登入帳號
      applicant: req.session.user.username,

      // 狀態
      status: "pending",
      statusText: "待審核",

      // 機械手臂格位
      slotId: null,

      // 時間紀錄
      createdAt: new Date().toISOString(),
      approvedAt: null,
      rejectedAt: null,
      completedAt: null
    };

    systemData.temporaryBookings.push(booking);

    saveData();

    console.log("新增臨時借用申請：", booking);

    return res.json({
      success: true,
      message: "臨時教室借用申請已送出",
      booking
    });

  } catch (error) {
    console.error("新增臨時借用申請失敗：", error);

    return res.status(500).json({
      success: false,
      message: "伺服器發生錯誤"
    });
  }
});
