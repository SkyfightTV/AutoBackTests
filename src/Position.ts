export default class Position {
    public current : Record<string, any> = {};
    public notion_id : string = "";
    public type : boolean = false;
    public risk : number = 0;
    public RR : number = 0;
    public date : number = 0;
    // 0 = not finish, 1 = win, 2 = loss
    public status : number = 0;
    public need_update : boolean = false;

    constructor(public readonly draw : Record<string, any>) {
        this.update(draw)
    }

    public update(draw : Record<string, any>) {
        this.current = draw;
        const state = draw['state'];
        if (this.risk != state.risk)
            this.need_update = true;
        this.risk = state.risk;
        if (this.RR != state.profitLevel / state.stopLevel)
            this.need_update = true;
        this.RR = Math.round(state.profitLevel / state.stopLevel * 100) / 100;
        this.type = this.current.type == 'LineToolRiskRewardLong'
        if (this.date != this.current.points[0]['time_t'])
            this.need_update = true;
        this.date = this.current.points[0]['time_t'];
        let status = this.getStatus(draw['points']);

        if (status != this.status) {
            this.need_update = true;
            this.status = status;
        }
    }

    private getStatus(points : Record<string, any>) {
        const entry = points[0]['price'];
        let last = points[points.length - 1]['price'];
        let status = 0;

        if (last != entry) {
            const price =  Math.round(last * 10000) / 10000
            const f_price =  Math.round(entry * 10000) / 10000;

            if (this.type) {
                if (price > f_price) {
                    status = 1;
                } else {
                    status = 2;
                }
            } else {
                if (price < f_price) {
                    status = 1;
                } else {
                    status = 2;
                }
            }
        }
        return status;
    }
}
