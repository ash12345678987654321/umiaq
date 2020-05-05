const Discord = require("discord.js");
const client = new Discord.Client();

const fs = require("fs");

const words = new Map(); //store words and their definition

const dist = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
//this is just a distribution of tiles to generate scrabble word quiz
const score = [1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10];
const L2 = []; //set of 2 letters
const L3 = []; //set of 3 letters

let curRack;
const usedSet = new Set();

const numWords = new Map();
const points = new Map();
const names = new Map();
let ids = [];

let gameOnGoing = false;

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

    if (message.length < 2 || message.substring(0, 2) !== "u!") { //string does not match command format
        if (msg.channel.id === '706659909630033991' && gameOnGoing) {
            let word = message.toUpperCase();

            if (isFormable(word, curRack)) {
                let id = msg.author.id;
                msg.react('👍');

                if (!names.has(id)) {
                    ids.push(id);
                    names.set(id, msg.author.username);
                    numWords.set(id, 0);
                    points.set(id, 0);
                }

                numWords.set(id, numWords.get(id) + 1);
                points.set(id, points.get(id) + getPoints(word));
                //msg.channel.send(word + " is good! " + scoreWord(word) + " points");
                usedSet.add(word);
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
        let word;
        if (rng(0, 2) === 0) {
            if (rng(0, 2) === 0) word = L2[rng(0, L2.length)];
            else word = genWord(2);
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

                const choice = (r.emoji.name === '✅');

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
    } else if (message[0] === "scramble" || message[0] === "scr") {
        if (msg.channel.id !== '706659909630033991') return; //ensure games only take place in scramble

        if (gameOnGoing) {
            msg.channel.send("A game is currently going on...");
        } else {
            gameOnGoing = true;

            let gameTime = 60000;
            if (message.length > 1) {
                let inputTime = parseInt(message[1]);
                if (!isNaN(inputTime) && inputTime >= 10) gameTime = inputTime * 1000;
            }

            curRack = genWord(7);
            curRack = toAlphagram(curRack);
            msg.channel.setTopic(curRack);
            msg.channel.send("A new game for " + gameTime / 1000 + " seconds has started! ");
            msg.channel.send("Rack: " + curRack);

            //initializing shit
            usedSet.clear();
            numWords.clear();
            points.clear();
            names.clear();
            ids = [];

            setTimeout(() => {
                ids.sort(function (x, y) {
                    if (points[x] < points[y]) return 1;
                    else if (points[x] === points[y]) return 0;
                    else return -1;
                });

                let toSend = "Scores: \n";
                for (const id of ids) {
                    toSend += (names.get(id) + ": " + numWords.get(id) + " words, " + points.get(id) + " points\n");
                }
                msg.channel.send(toSend);

                gameOnGoing = false;
            }, gameTime);
        }
    }

});

client.login(require('./auth.json').token);

function toAlphagram(str) {
    return str.split("").sort().join("");
}

function getPoints(str) {
    let res = 0;
    for (let i = 0; i < str.length; i++) {
        res += score[str.charCodeAt(i) - 65];
    }
    return res;
}

function genWord(length) {
    let word = "";
    for (let i = 0; i < length; i++) word += dist[rng(0, 98)];
    return word;
}

function isFormable(word, rack) {
    if (!words.has(word) || usedSet.has(word)) return false;

    word = toAlphagram(word);
    rack = toAlphagram(rack);
    length = rack.length;
    let j = 0;
    for (let i = 0; i < length; i++) {
        if (rack[i] === word[j]) {
            j++;
        }
        if (j === word.length) return true;
    }
    return false;
}

//utility shit
function rng(min, max) { //get a random integer from [min,max)
    return Math.floor(Math.random() * (max - min)) + min;
}