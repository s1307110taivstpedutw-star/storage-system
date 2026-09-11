```javascript
let currentUser = null;

let classrooms = [];

let slots = [];



/* =========================
   HTML 安全處理
   ========================= */

function escapeHTML(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(value)

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}



/* =========================
   初始化
   ========================= */

async function init() {

  try {

    const meResponse =
      await fetch("/api/me");


    if (!meResponse.ok) {

      throw new Error(
        "無法取得登入資訊"
      );

    }


    const me =
      await meResponse.json();


    if (!me.loggedIn) {

      location.href =
        "/index.html";

      return;

    }


    currentUser =
      me.user;


    document.getElementById(
      "userInfo"
    ).textContent =

      `目前登入：${currentUser.name}（${
        currentUser.role === "admin"
          ? "管理員"
          : "教師"
      }）`;


    await loadClassrooms();

    await loadBookings();

    await loadSlots();


  } catch (error) {

    console.error(
      "temporary 初始化失敗：",
      error
    );


    alert(
      "系統載入失敗：" +
      error.message
    );

  }

}



/* =========================
   載入教室
   ========================= */

async function loadClassrooms() {

  const response =
    await fetch(
      "/api/classrooms"
    );


  if (!response.ok) {

    throw new Error(
      "取得教室資料失敗"
    );

  }


  const data =
    await response.json();


  if (!data.success) {

    throw new Error(
      data.message ||
      "取得教室資料失敗"
    );

  }


  classrooms =
    Object.values(
      data.classrooms
    ).sort(
      (a, b) =>
        a.id - b.id
    );


  const select =
    document.getElementById(
      "classroom"
    );


  select.innerHTML = "";


  classrooms.forEach(
    room => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        room.id;


      option.textContent =
        `${room.id}. ${room.name}`;


      select.appendChild(
        option
      );

    }
  );

}



/* =========================
   送出申請
   ========================= */

async function submitBooking() {

  const className =
    document.getElementById(
      "className"
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



  if (
    !className ||
    !classroomId ||
    !date ||
    !startTime ||
    !endTime
  ) {

    alert(
      "請完整填寫資料"
    );

    return;

  }


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

            className,

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


    document.getElementById(
      "className"
    ).value = "";


    document.getElementById(
      "reason"
    ).value = "";


    await loadBookings();


  } catch (error) {

    console.error(error);


    alert(
      "無法連線到伺服器"
    );

  }

}



/* =========================
   載入申請
   ========================= */

async function loadBookings() {

  const response =
    await fetch(
      "/api/temporary-bookings"
    );


  if (!response.ok) {

    throw new Error(
      "取得申請資料失敗"
    );

  }


  const data =
    await response.json();


  renderBookings(
    data.bookings || []
  );

}



/* =========================
   狀態 CSS
   ========================= */

function getStatusClass(status) {

  switch (status) {

    case "pending":
      return "pending";

    case "approved":
      return "approved";

    case "rejected":
      return "rejected";

    case "completed":
      return "completed";

    default:
      return "";

  }

}



/* =========================
   顯示申請
   ========================= */

function renderBookings(bookings) {

  const tbody =
    document.getElementById(
      "bookingTable"
    );


  tbody.innerHTML = "";


  if (
    bookings.length === 0
  ) {

    tbody.innerHTML = `

      <tr>

        <td colspan="8">

          目前沒有臨時借用申請

        </td>

      </tr>

    `;

    return;

  }



  bookings

    .sort(
      (a, b) =>
        String(
          b.createdAt || ""
        ).localeCompare(
          String(
            a.createdAt || ""
          )
        )
    )

    .forEach(
      booking => {

        const tr =
          document.createElement(
            "tr"
          );


        let operation = "";


        /* =====================
           管理員操作
           ===================== */

        if (
          currentUser.role === "admin"
        ) {


          if (
            booking.status === "pending"
          ) {

            operation = `

              <button
                class="btn-success"
                onclick="approveBooking(${booking.id})">

                核准

              </button>

              <button
                class="btn-danger"
                onclick="rejectBooking(${booking.id})">

                拒絕

              </button>

            `;

          }


          if (
            booking.status === "approved"
          ) {

            operation = `

              <button
                class="btn-secondary"
                onclick="completeBooking(${booking.id})">

                完成借還

              </button>

            `;

          }

        }



        tr.innerHTML = `

          <td>

            <span
              class="status ${getStatusClass(
                booking.status
              )}">

              ${escapeHTML(
                booking.statusText
              )}

            </span>

          </td>


          <td>

            ${escapeHTML(
              booking.className
            )}

          </td>


          <td>

            ${escapeHTML(
              booking.classroomName
            )}

          </td>


          <td>

            ${escapeHTML(
              booking.date
            )}

          </td>


          <td>

            ${escapeHTML(
              booking.startTime
            )}

            ~

            ${escapeHTML(
              booking.endTime
            )}

          </td>


          <td>

            ${escapeHTML(
              booking.applicantName
            )}

          </td>


          <td>

            ${
              booking.slotId
                ? `第 ${booking.slotId} 格`
                : "尚未指定"
            }

          </td>


          <td>

            ${operation}

          </td>

        `;


        tbody.appendChild(
          tr
        );

      }
    );

}



/* =========================
   核准申請
   ========================= */

async function approveBooking(id) {

  const slot =
    prompt(
      "請輸入機械手臂格位（1～8）"
    );


  const slotId =
    Number(slot);


  if (
    !slotId ||
    slotId < 1 ||
    slotId > 8
  ) {

    alert(
      "請輸入 1～8"
    );

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


    const data =
      await response.json();


    if (!response.ok) {

      alert(
        data.message ||
        "核准失敗"
      );

      return;

    }


    alert(
      `申請已核准，使用機械手臂第 ${slotId} 格。`
    );


    await loadBookings();

    await loadSlots();


  } catch (error) {

    console.error(error);


    alert(
      "核准時發生錯誤"
    );

  }

}



/* =========================
   拒絕申請
   ========================= */

async function rejectBooking(id) {

  if (
    !confirm(
      "確定要拒絕這筆申請嗎？"
    )
  ) {

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


    const data =
      await response.json();


    if (!response.ok) {

      alert(
        data.message ||
        "拒絕失敗"
      );

      return;

    }


    await loadBookings();


  } catch (error) {

    console.error(error);


    alert(
      "拒絕時發生錯誤"
    );

  }

}



/* =========================
   完成借還
   ========================= */

async function completeBooking(id) {

  if (
    !confirm(
      "確定這筆借還已完成嗎？"
    )
  ) {

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


    const data =
      await response.json();


    if (!response.ok) {

      alert(
        data.message ||
        "操作失敗"
      );

      return;

    }


    alert(
      "借還已完成，機械手臂格位已釋放。"
    );


    await loadBookings();

    await loadSlots();


  } catch (error) {

    console.error(error);


    alert(
      "完成借還時發生錯誤"
    );

  }

}



/* =========================
   載入機械手臂格位
   ========================= */

async function loadSlots() {

  const response =
    await fetch(
      "/api/arm/slots"
    );


  if (!response.ok) {

    throw new Error(
      "取得機械手臂格位失敗"
    );

  }


  const data =
    await response.json();


  if (!data.success) {

    throw new Error(
      data.message ||
      "取得機械手臂格位失敗"
    );

  }


  slots =
    Object.values(
      data.slots
    ).sort(
      (a, b) =>
        a.slotId - b.slotId
    );


  renderSlots();

}



/* =========================
   顯示機械手臂格位
   ========================= */

function renderSlots() {

  const container =
    document.getElementById(
      "slots"
    );


  container.innerHTML = "";


  slots.forEach(
    slot => {

      let className =
        "slot free";


      if (
        slot.status === "待借出"
      ) {

        className =
          "slot waiting";

      }


      if (
        slot.status === "借用中"
      ) {

        className =
          "slot borrowing";

      }


      container.innerHTML += `

        <div class="${className}">

          <div class="slot-title">

            第 ${slot.slotId} 格

          </div>


          <div>

            ${escapeHTML(
              slot.roomName
            )}

          </div>


          <div>

            ${escapeHTML(
              slot.keyName
            )}

          </div>


          <div class="slot-status">

            狀態：
            ${escapeHTML(
              slot.status
            )}

          </div>


          ${
            slot.borrower

              ? `

                <div>

                  班級：
                  ${escapeHTML(
                    slot.borrower
                  )}

                </div>

              `

              : ""
          }


          ${
            slot.borrowTime

              ? `

                <div>

                  時間：
                  ${escapeHTML(
                    slot.borrowTime
                  )}

                </div>

              `

              : ""
          }

        </div>

      `;

    }
  );

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

    console.error(error);

  }


  location.href =
    "/index.html";

}



/* =========================
   啟動
   ========================= */

init();
```
