/** Next aligned time (5‑minute steps), bumped forward so it is not in the past within the same minute. */
export function getSmartDefaultAlarmTime(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  const step = 5;
  let m = d.getMinutes();
  const remainder = m % step;
  if (remainder !== 0) {
    d.setMinutes(m + (step - remainder));
  } else {
    d.setMinutes(m + step);
  }
  if (d.getMinutes() >= 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(d.getMinutes() - 60);
  }
  return d;
}

export function clockPartsFromDate(d: Date): { h12: number; minute: number; meridiem: 'AM' | 'PM' } {
  const h24 = d.getHours();
  const minute = d.getMinutes();
  const meridiem = h24 < 12 ? 'AM' : 'PM';
  let h12 = h24 % 12;
  if (h12 === 0) {
    h12 = 12;
  }
  return { h12, minute, meridiem };
}
