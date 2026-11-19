import { useTranslation } from '../../i18n';
import '../../styles/components/home/HomeAlertCallout.css';

export function HomeAlertCallout() {
    const { t } = useTranslation();

    return (
        <section className="alert-banner" id="alertas">
            <div className="alert-art" aria-hidden="true">↘</div>
            <div><div className="eyebrow">{t('home.alertEyebrow')}</div><h2>{t('home.alertTitle')}</h2><p>{t('home.alertIntro')}</p></div>
            <span className="coming-soon">{t('home.comingSoon')}</span>
        </section>
    );
}
