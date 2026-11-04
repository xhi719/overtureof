"""Convert Natural Earth 1:110m GeoJSON land and boundaries to compact SVG paths.

Input files must be supplied locally; see docs/natural-earth-map.md for source URLs.
No third-party Python packages are required.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path


def fmt(value: float) -> str:
    value = round(value, 1)
    if value == 0:
        value = 0
    return f'{value:.1f}'.rstrip('0').rstrip('.')


def path_line(coordinates, closed: bool) -> str:
    points = []
    for pair in coordinates:
        if len(pair) < 2:
            raise ValueError('Coordinate missing longitude/latitude')
        lon, lat = pair[:2]
        if not math.isfinite(lon) or not math.isfinite(lat) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError('Invalid longitude/latitude')
        point = (fmt((lon + 180) * 4), fmt((90 - lat) * 4))
        if not points or point != points[-1]:
            points.append(point)
    if closed and len(points) > 1 and points[-1] == points[0]:
        points.pop()
    if len(points) < (3 if closed else 2):
        return ''
    return 'M' + 'L'.join(','.join(p) for p in points) + ('Z' if closed else '')


def geometry_paths(geometry, closed):
    kind = geometry['type']
    coords = geometry['coordinates']
    if closed and kind == 'Polygon':
        return [path_line(ring, True) for ring in coords]
    if closed and kind == 'MultiPolygon':
        return [path_line(ring, True) for polygon in coords for ring in polygon]
    if not closed and kind == 'LineString':
        return [path_line(coords, False)]
    if not closed and kind == 'MultiLineString':
        return [path_line(line, False) for line in coords]
    raise ValueError(f'Unexpected geometry: {kind}')


def load(path: Path, closed: bool):
    raw = path.read_bytes()
    obj = json.loads(raw)
    if obj.get('type') != 'FeatureCollection' or not obj.get('features'):
        raise ValueError('Expected a nonempty GeoJSON FeatureCollection')
    paths = [part for feature in obj['features'] for part in geometry_paths(feature['geometry'], closed) if part]
    if not paths:
        raise ValueError('No geometry was generated')
    return ''.join(paths), hashlib.sha256(raw).hexdigest(), len(obj['features'])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('land', type=Path)
    p.add_argument('borders', type=Path)
    p.add_argument('output', type=Path)
    args = p.parse_args()
    land, land_hash, land_count = load(args.land, True)
    borders, border_hash, border_count = load(args.borders, False)
    result = {'viewBox': '0 0 1440 720', 'land': land, 'borders': borders,
              'source': {'name': 'Natural Earth 1:110m', 'landSha256': land_hash, 'borderSha256': border_hash,
                         'landFeatures': land_count, 'borderFeatures': border_count}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'landFeatures': land_count, 'borderFeatures': border_count,
                      'landSha256': land_hash, 'borderSha256': border_hash,
                      'outputBytes': args.output.stat().st_size}))


if __name__ == '__main__':
    main()
