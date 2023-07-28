import Notion from './Notion';
import TV from './TradingView';
import NotionSettings from "./NotionSettings";
import Auth from "./Auth";

const auth = new Auth();
const notion = new Notion(
  auth.notion_auth,
  auth.database_id,
  new NotionSettings(
    true
  )
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
