import Notion from "./Notion";
import Position from "./Position";
const TradingView = require("@mathieuc/tradingview");

export default class TV {
    private readonly date: Date;
    private readonly draws: Map<string, Position>;
    private readonly draws_skip: Position[];

    public user: any;

    constructor(private readonly session_id : string, private readonly session_id_sign : string, private readonly layout_id : string) {
        this.date = new Date();
        this.draws = new Map<string, Position>();
        this.draws_skip = [];
    }

    public async start(notion : Notion) {
        console.log("Start trading view")
        this.user = await TradingView.getUser(this.session_id, this.session_id_sign);
        setInterval(async () => {
            const drawings : Record<string, any> = await TradingView.getDrawings(this.layout_id, "", {
                session: this.user.session,
                id: this.user.id,
            });

            // @ts-ignore
            drawings.map(processDrawing => this.processDrawings(processDrawing, notion));
        }, 3000);
    }

    public processDrawings(draw : Record<string, any>, notion : Notion) {
        if (draw.type !== 'LineToolRiskRewardShort' && draw.type !== 'LineToolRiskRewardLong')
            return;
        if (draw.serverUpdateTime < this.date.getTime())
            return;

        try {
            if (this.draws.has(draw.id)) {
                const pos = this.draws.get(draw.id);
                if (!pos) {
                    console.log("Error: pos is null")
                    return;
                }
                pos.update(draw);
                if (pos.need_update) {
                    this.updatePosition(pos, notion).then(() => {
                        console.log("Updated position")
                    });
                    pos.need_update = false;
                }
            } else {
                const pos = new Position(draw)
                this.draws.set(draw.id, pos);
                this.createPosition(pos, notion).then(() => {
                    console.log("Created position")
                })
            }
        } catch (e) {
            console.log(e)
        }
    }

    private async updatePosition(position : Position, notion : Notion){
        if (position.notion_id === "")
            return;
        const query_post = {
            page_id: position.notion_id,
            properties: {
                [notion.settings.date_row]: {
                    date: {
                        start: new Date(position.current.points[0]['time_t'] * 1000 - 4 * 60 * 60000).toISOString().split('.')[0] + '+02:00',
                    }
                },
                [notion.settings.position_row]: {
                    select: {
                        name: position.draw.type === 'LineToolRiskRewardShort' ? 'SHORT' : 'LONG',
                    }
                },
                [notion.settings.r_row]: {
                    number: position.status === 0 ? 0 : position.status === 1 ? position.RR : -position.risk,
                }
            }
        };
        await notion.notion.pages.update(query_post);
    }

    private async createPosition(position : Position, notion : Notion) {
        const query_post = {
            parent: {
                database_id: notion.database_id
            },
            properties: {
                [notion.settings.id_row]: {
                    title: [
                        {
                            text: {
                                content: `${++notion.database.length}`,
                            },
                        },
                    ],
                },
                [notion.settings.pair_row]: {
                    select: {
                        name: this.formatName(position.draw.symbol.split(':')[1]),
                    },
                },
                [notion.settings.date_row]: {
                    date: {
                        start: new Date(position.draw.points[0]['time_t'] * 1000 - 4 * 60 * 60000).toISOString().split('.')[0] + '+02:00',
                    }
                },
                [notion.settings.position_row]: {
                    select: {
                        name: position.draw.type === 'LineToolRiskRewardShort' ? 'SHORT' : 'LONG',
                    }
                }
            }
        }
        await notion.notion.pages.create(query_post).then(value => {
            position.notion_id = value.id;
        });
    }

    private formatName(name : string) {
        let result = name
          .replace(/[0-9]/g, '')
          .replace('!', '')
          .replace('/', '')
          .substring(0, 2);

        switch (result) {
            case 'EURJPY':
                result = 'EJ';
                break;
            case 'USDJPY':
                result = 'EJ';
                break;
            case 'BH':
                result = 'GU';
                break;
        }
        return result;
    }
}
