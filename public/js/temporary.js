let currentUser = null;
let bookings = [];
let slots = [];

/* =========================
   頁面初始化
   ========================= */

document.addEventListener("DOMContentLoaded", () => {

  const identity = document.getElementById("identity");

  if (identity) {
    identity.addEventListener("change", updateIdentityFields);
  }

  updateIdentityFields();

  loadUser();
});


/* =========================
   取得登入者
   ========================= */

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

    document.getElementById("userInfo").textContent =
      `目前登入：${currentUser.name}（${currentUser.role === "admin" ? "管理員" : "老師"}）`;

    await loadBookings();
    await loadSlots();

  } catch (error) {

    console.error("loadUser 發生錯誤：", error);

    alert("系統載入失敗：" + error.message);
  }
}


/* =========================
   身分欄位控制
   ========================= */

function updateIdentityFields() {

  const identity = document.getElementById("identity");

  const className = document.getElementById("className");

  const studentId = document.getElementById("studentId");

  if (!identity || !className || !studentId) {
    return;
  }

  if (identity.value === "teacher") {

    className.value = "";
    studentId.value = "";

    className.disabled = true;
    studentId.disabled = true;

    className.placeholder = "老師免填";
    studentId.placeholder = "老師免填";

  } else if (identity.value === "student") {

    className.disabled = false;
    studentId.disabled = false;

    className.placeholder = "例如：控制二甲";
    studentId.placeholder = "例如：91123456";

  } else {

    className.disabled = false;
    studentId.disabled = false;

    className.placeholder = "請先選擇身分";
    studentId.placeholder = "請先選擇身分";
  }
}


/* =========================
   載入申請資料
   ========================= */

async function loadBookings() {

  try {

    const response = await fetch("/api/temporary-bookings");

    const result = await response.json();

    if (!result.success) {

      alert(result.message || "無法取得申請資料");

      return;
    }

    bookings = result.bookings || [];

    bookings.sort((a, b) => {

      return new Date(b.createdAt || 0) -
             new Date(a.createdAt || 0);

    });

    renderBookings();

  } catch (error) {

    console.error("loadBookings 發生錯誤：", error);

  }
}


/* =========================
   顯示申請列表
   ========================= */

