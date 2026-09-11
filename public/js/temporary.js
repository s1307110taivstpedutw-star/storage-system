// ======================================================
// 臨時教室借還核准 + 機械手臂格位
// temporary.js
// ======================================================

let currentUser = null;
let bookings = [];
let armSlots = [];


// ======================================================
// 頁面初始化
// ======================================================

document.addEventListener("DOMContentLoaded", () => {

  console.log("temporary.js 已載入");

  const identity =
    document.getElementById("identity");

  if (identity) {
    identity.addEventListener(
      "change",
      updateIdentityFields
    );
  }

  updateIdentityFields();

  loadUser();

});


// ======================================================
// 取得目前登入者
// ======================================================

async function loadUser() {

  try {

    const response =
      await fetch("/api/me");

    if (!response.ok) {

      window.location.href =
        "/index.html";

      return;
    }

    const result =
      await response.json();

    if (!result.loggedIn) {

      window.location.href =
        "/index.html";

      return;
    }

    currentUser =
      result.user;

    console.log(
      "目前登入者：",
      currentUser
    );


    // 顯示使用者資訊
    const userInfo =
      document.getElementById(
        "userInfo"
      );

    if (userInfo) {

      userInfo.textContent =
        `目前登入：${currentUser.name}（${
          currentUser.role === "admin"
            ? "管理員"
            : "老師"
        }）`;

    }


    // 載入資料
    await loadBookings();

    await loadArmSlots();


  } catch (error) {

    console.error(
      "loadUser 發生錯誤：",
      error
    );

    alert(
      "系統載入失敗：" +
      error.message
    );

  }

}


// ======================================================
// 身分切換
// ======================================================

function updateIdentityFields() {

  const identity =
    document.getElementById(
      "identity"
    );

  const className =
    document.getElementById(
      "className"
    );

  const studentId =
    document.getElementById(
      "studentId"
    );


  if (
    !identity ||
    !className ||
    !studentId
  ) {

    return;
  }


  // -------------------------------
  // 老師
  // -------------------------------

  if (identity.value === "teacher") {

    className.value = "";

    studentId.value = "";

    className.required = false;

    studentId.required = false;

    className.disabled = true;

    studentId.disabled = true;

    className.placeholder =
      "老師免填";

    studentId.placeholder =
      "老師免填";

  }


  // -------------------------------
  // 學生
  // -------------------------------

  else if (
    identity.value === "student"
  ) {

    className.disabled = false;

    studentId.disabled = false;

    className.required = true;

    studentId.required = true;

    className.placeholder =
      "例如：控制二甲";

    studentId.placeholder =
      "例如：91123456";

  }


  // -------------------------------
  // 尚未選擇
  // -------------------------------

  else {

    className.disabled = false;

    studentId.disabled = false;

    className.required = false;

    studentId.required = false;

    className.placeholder =
      "請先選擇身分";

    studentId.placeholder =
      "請先選擇身分";

  }

}


// ======================================================
// 載入申請列表
// ======================================================

async function loadBookings() {

  try {

    const response =
      await fetch(
        "/api/temporary-bookings"
      );

    const result =
      await response.json();


    if (!result.success) {

      alert(
        result.message ||
        "無法取得申請資料"
      );

      return;
    }


    bookings =
      result.bookings || [];


    // 最新申請排最上面
    bookings.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );


    renderBookings();


  } catch (error) {

    console.error(
      "loadBookings 發生錯誤：",
      error
    );

  }

}


// ======================================================
// 顯示申請列表
// ======================================================

