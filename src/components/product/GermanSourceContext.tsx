const sources = [
  [
    "Operator connection perspectives",
    "50Hertz",
    "https://www.50hertz.com/Vertragspartner/Netzkunden/Netzanschluss",
    "Indicative capacity and bay information; project-specific review, validity and reuse permission remain necessary.",
  ],
  [
    "Large-unit generation",
    "Bundesnetzagentur / SMARD",
    "https://www.smard.de/home/downloadcenter/download-kraftwerksdaten/",
    "Historical production for covered units, not spare grid capacity. Preserve the release, unit match and attribution.",
  ],
  [
    "Registered asset context",
    "Marktstammdatenregister",
    "https://www.marktstammdatenregister.de/MaStRHilfe/subpages/glossar.html",
    "Registered capacity and identity; actual generation volumes and connection rights are not established.",
  ],
  [
    "Broadband coverage",
    "Bundesnetzagentur",
    "https://www.bundesnetzagentur.de/GIGA/DE/Breitbandatlas/start.html",
    "Coverage context only. Diverse carrier routes and site-specific delivery need provider evidence and separate rights review.",
  ],
  [
    "Flood screening",
    "Official Länder geodata via GovData",
    "https://www.govdata.de/suche/daten/hochwassergefahrenkarten-und-hochwasserrisikokarten-umweltatlas",
    "Check the specific dataset scope, flood scenario, effective date and licence. Missing coverage is unassessed.",
  ],
  [
    "Data-centre efficiency and heat reuse",
    "EnEfG §11",
    "https://www.gesetze-im-internet.de/enefg/__11.html",
    "Review the rules applicable to the commissioning date, conditions and exceptions; proximity to a heat network is not an offtake agreement.",
  ],
] as const;

export function GermanSourceContext() {
  return (
    <section className="finder-site-evidence" aria-labelledby="german-siting-sources">
      <h2 id="german-siting-sources">German site evidence and source access</h2>
      <p>
        These are references for investigation, not newly integrated datasets. Site-specific land,
        planning, flood, fibre, cooling and heat evidence remains unassessed until reviewed.
      </p>
      <ul>
        {sources.map(([title, authority, url, boundary]) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {title} · {authority}
            </a>
            <p>{boundary}</p>
          </li>
        ))}
      </ul>
      <h3>Historical generation utilisation</h3>
      <p>
        Net generation divided by matched net AC capacity-hours describes historical output. It does
        not measure runtime, efficiency, connection rights or spare import MW. Missing output is
        unknown. Technology-relative comparisons require a documented peer cohort.
      </p>
      <dl>
        <div>
          <dt>Capacity factor</dt>
          <dd>Historical net MWh ÷ matched net AC MW-hours, for a stated time window.</dd>
        </div>
        <div>
          <dt>Running hours</dt>
          <dd>Time operating; output can vary while the plant is running.</dd>
        </div>
        <div>
          <dt>Efficiency</dt>
          <dd>Useful output relative to energy input, with a stated system boundary.</dd>
        </div>
        <div>
          <dt>Available import capacity</dt>
          <dd>Requires current, site-specific network and operator evidence.</dd>
        </div>
      </dl>
      <p>
        A plant can have low output relative to its technology peers while producing at a high
        capacity factor. Subtracting capacity factor from 100% does not reveal spare grid MW. An
        empty result can reflect filters, missing source coverage or retrieval limits; it does not
        prove that no infrastructure exists.
      </p>
      <p>
        Public access does not establish redistribution permission. Imported evidence needs a source
        version, date, reuse basis and review. No operator records are copied by this reference
        list.
      </p>
    </section>
  );
}
