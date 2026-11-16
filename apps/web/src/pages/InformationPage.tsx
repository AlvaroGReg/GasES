export function InformationPage() {
    return (
        <article className="content-page information-page">
            <div className="eyebrow"><span className="live-dot" /> INFORMACIÓN · ORIGEN DE LOS DATOS</div>
            <h1>Datos públicos,<br /><em>consultados en origen.</em></h1>
            <p className="content-lead">Calorjusto consulta la API pública del Geoportal de Hidrocarburos para mostrar los precios de gasóleo C publicados por estaciones terrestres en España.</p>
            <section className="information-card">
                <span className="information-number">01</span>
                <div><h2>La fuente: la API pública del Geoportal</h2><p>Los datos que mostramos proceden de la API pública del Geoportal de Hidrocarburos, servicio del Ministerio para la Transición Ecológica y el Reto Demográfico. La API publica información de precios de carburantes de estaciones terrestres.</p><p>En esta primera versión, la explicación se limita a identificar esa API como fuente. El detalle del proceso de consulta, validación, almacenamiento y actualización se concretará más adelante.</p><a className="text-link" href="https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help" target="_blank" rel="noreferrer">Consultar la documentación de la API pública <span>↗</span></a></div>
            </section>
            <aside className="information-notice"><span>i</span><p>Los precios corresponden a publicaciones de estaciones terrestres. No son ofertas de suministro a domicilio ni garantizan el precio que ofrecerá un distribuidor.</p></aside>
        </article>
    );
}
