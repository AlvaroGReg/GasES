import type { Theme } from './app';
import type { NationalReference, ProvincialReference } from './prices';

export type ProvinceGeometry = {
    type: 'Feature';
    properties: Record<string, string>;
    geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
};

export type GeoJson = { type: 'FeatureCollection'; features: ProvinceGeometry[] };

export type MapPath = {
    key: string;
    name: string;
    provinceId: string | undefined;
    d: string;
    fill: string;
    price: number | undefined;
    isCanaryProvince: boolean;
};

export type SelectedProvince = { id: string | null; name: string } | undefined;

export type HomeMapSectionProps = {
    geoJson: GeoJson | null;
    mapError: boolean;
    provinces: ProvincialReference[];
    nationalAverage: NationalReference | null;
    theme: Theme;
    selectedProvince: SelectedProvince;
    selectedProvinceName: string | null;
    selectedAverage: ProvincialReference | undefined;
    euro: Intl.NumberFormat;
    formatDate: (value: string) => string;
    formatDateTime: (value: string) => string;
    onSelectProvince: (id: string | null, name: string) => void;
    onClearSelection: () => void;
};
