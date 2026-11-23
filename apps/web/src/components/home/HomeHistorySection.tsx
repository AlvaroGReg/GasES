import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { HomeHistorySectionProps, HistoryPoint } from '../../types/history';
import '../../styles/components/home/HomeHistorySection.css';

const periods = ['1y', '6m', '3m', '1m'] as const;
const dateKey = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
const dayDistance = (first: string, second: string) => Math.round((dateKey(second) - dateKey(first)) / 86_400_000);

export function HomeHistorySection({
    history,
    period,
    onPeriodChange,
    loading,
    error,
    euro,
    formatDate,
}: HomeHistorySectionProps) {
    const { t } = useTranslation();
    const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);
    const chartPoints = useMemo(() => {
        if (!history.length) return [];
        const prices = history.map((point) => point.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const range = maxPrice - minPrice || Math.max(maxPrice * 0.02, 0.01);
        const start = dateKey(history[0].date);
        const end = dateKey(history[history.length - 1].date);
        const span = Math.max(1, (end - start) / 86_400_000);
        return history.map((point, index) => ({
            point,
            x: 8 + ((dateKey(point.date) - start) / 86_400_000 / span) * 984,
            y: 166 - ((point.price - minPrice) / range) * 132,
            previous: index > 0 ? history[index - 1] : undefined,
        }));
    }, [history]);

    const area = t('home.nationalArea');
    const title = t('home.nationalHistory');

    return (
        <section className="history-section" id="historial" aria-labelledby="history-title">
            <div className="section-heading history-heading">
                <div><div className="eyebrow">{t('home.historyEyebrow')}</div><h2 id="history-title">{title}</h2><p>{t('home.historyIntro')}</p></div>
                <div className="period-controls" aria-label={t('home.historyPeriods')}>
                    {periods.map((value) => <button key={value} type="button" className={period === value ? 'is-active' : ''} aria-pressed={period === value} onClick={() => onPeriodChange(value)}>{t(`home.period.${value}`)}</button>)}
                </div>
            </div>
            <div className="history-card">
                {loading ? <div className="history-empty" role="status">{t('home.loadingHistory')}</div>
                    : error ? <div className="history-empty" role="alert"><strong>{t('home.historyErrorTitle')}</strong><p>{t('home.dataLoadError')}</p></div>
                        : history.length ? <>
                            <div className="history-chart" role="img" aria-label={t('home.chartAria', { area })}>
                                <svg viewBox="0 0 1000 190" preserveAspectRatio="none">
                                    {chartPoints.map(({ point, x, y, previous }, index) => {
                                        const joinsPrevious = previous !== undefined && dayDistance(previous.date, point.date) === 1;
                                        const previousEntry = joinsPrevious ? chartPoints[index - 1] : undefined;
                                        return <g key={point.date}>
                                            {previousEntry && <line x1={previousEntry.x} y1={previousEntry.y} x2={x} y2={y} className="chart-line" />}
                                            <circle
                                                cx={x}
                                                cy={y}
                                                r="5"
                                                className="chart-dot"
                                                tabIndex={0}
                                                aria-label={`${formatDate(point.date)} · ${euro.format(point.price)}`}
                                                onMouseEnter={() => setHoveredPoint(point)}
                                                onMouseLeave={() => setHoveredPoint(null)}
                                                onFocus={() => setHoveredPoint(point)}
                                                onBlur={() => setHoveredPoint(null)}
                                            >
                                                <title>{`${formatDate(point.date)} · ${euro.format(point.price)}`}</title>
                                            </circle>
                                        </g>;
                                    })}
                                </svg>
                                {hoveredPoint && <div className="chart-tooltip" role="status">
                                    <strong>{euro.format(hoveredPoint.price)}</strong>
                                    <span>{formatDate(hoveredPoint.date)}</span>
                                </div>}
                                <div className="chart-axis"><span>{formatDate(history[0].date)}</span><span>{formatDate(history[history.length - 1].date)}</span></div>
                            </div>
                            <div className="history-summary"><span>{t('home.historyPointCount', { count: history.length })}</span><span>{t('home.historyHoverHelp')}</span></div>
                        </> : <div className="history-empty"><div className="empty-chart-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 25V7m0 18h24M8 20l6-7 5 4 8-9" /></svg></div><strong>{t('home.historyEmptyTitle')}</strong><p>{t('home.historyEmpty', { area })}</p><span>{t('home.historyGaps')}</span></div>}
            </div>
        </section>
    );
}
