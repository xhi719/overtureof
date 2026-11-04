# O*NET 31.0 직업명 한국어 번역 초안

`onet-31.0-ko.json`은 O*NET 31.0 원본 영어 명칭을 한국어로 번역한 초안이며 미국 노동부나 한국의 공식 번역이 아닙니다. 일부 명백한 오역과 영문 잔여를 수동 수정했지만 전체 명칭을 전문 인력이 검수하지 않았습니다. 직업상 중요한 결정을 내릴 때는 원문과 대조해야 합니다. 원본 영어 명칭과 검색 인덱스는 그대로 남습니다.

영어 원문: 미국 노동부 고용훈련청의 [O*NET 31.0](https://www.onetcenter.org/database.html), CC BY 4.0. 한국어 번역은 원본의 변경물입니다. USDOL/ETA가 이 번역을 승인하거나 보증하지 않았습니다.

번역 모델: 헬싱키 대학교 Language Technology Research Group의 OPUS-MT English–Korean transformer-big 모델. [원본 모델](https://object.pouta.csc.fi/Tatoeba-MT-models/eng-kor/opusTCv20210807-sepvoc_transformer-big_2022-07-28.zip), [CTranslate2 변환본](https://huggingface.co/Unbakedcookie/live-translator-models), CC BY 4.0. 변환본을 정수 8비트로 실행했습니다. `manuallyCorrected`는 일부의 수동 교정 표시이며 전문 검수 완료를 뜻하지 않습니다.

`npx tsx scripts/import-onet-ko.ts --validate-only`는 원본 코드·영문명·번역 개수와 공란, 영어 잔여만 검사합니다. 이는 의미 정확성을 보증하지 않습니다. `npx tsx scripts/import-onet-ko.ts`는 1,016개 공식 코드에 연결해 누락된 번역만 삽입하며 기존 관리자 번역을 덮어쓰지 않습니다. 원본 또는 모델이 바뀌면 재검토가 필요합니다.

현재 DB에서는 사용자 요청에 따라 명백한 오역 또는 비문으로 분류된 414개 직업을 제거했습니다. 이 중 161개는 후속 원문 대조에서 추가로 제외했습니다. [제외 목록](onet-31.0-exclusions.json)의 코드와 사유를 확인할 수 있으며 재수입 시 제외됩니다. 원본 JSON의 1,016개 번역은 검토 이력을 위해 보존합니다. 남은 602개도 전문 검수 완료를 뜻하지 않습니다. 삭제 전 전체 DB 백업은 프로젝트의 `.runtime/backups/`에 있습니다.
