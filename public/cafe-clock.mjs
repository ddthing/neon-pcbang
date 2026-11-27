export const CAFE_TIME_ZONE = "Asia/Seoul";

const clock = new Intl.DateTimeFormat("ko-KR", {
  timeZone: CAFE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const formatCafeTime = date => clock.format(date);
