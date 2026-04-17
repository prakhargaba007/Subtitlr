import { useMemo } from "react";

type PaginationItem = number | "ellipsis";

function getPaginationItems(
  current: number,
  total: number,
  siblingCount: number = 1
): PaginationItem[] {
  if (total <= 1) return [1];

  const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2*siblings, 2 ellipsis
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => total - rightItemCount + 1 + i
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  disabled = false,
  siblingCount = 1,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  siblingCount?: number;
  className?: string;
}) {
  const items = useMemo(
    () => getPaginationItems(page, pageCount, siblingCount),
    [page, pageCount, siblingCount]
  );

  if (!Number.isFinite(pageCount) || pageCount <= 1) return null;

  return (
    <nav
      className={["flex items-center justify-center gap-1", className].filter(Boolean).join(" ")}
      aria-label="Pagination"
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={disabled || page <= 1}
        className="h-9 w-9 grid place-items-center rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant"
        aria-label="Previous page"
      >
        <span className="material-symbols-outlined text-base">chevron_left</span>
      </button>

      {items.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            className="h-9 px-2 grid place-items-center text-on-surface-variant select-none"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            disabled={disabled}
            aria-current={item === page ? "page" : undefined}
            className={
              item === page
                ? "h-9 min-w-9 px-3 rounded-xl bg-primary text-on-primary text-sm font-extrabold"
                : "h-9 min-w-9 px-3 rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-40"
            }
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={disabled || page >= pageCount}
        className="h-9 w-9 grid place-items-center rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant"
        aria-label="Next page"
      >
        <span className="material-symbols-outlined text-base">chevron_right</span>
      </button>
    </nav>
  );
}

