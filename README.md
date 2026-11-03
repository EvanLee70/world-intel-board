# World Intel Board

세계 뉴스/트렌드를 자동 수집(Bot1)·점수화 배치(Bot2)·상호연관성 예측(Bot3)하는
3-봇 파이프라인의 결과를 보여주는 정적 대시보드입니다.

- `index.html` — 칸반 보드 UI (점수 구간별: Top/High/Medium/Low + Predictions)
- `data.json` — Bot2가 매일 자동 생성/커밋하는 데이터 (뉴스 항목 + 예측)

데이터는 Obsidian vault(`wiki/world/*.md`)에서 추출되며, 원본 자동화는
Hermes 에이전트의 `secondbrain_bots` 프로젝트가 담당합니다.