function renderBookings() {

  const table = document.getElementById("bookingTable");

  if (!table) {
    return;
  }

  table.innerHTML = "";

  if (bookings.length === 0) {

    table.innerHTML = `
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

    const identityText =
      booking.identity === "teacher"
        ? "老師"
        : "學生";

    let actionHTML = "-";

    if (
      currentUser &&
      currentUser.role === "admin" &&
      booking.status === "pending"
    ) {

      actionHTML = `
        <button
          class="btn-primary"
          onclick="approveBooking(${booking.id})"
        >
          核准
        </button>

        <button
          class="btn-danger"
          onclick="rejectBooking(${booking.id})"
        >
          駁回
        </button>
      `;

    } else if (
      currentUser &&
      currentUser.role === "admin" &&
      booking.status === "approved"
    ) {

      actionHTML = `
        <button
          class="btn-success"
          onclick="completeBooking(${booking.id})"
        >
          完成借還
        </button>
      `;
    }

    const slotText =
      booking.slotId
        ? `第 ${booking.slotId} 格`
        : "尚未分配";

    tr.innerHTML = `
      <td>${escapeHTML(booking.statusText || booking.status || "")}</td>

      <td>${escapeHTML(identityText)}</td>

      <td>${escapeHTML(booking.className || "-")}</td>

      <td>${escapeHTML(booking.applicantName || "-")}</td>

      <td>${escapeHTML(booking.studentId || "-")}</td>

      <td>${escapeHTML(booking.classroomName || "-")}</td>

      <td>${escapeHTML(booking.date || "-")}</td>

      <td>
        ${escapeHTML(booking.startTime || "")}
        -
        ${escapeHTML(booking.endTime || "")}
      </td>

      <td>${escapeHTML(slotText)}</td>

      <td>${actionHTML}</td>
    `;

    table.appendChild(tr);

  });
}


/* =========================
   送出申請
   ========================= */

async function submitBooking() {

  const identity =
    document.getElementById("identity").value;

  const className =
    document.getElementById("className").value.trim();

  const applicantName =
    document.getElementById("applicantName").value.trim();

  const studentId =
    document.getElementById("studentId").value.trim();

  const classroomId =
    document.getElementById("classroom").value;

  const date =
    document.getElementById("date").value;

  const startTime =
    document.getElementById("startTime").value;

  const endTime =
    document.getElementById("endTime").value;

  const reason =
    document.getElementById("reason").value.trim();


  /* =========================
     前端基本檢查
     ========================= */

  if (!identity) {

    alert("請選擇身分");

    return;
  }


  if (!applicantName) {

    alert("請輸入姓名");

    return;
  }


  if (identity === "student") {

    if (!className) {

      alert("學生必須填寫班級");

      return;
    }

    if (!studentId) {

      alert("學生必須填寫學號");

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


  if (!startTime || !endTime) {

    alert("請設定開始與結束時間");

    return;
  }


  if (startTime >= endTime) {

    alert("結束時間必須晚於開始時間");

    return;
  }


  /* =========================
     傳送資料
     ========================= */

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

    classroomId,

    date,

    startTime,

    endTime,

    reason
  };


  try {

    const response = await fetch(
      "/api/temporary-bookings",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(data)
      }
    );


    const result = await response.json();


    if (!result.success) {

      alert(result.message || "申請失敗");

      return;
    }


    alert("臨時借用申請已送出！");


    /* 清除表單 */

    document.getElementById("identity").value = "";

    document.getElementById("className").value = "";

    document.getElementById("applicantName").value = "";

    document.getElementById("studentId").value = "";

    document.getElementById("classroom").value = "";

    document.getElementById("date").value = "";

    document.getElementById("startTime").value = "";

    document.getElementById("endTime").value = "";

    document.getElementById("reason").value = "";


    updateIdentityFields();

    await loadBookings();

  } catch (error) {

    console.error("submitBooking 發生錯誤：", error);

    alert("連線失敗：" + error.message);
  }
}


/* =========================
   核准申請
   ========================= */

async function approveBooking(id) {

  const slotId = prompt(
    "請輸入機械手臂格位（1～8）"
  );


  if (slotId === null) {
    return;
  }


  const slotNumber = Number(slotId);


  if (
    !Number.isInteger(slotNumber) ||
    slotNumber < 1 ||
    slotNumber > 8
  ) {

    alert("格位必須是 1～8");

    return;
  }


  try {

    const response = await fetch(
      `/api/temporary-bookings/${id}/approve`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          slotId: slotNumber
        })
      }
    );


    const result = await response.json();


    if (!result.success) {

      alert(result.message || "核准失敗");

      return;
    }


    alert("申請已核准");

    await loadBookings();
    await loadSlots();

  } catch (error) {

    console.error("approveBooking 發生錯誤：", error);

    alert("連線失敗：" + error.message);
  }
}


/* =========================
   駁回申請
   ========================= */

async function rejectBooking(id) {

  const ok = confirm(
    "確定要駁回這筆申請嗎？"
  );


  if (!ok) {
    return;
  }


  try {

    const response = await fetch(
      `/api/temporary-bookings/${id}/reject`,
      {
        method: "POST"
      }
    );


    const result = await response.json();


    if (!result.success) {

      alert(result.message || "駁回失敗");

      return;
    }


    alert("申請已駁回");

    await loadBookings();

  } catch (error) {

    console.error("rejectBooking 發生錯誤：", error);

    alert("連線失敗：" + error.message);
  }
}


/* =========================
   完成借還
   ========================= */

async function completeBooking(id) {

  const ok = confirm(
    "確定這筆借用已完成借還嗎？"
  );


  if (!ok) {
    return;
  }


  try {

    const response = await fetch(
      `/api/temporary-bookings/${id}/complete`,
      {
        method: "POST"
      }
    );


    const result = await response.json();


    if (!result.success) {

      alert(result.message || "操作失敗");

      return;
    }


    alert("借還已完成");

    await loadBookings();
    await loadSlots();

  } catch (error) {

    console.error("completeBooking 發生錯誤：", error);

    alert("連線失敗：" + error.message);
  }
}


/* =========================
   載入機械手臂格位
   ========================= */

async function loadSlots() {

  try {

    const response = await fetch(
      "/api/arm/slots"
    );

    const result = await response.json();


    if (!result.success) {

      console.error(
        result.message || "無法取得機械手臂格位"
      );

      return;
    }


    slots = result.slots || [];

    slots.sort((a, b) =>
      Number(a.slotId) - Number(b.slotId)
    );

    renderSlots();

  } catch (error) {

    console.error("loadSlots 發生錯誤：", error);

  }
}


/* =========================
   顯示機械手臂格位
   ========================= */

function renderSlots() {

  const container =
    document.getElementById("slots");


  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (slots.length === 0) {

    container.innerHTML = `
      <p>目前沒有機械手臂格位資料</p>
    `;

    return;
  }


  slots.forEach(slot => {

    const div =
      document.createElement("div");

    div.className = "slot";


    const isEmpty =
      slot.status === "空閒";


    div.innerHTML = `

      <div class="slot-title">
        🤖 第 ${escapeHTML(String(slot.slotId))} 格
      </div>

      <div>
        狀態：
        <strong>
          ${escapeHTML(slot.status || "-")}
        </strong>
      </div>

      <div>
        教室：
        ${escapeHTML(slot.roomName || "-")}
      </div>

      <div>
        使用者：
        ${escapeHTML(slot.borrower || "-")}
      </div>

      <div>
        借用時間：
        ${escapeHTML(slot.borrowTime || "-")}
      </div>

    `;


    if (isEmpty) {
      div.classList.add("empty");
    } else {
      div.classList.add("occupied");
    }


    container.appendChild(div);

  });
}


/* =========================
   登出
   ========================= */

async function logout() {

  try {

    await fetch(
      "/api/logout",
      {
        method: "POST"
      }
    );

  } catch (error) {

    console.error("logout 發生錯誤：", error);

  }


  window.location.href = "/index.html";
}


/* =========================
   防止 HTML 注入
   ========================= */

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
