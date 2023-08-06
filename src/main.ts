import 'dotenv/config';

import fs from 'fs';
import config from '../config.json' assert { type: 'json' };
import Notion from './notion.js';
import Position from './position.js';
import TV, { loginUser } from './tradingview.js';

const { session } = config.tradingView;
if (session.id === '' || session.sign === '') {
  const data = await loginUser(
    process.env.TRADINGVIEW_EMAIL,
    process.env.TRADINGVIEW_PASSWORD,
  );
  session.id = data.sessionId;
  session.sign = data.sessionSignature;
  fs.writeFileSync(
    './config.json',
    JSON.stringify(config, () => {}, 2),
  );
  console.log('Created new trading view session');
}

console.log('Starting notion');
const notion = new Notion(
  process.env.NOTION_INTEGRATION_SECRET,
  config.database.id,
);

console.log('Cleaning database');
await notion.cleanDatabase();
console.log('Started notion');

console.log('Starting TradingView');
const tv = new TV(session.id, session.sign, config.tradingView.layoutId);

tv.on('positionCreate', (position: Position) =>
  notion.createPosition(position),
);
tv.on('positionUpdate', (position: Position) =>
  notion.updatePosition(position),
);

await tv.start();
console.log('Started trading view\nReady to go !');
