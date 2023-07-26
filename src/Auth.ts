import NotionSettings from "./NotionSettings";

export default class Auth {
  constructor(

    //Notion
    public readonly notion_auth: string = "",
    public readonly database_id: string = "",

    //TradingView
    public readonly session_id: string = "",
    public readonly session_id_sign: string = "",
    public readonly layout_id: string = "",


    public readonly settings: NotionSettings = new NotionSettings(),
  ) {
  }
}

