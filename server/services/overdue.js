const { loadData } = require("../data");

// ========================================
// ⏰ 逾期借用服務
// ========================================
// 專門負責判斷臨時教室借用是否已經逾期。
//
// 本服務目前負責：
// 1. 判斷單筆借用是否逾期
// 2. 找出所有逾期借用
// 3. 回傳逾期檢查結果
// 4. 取得單筆借用的逾期資訊
//
// 注意：
// 1. 本服務只負責「判斷」
// 2. 不直接修改 data.json
// 3. 不使用 setInterval
// 4. 後續由 API / GitHub Actions 呼叫
// ========================================


// ========================================
// 將時間轉換成 Date
// ========================================

function parseDateTime(value) {

  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}


// ========================================
// 建立完整的結束日期時間
// ========================================
//
// booking.date
// 例如：2026-09-16
//
// booking.endTime
// 例如：03:47
//
// 最後組成：
// 2026-09-16T03:47:00
// ========================================

function getBookingEndDateTime(booking) {

  if (
    !booking ||
    !booking.date ||
    !booking.endTime
  ) {
    return null;
  }

  return `${String(booking.date).trim()}T${String(
    booking.endTime
  ).trim()}:00`;
}


// ========================================
// 判斷單筆借用是否逾期
// ========================================

function isBookingOverdue(
  booking,
  now = new Date()
) {

  if (!booking) {
    return false;
  }


  // ======================================
  // 只有「已借出」才需要判斷逾期
  // ======================================

  if (
    booking.status !== "已借出" &&
    booking.status !== "borrowed"
  ) {
    return false;
  }


  // ======================================
  // 建立完整結束時間
  // ======================================

  const endDateTime =
    getBookingEndDateTime(booking);


  if (!endDateTime) {
    return false;
  }


  const endTime =
    parseDateTime(endDateTime);


  if (!endTime) {
    return false;
  }


  // ======================================
  // 比較目前時間與結束時間
  // ======================================

  return (
    endTime.getTime() <
    now.getTime()
  );
}


// ========================================
// 取得所有逾期借用
// ========================================

function getOverdueBookings(
  data = null,
  now = new Date()
) {

  try {

    const systemData =
      data || loadData();


    if (
      !systemData ||
      !Array.isArray(
        systemData.temporaryBookings
      )
    ) {

      return [];

    }


    return systemData.temporaryBookings.filter(
      booking =>
        isBookingOverdue(
          booking,
          now
        )
    );

  } catch (error) {

    console.error(
      "取得逾期借用資料錯誤：",
      error
    );

    return [];

  }
}


// ========================================
// 建立逾期檢查結果
// ========================================

function checkOverdueBookings(
  data = null,
  now = new Date()
) {

  const overdueBookings =
    getOverdueBookings(
      data,
      now
    );


  return {

    success: true,

    checkedAt:
      now.toISOString(),

    total:
      overdueBookings.length,

    bookings:
      overdueBookings

  };

}


// ========================================
// 取得單筆借用的逾期資訊
// ========================================

function getBookingOverdueInfo(
  booking,
  now = new Date()
) {

  if (!booking) {

    return {

      success: false,

      overdue: false,

      message:
        "找不到借用資料"

    };

  }


  // ======================================
  // 建立完整結束時間
  // ======================================

  const endDateTime =
    getBookingEndDateTime(
      booking
    );


  if (!endDateTime) {

    return {

      success: false,

      overdue: false,

      message:
        "日期或結束時間格式錯誤"

    };

  }


  const endTime =
    parseDateTime(
      endDateTime
    );


  if (!endTime) {

    return {

      success: false,

      overdue: false,

      message:
        "結束時間格式錯誤"

    };

  }


  const overdue =
    isBookingOverdue(
      booking,
      now
    );


  const difference =
    now.getTime() -
    endTime.getTime();


  return {

    success: true,

    overdue,

    bookingId:
      booking.id,

    classroom:
      booking.classroomName ||
      booking.classroom ||
      "-",

    date:
      booking.date,

    endTime:
      booking.endTime,

    checkedAt:
      now.toISOString(),

    overdueMinutes:
      overdue
        ? Math.floor(
            difference / 60000
          )
        : 0,

    message:
      overdue
        ? "此借用已逾期"
        : "此借用尚未逾期"

  };

}


// ========================================
// 匯出
// ========================================

module.exports = {

  parseDateTime,

  getBookingEndDateTime,

  isBookingOverdue,

  getOverdueBookings,

  checkOverdueBookings,

  getBookingOverdueInfo

};
