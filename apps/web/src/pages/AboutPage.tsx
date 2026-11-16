export function AboutPage() {
    return (
        <article className="content-page about-page">
            <div className="eyebrow">SOBRE EL PROYECTO</div>
            <h1>Más claridad para<br /><em>decidir con confianza.</em></h1>
            <p className="content-lead">Calorjusto es un proyecto para consultar y seguir los precios públicos de gasóleo C en España. Queremos hacer accesible la información disponible y ayudar a las personas a entender cómo evoluciona, sin confundir los precios publicados con una cotización de reparto.</p>
            <div className="about-repository">
                <div className="github-mark" aria-hidden="true">GH</div>
                <div><span className="detail-kicker">CÓDIGO ABIERTO</span><h2>El proyecto en GitHub</h2><p>Consulta el código, sigue el desarrollo y descubre cómo se construye Calorjusto.</p></div>
                <a className="repository-link" href="https://github.com/AlvaroGReg/GasES" target="_blank" rel="noreferrer">Ver repositorio <span>↗</span></a>
            </div>
        </article>
    );
}
