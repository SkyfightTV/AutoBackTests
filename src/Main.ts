import Notion from './Notion';
import TV from './TradingView';
import NotionSettings from "./NotionSettings";
// @ts-ignore
import auth from "./Auth.json";
const TradingView = require("@mathieuc/tradingview");
const fs = require("fs");


function createTVSession() {
    if (auth.session_id === "" || auth.session_id_sign === "") {
        if (auth.tv_email !== "" && auth.tv_password !== "") {
            TradingView.loginUser(auth.tv_email, auth.tv_password).then((user : any) => {
                auth["session_id"] = user.session;
                auth["session_id_sign"] = user.sign;
                console.log("Created new trading view session")
                fs.writeFileSync("./src/Auth.json", JSON.stringify(auth, null, 4));
            });
        } else
            throw new Error("No session id or sign provided")
    }
}

createTVSession();

const notion = new Notion(
  auth.notion_auth,
  auth.database_id,
  new NotionSettings()
);
const tv = new TV(
  auth.session_id,
  auth.session_id_sign,
  auth.layout_id
);

notion.cleanDatabase().then(() => {
    console.log("Started notion")
    tv.start(notion).then(() => {
        console.log("Started trading view\nReady to go !")
    });
});
