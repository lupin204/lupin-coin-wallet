const electron = require("electron"),
    path = require("path"),
    url = require("url"),
    getPort = require("get-port"),
    lupincoin = require('./lupin-coin/src/server');


    getPort().then(port => {
        // start lupin-coin express server.
        const server = lupincoin.app.listen(port, () => {
            console.log(`Running blockchain node on: http://localhost:${port}`);
        });

        lupincoin.startP2PServer(server);

        // --> electron에서 node.js 's global 변수에 저장 --> remote.getGlobal("sharedPort") 로 sharedPort 변수를 가져와서 --> React에서 사용.
        // --> node.js 글로벌 변수에 저장하여, electron / node.js / react 3군데서 모두 사용 가능한 변수로 만들었음!!
        global.sharedPort = port;
    })

/*
const app = electron.app;                           // node.js의 express app 같은 초기화.
const BrowserWindow = electron.BrowserWindow;       // <브라우저 window> 타입 설정 = BrowserWindow:웹사이트처럼보임
*/
const { app, BrowserWindow } = electron;

let mainWindow;

// application 시작 함수
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: false,
        title: "Lupincoin Wallet"
    });

    const ENV = process.env.ENV;
    console.log(ENV);

    // 개발기에서는 reactApp을 localhost를 바라보게 하고, 운영에서는 build된 곳을 보게 함.
    if (ENV === "dev") {
        mainWindow.loadURL("http://localhost:3000");
    } else {
        mainWindow.loadURL(
            url.format({
                pathname: path.join(__dirname, "uidev/build/index.html"),
                protocol: "file",
                slashes: true
            })
        );
    }



    mainWindow.on("closed", () => {
        mainWindow = null;
    });

}

// MacOS에서는 elctron App을 닫아도 App이 실제로는 종료되지 않음.
// --> 탭에서 클릭하면 다시 App을 띄우도록 처리.
app.on("window-all-closed", () => {
    // Darwin = Apple에서 만든 OS(리눅스 커널같은 존재)
    if (process.platform !== "darwin") {
        app.quit();
    }
})
app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
})

app.on("ready", createWindow);