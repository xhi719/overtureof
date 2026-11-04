# GitHub Pages용 정적 결과

이 스냅샷은 실시간 데이터베이스가 아니라 생성 시점의 직업 검색 항목과 사이트의 가정 기반 시뮬레이션 결과를 공개하기 위한 자료다. 실제 예측·연구기관이 직접 발표한 고용 대체 확률 또는 실제 대체 날짜가 아니다. 재생성 전까지 관리자의 데이터 변경이나 새로운 연구는 반영되지 않는다. 직업명의 한국어 번역은 미검수 초안일 수 있다.

`npx tsx scripts/export-pages-snapshot.ts`는 로컬 PostgreSQL에서 직업 코드·표시명·분류·검색용 별칭, 선택한 화면 문구 및 계산된 확률·시각·예측 기간·해당 공개 연구 링크만 허용 목록으로 추출해 `.runtime/pages/snapshot.json`을 작성한다. 설문 응답·동의 기록·관리자 정보·비밀값 및 미공개 원자료 점수는 출력하지 않는다. 같은 이름의 공개 항목은 기존 검색의 우선순위에 따라 중복을 제거한다. 공식 복합 분류를 나눈 표시 이름은 원래 분류의 결과를 공유한다.

산출물은 OpenAI의 [GPTs are GPTs](https://openai.com/index/gpts-are-gpts/), Anthropic의 [업무 노출 연구](https://www.anthropic.com/research/labor-market-impacts), [로봇 업무 노출 연구](https://www.anthropic.com/research/what-work-can-robots-do), 미국 [노동통계국 고용 전망](https://www.bls.gov/emp/) 및 자체적인 비검증 가정을 활용한다. 자료들의 업무 노출도와 전체 고용 전망은 AI에 의한 고용 대체 확률이 아니다. 자세한 가정은 [v10 설명](scenario-probability-v10.md)을 참고한다.

직업 분류 및 번역의 출처·변경 사항은 [데이터 공개 검토](data-publication-review.md), [O*NET 크레딧](../data/onet-31.0/ATTRIBUTION.md), [번역 기록](../data/translation/README.md)에 있다. O*NET 31.0 데이터는 미국 노동부 고용훈련청의 O*NET 31.0 Database를 출처로 하며 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 조건을 따른다. 명칭의 번역과 수정은 이 프로젝트가 한 것이며 미국 노동부가 승인하거나 보증하지 않았다. KSCO 명칭은 한국 고시 항목에서 가져왔다.

Anthropic 노동시장 원본 CSV와 정규화 입력 JSON은 재배포 조건을 확정할 수 없어 Git에서 제외한다. 원본이나 해당 입력 점수가 스냅샷에 포함되지 않더라도 모델 출력이 그 자료의 파생물인지, 공개에 추가 허락이 필요한지는 이 설명만으로 확정할 수 없다. 관련 이용조건 및 필요 시 권리자의 판단을 별도로 확인해야 한다. Frontier Era 공식 로고는 정적 공개물에 포함하지 않는다.

로컬 서버를 실행한 환경에서는 `npx tsx scripts/verify-pages-snapshot.ts`로 허용 필드, 표시명 중복 및 KSCO·O*NET·복합 분류 표본의 수치와 기존 API의 일치를 검사할 수 있다. 이 검사는 모든 법적 권리와 개인정보 유무를 보증하지 않는다.

배포 파일은 `pages-site/`의 정적 파일과 생성된 `.runtime/pages/snapshot.json`을 같은 폴더에 배치하고 빈 `.nojekyll` 파일을 추가한다. GitHub Pages에서는 이 산출물을 `gh-pages` 브랜치의 루트에서 제공한다. 스냅샷은 GitHub에 공개되므로 재생성할 때마다 허용 필드, 계산 결과 및 재배포 조건을 다시 검사해야 한다. 공개 저장소에 포함되지 않은 원본 로고·연구 자료나 로컬 DB 전체를 복사하지 않는다.
