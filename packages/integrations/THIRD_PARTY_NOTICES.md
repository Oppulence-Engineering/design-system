# Third-party logo notices

`@oppulence/integrations/logos` bundles provider marks as data URIs so product
clients do not need to call a third-party logo service at runtime.

## Sim Studio integration icons

Most catalogue marks were rendered from the integration icon components in
[simstudioai/sim](https://github.com/simstudioai/sim) at commit
`2a6267391d24d4e10e043ce474615ce9f5d1c22a`. That source is Copyright 2026 Sim
Studio, Inc. and licensed under Apache-2.0. A copy is included at
`licenses/simstudio-apache-2.0.txt`. The generated files convert those React SVG
components to standalone SVG data URIs and add Oppulence provenance metadata.

## Simple Icons

Selected catalogue-only integrations use Simple Icons 16.28.0. Simple Icons is
released under CC0-1.0; a copy is included at `licenses/cc0-1.0.txt`. Individual
brand source URLs are retained in each `IntegrationLogoAsset`. The upstream
brand-use disclaimer is included at `licenses/simple-icons-disclaimer.txt`.

## Iconify SVG Logos

Selected catalogue-only integrations use the SVG Logos collection exposed by
Iconify, package version 1.2.11. The collection is by Gil Barbara and released
under CC0-1.0. A copy is included at `licenses/cc0-1.0.txt`.

## Vendor favicons

Where an open SVG collection had no suitable mark, the package snapshots the
brand owner's public favicon and records the official domain in
`IntegrationLogoAsset.sourceUrl`.

## Trademarks

All product names, marks, favicons, and logos may be trademarks of their
respective owners, regardless of the copyright license covering the icon file.
Their inclusion identifies an available integration and does not imply
endorsement, sponsorship, or affiliation. Consumers remain responsible for
following each brand owner's trademark and usage guidelines.
