export type NationalHistoryPoint = {
    date: string;
    price: number;
    provinceCount: number;
    stationObservationCount: number;
    dataDateFrom: string;
    dataDateTo: string;
    retrievedAtFrom: string;
    retrievedAtTo: string;
};

export type HistoryPoint = NationalHistoryPoint;
export type Period = '1y' | '6m' | '3m' | '1m';

export type HomeHistorySectionProps = {
    history: HistoryPoint[];
    period: Period;
    onPeriodChange: (period: Period) => void;
    loading: boolean;
    error: boolean;
    euro: Intl.NumberFormat;
    formatDate: (value: string) => string;
    formatDateTime: (value: string) => string;
};
