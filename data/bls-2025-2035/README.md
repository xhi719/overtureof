# BLS 2025–2035 직업별 고용 전망

미국 노동통계국(BLS)의 [Table 1.2 Occupational projections and worker characteristics](https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm)의 2025년 기준 및 2035년 전망 고용 수치다. 원 출처의 최종 수정일은 2026-08-27이며, 2026-11-01에 확인했다. BLS의 자료는 미국 연방정부 작성 공공 자료다.

공식 XLSX 직접 다운로드는 BLS 서버에서 자동 접근 차단 응답을 반환했다. 이 디렉터리의 `official-table-extract.json`은 BLS가 제공하는 **공식 HTML 표를 웹 열람 도구로 구간별 확인해** 가져온 수치 추출본이다. 표 본문 165–1277행의 연속성과 SOC 코드의 고유성을 확인했다. 상위 합계 행을 제외한 2018 SOC 세부 항목 831건을 보존하며, 표의 각 값은 천 명 또는 퍼센트 단위의 반올림된 원문 수치다. `raw-percent-by-code.json`에는 SOC별 고용 변화율 원문 문자열과 해당 출처 행번호를 별도로 보존한다. 숫자 0과 원문에 `—`로 표시한 결측값은 구별한다. 현재 연결된 O*NET 581개 항목에서는 결측 변화율이 없으며 0인 값은 5개다.

`onet-soc-crosswalk.csv`는 [O*NET-SOC 2019 → SOC 2018 공식 대응표](https://www.onetcenter.org/taxonomy/2019/soc.html)의 [CSV 원본](https://www.onetcenter.org/taxonomy/2019/soc/2019_to_SOC_Crosswalk.csv?fmt=csv) 1,016행이다. 미국 노동부 고용훈련청 O*NET 자료의 변경물은 CC BY 4.0에 따라 출처와 변경을 밝혀야 하며, 노동부의 승인이나 보증을 뜻하지 않는다. 로컬 O*NET 31.0 원본 코드와 영어 이름을 모두 대조해 1,016건이 일치함을 확인했다.

`python etl/normalize_bls_projections.py`는 두 출처를 코드로 연결하고 원문 값·행번호·직업 제목 및 중복을 검증해 `normalized.json`을 만든다. 번역 오류로 제외된 직업은 재등록하지 않는다. 현재 남은 O*NET 602개 가운데 581개가 BLS가 제공하는 부모 SOC 행에 연결되며, 나머지 21개 코드는 정규화 파일의 `metadata.missingOnet`에 기록한다. KSCO는 공식 대응표 없이 연결하지 않는다. 정규화 값의 `relation`은 `official_crosswalk_soc_parent`다. **BLS 값은 상위 SOC 전체의 미국 고용 전망이며 세부 O*NET 직업에 대한 독립 전망이 아니다. 고용 변화율은 AI 기인 감소율이나 대체 확률이 아니다.**

출처 파일의 SHA-256:

- `official-table-extract.json`: `a40025bc0cb475d33d39349072c197dbd7e5149d7d1f493e22137a7167f468f2`
- `raw-percent-by-code.json`: `b1dac42ff4d35a47d900c46b7a209562b2e00a75c8d1d1f3d7ed3e9831b1d097`
- `onet-soc-crosswalk.csv`: `506fff0a3ca0d26137b9389322413022a4348bead559c4dd24edeb2cea86aa89`

검산 예: BLS 공식 표에서 배우 SOC 27-2011의 2025년과 2035년 고용은 모두 67.5천 명, 전망 변화율 원문은 `0.0`이다. BLS는 [배우 직업전망](https://www.bls.gov/ooh/entertainment-and-sports/actors.htm)에서 AI가 일부 하위 분야에 영향을 줄 수 있다고 밝히지만, 이 값을 AI 대체율로 제시하지 않는다.
