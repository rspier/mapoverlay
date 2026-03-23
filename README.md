# Map Layer Comparator

A side-by-side (overlay) map comparison tool. Drag and rotate the top layer to align features from different map providers or historical imagery.

## Features

- **Split Map View**: Compare two distinct map layers (Base and Overlay).
- **Independent Manipulation**: Drag and rotate the overlay map independently for precise alignment.
- **Synchronized Zoom**: Lock zoom levels between layers for a consistent perspective.
- **Deep Linking**: Share specific views (location, zoom, layers, opacity, and rotation) via URL.
- **Search**: Fly to specific locations on either map.
- **Filters**: Apply tinting (Red, Blue, Green) or Inversion for better contrast during comparison.

## Technologies

- [Leaflet](https://leafletjs.com/) for map rendering.
- [Tailwind CSS](https://tailwindcss.com/) for UI styling.
- [Photon API](https://photon.komoot.io/) for geocoding.
- GitHub Pages for static hosting.

## Local Development

Since this project uses ES Modules, it requires a local server to run.

```bash
# Example using python
python3 -m http.server
```

Open `http://localhost:8000` in your browser.

## License

Apache License 2.0 (see [LICENSE](LICENSE) for details).
