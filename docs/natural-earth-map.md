# 인트로 세계 지도 데이터

메인 인트로, 직업 검색 및 직업 결과 화면 배경의 지형과 국경선은 [Natural Earth 1:110m Land](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/)와 [Natural Earth 1:110m Admin 0 – Boundary Lines](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-boundary-lines/)의 공개 데이터에서 만들었습니다. Natural Earth는 [이용조건](https://www.naturalearthdata.com/about/terms-of-use/)에서 해당 지도 데이터를 공개 도메인으로 제공합니다. 지형은 장식용이며 국경이나 지리 정보를 공식적으로 판정하는 용도가 아닙니다.

Natural Earth 공식 벡터 저장소의 입력 파일:

- [ne_110m_land.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson), SHA-256 `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`.
- [ne_110m_admin_0_boundary_lines_land.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_boundary_lines_land.geojson), SHA-256 `d42479fd79552cca4eec7f85fcdca717a790d29ff06be7676f1af0568c6d3f7c`.

`scripts/generate-natural-earth.py`는 두 입력의 좌표를 경위도 정거원통 투영의 1440 × 720 좌표로 변환하고 소수점 한 자리로 반올림하여 [`data/visual/world-map-110m.json`](../data/visual/world-map-110m.json)에 경로를 저장합니다. 경량 파일에는 국가명이나 다른 속성이 없습니다. 클라이언트 지도 라이브러리는 사용하지 않고, 메인 페이지에서는 한 번 정의한 경로를 두 장식 SVG가 재사용하고, 직업 결과 화면에서도 동일한 경로 데이터를 사용합니다. 입력 원본은 `.runtime/natural-earth/`에 보관되며 Git에 포함하지 않습니다.

```powershell
python scripts/generate-natural-earth.py .runtime/natural-earth/land.geojson .runtime/natural-earth/borders.geojson data/visual/world-map-110m.json
```
