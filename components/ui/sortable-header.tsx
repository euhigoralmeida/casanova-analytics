export default function SortableHeader({ label, field, current, dir, onSort, className }: {
  label: string;
  field: string;
  current: string;
  dir: "asc" | "desc";
  onSort: (field: string) => void;
  className?: string;
}) {
  const isActive = current === field;
  return (
    <th
      className={`py-2 px-2 cursor-pointer select-none hover:text-zinc-900 ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <span className="text-[10px]">
          {isActive ? (dir === "asc" ? " ↑" : " ↓") : " ↕"}
        </span>
      </span>
    </th>
  );
}
