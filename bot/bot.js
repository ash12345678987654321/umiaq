const Discord = require("discord.js");
const client = new Discord.Client();

const fs = require("fs");

const words = new Map(); //store words and their definition

const dist = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
//this is just a distribution of tiles to generate scrabble word quiz
const score = [1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10];
///letter values

const L2 = []; //set of 2 letters
const L3 = []; //set of 3 letters

let curRack;
let usedSet = new Set(); ///set of used words
let numwords = new Map(); ///map of id: scores: number of words
let points = new Map(); ///map of id: points: points of words

let gameOnGoing=false;

function toAlphagram(str) { ///generates alphagram
    return str.split("").sort().join("");
}

function getPoints(str) { ///gets points of word
    let res = 0;
    for (let i = 0; i < str.length; i++) {
        res += score[str.charCodeAt(i) - 65];
    }
    return res;
}

function genWord(length){
	let word = ""
	for (let i = 0; i < length; i++) word += dist[rng(0, 98)];
	return word;
}

function isFormable(word, rack){
	word = toAlphagram(word)
	rack = toAlphagram(rack)
	length = rack.length
	for (let mask = 0; mask < (1<<length); mask++) {
		let check = "";
		for (let i = 0; i < length; i++) {
			if (mask & (1 << i)) {
				check += rack[i];
			}
		}
		if (check === word) {
			return true;
		}
	}
	return false;
}

function addWord(id, word){ ///id got word, add points and score
	if (numwords.get(id) == undefined) numwords.set(id,0);
	if (points.get(id) == undefined) points.set(id,0);
	numwords.set(id,numwords.get(id)+1);
	points.set(id,points.get(id)+getPoints(word));
	usedSet.add(word);
}

client.on("ready", () => {
    console.log("Reading lexicon...");

    fs.readFile('../rsc/CSW19.txt', function (err, data) {
        if (err) throw err;

        for (let word of data.toString().split("\r\n")) {
            const temp = word.split("\t");

            words.set(temp[0], temp[1]);

            if (temp[0].length === 2) L2.push(temp[0]);
            if (temp[0].length === 3) L3.push(temp[0]);
        }
    });

    console.log("Bot is online!");
});

client.on("message", async msg => {
    if (msg.author.bot) return;
    //console.log(msg)
    let message = msg.content;

    if (message.length < 2 || message.substring(0, 2) !== "u!") {
        if (msg.channel.id === '706659909630033991' && gameOnGoing) {

            let word = message.toUpperCase();
            //console.log("word is " + word);
            if (words.has(word) && !usedSet.has(word) && isFormable(word,curRack)) {
				let id = msg.author.username;
				msg.react('👍');
				addWord(id,word)
				return;
            }
        }
        return;
    }
    message = message.substring(2).split(" ");
    console.log(message);

    if (message[0] === "ping") {
        const m = await msg.channel.send("Ping?");
        m.edit("Latency is " + (m.createdTimestamp - msg.createdTimestamp) + "ms.");
    } else if (message[0] === "valid") {
        if (message.length < 2) {
            msg.channel.send("No word specified");
        } else {
            const word = message[1].toUpperCase();
            console.log(word);

            if (words.has(word)) {
                msg.channel.send(word + " is valid!\n" +
                    "Definition: " + words.get(word));
            } else {
                msg.channel.send(word + " is not valid!");
            }
        }
    } else if (message[0] === "test") {
        let word = "";
        if (rng(0, 2) === 0) {
            if (rng(0, 2) === 0) word = L2[rng(0, L2.length)];
            else word = genWord(2)
        } else {
            if (rng(0, 2) === 0) word = L3[rng(0, L3.length)];
			else word = genWord(3);
        }

        console.log(word);

        await msg.channel.send(msg.author.toString() + " " + word).then(async sentEmbed => {
            try {
                await sentEmbed.react('✅');
                await sentEmbed.react('❎');
            } catch (error) {
                console.error('One of the emojis failed to react.');
            }

            let graded = false;

            const filter = (reaction, user) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❎') && user.id === msg.author.id;
            const collector = sentEmbed.createReactionCollector(filter, {time: 5000});
            collector.on('collect', r => {
                if (graded) return;
                graded = true;

                var choice = (r.emoji.name === '✅');

                let verdict;
                if (choice === words.has(word)) verdict = "You are correct!\n";
                else verdict = "You are wrong!\n";

                if (words.has(word)) verdict += word + " is a word.\nDefinition: " + words.get(word);
                else verdict += word + " is not a word.";

                sentEmbed.edit(verdict);

                sentEmbed.reactions.cache.get('✅').remove();
                sentEmbed.reactions.cache.get('❎').remove();
            });
            collector.on('end', collected => {
                if (graded) return;

                let verdict = "You ran out of time.\n";

                if (words.has(word)) verdict += word + " is a word.\nDefinition: " + words.get(word);
                else verdict += word + " is not a word.";

                sentEmbed.edit(verdict);

                sentEmbed.reactions.cache.get('✅').remove();
                sentEmbed.reactions.cache.get('❎').remove();
            });
        });
    } else if (message[0] === "scramble") {
        if (msg.channel.id !== '706659909630033991') return; //ensure games only take place in scramble

        if (gameOnGoing){
            msg.channel.send("A game is currently going on...");
        }
        else {
            gameOnGoing = true;
            curRack = toAlphagram(genWord(7));
            msg.channel.setTopic(curRack);
            msg.channel.send("Rack: "+curRack);
            usedSet.clear();
            numwords.clear();
			points.clear();
            setTimeout(() => {
                let toSend = "Scores: \n";
                for (let [k, v] of numwords) {
                    toSend += (k + ": " + v + " words, " + points.get(k) + " points\n");
                    //console.log(k + ": " + v + "," + points.get(k));
                }
                msg.channel.send(toSend);
                gameOnGoing = false;
            }, 60000);
        }
    }

});

client.login(require('./auth.json').token);

//utility shit
function rng(min, max) { //get a random integer from [min,max)
    return Math.floor(Math.random() * (max - min)) + min;
}