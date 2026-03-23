/**
 * 用餐时间 scheduled_at：库中为北京时间墙钟；mysql2 读入为正确 UTC 的 Date。
 * 云函数进程常为 TZ=UTC，不可用 getHours() 等「本地」分量格式化，否则会少 8 小时。
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

const MS_8H = 8 * 60 * 60 * 1000;

function toBeijingSqlDatetimeFromUtcMs(ms) {
  const b = new Date(ms + MS_8H);
  return `${b.getUTCFullYear()}-${pad2(b.getUTCMonth() + 1)}-${pad2(b.getUTCDate())} ${pad2(
    b.getUTCHours()
  )}:${pad2(b.getUTCMinutes())}:${pad2(b.getUTCSeconds())}`;
}

/**
 * @param {Date|string|null|undefined} rawAt
 * @param {number|string|boolean} rawFlag scheduled_time_specified
 * @returns {{ scheduledAt: string|null, scheduledTimeSpecified: boolean }}
 */
function formatScheduledForApi(rawAt, rawFlag) {
  if (rawAt == null) {
    return { scheduledAt: null, scheduledTimeSpecified: false };
  }
  const specified = Number(rawFlag) === 1;

  let s;
  if (rawAt instanceof Date) {
    s = toBeijingSqlDatetimeFromUtcMs(rawAt.getTime());
  } else {
    const str = String(rawAt).trim();
    if (/Z$/i.test(str) || /[+-]\d{2}:?\d{2}$/i.test(str)) {
      const d = new Date(str);
      s = Number.isNaN(d.getTime())
        ? str.replace('T', ' ').substring(0, 19)
        : toBeijingSqlDatetimeFromUtcMs(d.getTime());
    } else {
      s = str.replace('T', ' ').substring(0, 19);
    }
  }
  return { scheduledAt: s, scheduledTimeSpecified: specified };
}

module.exports = { formatScheduledForApi };
