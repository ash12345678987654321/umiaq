const Discord = require("discord.js");
const client = new Discord.Client();

const fs = require("fs");

const words = new Map(); //store words and their definition

const dist = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
//this is just a distribution of tiles to generate scrabble word quiz
const score = [1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10];
const L2 = []; //set of 2 letters
const L3 = []; //set of 3 letters

let curWord;
let usedSet = new Set();
let scores = new Map();
let points = new Map();

let gameOnGoing=false;

function toAlphagram(str) {
    return str.split("").sort().join("");
}

function scoreWord(str) {
    console.log(str);
    let res = 0;
    for (let i = 0; i < str.length; i++) {
        console.log(str.charCodeAt(i) - 65);
        res += score[str.charCodeAt(i) - 65];
    }
    return res;
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
        if (msg.channel.id === '706659909630033991') {

            let word = message.toUpperCase();
            console.log("word is " + word);
            if (words.has(word) && !usedSet.has(word)) {
                let alph = toAlphagram(word);
                for (let mask = 0; mask < 128; mask++) {
                    let check = "";
                    for (let i = 0; i < 7; i++) {
                        if (mask & (1 << i)) {
                            check += curWord[i];
                        }
                    }
                    if (check === alph) {
                        let name = msg.author.username;
                        msg.react('👍');
                        if (scores[name] == null) scores[name] = 0;
                        if (points[name] == null) points[name] = 0;
                        scores[name]++;
                        points[name] += scoreWord(word);
                        //msg.channel.send(word + " is good! " + scoreWord(word) + " points");
                        usedSet.add(word);
                        return;
                    }
                }
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
            else for (let i = 0; i < 2; i++) word += dist[rng(0, 98)];
        } else {
            if (rng(0, 2) === 0) word = L3[rng(0, L3.length)];
            else for (let i = 0; i < 3; i++) word += dist[rng(0, 98)];
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

            let word = "";
            for (let i = 0; i < 7; i++) word += dist[rng(0, 98)];
            curWord = word = word.split("").sort().join("");
            msg.channel.setTopic(word);
            msg.channel.send("Rack: "+word);
            usedSet.clear();
            scores.clear();

            setTimeout(() => {
                var toSend = "Scores: \n";
                console.log(scores);
                for (var key in scores) {
                    toSend += (key + ": " + scores[key] + " words, " + points[key] + " points\n");
                    console.log(key, scores[key], points[key]);
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