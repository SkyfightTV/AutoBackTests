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
        const length = Math.pow(10, points[0]['price'].toString().length - 2);
        const entry = Math.round(points[0]['price'] * length) / length;
        const last = Math.round(points[points.length - 1]['price'] * length) / length;
        let status = 0;

        if (last != entry) {
            if (this.type) {
                if (last > entry) {
                    status = 1;
                } else {
                    status = 2;
                }
            } else {
                if (last < entry) {
                    status = 1;
                } else {
                    status = 2;
                }
            }
        }
        return status;
    }
}
