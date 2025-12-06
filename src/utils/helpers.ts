// utils/helpers.ts

export const calculateDaysBetween = (d1: Date, d2: Date): number => {
  const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getFutureDate = (startDate: Date, days: number): Date => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + days);
  return date;
};

// You can add more helper functions here for things like
// - Sanitizing user input
// - Formatting dates
// - Etc.
