import { Composer } from "grammy";
import { checkIfAdmin, checkIfGroup } from "../middlewares";
import { MyContext } from "../MyContext";

import MarkovChainWrapper from "../MarkovChainWrapper";

import * as fs from 'fs';

const composer = new Composer<MyContext>();

composer.command("start", async ctx => {

    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
    const message = isGroup ? "hello. i will start talking like you." : "hello. put me in a group and i will talk like you.";

    await ctx.reply(message);
    
});

composer.command("markov", checkIfGroup, async ctx => {

    if(ctx.session.markov == null) {
        ctx.session.markov = MarkovChainWrapper.loadOrCreateMarkovChain(ctx.chat.id.toString());

        setInterval(() => {
            MarkovChainWrapper.saveMarkovChain(ctx.session.markov, ctx.chat.id.toString());
        }, 1000 * 60 * 5).unref();
    }

    const response = MarkovChainWrapper.generateByProbability(ctx.session.markov, 1.0);
    await ctx.reply(response);
});

composer.command("markovclear", checkIfGroup, checkIfAdmin, async ctx => {

    MarkovChainWrapper.eraseModelFile(ctx.chat.id.toString());
    ctx.session.markov = MarkovChainWrapper.loadOrCreateMarkovChain(ctx.chat.id.toString());

    await ctx.reply("memory erased");
});

composer.command("markovprob", checkIfGroup, checkIfAdmin, async ctx => {
    
        if(ctx.msg.text == null) return;
    
        const probability = parseFloat(ctx.msg.text.split(" ")[1]);
    
        if(isNaN(probability) || probability < 0 || probability > 1) {
            await ctx.reply("give me a float number between 0 and 1.");
            return;
        }
    
        ctx.session.talking_probability = probability;
        await ctx.reply(`talking probability set to ${probability}.`);
});


composer.on("message", checkIfGroup, async ctx => {

    if(ctx.session.markov == null) {

        ctx.session.markov = MarkovChainWrapper.loadOrCreateMarkovChain(ctx.chat.id.toString());

        //Save markov chain to file every 10 minutes
        setInterval(() => {
            MarkovChainWrapper.saveMarkovChain(ctx.session.markov, ctx.chat.id.toString());
        }, 1000 * 60 * 5).unref();
    }


    //if the message is forwarded discard it
    if(ctx.message.forward_origin != null) return;
    
    //Add msg to markov chain
    const msg = ctx.message.text || ctx.message.caption;

    //temporary code
    if(msg == undefined) {
        console.log("undefined message");
        //write ctx object to file
        fs.writeFileSync(`ctx${ctx.chat.id}.txt`, JSON.stringify(ctx, null, 2));
    }

    if(msg == undefined) return; //discard messages without text

    ctx.session.markov.add(msg);

    //If the user is replying to the bot, the bot is more likely to reply
    const isReplyingToBotMessage = ctx.message.reply_to_message != null && ctx.message.reply_to_message.from.id == ctx.me.id;
    const talking_probability = isReplyingToBotMessage ? ctx.session.talking_probability + 0.2: ctx.session.talking_probability;

    const response = MarkovChainWrapper.generateByProbability(ctx.session.markov, talking_probability);

    if(response != null) {
        const replying_probability = 0.3;
        let reply_to_message_id = null;

        //Probability that it will reply to the last message
        if(Math.random() <= replying_probability) {
            reply_to_message_id = ctx.message.message_id;
        }

        await ctx.reply(response, { reply_to_message_id: reply_to_message_id });
    }

});


composer.on("my_chat_member", checkIfGroup, async ctx => {

    const oldStatus = ctx.myChatMember.old_chat_member.status;
    const newStatus = ctx.myChatMember.new_chat_member.status;

    //Bot added to the group or supergroup
    if((oldStatus === "left" || oldStatus == "kicked") && (newStatus === "member" || newStatus === "administrator")) {
        await ctx.reply("hello. put me in a group and i will talk like you.", { parse_mode: "HTML" });
    }
});

//Migrate to super group
composer.on(":migrate_to_chat_id", async ctx => {
    //Get the group's model file and decrypt it
    const oldGroupID = ctx.chat.id.toString();
    const newGroupID = ctx.msg.migrate_to_chat_id.toString();

    MarkovChainWrapper.changeGroupID(oldGroupID, newGroupID);

    console.log(`group migrated ${ctx.chat.id} -> ${ctx.msg.migrate_to_chat_id}`);
});




export default composer;