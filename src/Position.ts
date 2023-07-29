export default class Position {
    public current : Record<string, any> = {};
    public notion_id : string = "";
    public type : boolean = false;
    public risk : number = 0;
    public RR : number = 0;
    public date : number = 0;
    public price : number[] = [0, 0];
    // 0 = not finish, 1 = win, 2 = loss
    public status : number = 0;

    constructor(public readonly draw : Record<string, any>) {
        this.update(draw)
    }

    public needUpdate(draw : Record<string, any>) : boolean {
        const state = draw['state'];
        const price = this.getPrice(draw['points']);

        if (price[1] != this.price[1] || price[0] != this.price[0]) {
            console.log("Price changed")
            return true;
        }
        if (this.current.state.profitLevel != state.profitLevel) {
            console.log("Profit level changed")
            return true;
        }
        if (this.current.state.stopLevel != state.stopLevel) {
            console.log("Stop level changed")
            return true;
        }
        if (this.current.state.risk != state.risk){
            console.log("Risk level changed")
            return true;
        }
        return false;
    }

    public update(draw : Record<string, any>) {
        const state = draw['state'];

        this.current = draw;
        this.risk = state.risk;
        this.RR = Math.round(state.profitLevel / state.stopLevel * 100) / 100;
        this.type = this.current.type == 'LineToolRiskRewardLong'
        this.date = this.current.points[0]['time_t'];
        this.price = this.getPrice(this.current['points']);
        this.status = this.getStatus(this.current['points']);
    }

    private getStatus(points : Record<string, any>) {
        let status = 0;

        if (this.price[1] != this.price[0]) {
            if (this.type) {
                if (this.price[1] > this.price[0]) {
                    status = 1;
                } else {
                    status = 2;
                }
            } else {
                if (this.price[1] < this.price[0]) {
                    status = 1;
                } else {
                    status = 2;
                }
            }
        }
        return status;
    }

    private getPrice(points : Record<string, any>) {
        const length = Math.pow(10, points[0]['price'].toString().length - 2);
        const price : number[] = []
        //entry
        price[0] = Math.round(points[0]['price'] * length) / length;
        //last
        price[1] = Math.round(points[points.length - 1]['price'] * length) / length;
        return price;
    }
}
