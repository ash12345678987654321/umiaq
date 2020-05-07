const Discord = require("discord.js");
const client = new Discord.Client();

const fs = require("fs");

const words = new Map(); //store words and their definition
const words_vec = [];

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

const testSet = new Set(); //make sure user does not hold 2 games

const scrambleChannels = new Set(['706659909630033991', '707951810702213220']);

client.on("ready", () => {
    console.log("Reading lexicon...");

    fs.readFile('../rsc/CSW19.txt', function (err, data) {
        if (err) throw err;

        for (let word of data.toString().split("\r\n")) {
            const temp = word.split("\t");

            words.set(temp[0], temp[1]);
            words_vec.push(temp[0]);

            if (temp[0].length === 2) L2.push(temp[0]);
            if (temp[0].length === 3) L3.push(temp[0]);
        }
    });

    client.user.setActivity("Scrabble");

    console.log("Bot is online!");
});

client.on("message", async msg => {
    if (msg.author.bot) return;
    //console.log(msg)
    let message = msg.content;

    if (message.length < 2 || message.substring(0, 2) !== "u!") { //string does not match command format
        if (scrambleChannels.has(msg.channel.id) && gameOnGoing) {
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
    } else if (message[0] === "anagram") {
        if (message.length < 2) {
            msg.channel.send("No rack specified!");
            return;
        }

        let rack = message[1].toUpperCase();

        let res = "";

        for (let word of words_vec) {
            if (isFormable(word, rack)) {
                res += word + "\n";
            }
        }

        if (res === "") msg.author.send("No words found.");
        else msg.author.send(res);
    } else if (message[0] === "pattern") {
        msg.author.send("pattern");
    } else if (message[0] === "starts") {
        msg.author.send("starts");
    } else if (message[0] === "ends") {
        msg.author.send("ends");
    } else if (message[0] === "contains") {
        msg.author.send("contains");
    } else if (message[0] === "test") {
        if (testSet.has(msg.author.id)) {
            msg.channel.send("You are already in a test...");
            return;
        }

        testSet.add(msg.author.id);

        let score = 0;
        let bad = false;

        while (!bad) {
            let fin = false;

            let word;
            if (rng(0, 5) === 0) { //eh is there a better balance?
                if (rng(0, 2) === 0) word = L2[rng(0, L2.length)];
                else word = genWord(2);
            } else {
                if (rng(0, 2) === 0) word = L3[rng(0, L3.length)];
                else word = genWord(3);
            }

            msg.channel.send(msg.author.toString() + " " + word).then(async sentEmbed => {
                let graded = false;

                const filter = (reaction, user) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❎') && user.id === msg.author.id;
                const collector = sentEmbed.createReactionCollector(filter, {time: 5000});
                collector.on('collect', r => {
                    if (graded) return;
                    graded = true;

                    const choice = (r.emoji.name === '✅');

                    let verdict;
                    if (choice === words.has(word)) {
                        verdict = "You are correct!\n";
                        score++;
                    } else {
                        verdict = "You are wrong!\n";
                        bad = true;
                    }
                    if (words.has(word)) verdict += word + " is a word.\nDefinition: " + words.get(word);
                    else verdict += word + " is not a word.";

                    sentEmbed.edit(verdict);

                    //sentEmbed.reactions.cache.get('✅').remove();
                    //sentEmbed.reactions.cache.get('❎').remove();

                    fin = true;
                });
                collector.on('end', () => {
                    if (graded) return;

                    let verdict = "You ran out of time.\n";

                    if (words.has(word)) verdict += word + " is a word.\nDefinition: " + words.get(word);
                    else verdict += word + " is not a word.";

                    sentEmbed.edit(verdict);

                    //sentEmbed.reactions.cache.get('✅').remove();
                    //sentEmbed.reactions.cache.get('❎').remove();

                    bad = true;
                    fin = true;
                });

                try {
                    await sentEmbed.react('✅');
                    await sentEmbed.react('❎');
                } catch (error) {
                    console.error('One of the emojis failed to react.');
                }
            });

            while (!fin) await sleep(200); //somehow this works idk really dk how but dont touch
        }

        msg.channel.send(msg.author.toString() + " your score is " + score);
        testSet.delete(msg.author.id);
    } else if (message[0] === "scramble" || message[0] === "scr") {
        if (!scrambleChannels.has(msg.channel.id)) return; //ensure games only take place in scramble

        if (gameOnGoing) {
            msg.channel.send("A game is currently going on...");
            return;
        }

        gameOnGoing = true;

        let gameTime = 60000;
        if (message.length > 1) {
            let inputTime = parseInt(message[1]);
            if (!isNaN(inputTime) && inputTime >= 10) gameTime = inputTime * 1000;
        }

        curRack = genWord(7);
        curRack = toAlphagram(curRack).join("");
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
                if (points.get(x) < points.get(y)) return 1;
                else if (points.get(x) === points.get(y)) {
                    if (numWords.get(x) < numWords.get(y)) return 1;
                    else if (numWords.get(x) === numWords.get(y)) return 0;
                    else return -1;
                } else return -1;
            });

            let toSend = "Scores: \n";
            for (const id of ids) {
                toSend += (names.get(id) + ": " + numWords.get(id) + " words, " + points.get(id) + " points\n");
            }
            msg.channel.send(toSend);

            gameOnGoing = false;
        }, gameTime);
    } else if (message[0] === "help") {
        msg.channel.send("```\n" +
            "Prefix: u!\n" +
            "\n" +
            "Commands:\n" +
            "valid - check if a word is valid\n" +
            "anagram - check for anagrams (WIP)\n" +
            "pattern - check for all words that fit pattern (WIP)\n" +
            "starts - check for all words that starts with that string (WIP)\n" +
            "end - checks for all words that ends with that string (WIP)\n" +
            "contains - checks for all words that contains that string (WIP)\n" +
            "test - test your 2 and 3 letter knowledge\n" +
            "scramble - play scramble (only available in scramble channel)\n" +
            "```");
    }
});

client.login(require('./auth.json').token);

function toAlphagram(str) {
    return str.split("").sort();
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

function sleep(time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}
