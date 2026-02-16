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
    <div className="w-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="h-8 flex items-center justify-center text-[11px] font-semibold text-zinc-400 uppercase">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="h-9" />;

          const dateStr = `${props.year}-${String(props.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isStart = isSameDay(dateStr, props.rangeStart);
          const isEnd = isSameDay(dateStr, props.rangeEnd);
          const inRange = props.rangeStart && props.rangeEnd && isInRange(dateStr, props.rangeStart, props.rangeEnd);
          const isToday = isSameDay(dateStr, today);
          const isFuture = dateStr > today;

          // Background shape for range
          let rangeBg = "";
          if (isStart && isEnd) {
            rangeBg = "";
          } else if (isStart) {
            rangeBg = "bg-blue-50 rounded-l-full";
          } else if (isEnd) {
            rangeBg = "bg-blue-50 rounded-r-full";
          } else if (inRange) {
            rangeBg = "bg-blue-50";
          }

          // Inner circle styles
          let innerCls = "h-9 w-9 flex items-center justify-center rounded-full text-sm transition-all ";
          if (isStart || isEnd) {
            innerCls += "bg-blue-600 text-white font-semibold shadow-sm ";
          } else if (inRange) {
            innerCls += "text-blue-700 font-medium ";
          } else if (isFuture) {
            innerCls += "text-zinc-300 cursor-default ";
          } else if (isToday) {
            innerCls += "text-blue-600 font-bold ring-1 ring-blue-300 hover:bg-blue-50 cursor-pointer ";
          } else {
            innerCls += "text-zinc-700 hover:bg-zinc-100 cursor-pointer ";
          }

          return (
            <div key={dateStr} className={`flex items-center justify-center ${rangeBg}`}>
              <div
                className={innerCls}
                onClick={() => !isFuture && props.onDayClick(dateStr)}
              >
                {day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
