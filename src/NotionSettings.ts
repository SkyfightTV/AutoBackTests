export default class NotionSettings {
  constructor(
    public readonly sort_database : boolean = true,

    public readonly id_row : string = "Trade #",
    public readonly date_row : string = "Date",
    public readonly pair_row : string = "Pair",
    public readonly position_row : string = "Position",
    public readonly r_row : string = "R (3 !w\\ BE)",
  ) {}
}
