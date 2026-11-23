import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import '../styles/pages/HomePage.css';
import { HomeHeroSection } from '../components/home/HomeHeroSection';
import { HomeObservationsSection } from '../components/home/HomeObservationsSection';
import { HomeAlertCallout } from '../components/home/HomeAlertCallout';
import { HomeMapSection } from '../components/home/HomeMapSection';
import { HomeHistorySection } from '../components/home/HomeHistorySection';
import type { HistoryPoint, Period } from '../types/history';
import type { GeoJson } from '../types/province-map';
import type { HomePageProps } from '../types/pages';
import type { LatestResponse, Observation } from '../types/prices';
import { canonicalProvinceName, getProvinceName, normalizeProvinceName } from '../utils/provinces';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
function parseSourceDate(value: string): Date {
    const match = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(value);
    return match
        ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])))
        : new Date(value);
}

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
}

export function HomePage({ theme }: HomePageProps) {
    const { formatLocale } = useTranslation();
    const euro = useMemo(() => new Intl.NumberFormat(formatLocale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }), [formatLocale]);
    const dateFormat = useMemo(() => new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), [formatLocale]);
    const dateTimeFormat = useMemo(() => new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), [formatLocale]);
    const formatDate = (value: string) => dateFormat.format(parseSourceDate(value));
    const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value));

    const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
    const [mapError, setMapError] = useState(false);
    const [latest, setLatest] = useState<LatestResponse | null>(null);
    const [observations, setObservations] = useState<Observation[]>([]);
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [period, setPeriod] = useState<Period>('1y');
    const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
    const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [observationsError, setObservationsError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/data/spain-provinces.geojson', { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<GeoJson>;
            })
            .then(setGeoJson)
            .catch((error: unknown) => {
                if (error instanceof Error && error.name !== 'AbortError') setMapError(true);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setDataLoading(true);
        setDataError(false);
        Promise.allSettled([
            fetchJson<LatestResponse>('/prices/latest', controller.signal),
            fetchJson<Observation[]>('/prices/observations', controller.signal),
        ]).then(([latestResult, observationsResult]) => {
            if (latestResult.status === 'fulfilled') {
                setLatest(latestResult.value);
            } else if (!(latestResult.reason instanceof Error && latestResult.reason.name === 'AbortError')) {
                setDataError(true);
            }
            if (observationsResult.status === 'fulfilled') {
                setObservations(observationsResult.value);
            } else if (!(observationsResult.reason instanceof Error && observationsResult.reason.name === 'AbortError')) {
                setObservationsError(true);
            }
        }).finally(() => {
            if (!controller.signal.aborted) setDataLoading(false);
        });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setHistoryLoading(true);
        setHistoryError(false);
        fetchJson<HistoryPoint[]>(`/prices/history?period=${period}`, controller.signal)
            .then(setHistory)
            .catch((error: unknown) => {
                if (error instanceof Error && error.name !== 'AbortError') {
                    setHistory([]);
                    setHistoryError(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setHistoryLoading(false);
            });
        return () => controller.abort();
    }, [period]);

    const provinces = latest?.provinces ?? [];
    const provincesById = useMemo(() => new Map(provinces.map((province) => [province.provinceId, province])), [provinces]);
    const provinceIdsByName = useMemo(
        () => new Map(provinces.map((province) => [normalizeProvinceName(canonicalProvinceName(province.province)), province.provinceId])),
        [provinces],
    );
    const selectedProvince = selectedProvinceName
        ? { id: selectedProvinceId, name: selectedProvinceName }
        : selectedProvinceId
            ? geoJson?.features
            .map((feature) => ({ id: provinceIdsByName.get(normalizeProvinceName(getProvinceName(feature))) ?? null, name: getProvinceName(feature) }))
                .find((province) => province.id === selectedProvinceId)
            : undefined;
    const selectedAverage = selectedProvinceId ? provincesById.get(selectedProvinceId) : undefined;
    const nationalAverage = latest?.national ?? null;
    return (
        <>
            <HomeHeroSection
                nationalAverage={nationalAverage}
                euro={euro}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
                dataLoading={dataLoading}
                dataError={dataError}
            />

            <HomeHistorySection
                history={history}
                period={period}
                onPeriodChange={setPeriod}
                loading={historyLoading}
                error={historyError}
                euro={euro}
                formatDate={formatDate}
            />

            <HomeObservationsSection
                observations={observations}
                observationsError={observationsError}
                dataLoading={dataLoading}
                euro={euro}
                formatDate={formatDate}
            />

            <HomeAlertCallout />

            <HomeMapSection
                geoJson={geoJson}
                mapError={mapError}
                provinces={provinces}
                nationalAverage={nationalAverage}
                theme={theme}
                selectedProvince={selectedProvince}
                selectedProvinceName={selectedProvinceName}
                selectedAverage={selectedAverage}
                euro={euro}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
                onSelectProvince={(id, name) => {
                    setSelectedProvinceId(id);
                    setSelectedProvinceName(name);
                }}
                onClearSelection={() => {
                    setSelectedProvinceName(null);
                    setSelectedProvinceId(null);
                }}
            />
        </>
    );
}
