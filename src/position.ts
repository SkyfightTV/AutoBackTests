import { TVDrawingRiskReward, TVPricePoint } from './tradingview.js';

export enum PositionStatus {
  InProgress = 0,
  Win = 1,
  Loss = 2,
}

export enum PositionDirection {
  SHORT,
  LONG,
}

export default class Position {
  private risk: number = 0;
  private RR: number = 0;
  private status: PositionStatus = PositionStatus.InProgress;
  private entryPrice: number = 0;
  private lastPrice: number = 0;
  public drawing: TVDrawingRiskReward;
  public direction: PositionDirection;

  constructor(drawing: TVDrawingRiskReward) {
    this.update(drawing);
  }

  getR() {
    switch (this.status) {
      case PositionStatus.InProgress:
        return 0;
      case PositionStatus.Win:
        return this.RR;
      case PositionStatus.Loss:
        return -this.risk;
    }
  }

  private getPrices(points: TVPricePoint[]): [number, number] {
    const length = Math.pow(10, points[0].price.toString().length - 2);
    const entryPrice = Math.round(points[0].price * length) / length;
    const lastPrice =
      Math.round(points[points.length - 1].price * length) / length;
    return [entryPrice, lastPrice];
  }

  public needUpdate(drawing: TVDrawingRiskReward): boolean {
    const { state: newState } = drawing.state;
    const { state: currentState } = this.drawing.state;
    const [entryPrice, lastPrice] = this.getPrices(drawing.state.points);

    if (entryPrice != this.entryPrice || lastPrice != this.lastPrice) {
      return true;
    }
    if (currentState.profitLevel != newState.profitLevel) {
      return true;
    }
    if (currentState.stopLevel != newState.stopLevel) {
      return true;
    }
    if (currentState.risk != newState.risk) {
      return true;
    }
    return false;
  }

  private getStatus(): PositionStatus {
    if (this.lastPrice != this.entryPrice) {
      if (this.direction) {
        return this.lastPrice > this.entryPrice
          ? PositionStatus.Win
          : PositionStatus.Loss;
      } else {
        return this.lastPrice < this.entryPrice
          ? PositionStatus.Win
          : PositionStatus.Loss;
      }
    }
    return PositionStatus.InProgress;
  }

  public update(drawing: TVDrawingRiskReward) {
    const { state: newState } = drawing.state;

    this.drawing = drawing;
    this.risk = newState.risk;
    this.RR =
      Math.round((newState.profitLevel / newState.stopLevel) * 100) / 100;
    this.direction =
      this.drawing.state.type == 'LineToolRiskRewardLong'
        ? PositionDirection.LONG
        : PositionDirection.SHORT;

    const [entryPrice, lastPrice] = this.getPrices(drawing.state.points);
    this.entryPrice = entryPrice;
    this.lastPrice = lastPrice;
    this.status = this.getStatus();
  }
}
