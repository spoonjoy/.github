# Agents in spoonjoy/.github

Spoonjoy's GitHub surfaces use Spoonjoy's own brand, The Kitchen Table: bone paper, charcoal ink, sparse brass, editorial food photography, Fraunces, Source Serif 4 and IBM Plex Sans Condensed. The source of truth is `docs/design-language.md` in [spoonjoy/spoonjoy-v2](https://github.com/spoonjoy/spoonjoy-v2). Never put another brand's mark or name on a Spoonjoy surface; a plain "built with Ouro HX" link is fine where true.

## A brand change is done only when every surface carries it

1. Change the images in `brand/` and record each one in `brand/provenance.json` (file, sha256, source images, how it was made, and the prompt if generated).
2. Update every surface in `brand/surfaces.json`: the README header blocks between `<!-- spoonjoy:brand:start -->` and `<!-- spoonjoy:brand:end -->`, each repository's About (description, homepage, topics), and its social preview. GitHub has no API for social previews: upload them in Settings > General > Social preview.
3. Add any new surface to `brand/surfaces.json`.
4. Run `node brand/tools/audit.mjs` and keep going until it says every surface is current.

A README's first line under its title equals the repository's About description, and the line after the links says how to start.

## Rebuilding an image

`brand/tools/compose.html` lays out each header and social preview from the source images listed in `brand/provenance.json`; `brand/tools/render.cjs` renders it at 2x with Playwright. Images carry no text that should be live text, except the social previews, which are only seen as link cards.
