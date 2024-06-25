import { Composer } from "grammy";
import { checkIfGroup } from "../middlewares";
import { MyContext } from "../MyContext";
import { createHash } from 'crypto';
import { decrypt, encrypt } from "./cipher";

//import Services from "../service/Services";

import * as fs from 'fs';

import MarkovChain from "markovts";

const composer = new Composer<MyContext>();

composer.command("start", async ctx => {

    await ctx.reply(
        "hello. put me in a group and i will talk like you.",
        { parse_mode: "HTML" }
    );
    
});

composer.on("message", checkIfGroup, async ctx => {

    if(ctx.session.markov == null) {

        //Check if there's a file named with the hashed groupID
        const fileName = createHash('sha256').update(ctx.chat.id.toString()).digest('hex');
        const filePath = `./models/${fileName}.txt`;

        //If there is, load the file into MarkovChain, else create a new one
        if (fs.existsSync(filePath)) {
            const fileDataEncrypted = fs.readFileSync(filePath, 'utf8');
            const fileData = decrypt(fileDataEncrypted, ctx.chat.id.toString());

            const markovData = JSON.parse(fileData);

            ctx.session.markov = MarkovChain.fromJSON(markovData);
            console.log("markov loaded from file");
        } else {
            ctx.session.markov = new MarkovChain(1);
            console.log("new markov created");
        }

        console.log("markov created");

        //Save markov chain to file every 10 minutes
        setInterval(() => {
            const jsonObject = ctx.session.markov.toJSON();
            const jsonString = JSON.stringify(jsonObject);

            //crypt the jsonString using the groupID as a symmetric key
            const encrypted = encrypt(jsonString, ctx.chat.id.toString());

            // Write JSON string to file
            fs.writeFileSync(`./models/${fileName}.txt`, encrypted);

            console.log("markov saved");

        }, 1000 * 60 * 5);
    }

    let talking_probability = 0.2;
    const replying_probability = 0.3;

    //if the message is replying to a bot message, increase probability
    if(ctx.message.reply_to_message != null && ctx.message.reply_to_message.from.id == ctx.me.id) {
        talking_probability = 0.6;
        console.log("bot replied");
    }
        
    //Add msg to markov chain
    const msg = ctx.message.text || ctx.message.caption;
    ctx.session.markov.add(msg.split(' '));

    //Insert a probability that markov chain will generate a message
    if(Math.random() <= talking_probability) {
        const result = ctx.session.markov.generate();

        //also insert a probability that it will reply to the last message
        if(Math.random() <= replying_probability) {
            await ctx.reply(result, { reply_to_message_id: ctx.message.message_id });
        }
        else {
            await ctx.reply(result);
        }
    }


    //IDEA: probability of sending 2-3 messages in a row
    //IDEA: sending stickers

    console.log("markov populated");

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
    const fileName = createHash('sha256').update(ctx.chat.id.toString()).digest('hex');
    const filePath = `./models/${fileName}.txt`;
    const fileDataEncrypted = fs.readFileSync(filePath, 'utf8');
    const fileData = decrypt(fileDataEncrypted, ctx.chat.id.toString());

    //Encrypt it again with the new group's ID
    const newFileName = createHash('sha256').update(ctx.msg.migrate_to_chat_id.toString()).digest('hex');
    const newFilePath = `./models/${newFileName}.txt`;
    const newFileDataEncrypted = encrypt(fileData, ctx.msg.migrate_to_chat_id.toString());
    fs.writeFileSync(newFilePath, newFileDataEncrypted);

    console.log(`group migrated ${ctx.chat.id} -> ${ctx.msg.migrate_to_chat_id}`);
});




export default composer;