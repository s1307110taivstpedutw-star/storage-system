const https = require("https");

// ========================================
// 💬 LINE Messaging API 服務
// ========================================
// 目前先建立 LINE 服務層。
// 尚未設定 LINE_CHANNEL_ACCESS_TOKEN 時，
// 系統不會因此當掉。
// ========================================


// ========================================
// LINE 設定
// ========================================

const LINE_CHANNEL_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

const LINE_API_HOST = "api.line.me";


// ========================================
// 檢查 LINE 是否已設定
// ========================================

function isLineConfigured() {
  return Boolean(LINE_CHANNEL_ACCESS_TOKEN);
}


// ========================================
// 發送 LINE Push Message
// ========================================

function sendPushMessage(userId, message) {
  return new Promise((resolve, reject) => {

    if (!isLineConfigured()) {
      return resolve({
        success: false,
        configured: false,
        message: "LINE 尚未設定 Channel Access Token"
      });
    }

    if (!userId) {
      return resolve({
        success: false,
        configured: true,
        message: "缺少 LINE User ID"
      });
    }

    if (!message) {
      return resolve({
        success: false,
        configured: true,
        message: "缺少 LINE 訊息內容"
      });
    }


    const postData = JSON.stringify({
      to: userId,

      messages: [
        {
          type: "text",
          text: String(message)
        }
      ]
    });


    const options = {
      hostname: LINE_API_HOST,

      path: "/v2/bot/message/push",

      method: "POST",

      headers: {
        "Content-Type": "application/json",

        "Authorization":
          `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,

        "Content-Length":
          Buffer.byteLength(postData)
      }
    };


    const request = https.request(options, response => {

      let responseData = "";

      response.on("data", chunk => {
        responseData += chunk;
      });


      response.on("end", () => {

        if (
          response.statusCode >= 200 &&
          response.statusCode < 300
        ) {

          resolve({
            success: true,
            configured: true,
            statusCode: response.statusCode,
            message: "LINE 訊息發送成功"
          });

        } else {

          console.error(
            "LINE API 錯誤：",
            response.statusCode,
            responseData
          );

          resolve({
            success: false,
            configured: true,
            statusCode: response.statusCode,
            message: "LINE 訊息發送失敗",
            response: responseData
          });

        }

      });

    });


    request.on("error", error => {

      console.error(
        "LINE API 連線錯誤：",
        error
      );

      reject(error);

    });


    request.write(postData);

    request.end();

  });
}


// ========================================
// 系統通知
// ========================================

async function sendSystemNotification(
  userId,
  message
) {

  return sendPushMessage(
    userId,
    message
  );

}


// ========================================
// 冷氣卡低餘額通知
// ========================================

async function sendLowBalanceNotification(
  userId,
  roomName,
  balance
) {

  const message =
`⚠️ 冷氣卡餘額提醒

教室：${roomName}

目前餘額：NT$ ${balance}

目前餘額低於 NT$300，
請管理員注意。`;

  return sendPushMessage(
    userId,
    message
  );

}


// ========================================
// 冷氣卡歸還通知
// ========================================

async function sendCardReturnNotification(
  userId,
  roomName
) {

  const message =
`❄️ 冷氣卡歸還通知

教室：${roomName}

冷氣卡已完成歸還確認。

謝謝使用。`;

  return sendPushMessage(
    userId,
    message
  );

}


// ========================================
// 臨時借用申請通知
// ========================================

async function sendTemporaryBookingNotification(
  userId,
  classroom,
  startTime,
  endTime
) {

  const message =
`🔑 臨時教室借用申請

教室：${classroom}

時間：
${startTime} ～ ${endTime}

目前狀態：申請中

請等待管理員核准。`;

  return sendPushMessage(
    userId,
    message
  );

}


// ========================================
// 臨時借用核准通知
// ========================================

async function sendBookingApprovedNotification(
  userId,
  classroom,
  startTime,
  endTime
) {

  const message =
`✅ 臨時教室借用已核准

教室：${classroom}

時間：
${startTime} ～ ${endTime}

狀態：已核准／待執行`;

  return sendPushMessage(
    userId,
    message
  );

}


// ========================================
// 匯出
// ========================================

module.exports = {

  isLineConfigured,

  sendPushMessage,

  sendSystemNotification,

  sendLowBalanceNotification,

  sendCardReturnNotification,

  sendTemporaryBookingNotification,

  sendBookingApprovedNotification

};
