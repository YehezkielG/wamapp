import { create } from 'zustand';

const PAGE_SIZE = 4;

type ForecastUiStore = {
  visibleDayCount: number;
  selectedDate: string | null;
  visibleHourCountByDate: Record<string, number>;
  resetVisibleDayCount: () => void;
  loadMoreDays: (total: number) => void;
  toggleSelectedDate: (date: string) => void;
  loadMoreHours: (date: string, total: number) => void;
};

export const useForecastUiStore = create<ForecastUiStore>((set, get) => ({
  visibleDayCount: PAGE_SIZE,
  selectedDate: null,
  visibleHourCountByDate: {},

  resetVisibleDayCount: () => set({ visibleDayCount: PAGE_SIZE }),

  loadMoreDays: (total) =>
    set((state) => ({
      visibleDayCount: Math.min(state.visibleDayCount + PAGE_SIZE, total),
    })),

  toggleSelectedDate: (date) => {
    const state = get();
    if (state.selectedDate === date) {
      set({ selectedDate: null });
      return;
    }

    set({
      selectedDate: date,
      visibleHourCountByDate: {
        ...state.visibleHourCountByDate,
        [date]: state.visibleHourCountByDate[date] ?? PAGE_SIZE,
      },
    });
  },

  loadMoreHours: (date, total) =>
    set((state) => {
      const current = state.visibleHourCountByDate[date] ?? PAGE_SIZE;
      return {
        visibleHourCountByDate: {
          ...state.visibleHourCountByDate,
          [date]: Math.min(current + PAGE_SIZE, total),
        },
      };
    }),
}));
