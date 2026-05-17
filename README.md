# STL Hole Filler

Try the app online: [https://jedundon.github.io/stl-hole-filler/](https://jedundon.github.io/stl-hole-filler/)

STL Hole Filler is a focused web app for loading an STL, selecting recessed text or logo regions, previewing fill solids, and exporting a multi-part 3MF that slicers can treat as separately assignable parts.

## Development

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

The app is deployed to GitHub Pages from `master` via the workflow in `.github/workflows/pages.yml`.
