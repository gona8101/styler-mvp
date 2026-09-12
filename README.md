# styler MVP v2 — Real Agent

추가된 기능
- Vercel Function `/api/agent`
- OpenAI Responses API
- LLM이 직접 tool을 선택하는 Agent loop
- `search_products`
- `get_product`
- `find_matching_items`
- 실제 products.json 검색 결과를 상품 카드로 노출
- 현재 PDP 상품 ID를 Agent context로 전달
- 간단한 대화 히스토리 유지

배포 전 필수
Vercel > Project > Settings > Environment Variables에 `OPENAI_API_KEY`를 추가하고 재배포하세요.

다음 단계
- 이미지 업로드
- 보유 의류 이미지 분석
- 상담 history 저장
