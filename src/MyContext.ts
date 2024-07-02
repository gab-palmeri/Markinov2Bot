import { Context, SessionFlavor } from "grammy";
import MarkovChain from "markovts";

interface SessionData {
	markov: MarkovChain;
	talking_probability: number;
}

export type MyContext = Context & SessionFlavor<SessionData>;