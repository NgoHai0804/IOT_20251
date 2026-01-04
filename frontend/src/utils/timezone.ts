/**
 * Utility functions for handling Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7)
 * 
 * Logic đơn giản:
 * - Frontend tính toán thời gian theo giờ Việt Nam (ví dụ: "1 ngày trước" = 1 ngày trước theo giờ VN)
 * - Gửi UTC time tương ứng lên server
 * - Backend nhận UTC time và chuyển đổi sang giờ Việt Nam để so sánh với timestamp trong database
 */

/**
 * Lấy thời gian hiện tại theo múi giờ Việt Nam và trả về dạng ISO string (UTC)
 * @returns ISO string của thời gian hiện tại (UTC, đại diện cho giờ Việt Nam)
 */
export function getVietnamNowISOString(): string {
  // Lấy thời gian hiện tại (theo local timezone của browser)
  const now = new Date();
  
  // Chuyển đổi sang giờ Việt Nam (UTC+7)
  // getTimezoneOffset() trả về offset của timezone hiện tại (phút, dương nếu ở phía tây UTC)
  // Việt Nam là UTC+7, tức là offset = -420 phút
  const localOffset = now.getTimezoneOffset(); // offset của timezone hiện tại (phút)
  const vietnamOffset = -420; // offset của Việt Nam (UTC+7 = -420 phút)
  const offsetDiff = (vietnamOffset - localOffset) * 60 * 1000; // chênh lệch (ms)
  
  // Tạo thời gian theo giờ Việt Nam
  const vietnamTime = new Date(now.getTime() + offsetDiff);
  
  // Trả về UTC time tương ứng (toISOString() tự động chuyển sang UTC)
  return vietnamTime.toISOString();
}

/**
 * Chuyển đổi Date object sang giờ Việt Nam và trả về dạng ISO string (UTC)
 * @param date Date object cần chuyển đổi (theo local time của user)
 * @returns ISO string của thời gian (UTC, đại diện cho giờ Việt Nam)
 */
export function toVietnamISOString(date: Date): string {
  // Chuyển đổi sang giờ Việt Nam (UTC+7)
  const localOffset = date.getTimezoneOffset(); // offset của timezone hiện tại (phút)
  const vietnamOffset = -420; // offset của Việt Nam (UTC+7 = -420 phút)
  const offsetDiff = (vietnamOffset - localOffset) * 60 * 1000; // chênh lệch (ms)
  
  // Tạo thời gian theo giờ Việt Nam
  const vietnamTime = new Date(date.getTime() + offsetDiff);
  
  // Trả về UTC time tương ứng (toISOString() tự động chuyển sang UTC)
  return vietnamTime.toISOString();
}

