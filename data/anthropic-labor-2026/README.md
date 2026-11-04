# Anthropic 직업별 AI 업무 노출 자료 (2026)

`job_exposure.csv`는 Anthropic의 [공개 원본 파일](https://huggingface.co/datasets/Anthropic/EconomicIndex/blob/main/labor_market_impacts/job_exposure.csv)을 변경하지 않고 보존한 것입니다. 보고서는 [Labor market impacts of AI: A new measure and early evidence](https://www.anthropic.com/research/labor-market-impacts), 2026-03-05, Anthropic입니다. 2026-11-01에 저장소 파일 버전 `7a1cc3c`에서 수집했습니다.

- 원본 SHA-256: `4f0a3adf5feeb2ec5f5d02ab18cc5e851a2a4b8470bde84c0c9335017be12d68`
- 원본 열: `occ_code`, `title`, `observed_exposure`; 미국 SOC 6자리 직업군 756행, 코드 중복 없음.
- 정규화: `python etl/normalize_anthropic_labor.py`는 원본 해시·헤더·개수·코드·값의 범위와 중복을 검사하고 `normalized.json`을 작성합니다. 원본 숫자는 문자열로 보존하며 값을 수정하지 않습니다.
- Attribution: Anthropic, Anthropic Economic Index, “Labor market impacts of AI: A new measure and early evidence,” 2026. [원본 데이터](https://huggingface.co/datasets/Anthropic/EconomicIndex/blob/main/labor_market_impacts/job_exposure.csv). 이 프로젝트는 행을 구조화한 JSON을 추가했습니다.

## 사용 조건

Anthropic [저장소 카드](https://huggingface.co/datasets/Anthropic/EconomicIndex)의 **본문**은 데이터에 CC-BY, 코드에 MIT를 적용한다고 명시하지만, 기계 판독용 헤더에는 MIT가 표시됩니다. 본문은 CC-BY의 버전을 명시하지 않으므로 특정 버전을 단정하지 않습니다. 배포에 필요한 저작자·출처 고지와 변경 사항을 위에 표시합니다.

라이선스 표기의 차이와 버전을 권리자에게 확인하기 전까지 원본 `job_exposure.csv`와 이를 정규화한 `normalized.json`은 Git에서 제외하며 기존 로컬 파일은 보존합니다. 파일이 없어도 빌드할 수 있지만, 자료 누락으로 수치가 달라지는 것을 막기 위해 **직업별 시뮬레이션 결과 API는 자료가 없거나 유효하지 않으면 503을 반환합니다.** 결과를 사용하려면 이용 조건을 검토한 뒤 고정된 출처에서 원본을 별도로 확보하고 다음 명령으로 정규화한 후 서버를 다시 시작합니다. 파일 획득과 해시 일치는 재배포 허락의 확인이 아닙니다.

```powershell
Invoke-WebRequest -Uri 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/7a1cc3c/labor_market_impacts/job_exposure.csv' -OutFile 'data/anthropic-labor-2026/job_exposure.csv'
python etl/normalize_anthropic_labor.py
```

## 의미와 연결 범위

`observed_exposure`는 이론적인 업무 노출도와 Anthropic Claude의 업무 관련 관측 이용을 결합한 SOC 직업군 수준의 점수입니다. **고용 대체 확률, 자동화 도입률 또는 대체 날짜가 아닙니다.** 미국 자료이고, Claude를 통해 관측되지 않은 AI 사용·다른 도구·해외 노동시장 전체를 대표하지 않습니다. 0은 관측 기준을 넘지 못한 경우를 포함하므로 AI가 사용되지 않았거나 해당 업무가 불가능하다는 증거가 아닙니다.

이 파일에는 SOC 그룹별 수치만 있습니다. O*NET 세부 직업의 `.xx` 접미사를 제거하면 동일한 SOC 그룹에 속할 수 있으나, 그룹값은 그 세부 직업을 독립적으로 측정한 값이 아닙니다. 공식 버전과 제목, 범위를 확인하지 않은 명칭 유사도는 직업 대응표가 아닙니다. 한국표준직업분류와 이 데이터 사이에는 현재 검증된 공식 대응표가 없습니다.

2026-11-01 기준 현 프로젝트 O*NET 번역·제외 목록에서 남은 602개 중 436개는 SOC 6자리 코드 및 정규화한 영문 제목이 원본과 일치합니다(`.00`). 99개는 SOC 6자리만 같은 `.xx` 세부 항목이며 67개는 일치하는 SOC 코드가 없습니다. 이 수치는 자료 연결 가능성 분석이며 DB 반영, 과학적 타당성 검증 또는 개인 직업 예측을 뜻하지 않습니다.
