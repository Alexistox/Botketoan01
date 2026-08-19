/**
 * URL public của server Express (dùng cho /messagelogs, /report, …).
 * Ưu tiên SERVER_URL hoặc BASE_URL.
 */
function getBaseUrl() {
  if (process.env.SERVER_URL) {
    return process.env.SERVER_URL.replace(/\/$/, '');
  }
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (process.env.HEROKU_APP_NAME) {
    return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
  }
  // Botketoan01 trên VPS mặc định cổng 3001
  return 'http://159.223.49.204:3001';
}

module.exports = { getBaseUrl };
