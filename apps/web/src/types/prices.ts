export type NationalReference = {
    price: number;
    provinceCount: number;
    stationObservationCount: number;
    dataDateFrom: string;
    dataDateTo: string;
    retrievedAtFrom: string;
    retrievedAtTo: string;
    calculatedAt: string;
};

export type ProvincialReference = {
    provinceId: string;
    province: string;
    price: number;
    observationCount: number;
    dataDate: string;
    sourceDate: string;
    retrievedAt: string;
};

export type LatestResponse = {
    national: NationalReference | null;
    provinces: ProvincialReference[];
};

export type Observation = {
    stationId: string | null;
    brand: string | null;
    locality: string | null;
    municipality: string | null;
    provinceId: string | null;
    province: string | null;
    price: number;
    sourceDate: string;
    retrievedAt: string;
};

export type HomeHeroSectionProps = {
    nationalAverage: NationalReference | null;
    euro: Intl.NumberFormat;
    formatDate: (value: string) => string;
    formatDateTime: (value: string) => string;
    dataLoading: boolean;
    dataError: boolean;
};

export type HomeObservationsSectionProps = {
    observations: Observation[];
    observationsError: boolean;
    dataLoading: boolean;
    euro: Intl.NumberFormat;
    formatDate: (value: string) => string;
    formatDateTime: (value: string) => string;
};
