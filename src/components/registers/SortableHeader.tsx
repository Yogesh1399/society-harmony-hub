import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { SortDirection } from '@/hooks/useRegisterFilters';

interface SortableHeaderProps {
  label: string;
  column: string;
  currentColumn: string | null;
  direction: SortDirection;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableHeader({ label, column, currentColumn, direction, onSort, className }: SortableHeaderProps) {
  const isActive = currentColumn === column;

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className || ''}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && direction === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5 text-primary" />
        ) : isActive && direction === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );
}
