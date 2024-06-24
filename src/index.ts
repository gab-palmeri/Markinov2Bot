import * as dotenv from 'dotenv';
dotenv.config();

import MarkinovBot from "./MarkinovBot";

const bot = new MarkinovBot(process.env.BOT_TOKEN);
bot.start().then(() => console.log("Bot started")).catch(console.error);



