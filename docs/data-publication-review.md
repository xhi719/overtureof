# 데이터 출처와 공개 전 확인

이 문서는 이용조건 확인을 돕는 작업 기록이며 적법성 보증이나 법률 자문이 아니다. 자료별 원문·버전·라이선스와 프로젝트의 변환 내용을 공개 전에 다시 확인한다. `.gitignore`는 이미 추적 중인 파일의 커밋 이력이나 강제 추가를 막지 못한다. 이 폴더는 작성 시점에 Git 저장소가 아니므로 업로드 전 실제 스테이징 목록과 이력, 비밀정보를 별도로 검사해야 한다.

| 자료 | 출처 및 현재 확인 | 공개 전 취급 |
| --- | --- | --- |
| ISCO-08 | [ILO 이용조건](https://www.ilo.org/rights-and-permissions)은 2023-05-03 이전 발행물에 CC BY를 자동 적용하지 않는다. 해당 CSV 및 파생 정규화 파일의 재배포 조건은 미확인이다. | 두 파일을 Git에서 제외하고 로컬에 보존한다. 허락 또는 정확한 라이선스 확인 전 재배포하지 않는다. [상세](../data/isco-08/README.md) |
| Anthropic 노동시장 노출 | [공식 데이터셋 README](https://huggingface.co/datasets/Anthropic/EconomicIndex/raw/main/README.md)는 헤더에 MIT, 본문에 데이터 CC-BY와 코드 MIT를 적으며 데이터의 CC-BY 버전은 명시하지 않는다. | 원본 CSV 및 정규화 JSON을 Git에서 제외한다. 새 환경에서 빌드는 가능하지만 시뮬레이션 결과를 제공하려면 별도 확보 및 정규화가 필요하다. 재배포 조건을 권리자에게 확인한다. [상세](../data/anthropic-labor-2026/README.md) |
| Anthropic 로봇 노출 | [해당 데이터 설명서](https://huggingface.co/datasets/Anthropic/EconomicIndex/raw/main/robot_exposure/README.md)는 CC BY 4.0, O*NET 기여와 변경 고지를 명시한다. | 저작자·출처·라이선스 링크·원본 및 프로젝트 변환·비보증 고지를 유지한다. [상세](../data/anthropic-robot-2026/README.md) |
| O*NET 31.0 | [원본 이용조건](https://www.onetcenter.org/license_db.html)은 데이터베이스 콘텐츠에 CC BY 4.0과 출처, 라이선스 및 수정 고지를 요구한다. 별도의 자료에 일괄 적용되지는 않는다. | 해당 자료의 출처·변경·비보증 고지와 링크를 유지한다. [상세](../data/onet-31.0/ATTRIBUTION.md) |
| OpenAI 연구 데이터 | [원본 저장소](https://github.com/openai/GPTs-are-GPTs)의 MIT 라이선스와 출처를 저장해 두었다. | 원본 저작권·라이선스 고지를 유지하고 연구 지표와 사이트 추정치를 구분한다. [상세](../data/openai-gpts-2023/README.md) |
| Natural Earth | [원본 이용조건](https://www.naturalearthdata.com/about/terms-of-use/)은 배포된 지도 데이터를 퍼블릭 도메인으로 설명한다. | 지형 변환과 원본 출처 기록을 유지한다. [상세](natural-earth-map.md) |
| 기계 번역 | `onet-31.0-ko.json`의 영어 원문은 O*NET 31.0이다. [O*NET 이용조건](https://www.onetcenter.org/license_db.html)은 CC BY 4.0 출처·라이선스·변경 표시를 요구한다. 실제 사용 모델의 [변환본 배포자 목록](https://huggingface.co/Unbakedcookie/live-translator-models)은 영어→한국어 모델에 CC BY 4.0을 표기하고, [Helsinki-NLP 모델 카드](https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-ko)도 CC BY 4.0을 표기한다. 모델 가중치 라이선스만으로 번역문 자체의 모든 권리관계가 자동 확정되는 것은 아니다. | O*NET 원문·모델·번역 및 수동 수정 사실, 공식 승인 부재와 번역 미검수 고지를 유지한다. 모델 파일은 포함하지 않는다. 최종 배포 범위에 다른 원문이나 제3자 번역이 섞인 경우 그 권리를 따로 확인한다. [상세](../data/translation/README.md) |
| KSCO-8 | [통계청 고시 제2024-328호](https://mods.go.kr/board.es?act=view&bid=107&list_no=431582&mid=a10403040000)는 분류 항목표를 고시 범위에 명시한다. [저작권법 제7조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033063839)는 국가의 고시 등을 저작권법상 보호받지 못하는 저작물로 규정한다. `classification.json`은 고시 항목표의 한국어 코드와 명칭을 추출한 파일이며, 로컬 원본에서 재생성한 결과와 SHA-256이 일치한다. | 이 근거는 해당 고시 항목을 대상으로 한 검토이며 다른 자료 전체의 재배포 허락이 아니다. 질병관리청 자료는 코드 대조에 사용했고 영어 번역은 포함하지 않았다. 질병관리청 원본 등 검증용 `data/raw/`는 제외한다. [상세](../data/ksco8/README.md) |
| Frontier Era 공식 로고 | `public/images/frontier-era-logo.png`는 프로젝트 사용자가 공식 자산이라고 확인하여 제공한 원본이다. 사이트 표시를 위해 원본 비율을 유지하고 CSS 투명도만 변경한다. | 공개 저장소에서는 제외하고 로컬에 보존한다. 소유자 제공 및 이 사이트의 사용 허락 사실만 기록하며, 별도 허락 없이 제3자에게 재사용·상표 사용권이 부여된다고 해석하지 않는다. |

O*NET·Anthropic 관측값, BLS 전망과 로봇 지수는 직업 대체 확률이나 대체 날짜의 검증된 관측값이 아니다. 사이트 수치는 해당 지표와 사이트 자체 가정을 결합한 시뮬레이션이다. 각 자료의 허락 여부는 표시 방법의 적절성이나 예측 타당성과 별도로 검토한다.

프로젝트 자체 코드에는 사용자의 선택에 따라 [MIT 라이선스](../LICENSE)를 적용한다. 제3자 자료의 개별 라이선스를 프로젝트 코드 라이선스로 대체하거나, 공용 데이터·상표·로고에 일괄 적용하지 않는다. GitHub 공개와 운영 배포는 별도 판단이며 이 문서의 기재 자체가 어느 쪽도 승인하지 않는다.
