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

  // 身分切換
  const identitySelect = document.getElementById("identity");

  if (identitySelect) {
    identitySelect.addEventListener("change", updateIdentityFields);
  }

  // 預設狀態
  updateIdentityFields();

  // 載入使用者
  loadUser();
});


// ======================================================
// 取得目前登入者
// ======================================================

async function loadUser() {

  try {

    const response = await fetch("/api/me");

    if (!response.ok) {
      window.location.href = "/index.html";
      return;
    }

    const result = await response.json();

    if (!result.loggedIn) {
      window.location.href = "/index.html";
      return;
    }

    currentUser = result.user;

    console.log("目前登入者：", currentUser);

    // 顯示帳號
    const usernameElement = document.getElementById("username");

    if (usernameElement) {
      usernameElement.textContent = currentUser.username;
    }

    // 顯示身分
    const roleElement = document.getElementById("role");

    if (roleElement) {
      roleElement.textContent =
        currentUser.role === "admin"
          ? "管理員"
          : "老師";
    }

    // 管理員功能
    const adminOnlyElements =
      document.querySelectorAll(".admin-only");

    adminOnlyElements.forEach(element => {

      if (currentUser.role === "admin") {
        element.style.display = "";
      } else {
        element.style.display = "none";
      }

    });

    // 載入資料
    await loadBookings();
    await loadArmSlots();

  } catch (error) {

    console.error("loadUser 發生錯誤：", error);

    alert("系統載入失敗：" + error.message);
  }
}


// ======================================================
// 身分切換
// 老師：班級、學號不用填
// 學生：班級、學號必填
// ======================================================

function updateIdentityFields() {

  const identityElement =
    document.getElementById("identity");

  const classNameElement =
    document.getElementById("className");

  const studentIdElement =
    document.getElementById("studentId");

  if (!identityElement ||
      !classNameElement ||
      !studentIdElement) {
    return;
  }

  const identity = identityElement.value;

  // -------------------------------
  // 老師
  // -------------------------------

  if (identity === "teacher") {

    classNameElement.value = "";
    studentIdElement.value = "";

    classNameElement.required = false;
    studentIdElement.required = false;

    classNameElement.disabled = true;
    studentIdElement.disabled = true;

    classNameElement.placeholder = "老師免填";
    studentIdElement.placeholder = "老師免填";

  }

  // -------------------------------
  // 學生
  // -------------------------------

  else if (identity === "student") {

    classNameElement.disabled = false;
    studentIdElement.disabled = false;

    classNameElement.required = true;
    studentIdElement.required = true;

    classNameElement.placeholder = "例如：控制二甲";
    studentIdElement.placeholder = "請輸入學號";

  }

  // -------------------------------
  // 尚未選擇
  // -------------------------------

  else {

    classNameElement.disabled = false;
    studentIdElement.disabled = false;

    classNameElement.required = false;
    studentIdElement.required = false;

    classNameElement.placeholder = "請先選擇身分";
    studentIdElement.placeholder = "請先選擇身分";
  }
}


// ======================================================
// 載入臨時借用資料
// ======================================================

async function loadBookings() {

  try {

    const response =
      await fetch("/api/temporary-bookings");

    const result = await response.json();

    if (!result.success) {

      alert(result.message || "無法取得借用資料");

      return;
    }

    bookings = result.bookings || [];

    // 最新申請在前面
    bookings.sort((a, b) => {

      return new Date(b.createdAt) -
             new Date(a.createdAt);

    });

    renderBookings();

  } catch (error) {

    console.error("loadBookings 發生錯誤：", error);

  }
}


// ======================================================
// 顯示借用申請
// ======================================================

function renderBookings() {

  const tbody =
    document.getElementById("bookingTableBody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  if (bookings.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;">
          目前沒有臨時借用申請
        </td>
      </tr>
    `;

    return;
  }

  bookings.forEach(booking => {

    const tr = document.createElement("tr");

    // 身分文字
    const identityText =
      booking.identity === "teacher"
        ? "老師"
        : "學生";

    // 狀態文字
    let statusText =
      booking.statusText || "待審核";

    // 時間
    const timeText =
      `${booking.startTime}～${booking.endTime}`;

    // 操作按鈕
    let actionHTML = "";

    // 管理員才能審核
    if (
      currentUser &&
      currentUser.role === "admin"
    ) {

      if (booking.status === "pending") {

        actionHTML = `
          <button
            onclick="approveBooking(${booking.id})">
            核准
          </button>

          <button
            onclick="rejectBooking(${booking.id})">
            駁回
          </button>
        `;

      }

      else if (
        booking.status === "approved"
      ) {

        actionHTML = `
          <button
            onclick="completeBooking(${booking.id})">
            完成借用
          </button>
        `;

      }

    }

    tr.innerHTML = `
      <td>${escapeHTML(statusText)}</td>

      <td>${escapeHTML(identityText)}</td>

      <td>${escapeHTML(
        booking.className || "-"
      )}</td>

      <td>${escapeHTML(
        booking.applicantName || "-"
      )}</td>

      <td>${escapeHTML(
        booking.studentId || "-"
      )}</td>

      <td>${escapeHTML(
        booking.classroomName || "-"
      )}</td>

      <td>${escapeHTML(
        booking.date || "-"
      )}</td>

      <td>${escapeHTML(timeText)}</td>

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

    tbody.appendChild(tr);

  });
}


