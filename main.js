const electron = require("electron"),
    path = require("path"),
    url = require("url"),
    lupincoin = require('./lupin-coin/src/server');

/*
const app = electron.app;                           // node.js의 express app 같은 초기화.
const BrowserWindow = electron.BrowserWindow;       // <브라우저 window> 타입 설정 = BrowserWindow:웹사이트처럼보임
*/
const { app, BrowserWindow } = electron;

// start lupin-coin express server.
const server = lupincoin.app.listen(4000, () => {
    console.log('running localhost:4000');
});

lupincoin.startP2PServer(server);

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