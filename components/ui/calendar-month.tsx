import { WEEKDAYS, getDaysInMonth, getFirstDayOfMonth, isSameDay } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

function isInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

export default function CalendarMonth(props: {
  year: number;
  month: number;
  rangeStart: string;
  rangeEnd: string;
  onDayClick: (day: string) => void;
}) {
  const daysInMonth = getDaysInMonth(props.year, props.month);
  const firstDay = getFirstDayOfMonth(props.year, props.month);
  const today = fmtDate(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex-1 min-w-[200px]">
      <div className="grid grid-cols-7 text-center text-xs text-zinc-400 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;

          const dateStr = `${props.year}-${String(props.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isStart = isSameDay(dateStr, props.rangeStart);
          const isEnd = isSameDay(dateStr, props.rangeEnd);
          const inRange = props.rangeStart && props.rangeEnd && isInRange(dateStr, props.rangeStart, props.rangeEnd);
          const isToday = isSameDay(dateStr, today);
          const isFuture = dateStr > today;

          let cls = "py-1 cursor-pointer transition-colors ";
          if (isStart || isEnd) {
            cls += "bg-blue-600 text-white rounded-full font-medium ";
          } else if (inRange) {
            cls += "bg-blue-50 text-blue-800 ";
          } else if (isFuture) {
            cls += "text-zinc-300 ";
          } else {
            cls += "hover:bg-zinc-100 rounded-full ";
          }
          if (isToday && !isStart && !isEnd) {
            cls += "font-bold text-blue-600 ";
          }

          return (
            <div
              key={dateStr}
              className={cls}
              onClick={() => !isFuture && props.onDayClick(dateStr)}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
