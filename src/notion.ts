import { Client } from '@notionhq/client';
import {
  CreatePageParameters,
  PageObjectResponse,
  QueryDatabaseParameters,
  UpdatePageParameters,
} from '@notionhq/client/build/src/api-endpoints.js';
import { DateTime } from 'luxon';
import config from '../config.json' assert { type: 'json' };
import Position, { PositionDirection } from './position.js';

export default class Notion {
  private client: Client;
  private positionCount: number = 0;
  private positionIds: Map<string, string> = new Map<string, string>();

  constructor(
    auth: string,
    private readonly databaseId: string,
  ) {
    this.client = new Client({ auth });
  }

  private async sortDatabase(results: PageObjectResponse[]) {
    for (let i = 0; i < results.length; i++) {
      const { id, properties } = results[i];
      const column = properties[config.database.columns.id];
      if (
        column.type !== 'title' ||
        column.title[0].type !== 'text' ||
        column.title[0].text.content === `${i + 1}`
      ) {
        continue;
      }

      const updateRequest: UpdatePageParameters = {
        page_id: id,
        properties: {
          [config.database.columns.id]: {
            title: [
              {
                text: {
                  content: `${i + 1}`,
                },
              },
            ],
          },
        },
      };
      await this.client.pages.update(updateRequest);
      console.log('Cleaned n°' + (i + 1));
    }
  }

  private async query(): Promise<PageObjectResponse[]> {
    const query: QueryDatabaseParameters = {
      database_id: this.databaseId,
      sorts: [
        {
          property: config.database.columns.date,
          direction: 'ascending',
        },
      ],
    };
    const response = await this.client.databases.query(query);

    const isPage = (
      result: (typeof response.results)[0],
    ): result is PageObjectResponse =>
      result.object === 'page' && result['properties'] !== null;
    let results = response.results.filter(isPage);

    let nextCursor = response.next_cursor;
    while (response.has_more) {
      query.start_cursor = nextCursor;
      const nextResponse = await this.client.databases.query(query);
      results = results.concat(nextResponse.results.filter(isPage));
      nextCursor = nextResponse.next_cursor;
      if (nextCursor === null) {
        break;
      }
    }
    return results;
  }

  async cleanDatabase() {
    const results = await this.query();

    this.positionCount = results.length;
    if (config.database.sort) {
      await this.sortDatabase(results);
    }
  }

  async updatePosition(position: Position) {
    if (!this.positionIds.has(position.drawing.id)) {
      await this.createPosition(position);
      return;
    }

    const points = position.drawing.state.points;
    const startDate = DateTime.fromSeconds(points[0].time_t, {
      zone: 'America/New_York',
    });
    const endDate = DateTime.fromSeconds(points[points.length - 1].time_t, {
      zone: 'America/New_York',
    });
    const updateRequest: UpdatePageParameters = {
      page_id: this.positionIds.get(position.drawing.id),
      properties: {
        [config.database.columns.date]: {
          date: {
            start: startDate.toISO({ includeOffset: false }),
            time_zone: 'Europe/Paris',
            end:
              endDate.diff(startDate).toMillis() > 0
                ? endDate.toISO({ includeOffset: false })
                : undefined,
          },
          number: undefined,
        },
        [config.database.columns.reward]: {
          number: position.getR(),
        },
      },
    };
    await this.client.pages.update(updateRequest);
  }

  private formatName(name: string): string {
    if (name[0] === '6') {
      const cmeName = name.substring(0, 2);
      switch (cmeName) {
        case '6E':
          return 'EU';
        case '6J':
          return 'UJ';
        case '6B':
          return 'GU';
        case '6A':
          return 'AU';
        case '6C':
          return 'CU';
        default:
          return cmeName;
      }
    }
    const match = /([A-Z0-9]+)[A-Z][0-9]{4}/g.exec(name);
    if (match !== null && match.length > 1) {
      return match[1];
    }
    switch (name) {
      case 'EURJPY':
        return 'EJ';
      case 'USDJPY':
        return 'UJ';
      default:
        return name;
    }
  }

  async createPosition(position: Position) {
    const createRequest: CreatePageParameters = {
      parent: {
        database_id: config.database.id,
      },
      properties: {
        [config.database.columns.id]: {
          title: [
            {
              text: {
                content: `${++this.positionCount}`,
              },
            },
          ],
        },
        [config.database.columns.pair]: {
          select: {
            name: this.formatName(
              position.drawing.state.state.symbol.split(':')[1],
            ),
          },
        },
        [config.database.columns.position]: {
          select: {
            name:
              position.direction === PositionDirection.LONG ? 'LONG' : 'SHORT',
          },
        },
      },
    };

    const response = await this.client.pages.create(createRequest);
    this.positionIds.set(position.drawing.id, response.id);
    await this.updatePosition(position);
    console.log('Updated position');
  }
}