function renderBookings() {

  const table =
    document.getElementById(
      "bookingTable"
    );


  if (!table) {

    console.error(
      "找不到 bookingTable"
    );

    return;
  }


  table.innerHTML = "";


  if (bookings.length === 0) {

    table.innerHTML = `
      <tr>
        <td
          colspan="10"
          style="text-align:center;"
        >
          目前沒有臨時借用申請
        </td>
      </tr>
    `;

    return;
  }


  bookings.forEach(
    booking => {

      const tr =
        document.createElement(
          "tr"
        );


      // 身分
      const identityText =
        booking.identity === "teacher"
          ? "老師"
          : "學生";


      // 狀態
      const statusText =
        booking.statusText ||
        "待審核";


      // 時間
      const timeText =
        `${booking.startTime || "-"}～${
          booking.endTime || "-"
        }`;


      // 操作
      let actionHTML = "";


      if (
        currentUser &&
        currentUser.role === "admin"
      ) {


        // 待審核
        if (
          booking.status ===
          "pending"
        ) {

          actionHTML = `
            <button
              onclick="approveBooking(${booking.id})"
            >
              核准
            </button>

            <button
              onclick="rejectBooking(${booking.id})"
            >
              駁回
            </button>
          `;

        }


        // 已核准
        else if (
          booking.status ===
          "approved"
        ) {

          actionHTML = `
            <button
              onclick="completeBooking(${booking.id})"
            >
              完成借用
            </button>
          `;

        }

      }


      tr.innerHTML = `

        <td>
          ${escapeHTML(statusText)}
        </td>

        <td>
          ${escapeHTML(identityText)}
        </td>

        <td>
          ${escapeHTML(
            booking.className || "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            booking.applicantName || "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            booking.studentId || "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            booking.classroomName || "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            booking.date || "-"
          )}
        </td>

        <td>
          ${escapeHTML(timeText)}
        </td>

        <td>
          ${
            booking.slotId
              ? `第 ${booking.slotId} 格`
              : "-"
          }
        </td>

        <td>
          ${actionHTML}
        </td>

      `;


      table.appendChild(tr);

    }
  );

}


// ======================================================
// 送出申請
// ======================================================

async function submitBooking() {

  console.log(
    "開始送出臨時借用申請"
  );


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


  // ⚠️ 你的 HTML 是 classroom
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


  // ====================================================
  // 驗證
  // ====================================================

  if (!identity) {

    alert(
      "請選擇申請身分"
    );

    return;
  }


  if (!applicantName) {

    alert(
      "請輸入姓名"
    );

    return;
  }


  // 學生才需要班級、學號
  if (identity === "student") {

    if (!className) {

      alert(
        "學生申請請輸入班級"
      );

      return;
    }


    if (!studentId) {

      alert(
        "學生申請請輸入學號"
      );

      return;
    }

  }


  if (!classroomId) {

    alert(
      "請選擇教室"
    );

    return;
  }


  if (!date) {

    alert(
      "請選擇日期"
    );

    return;
  }


  if (!startTime) {

    alert(
      "請選擇開始時間"
    );

    return;
  }


  if (!endTime) {

    alert(
      "請選擇結束時間"
    );

    return;
  }


  if (startTime >= endTime) {

    alert(
      "結束時間必須晚於開始時間"
    );

    return;
  }


  // ====================================================
  // 組資料
  // ====================================================

  const data = {

    identity:

      identity,

    className:

      identity === "student"
        ? className
        : "",

    applicantName:

      applicantName,

    studentId:

      identity === "student"
        ? studentId
        : "",

    classroomId:

      Number(classroomId),

    date:

      date,

    startTime:

      startTime,

    endTime:

      endTime,

    reason:

      reason || ""

  };


  console.log(
    "準備送出的資料：",
    data
  );


  // ====================================================
  // 傳給 server.js
  // ====================================================

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

          body:
            JSON.stringify(data)
        }
      );


    const result =
      await response.json();


    console.log(
      "伺服器回應：",
      result
    );


    if (!result.success) {

      alert(
        result.message ||
        "申請失敗"
      );

      return;
    }


    alert(
      result.message ||
      "申請成功"
    );


    // 清除表單
    resetBookingForm();


    // 更新列表
    await loadBookings();

    await loadArmSlots();


  } catch (error) {

    console.error(
      "submitBooking 發生錯誤：",
      error
    );

    alert(
      "連線失敗，請稍後再試"
    );

  }

}


// ======================================================
// 清除表單
// ======================================================

function resetBookingForm() {

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


  updateIdentityFields();

}


// ======================================================
// 核准
// ======================================================

async function approveBooking(id) {

  if (
    !currentUser ||
    currentUser.role !== "admin"
  ) {

    alert(
      "只有管理員可以核准"
    );

    return;
  }


  const input =
    prompt(
      "請輸入機械手臂格位（1～8）"
    );


  if (input === null) {

    return;
  }


  const slotId =
    Number(input);


  if (
    !Number.isInteger(slotId) ||
    slotId < 1 ||
    slotId > 8
  ) {

    alert(
      "格位必須是 1～8"
    );

    return;
  }


  const ok =
    confirm(
      `確定核准，使用第 ${slotId} 格嗎？`
    );


  if (!ok) {

    return;
  }


  try {

    const response =
      await fetch(
        `/api/temporary-bookings/${id}/approve`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              slotId
            })
        }
      );


    const result =
      await response.json();


    if (!result.success) {

      alert(
        result.message ||
        "核准失敗"
      );

      return;
    }


    alert(
      result.message ||
      "核准成功"
    );


    await loadBookings();

    await loadArmSlots();


  } catch (error) {

    console.error(
      "approveBooking 發生錯誤：",
      error
    );

    alert(
      "連線失敗，請稍後再試"
    );

  }

}


