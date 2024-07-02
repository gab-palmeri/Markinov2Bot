import { Bot, GrammyError, HttpError, session } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { getSessionKey } from "./middlewares";
import { limit } from "@grammyjs/ratelimiter";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";

import composer from "./composer/composer";

import { MyContext } from "./MyContext";


export default class MarkinovBot {

	private bot: Bot<MyContext>;

	constructor(token: string) {
		this.bot = new Bot<MyContext>(token);

		//Set the bot commands list
		this.bot.api
            .setMyCommands([
				{command: "start", description: "show start message"},
				{command: "markov", description: "talk"},
				{command: "markovclear", description: "erase bot memory for this chat"},
				{command: "markovprob", description: "set bot talking probability"},
            ])
            .catch(console.error);

		//Set the basic error handler
		this.bot.catch((err) => {
            console.error(`Error while handling update ${err.ctx.update.update_id}:`);

			err.error instanceof GrammyError
                ? console.error('Error in request:', err.error.description)
                : err.error instanceof HttpError
                ? console.error('Could not contact Telegram:', err.error)
                : console.error('Unknown error:', err.error);
        });

		//Set the session middleware and initialize session data
		this.bot.use(sequentialize(getSessionKey));
		this.bot.use(session({getSessionKey, initial: () => ({markov: null, talking_probability: 0.2})}));

		//Set the auto-retry middleware
		this.bot.api.config.use(autoRetry());

		const throttler = apiThrottler();
		this.bot.api.config.use(throttler);

		this.setRateLimits();
		this.setCommands();
	}

	public setCommands() {
		this.bot.use(composer);
	}

	public setRateLimits() {
		//Set up the user-side rate limiter, only for commands
		this.bot.filter(ctx => ctx.has("::bot_command")).use(limit({
			timeFrame: 5000,
			limit: 3,
			onLimitExceeded: async (ctx) => {
				try {
					await ctx.deleteMessage();
				} catch (error) {
					let groupInfo: string | number;
					if(ctx.chat.type !== "private")
						groupInfo = `${ctx.chat.title} (${ctx.chat.id})`;
					else 
						groupInfo = ctx.chat.id;

					console.log(`[R] Could not delete the message "${ctx.msg.text}" from the group ${groupInfo} because the bot is not an admin`);
				}

				const issuerUsername = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
				await ctx.reply("🕑 " + issuerUsername + ", wait some time before sending another command.");
			},
			
			keyGenerator: (ctx) => ctx.from?.id.toString() + "-" + ctx.chat.id.toString(),
		}));
	}

	public async start() {
		const runner = run(
			this.bot, 
			500, 
			{allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"], drop_pending_updates: true},
			{retryInterval: 1000},
		);

		const stopRunner = () => runner.isRunning() && runner.stop() && process.exit(0);
		process.once("SIGINT", stopRunner);
		process.once("SIGTERM", stopRunner);
	}
}
