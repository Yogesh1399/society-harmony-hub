import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export interface FiscalPeriod {
  /** uuid of the fiscal year row, when one was found */
  id: string | null;
  /** e.g. "2023-24" */
  label: string;
  /** yyyy-MM-dd */
  start: string;
  /** yyyy-MM-dd */
  end: string;
  /** calendar year the period starts in — e.g. 2023 */
  startYear: number;
  /** true when today falls inside the period */
  isCurrent: boolean;
}

function calendarFallback(): FiscalPeriod {
  // April-to-March year containing today
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    id: null,
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
    startYear,
    isCurrent: true,
  };
}

/**
 * The accounting period the screens should open on.
 *
 * Reports, dashboards and bill generation used to default to `new Date()`.
 * For a society whose books are a closed past year that meant every screen
 * opened empty and the user had to change the dates by hand. This reads the
 * society's own open fiscal year instead and falls back to the calendar
 * April-March year only when no fiscal year has been set up yet.
 */
export function useFiscalPeriod() {
  const { currentSocietyId } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['fiscal-period', currentSocietyId],
    queryFn: async (): Promise<FiscalPeriod | null> => {
      if (!currentSocietyId) return null;

      // Prefer the open year; if none is open, use the most recent one that has dates.
      const { data: rows, error } = await supabase
        .from('fiscal_years')
        .select('id, year_label, start_date, end_date, status')
        .eq('society_id', currentSocietyId)
        .order('start_date', { ascending: false });

      if (error || !rows || rows.length === 0) return null;

      const open = rows.find((r: any) => r.status === 'open');
      const row: any = open || rows[0];

      const start = String(row.start_date);
      const end = String(row.end_date);
      const today = new Date().toISOString().slice(0, 10);

      return {
        id: row.id,
        label: row.year_label || '',
        start,
        end,
        startYear: Number(start.slice(0, 4)),
        isCurrent: today >= start && today <= end,
      };
    },
    enabled: !!currentSocietyId,
    staleTime: 5 * 60 * 1000,
  });

  return { period: data ?? calendarFallback(), isLoading, hasFiscalYear: !!data };
}
