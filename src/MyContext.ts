import { Context, SessionFlavor } from "grammy";
import MarkovChain from "markovts";

interface SessionData {
	markov: MarkovChain;
}

export type MyContext = Context & SessionFlavor<SessionData>;