const crypto = require("crypto");

// ========================================
// 🔑 NFC 服務
// ========================================
// 目前先負責 NFC ID 的格式整理、比對與
// 卡片類型判斷。
// 尚未直接連接 ESP32 / NFC 讀卡機。
// ========================================


// ========================================
// NFC ID 正規化
// ========================================

function normalizeNfcId(nfcId) {
  if (nfcId === undefined || nfcId === null) {
    return "";
  }

  return String(nfcId)
    .trim()
    .replace(/[\s:-]/g, "")
    .toUpperCase();
}


// ========================================
// 檢查 NFC ID 是否有效
// ========================================

function isValidNfcId(nfcId) {
  const normalized = normalizeNfcId(nfcId);

  if (!normalized) {
    return false;
  }

  // 常見 NFC UID 為十六進位字串
  if (!/^[0-9A-F]+$/.test(normalized)) {
    return false;
  }

  // UID 長度至少 4 碼
  if (normalized.length < 4) {
    return false;
  }

  return true;
}


// ========================================
// 安全比對 NFC ID
// ========================================

function compareNfcId(firstId, secondId) {
  const first = normalizeNfcId(firstId);
  const second = normalizeNfcId(secondId);

  if (!first || !second) {
    return false;
  }

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(first),
    Buffer.from(second)
  );
}


// ========================================
// 判斷卡片類型
// ========================================

function identifyCardType(nfcId, slots = []) {
  const normalizedId = normalizeNfcId(nfcId);

  if (!normalizedId) {
    return {
      found: false,
      type: "unknown",
      message: "沒有提供 NFC ID"
    };
  }


  for (const slot of slots) {

    // 鑰匙卡
    if (
      slot.keyNfcId &&
      compareNfcId(normalizedId, slot.keyNfcId)
    ) {
      return {
        found: true,
        type: "key",
        slotId: slot.slotId,
        roomName: slot.roomName,
        nfcId: normalizedId,
        message: "辨識為鑰匙 NFC"
      };
    }


    // 冷氣卡
    if (
      slot.acCardNfcId &&
      compareNfcId(normalizedId, slot.acCardNfcId)
    ) {
      return {
        found: true,
        type: "ac-card",
        slotId: slot.slotId,
        roomName: slot.roomName,
        nfcId: normalizedId,
        balance: Number(slot.acCardBalance || 0),
        message: "辨識為冷氣卡 NFC"
      };
    }
  }


  return {
    found: false,
    type: "unknown",
    nfcId: normalizedId,
    message: "找不到對應的 NFC 卡片"
  };
}


// ========================================
// 尋找指定 NFC 卡片
// ========================================

function findCardByNfcId(nfcId, slots = []) {
  const normalizedId = normalizeNfcId(nfcId);

  if (!normalizedId) {
    return null;
  }

  for (const slot of slots) {

    if (
      slot.keyNfcId &&
      compareNfcId(normalizedId, slot.keyNfcId)
    ) {
      return {
        type: "key",
        slot
      };
    }


    if (
      slot.acCardNfcId &&
      compareNfcId(normalizedId, slot.acCardNfcId)
    ) {
      return {
        type: "ac-card",
        slot
      };
    }
  }

  return null;
}


// ========================================
// 檢查冷氣卡餘額
// ========================================

function checkAcCardBalance(balance) {
  const amount = Number(balance);

  if (!Number.isFinite(amount)) {
    return {
      valid: false,
      lowBalance: false,
      balance: 0,
      message: "冷氣卡餘額格式錯誤"
    };
  }


  if (amount < 0) {
    return {
      valid: false,
      lowBalance: false,
      balance: amount,
      message: "冷氣卡餘額不可小於 0"
    };
  }


  return {
    valid: true,
    lowBalance: amount < 300,
    balance: amount,
    message:
      amount < 300
        ? "冷氣卡餘額低於 NT$300"
        : "冷氣卡餘額正常"
  };
}


// ========================================
// 建立 NFC 掃描結果
// ========================================

function createScanResult(nfcId, slots = []) {
  const normalizedId = normalizeNfcId(nfcId);

  if (!isValidNfcId(normalizedId)) {
    return {
      success: false,
      found: false,
      type: "unknown",
      nfcId: normalizedId,
      message: "NFC ID 格式無效"
    };
  }


  const result = identifyCardType(
    normalizedId,
    slots
  );


  return {
    success: true,
    ...result,
    scannedAt: new Date().toISOString()
  };
}


// ========================================
// 匯出
// ========================================

module.exports = {
  normalizeNfcId,
  isValidNfcId,
  compareNfcId,
  identifyCardType,
  findCardByNfcId,
  checkAcCardBalance,
  createScanResult
};
