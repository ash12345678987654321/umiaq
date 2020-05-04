const Discord = require("discord.js");
const client = new Discord.Client();

const fs= require("fs");

const words=new Map(); //store words and their definition

const dist="AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
//this is just a distribution of tiles to generate scrabble word quiz

const L2=[]; //set of 2 letters
const L3=[]; //set of 3 letters

var curWord

function toAlphagram(str){
	return str.split("").sort().join("");
}

client.on("ready", () => {
    console.log("Reading lexicon...");

    fs.readFile('../rsc/CSW19.txt', function(err, data) {
        if(err) throw err;

        for (let word of data.toString().split("\r\n")){
            const temp=word.split("\t");

            words.set(temp[0],temp[1]);

            if (temp[0].length === 2) L2.push(temp[0]);
            if (temp[0].length === 3) L3.push(temp[0]);
        }
    });

    console.log("Bot is online!");
});

client.on("message", async msg => {
    if (msg.author.bot) return;

    let message = msg.content;

    if (message.length < 2 || message.substring(0, 2) !== "u!") return;
    message = message.substring(2).split(" ");

    console.log(message);

    if (message[0] === "ping") {
        const m = await msg.channel.send("Ping?");
        m.edit("Latency is "+(m.createdTimestamp - msg.createdTimestamp)+"ms.");
    }
    else if (message[0] === "valid"){
        if (message.length < 2){
            msg.channel.send("No word specified");
        }
        else{
            const word = message[1].toUpperCase();
            console.log(word);

            if (words.has(word)){
                msg.channel.send(word+" is valid!\n" +
                    "Definition: "+words.get(word));
            }
            else{
                msg.channel.send(word+" is not valid!");
            }
        }
    }
    else if (message[0] === "test"){
        var word="";
        if (rng(0,2)===0) {
            if (rng(0, 2) === 0) word=L2[rng(0, L2.length)];
            else for (let i = 0; i < 2; i++) word += dist[rng(0, 98)];
        }
        else {
            if (rng(0, 2) === 0) word=L3[rng(0, L3.length)];
            else for (let i = 0; i < 3; i++) word += dist[rng(0, 98)];
        }

        console.log(word);

        await msg.channel.send(msg.author.toString()+" "+word).then(async sentEmbed => {
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
                graded=true;

                var choice=(r.emoji.name==='✅');

                let verdict;
                if (choice===words.has(word)) verdict="You are correct!\n";
                else verdict="You are wrong!\n";

                if (words.has(word)) verdict+=word+" is a word.\nDefinition: "+words.get(word);
                else verdict+=word+" is not a word.";

                sentEmbed.edit(verdict);

                sentEmbed.reactions.cache.get('✅').remove();
                sentEmbed.reactions.cache.get('❎').remove();
            });
            collector.on('end', collected => {
                if (graded) return;

                let verdict = "You ran out of time.\n";

                if (words.has(word)) verdict+=word+" is a word.\nDefinition: "+words.get(word);
                else verdict+=word+" is not a word.";

                sentEmbed.edit(verdict);

                sentEmbed.reactions.cache.get('✅').remove();
                sentEmbed.reactions.cache.get('❎').remove();
            });
        });
    }
	else if (message[0] === "scramble" && message[1] === "start"){
		var word = "";
		for (let i = 0; i < 7; i++) word += dist[rng(0, 98)];
		curWord = word = word.split("").sort().join("")
		///how to check
		msg.channel.setTopic(word);

        msg.channel.send("rack chosen");
	}
	else if (message[0] === "g"){
		var word = message[1].toUpperCase();
		if (words.has(word)){
			word = toAlphagram(word);
			for (var mask = 0; mask < 128; mask++){
				var check = "";
				for (var i = 0; i < 7; i++){
					if (mask & (1<<i)){
						check += curWord[i];
					}
				}
				if (check === word){
					msg.channel.send("good!")
					return;
				}
			}
		}
		msg.channel.send("you cant make that word!")
	}

});

client.login(require('./auth.json').token);

//utility shit
function rng(min, max) { //get a random integer from [min,max)
    return Math.floor(Math.random() * (max - min) ) + min;
}