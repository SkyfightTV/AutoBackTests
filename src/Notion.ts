import {Client} from "@notionhq/client";
import NotionSettings from "./NotionSettings";
import {QueryDatabaseResponse} from "@notionhq/client/build/src/api-endpoints";

export default class Notion {
    public notion: Client;
    public database: any;

    constructor(
      private readonly notion_auth : string,
      public readonly database_id : string,
      public readonly settings : NotionSettings = new NotionSettings()
    ) {
        this.notion = new Client({ auth: this.notion_auth });
    }

    public async cleanDatabase() {
        const query = await this.query()

        if (this.settings.sort_database)
            await this.sortDatabase(query)
    }

    private sortDatabase(query : QueryDatabaseResponse) {
        let tmp = 0;

        for (let i = 0; i < query["results"].length; i++) {
            const element : any = query["results"][i];
            let clean_post : any = {
                path: `pages/${element["id"]}`,
                method: "PATCH",
                body: {
                    properties: {
                        [this.settings.id_row]: {
                            title: [
                                {
                                    text: {
                                        content: `${i + 1}`,
                                    }
                                }
                            ]
                        }
                    }
                }
            };
            if (element["properties"][this.settings.id_row]["title"][0]["text"]["content"] === `${i + 1}`)
                continue
            tmp++;
            this.notion.request(clean_post).then(r => {
                console.log("Cleaned n°" + i)
                tmp--;
            });
        }
        this.database = query["results"];
        while(tmp != 0) {}
    }

    private async query() {
        let query_post : any = {
            database_id: this.database_id,
            sorts: [
                {
                    property: "Date",
                    direction: "ascending",
                },
            ],
        }
        let query_ret = await this.notion.databases.query(query_post);

        let next_cur = query_ret["next_cursor"]
        while (query_ret["has_more"]) {
            query_post["start_cursor"] = next_cur
            let db_query_ret = await this.notion.databases.query(query_post);
            query_ret["results"] = query_ret["results"].concat(db_query_ret["results"])
            next_cur = db_query_ret["next_cursor"]
            if (next_cur === null)
                break
        }
        console.log('Database queried')
        return query_ret
    }
}
