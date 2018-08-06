# Electron으로 암호화폐 지갑 만들기 (Clone Coding)

- 셋팅
  - electron 모듈 설치
  ```sh
  >yarn add electron --dev
  ```
  - react-app 프로젝트 생성
  ```sh
  >create-react-app lupin-coin-explorer
  ```
  - 서버 구동 후 <http://localhost:3000> 에서 "React App" 확인
  ```sh
  >cd lupin-coin-explorer
  >npm start        <- npm
  >yarn start       <- yarn
  ```


- dependencies
  - electron
  - concurrently
    - 여러개의 프로세스를 한번에 하게 해주는 module
    - 여기서는 ReactJS(create-react-app) & Electron() 환경설정을 동시에 함.
  - get-port
    - port 잡는 것을 도와주는 lib.


