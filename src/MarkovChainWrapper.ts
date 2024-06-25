import { createHash } from 'crypto';
import { decrypt, encrypt, hashGroupID } from "./cipher";
import * as fs from 'fs';
import MarkovChain from 'markovts';


export default class MarkovChainWrapper {

    public static loadOrCreateMarkovChain(groupIDString: string) {

        //Check if there's a file named with the hashed groupID
        const fileName = createHash('sha256').update(groupIDString).digest('hex');
        const filePath = `./models/${fileName}.txt`;

        //If there is, load the file into MarkovChain, else create a new one
        if (fs.existsSync(filePath)) {
            const fileDataEncrypted = fs.readFileSync(filePath, 'utf8');
            const fileData = decrypt(fileDataEncrypted, groupIDString);

            const markovData = JSON.parse(fileData);

            console.log("markov loaded from file");
            return MarkovChain.fromJSON(markovData);
            
        } else {
            console.log("new markov created");
            return new MarkovChain(1);
        }
    }

    public static saveMarkovChain(markov: MarkovChain, groupIDString: string) {

        const fileName = createHash('sha256').update(groupIDString).digest('hex');
        const filePath = `./models/${fileName}.txt`;

        const jsonObject = markov.toJSON();
        const jsonString = JSON.stringify(jsonObject);

        //crypt the jsonString using the groupID as a symmetric key
        const encrypted = encrypt(jsonString, groupIDString);

        // Write JSON string to file
        fs.writeFileSync(filePath, encrypted);

        console.log("markov saved");
    }

    //function that computes probability to see if markov has to generate a new sentence
    public static generateByProbability(markov: MarkovChain, talking_probability: number) {
        
        //Insert a probability that markov chain will generate a message
        if(Math.random() <= talking_probability) 
            return markov.generate();
        else
            return null;

    }

    public static changeGroupID(oldGroupID: string, newGroupID: string) {
        
        if(oldGroupID !== newGroupID) {
            //Get the group's model file and decrypt it
            const fileNameHashed = hashGroupID(oldGroupID);
            const filePath = `./models/${fileNameHashed}.txt`;
            const fileDataEncrypted = fs.readFileSync(filePath, 'utf8');

            const modelData = decrypt(fileDataEncrypted, oldGroupID);

            //Encrypt it again with the new group's ID
            const newFileNameHashed = hashGroupID(oldGroupID);
            const newFilePath = `./models/${newFileNameHashed}.txt`;
            const newFileDataEncrypted = encrypt(modelData, newGroupID);

            //Write the file
            fs.writeFileSync(newFilePath, newFileDataEncrypted);
            fs.unlinkSync(filePath);       
        }
    }   
}
