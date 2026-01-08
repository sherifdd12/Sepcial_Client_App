import { supabase } from './supabase/client';

export const getFinancialReport = async (
  startDate: string,
  endDate: string,
  statuses: string[]
) => {
  const { data, error } = await supabase.rpc('get_financial_report' as any, {
    start_date: startDate,
    end_date: endDate,
    transaction_statuses: statuses,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
