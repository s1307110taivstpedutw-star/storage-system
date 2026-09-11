async function submitBooking() {

  const identity =
    document.getElementById(
      "identity"
    ).value;


  const className =
    document.getElementById(
      "className"
    ).value.trim();


  const applicantName =
    document.getElementById(
      "applicantName"
    ).value.trim();


  const studentId =
    document.getElementById(
      "studentId"
    ).value.trim();


  const classroomId =
    document.getElementById(
      "classroom"
    ).value;


  const date =
    document.getElementById(
      "date"
    ).value;


  const startTime =
    document.getElementById(
      "startTime"
    ).value;


  const endTime =
    document.getElementById(
      "endTime"
    ).value;


  const reason =
    document.getElementById(
      "reason"
    ).value.trim();


  // ================================
  // 身分必填
  // ================================

  if (!identity) {

    alert("請選擇身分");

    return;

  }


  // ================================
  // 姓名必填
  // ================================

  if (!applicantName) {

    alert("請輸入姓名");

    return;

  }


  // ================================
  // 學生才需要班級、學號
  // ================================

  if (identity === "student") {

    if (!className) {

      alert("學生請填寫班級");

      return;

    }

    if (!studentId) {

      alert("學生請填寫學號");

      return;

    }

  }


  // ================================
  // 基本資料
  // ================================

  if (
    !classroomId ||
    !date ||
    !startTime ||
    !endTime
  ) {

    alert(
      "請完整填寫教室、日期與時間"
    );

    return;

  }


  // ================================
  // 時間檢查
  // ================================

  if (startTime >= endTime) {

    alert(
      "結束時間必須晚於開始時間"
    );

    return;

  }


  try {

    const response =
      await fetch(
        "/api/temporary-bookings",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            identity,

            className,

            applicantName,

            studentId,

            classroomId,

            date,

            startTime,

            endTime,

            reason

          })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      alert(
        data.message ||
        "申請失敗"
      );

      return;

    }


    alert(
      "臨時借用申請已送出，等待管理員審核。"
    );


    // ================================
    // 清空表單
    // ================================

    document.getElementById(
      "identity"
    ).value = "";


    document.getElementById(
      "className"
    ).value = "";


    document.getElementById(
      "applicantName"
    ).value = "";


    document.getElementById(
      "studentId"
    ).value = "";


    document.getElementById(
      "classroom"
    ).value = "";


    document.getElementById(
      "date"
    ).value = "";


    document.getElementById(
      "startTime"
    ).value = "";


    document.getElementById(
      "endTime"
    ).value = "";


    document.getElementById(
      "reason"
    ).value = "";


    await loadBookings();


  } catch (error) {

    console.error(
      "送出申請錯誤：",
      error
    );

    alert(
      "無法連線到伺服器"
    );

  }

}
