import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;
export type DateFilterMode = 'month' | 'range';

interface UseRegisterFiltersOptions<T> {
  data: T[] | undefined;
  searchFields: (item: T) => string[];
  dateField: (item: T) => string;
  categoryField?: (item: T) => string;
  pageSize?: number;
}

export function useRegisterFilters<T>({
  data,
  searchFields,
  dateField,
  categoryField,
  pageSize = 25,
}: UseRegisterFiltersOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortColumn(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = [...data];

    // Category filter
    if (activeCategory !== 'all' && categoryField) {
      result = result.filter(item => categoryField(item) === activeCategory);
    }

    // Date filter
    result = result.filter(item => {
      const d = new Date(dateField(item));
      if (dateFilterMode === 'month') {
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      } else {
        if (dateFrom && d < dateFrom) return false;
        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (d > endOfDay) return false;
        }
        return true;
      }
    });

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        searchFields(item).some(f => f?.toLowerCase().includes(q))
      );
    }

    return result;
  }, [data, activeCategory, categoryField, dateFilterMode, selectedMonth, selectedYear, dateFrom, dateTo, searchQuery, searchFields, dateField]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Summary for filtered data
  const filteredTotal = filtered.length;

  return {
    searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    dateFilterMode, setDateFilterMode,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    sortColumn, sortDirection, handleSort,
    currentPage, setCurrentPage,
    totalPages,
    filtered,
    paginated,
    filteredTotal,
    pageSize,
  };
}