// ======================================================
// 駁回
// ======================================================

async function rejectBooking(id) {

  if (
    !currentUser ||
    currentUser.role !== "admin"
  ) {

    alert(
      "只有管理員可以駁回"
    );

    return;
  }


  const ok =
    confirm(
      "確定要駁回這筆申請嗎？"
    );


  if (!ok) {

    return;
  }


  try {

    const response =
      await fetch(
        `/api/temporary-bookings/${id}/reject`,
        {
          method: "POST"
        }
      );


    const result =
      await response.json();


    if (!result.success) {

      alert(
        result.message ||
        "駁回失敗"
      );

      return;
    }


    alert(
      result.message ||
      "已駁回申請"
    );


    await loadBookings();

    await loadArmSlots();


  } catch (error) {

    console.error(
      "rejectBooking 發生錯誤：",
      error
    );

    alert(
      "連線失敗，請稍後再試"
    );

  }

}


// ======================================================
// 完成借用
// ======================================================

async function completeBooking(id) {

  if (
    !currentUser ||
    currentUser.role !== "admin"
  ) {

    alert(
      "只有管理員可以完成借用"
    );

    return;
  }


  const ok =
    confirm(
      "確定這筆借用已完成嗎？"
    );


  if (!ok) {

    return;
  }


  try {

    const response =
      await fetch(
        `/api/temporary-bookings/${id}/complete`,
        {
          method: "POST"
        }
      );


    const result =
      await response.json();


    if (!result.success) {

      alert(
        result.message ||
        "完成失敗"
      );

      return;
    }


    alert(
      result.message ||
      "借用已完成"
    );


    await loadBookings();

    await loadArmSlots();


  } catch (error) {

    console.error(
      "completeBooking 發生錯誤：",
      error
    );

    alert(
      "連線失敗，請稍後再試"
    );

  }

}


// ======================================================
// 載入機械手臂格位
// ======================================================

async function loadArmSlots() {

  try {

    const response =
      await fetch(
        "/api/arm/slots"
      );


    const result =
      await response.json();


    if (!result.success) {

      console.error(
        "無法取得機械手臂格位"
      );

      return;
    }


    armSlots =
      result.slots || [];


    armSlots.sort(
      (a, b) =>
        Number(a.slotId) -
        Number(b.slotId)
    );


    renderArmSlots();


  } catch (error) {

    console.error(
      "loadArmSlots 發生錯誤：",
      error
    );

  }

}


// ======================================================
// 顯示 8 格機械手臂
// ======================================================

function renderArmSlots() {

  // ⚠️ 你的 HTML 是 slots
  const container =
    document.getElementById(
      "slots"
    );


  if (!container) {

    console.error(
      "找不到 slots"
    );

    return;
  }


  container.innerHTML = "";


  armSlots.forEach(
    slot => {

      const div =
        document.createElement(
          "div"
        );


      const isEmpty =
        slot.status === "空閒";


      div.className =
        isEmpty
          ? "arm-slot empty"
          : "arm-slot occupied";


      div.innerHTML = `

        <div class="slot-title">
          第 ${slot.slotId} 格
        </div>

        <div class="slot-room">
          ${escapeHTML(
            slot.roomName || "-"
          )}
        </div>

        <div class="slot-status">
          ${escapeHTML(
            slot.status || "-"
          )}
        </div>

        <div class="slot-borrower">
          ${
            slot.borrower
              ? escapeHTML(
                  slot.borrower
                )
              : "目前空閒"
          }
        </div>

      `;


      container.appendChild(div);

    }
  );

}


// ======================================================
// HTML 安全處理
// ======================================================

function escapeHTML(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


// ======================================================
// 登出
// ======================================================

async function logout() {

  try {

    await fetch(
      "/api/logout",
      {
        method: "POST"
      }
    );

  } catch (error) {

    console.error(
      "登出錯誤：",
      error
    );

  }


  window.location.href =
    "/index.html";

}


// ======================================================
// 每 10 秒自動更新
// ======================================================

setInterval(
  () => {

    if (currentUser) {

      loadBookings();

      loadArmSlots();

    }

  },
  10000
);
