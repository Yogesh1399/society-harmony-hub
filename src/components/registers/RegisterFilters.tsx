import { Search, CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DateFilterMode } from '@/hooks/useRegisterFilters';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface CategoryTab {
  key: string;
  label: string;
  count?: number;
}

interface RegisterFiltersProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchPlaceholder?: string;
  categories?: CategoryTab[];
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  dateFilterMode: DateFilterMode;
  setDateFilterMode: (m: DateFilterMode) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  dateFrom?: Date;
  setDateFrom: (d: Date | undefined) => void;
  dateTo?: Date;
  setDateTo: (d: Date | undefined) => void;
}

export function RegisterFilters({
  searchQuery, setSearchQuery, searchPlaceholder,
  categories, activeCategory, setActiveCategory,
  dateFilterMode, setDateFilterMode,
  selectedMonth, setSelectedMonth,
  selectedYear, setSelectedYear,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
}: RegisterFiltersProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-3">
      {/* Category Tabs */}
      {categories && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <Button
              key={cat.key}
              variant={activeCategory === cat.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat.key)}
              className="h-8"
            >
              {cat.label}
              {cat.count !== undefined && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {cat.count}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Date Filter + Search Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={dateFilterMode === 'month' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setDateFilterMode('month')}
            className="h-9 text-xs"
          >
            <Filter className="mr-1 h-3 w-3" />
            Month
          </Button>
          <Button
            variant={dateFilterMode === 'range' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setDateFilterMode('range')}
            className="h-9 text-xs"
          >
            <CalendarIcon className="mr-1 h-3 w-3" />
            Date Range
          </Button>

          {dateFilterMode === 'month' ? (
            <div className="flex gap-2">
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="h-9 w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-9 w-[130px] justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-9 w-[130px] justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>
    </div>
  );
}
