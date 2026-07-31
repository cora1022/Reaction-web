# Cora 반응속도 테스트

화면 신호가 초록색으로 바뀐 뒤 클릭하기까지 걸린 시간을 밀리초 단위로 측정하는 정적 웹 서비스입니다.

## 주요 기능

- 안전한 난수 기반 1.6~4.2초 대기 시간
- 너무 이른 클릭 감지
- 5회 측정 평균, 최고 기록과 회차별 결과
- 최근 완료 테스트 10개를 브라우저에만 저장
- 마우스, 터치, 키보드 조작
- 화면 전환 시 진행 중인 측정 취소
- 개인정보처리방침, 이용약관, 문의, 404, SEO 메타데이터

## 로컬 실행

```powershell
npm install
npm test
npm run build
python -m http.server 4173 --directory dist
```

운영 주소는 `https://reaction.cora1022.com`이며 Netlify에서 `dist` 폴더를 배포합니다.

