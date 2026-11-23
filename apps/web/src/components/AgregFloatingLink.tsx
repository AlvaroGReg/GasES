import { useTranslation } from '../i18n';
import '../styles/components/AgregFloatingLink.css';

export function AgregFloatingLink() {
    const { t } = useTranslation();

    return (
        <a className="agreg-floating-link" href="#/sobre" aria-label={`${t('navigation.about')} — AGREG`} title={t('navigation.about')}>
            <img src="logos/logo_letra-v2.png" alt="" />
        </a>
    );
}
