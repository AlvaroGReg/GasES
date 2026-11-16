import { createContext, useContext, useEffect, type ReactNode } from 'react';

/** Languages planned for the Spanish market; only Spanish is translated and selectable today. */
export const PLANNED_LOCALES = ['es', 'gl', 'eu', 'ca'] as const;
export const AVAILABLE_LOCALES = ['es'] as const;

export type Locale = (typeof AVAILABLE_LOCALES)[number];

const messages = {
    'app.description': 'Observatorio de datos de gasóleo C en España.',
    'app.title': 'GasEs — datos de gasóleo C',
    'navigation.home': 'Inicio',
    'navigation.information': 'Información',
    'navigation.about': 'Sobre nosotros',
    'navigation.brandHome': 'GasEs, inicio',
    'navigation.createAlert': 'Crear alerta',
    'theme.changeTo': 'Cambiar a tema {theme}',
    'theme.light': 'claro',
    'theme.dark': 'oscuro',
    'header.observatory': 'OBSERVATORIO DE GASÓLEO C EN ESPAÑA',
    'footer.tagline': 'DATOS PARA DECIDIR MEJOR',
    'footer.description': 'Un observatorio de precios publicados de gasóleo C en España.',
    'footer.explore': 'Explora',
    'footer.publicSource': 'Fuente pública',
    'footer.api': 'API del Geoportal ↗',
    'footer.ministry': 'Ministerio para la Transición Ecológica',
    'footer.disclaimer': 'Precios publicados por estaciones terrestres; no son cotizaciones de reparto.',
    'home.eyebrow': 'DATOS ABIERTOS · ESPAÑA',
    'home.titleFirst': 'El precio real.',
    'home.titleSecond': 'Sin letra pequeña.',
    'home.intro': 'Consulta los precios de gasóleo C publicados por estaciones terrestres y sigue su evolución en todo el país.',
    'home.nationalAverage': 'MEDIA NACIONAL',
    'home.officialGeoportal': 'Geoportal oficial',
    'home.perLitre': '/ litro',
    'home.lastQuery': 'Última consulta',
    'home.noDataYet': 'Sin datos todavía',
    'home.validObservations': 'Observaciones válidas',
    'home.nationalDisclaimer': 'Media de precios publicados por estaciones terrestres. No es una oferta de suministro a domicilio.',
    'home.mapEyebrow': 'EL PRECIO, PROVINCIA A PROVINCIA',
    'home.mapTitle': 'Explora el mapa',
    'home.mapIntro': 'Selecciona una provincia para consultar su media y sus datos.',
    'home.belowAverage': 'Por debajo de la media',
    'home.aboveAverage': 'Por encima',
    'home.noData': 'Sin datos',
    'home.mapAria': 'Mapa interactivo de las provincias de España',
    'home.mapLoadError': 'No se ha podido cargar el mapa provincial.',
    'home.mapLoading': 'Cargando límites provinciales…',
    'home.mapAttribution': 'Límites provinciales ·',
    'home.selectedProvince': 'PROVINCIA SELECCIONADA',
    'home.provincialDetail': 'DETALLE PROVINCIAL',
    'home.selectProvince': 'Selecciona una provincia',
    'home.observations': 'Observaciones',
    'home.provinceNoData': 'No hay datos disponibles para esta provincia.',
    'home.noPriceDate': 'No se muestra un precio ni una fecha hasta recibir una consulta válida.',
    'home.provincePrompt': 'Elige una provincia en el mapa para ver su precio medio y el número de observaciones.',
    'home.showNationalAverage': 'Ver media nacional',
    'home.mapMethod': 'Los colores comparan cada media provincial con la nacional. Los datos antiguos pierden contraste; una provincia sin observaciones permanece diferenciada.',
    'home.historyEyebrow': 'SEGUIMIENTO EN EL TIEMPO',
    'home.provinceHistory': 'Evolución en {province}',
    'home.nationalHistory': 'Evolución nacional',
    'home.historyIntro': 'Precios medios por fecha de consulta.',
    'home.historyAvailable': 'Histórico disponible',
    'home.noObservation': 'Sin observación',
    'home.historyEmptyTitle': 'Aún no hay historial de precios',
    'home.historyEmpty': 'Cuando se recopilen consultas válidas, aquí podrás ver cómo evoluciona la media {area}.',
    'home.nationalArea': 'nacional',
    'home.provinceArea': 'de {province}',
    'home.historyGaps': 'Los días sin observaciones se mostrarán como interrupciones, sin interpolar valores.',
    'home.sourceEyebrow': 'DATOS DE ORIGEN',
    'home.latestObservations': 'Últimas observaciones',
    'home.stationPrices': 'Precios publicados por estaciones terrestres.',
    'home.recordCount': '{count} registros',
    'home.station': 'Estación',
    'home.province': 'Provincia',
    'home.publishedPrice': 'Precio publicado',
    'home.sourceDate': 'Fecha de origen',
    'home.retrieved': 'Recuperado',
    'home.dateNotProvided': 'No indicada',
    'home.waitingFirstQuery': 'Esperando la primera consulta',
    'home.observationsEmpty': 'Las observaciones aparecerán aquí con su estación, provincia y fechas de origen y recuperación.',
    'home.observationsDisclaimer': 'Son precios publicados por estaciones terrestres, no cotizaciones ni precios garantizados de reparto a domicilio.',
    'home.alertEyebrow': 'NO HACE FALTA ESTAR PENDIENTE',
    'home.alertTitle': 'Que el precio te avise.',
    'home.alertIntro': 'Estamos preparando las alertas por correo para que puedas seguir el gasóleo C sin consultar la web cada día.',
    'home.comingSoon': 'PRÓXIMAMENTE',
    'information.eyebrow': 'INFORMACIÓN · ORIGEN DE LOS DATOS',
    'information.titleFirst': 'Datos públicos,',
    'information.titleSecond': 'consultados en origen.',
    'information.intro': 'GasEs consulta la API pública del Geoportal de Hidrocarburos para mostrar los precios de gasóleo C publicados por estaciones terrestres en España.',
    'information.sourceTitle': 'La fuente: la API pública del Geoportal',
    'information.sourceDescription': 'Los datos que mostramos proceden de la API pública del Geoportal de Hidrocarburos, servicio del Ministerio para la Transición Ecológica y el Reto Demográfico. La API publica información de precios de carburantes de estaciones terrestres.',
    'information.processDescription': 'En esta primera versión, la explicación se limita a identificar esa API como fuente. El detalle del proceso de consulta, validación, almacenamiento y actualización se concretará más adelante.',
    'information.apiDocumentation': 'Consultar la documentación de la API pública',
    'information.notice': 'Los precios corresponden a publicaciones de estaciones terrestres. No son ofertas de suministro a domicilio ni garantizan el precio que ofrecerá un distribuidor.',
    'about.eyebrow': 'SOBRE EL PROYECTO',
    'about.titleFirst': 'Más claridad para',
    'about.titleSecond': 'decidir con confianza.',
    'about.intro': 'GasEs es un proyecto para consultar y seguir los precios públicos de gasóleo C en España. Queremos hacer accesible la información disponible y ayudar a las personas a entender cómo evoluciona, sin confundir los precios publicados con una cotización de reparto.',
    'about.openSource': 'CÓDIGO ABIERTO',
    'about.githubTitle': 'El proyecto en GitHub',
    'about.githubDescription': 'Consulta el código, sigue el desarrollo y descubre cómo se construye GasEs.',
    'about.repository': 'Ver repositorio',
} as const;

export type MessageKey = keyof typeof messages;
type TranslationValues = Record<string, string | number>;

const catalog: Record<Locale, typeof messages> = { es: messages };
const LocaleContext = createContext<Locale>('es');

export function I18nProvider({ children }: { children: ReactNode }) {
    const locale: Locale = 'es';

    useEffect(() => {
        document.documentElement.lang = locale === 'es' ? 'es' : locale;
        document.querySelector('meta[name="description"]')?.setAttribute('content', translate(locale, 'app.description'));
        document.title = translate(locale, 'app.title');
    }, [locale]);

    return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

function translate(locale: Locale, key: MessageKey, values?: TranslationValues): string {
    const template: string = catalog[locale][key];
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`));
}

export function useTranslation() {
    const locale = useContext(LocaleContext);
    return {
        locale,
        t: (key: MessageKey, values?: TranslationValues) => translate(locale, key, values),
        formatLocale: locale === 'es' ? 'es-ES' : locale,
    };
}