// ======================================================
// 送出臨時借用申請
// ======================================================

async function submitBooking() {

  const identity =
    document.getElementById("identity")?.value;

  const className =
    document.getElementById("className")?.value.trim();

  const applicantName =
    document.getElementById("applicantName")?.value.trim();

  const studentId =
    document.getElementById("studentId")?.value.trim();

  const classroomId =
    document.getElementById("classroomId")?.value;

  const date =
    document.getElementById("date")?.value;

  const startTime =
    document.getElementById("startTime")?.value;

  const endTime =
    document.getElementById("endTime")?.value;

  const reason =
    document.getElementById("reason")?.value.trim();


  // ====================================================
  // 前端驗證
  // ====================================================

  if (!identity) {

    alert("請選擇申請身分");

    return;
  }

  if (!applicantName) {

    alert("請輸入姓名");

    return;
  }

  // 學生才需要
  // 班級與學號
  if (identity === "student") {

    if (!className) {

      alert("學生申請請輸入班級");

      return;
    }

    if (!studentId) {

      alert("學生申請請輸入學號");

      return;
    }

  }


  if (!classroomId) {

    alert("請選擇教室");

    return;
  }

  if (!date) {

    alert("請選擇日期");

    return;
  }

  if (!startTime) {

    alert("請選擇開始時間");

    return;
  }

  if (!endTime) {

    alert("請選擇結束時間");

    return;
  }


  // ====================================================
  // 時間檢查
  // ====================================================

  if (startTime >= endTime) {

    alert("結束時間必須晚於開始時間");

    return;
  }


  // ====================================================
  // 組成資料
  // ====================================================

  const data = {

    identity,

    className:
      identity === "student"
        ? className
        : "",

    applicantName,

    studentId:
      identity === "student"
        ? studentId
        : "",

    classroomId: Number(classroomId),

    date,

    startTime,

    endTime,

    reason: reason || ""
  };


  console.log(
    "送出臨時借用資料：",
    data
  );


  // ====================================================
  // 傳送到伺服器
  // ====================================================

  try {

    const response = await fetch(
      "/api/temporary-bookings",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(data)
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


    // ==================================================
    // 成功
    // ==================================================

    alert(
      result.message ||
      "臨時教室借用申請成功"
    );


    // 清除表單
    resetBookingForm();


    // 重新載入資料
    await loadBookings();


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

  const form =
    document.getElementById("bookingForm");

  if (form) {

    form.reset();

  }

  updateIdentityFields();
}


// ======================================================
// 核准借用
// ======================================================

async function approveBooking(id) {

  if (
    !currentUser ||
    currentUser.role !== "admin"
  ) {

    alert("只有管理員可以核准");

    return;
  }


  // ====================================================
  // 選擇機械手臂格位
  // ====================================================

  const slotInput =
    prompt(
      "請輸入機械手臂格位（1～8）"
    );


  if (slotInput === null) {
    return;
  }


  const slotId =
    Number(slotInput);


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


  // ====================================================
  // 確認
  // ====================================================

  const confirmResult =
    confirm(
      `確定核准此申請，並使用第 ${slotId} 格嗎？`
    );


  if (!confirmResult) {
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

          body: JSON.stringify({
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
      "借用申請已核准"
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
// 駁回申請
// ======================================================

async function rejectBooking(id) {

  if (
    !currentUser ||
    currentUser.role !== "admin"
  ) {

    alert("只有管理員可以駁回");

    return;
  }


  const confirmResult =
    confirm(
      "確定要駁回這筆借用申請嗎？"
    );


  if (!confirmResult) {
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
      "申請已駁回"
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

    alert("只有管理員可以完成借用");

    return;
  }


  const confirmResult =
    confirm(
      "確定這筆借用已完成嗎？"
    );


  if (!confirmResult) {
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
        "完成借用失敗"
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


    // 排序
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
// 顯示機械手臂格位
// ======================================================

function renderArmSlots() {

  const container =
    document.getElementById(
      "armSlots"
    );


  if (!container) {
    return;
  }


  container.innerHTML = "";


  armSlots.forEach(slot => {

    const div =
      document.createElement("div");


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
            ? escapeHTML(slot.borrower)
            : "目前空閒"
        }
      </div>

    `;


    container.appendChild(div);

  });
}


// ======================================================
// HTML 安全處理
// ======================================================

function escapeHTML(value) {

  if (value === null ||
      value === undefined) {

    return "";
  }


  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
// 定期更新
// ======================================================

// 每 10 秒更新一次資料
setInterval(() => {

  if (currentUser) {

    loadBookings();
    loadArmSlots();

  }

}, 10000);
