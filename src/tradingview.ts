import { EventEmitter } from 'events';
import https from 'https';
import config from '../config.json' assert { type: 'json' };
import Position from './position.js';

interface TVUser {
  id: string;
}

export interface TVPricePoint {
  price: number;
  time_t: number;
}

export type TVPartialDrawing = {
  id: string;
  serverUpdateTime: number;
  state: {
    state: {
      symbol: string;
    };
  };
};

export type TVDrawingRiskReward = TVPartialDrawing & {
  state: {
    type: 'LineToolRiskRewardShort' | 'LineToolRiskRewardLong';
    state: {
      profitLevel: number;
      stopLevel: number;
      risk: number;
    };
    points: TVPricePoint[];
  };
};

export type TVDrawing = TVDrawingRiskReward;

type Response<Type = object> = {
  data: Type;
  cookies: string[];
};

function request<Type = object>(
  options = {},
  content = '',
): Promise<Response<Type>> {
  return new Promise((cb, err) => {
    const req = https.request(options, (res) => {
      let buffer = '';
      res.on('data', (c) => {
        buffer += c;
      });
      res.on('end', () => {
        try {
          const data: Type = JSON.parse(buffer);
          cb({ data, cookies: res.headers['set-cookie'] });
        } catch (error) {
          console.log(buffer);
          err(new Error("Can't parse server response"));
        }
      });
    });

    req.on('error', err);
    req.end(content);
  });
}

class FormData {
  public buffer: string = '';
  public boundary: string = '';

  constructor() {
    const random = (Math.random() * 10 ** 20).toString(36);
    this.boundary = `${random}`;
    this.buffer = `--${this.boundary}`;
  }

  append(key: string, value: string) {
    this.buffer += `\r\nContent-Disposition: form-data; name="${key}"`;
    this.buffer += `\r\n\r\n${value}`;
    this.buffer += `\r\n--${this.boundary}`;
  }

  toString(): string {
    return `${this.buffer}--`;
  }
}

const tradingViewFullDomain = `${
  config.tradingView.locale ?? 'www'
}.tradingview.com`;

export async function loginUser(
  username: string,
  password: string,
): Promise<{ sessionId: string; sessionSignature: string }> {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  formData.append('remember', 'on');

  const { data, cookies } = await request<{ error: string }>(
    {
      method: 'POST',
      host: tradingViewFullDomain,
      path: '/accounts/signin/',
      headers: {
        referer: `https://${tradingViewFullDomain}`,
        'Content-Type': `multipart/form-data; boundary=${formData.boundary}`,
        'User-Agent': 'TVAPI/1.0',
      },
    },
    formData.toString(),
  );

  if (data.error) {
    throw new Error(data.error);
  }

  const sessionCookie = cookies.find((c) => c.includes('sessionid='));
  const sessionId = (sessionCookie.match(/sessionid=(.*?);/) ?? [])[1];

  const signCookie = cookies.find((c) => c.includes('sessionid_sign='));
  const sessionSignature = (signCookie.match(/sessionid_sign=(.*?);/) ?? [])[1];

  return {
    sessionId,
    sessionSignature,
  };
}

export async function getChartToken(
  layoutId: string,
  userId: string,
  sessionId: string,
  sessionSignature: string,
): Promise<string> {
  const { data } = await request<{ token: string }>({
    host: tradingViewFullDomain,
    path: `/chart-token/?image_url=${layoutId}&user_id=${userId}`,
    headers: {
      cookie: `sessionid=${sessionId};sessionid_sign=${sessionSignature};`,
    },
  });

  if (!data.token) {
    throw new Error('Wrong layout or credentials');
  }

  return data.token;
}

export async function getDrawings(
  layoutId: string,
  userId: string,
  sessionId: string,
  sessionSignature: string,
): Promise<TVDrawing[]> {
  const chartToken = await getChartToken(
    layoutId,
    userId,
    sessionId,
    sessionSignature,
  );

  const { data } = await request<{
    payload: {
      sources: TVDrawing[];
    };
  }>({
    host: 'charts-storage.tradingview.com',
    path: `/charts-storage/get/layout/${layoutId}/sources?chart_id=_shared&jwt=${chartToken}`,
    headers: {
      cookie: `sessionid=${sessionId};sessionid_sign=${sessionSignature};`,
    },
  });

  if (!data.payload) {
    throw new Error('Wrong layout, user credentials, or chart id.');
  }

  return Object.values(data.payload.sources || {});
}

export async function getUser(
  sessionId: string,
  sessionSignature: string,
): Promise<TVUser> {
  return new Promise((cb, err) => {
    https
      .get(
        `https://${tradingViewFullDomain}/`,
        {
          headers: {
            cookie: `sessionid=${sessionId};sessionid_sign=${sessionSignature};`,
          },
        },
        (res) => {
          let buffer = '';
          res.on('data', (data) => {
            buffer += data;
          });
          res.on('end', () => {
            if (buffer.includes('auth_token')) {
              cb({
                id: /"id":([0-9]{1,10}),/.exec(buffer)[1],
              });
            } else {
              err(new Error('Wrong or expired sessionid/signature'));
            }
          });

          res.on('error', err);
        },
      )
      .end();
  });
}

export default class TV extends EventEmitter {
  private readonly date: Date = new Date();
  private readonly savedDrawings: Map<string, Position> = new Map<
    string,
    Position
  >();

  constructor(
    private readonly sessionId: string,
    private readonly sessionSignature: string,
    private readonly layoutId: string,
  ) {
    super();
  }

  public async start() {
    const user: TVUser = await getUser(this.sessionId, this.sessionSignature);
    setInterval(async () => {
      try {
        const drawings = await getDrawings(
          this.layoutId,
          user.id,
          this.sessionId,
          this.sessionSignature,
        );

        for (const drawing of drawings) {
          this.processDrawings(drawing);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }

  private async processDrawings(drawing: TVDrawing) {
    if (
      drawing.state.type !== 'LineToolRiskRewardShort' &&
      drawing.state.type !== 'LineToolRiskRewardLong'
    ) {
      return;
    }

    if (drawing.serverUpdateTime < this.date.getTime()) {
      return;
    }

    try {
      if (this.savedDrawings.has(drawing.id)) {
        const pos = this.savedDrawings.get(drawing.id);
        if (pos === undefined) {
          console.log('Error: pos is undefined');
          return;
        }
        if (pos.needUpdate(drawing)) {
          pos.update(drawing);
          this.emit('positionUpdate', pos);
        }
      } else {
        const pos = new Position(drawing);
        this.savedDrawings.set(drawing.id, pos);
        this.emit('positionCreate', pos);
        console.log('Created position');
      }
    } catch (e) {
      console.error(e);
    }
  }
}
