# BodyMap Pain — Final Release

## What this release contains

BodyMap Pain is an educational pain-location tool. It presents an interactive anatomy map with 317 selectable fragments across 23 anatomical groups. The application does not diagnose disease, prescribe treatment, or replace a qualified clinician.

The data file `data/anatomyPainMap.json` contains a stable number from 1 to 317 for every fragment, Arabic and English labels, anatomical location metadata, general non-diagnostic causes, safety warnings for selected high-risk regions, general recommendations, and a review-status marker.

## Main features

- Interactive male/female and front/back anatomy views.
- Browser-compatible SVG click handling through `components/WebBodySilhouette.tsx`.
- Native zoom and pan behavior on mobile through `BodySilhouette`.
- Search by part number, Arabic label, or muscle-group label.
- Stable part numbers displayed in selection, results, history, accessibility labels, and sharing text.
- Local history persistence through AsyncStorage.
- Shareable examination summary.
- Arabic RTL interface with `BodyMap Pain` branding and `by ElSayed` signature.
- Vercel configuration for Expo Web deployment.
- Regeneration and validation scripts for the anatomy dataset.

## Commands

```bash
npm ci
npm run validate:pain-map
npm run enrich:anatomy
npm run build:web
```

## Medical and privacy boundary

The medical text is intentionally general and safety-oriented. It is not a diagnosis and has not been independently reviewed by a licensed clinician in this repository. Before commercial publication, obtain clinical review, add a privacy policy, document consent, and perform a legal/regulatory review appropriate to the target country. The local history is stored on the user's device; no remote medical record is created by this project.
