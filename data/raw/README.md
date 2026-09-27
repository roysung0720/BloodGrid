# Raw Public Source Snapshots

Files in this directory are retained as received from the named public source.
They are not edited to make them easier for the application to consume.

| Location | Retrieval purpose | Runtime use |
| --- | --- | --- |
| `census_tiger_2025/echols_county_2026_tigerweb.geojson` | Census TIGERweb query for Echols County (GEOID 13101) | County context and derived bounding-box reference |
| `cms_hospital_general_information_2026-09-26/hospital_general_information_page_2.json` | CMS Hospital General Information query page containing the selected Georgia facility records | Public facility identity/address source |
| `census_geocoder_2026-09-26/sgmc_health.json` | Census Geocoder response for the CMS SGMC HEALTH address | H-EV-01 coordinate source |
| `census_geocoder_2026-09-26/sgmc_health_lanier.json` | Census Geocoder response for the CMS SGMC HEALTH LANIER address | H-EV-02 coordinate source |
| `census_tiger_2026_roads/echols_valdosta_primary_roads.geojson` | Census TIGERweb primary-road query for the demo envelope | Geometry source for 18 synthetic road-aligned demand proxies |
| `census_tiger_2026_roads/echols_valdosta_secondary_roads.geojson` | Census TIGERweb secondary-road query for the demo envelope | Geometry source for 12 synthetic road-aligned demand proxies |

The CMS pages 1 and 3 are unmodified adjacent query pages retained from the
same retrieval session; they are not used in the scenario. The
`clinch_memorial_hospital.json` response records a no-match geocoder result and
is retained to make that discarded candidate auditable. None of these files are
live operational data.

The authoritative file-level manifest and hashes for the runtime sources are in
`data/scenarios/echols_valdosta_public_geography_v1/sources.json`.
