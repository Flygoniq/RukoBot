var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');
var data = require('./data.json');
var operationalChannels = data.operationalChannels;
var modList = data.modList;
var whitelist = data.whitelist;
var wordRegex = /[^a-zA-Z0-9\-*\']+/;
var FlyID = data.FlyID;
var idiotList = [];

var partnerID = '';
var topic = '';
var phase = 0;
var newRecurringMessage = {}; //parts of a recurring message: ID, creator, message, channelID[], timer
var recurringMessages = {
	"RecurringMessages": []
};
var messageSenders = [];

var hushed = false;
var dehusher = null;

var questionWords = [
	'question',
	'when',
	'where',
	'how',
	'what',
	'who',
	'where',
	'good',
];

var wordLists = null;

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
	fs.readFile('./RecurringMessages.json', 'utf8', function readFileCallback(err, data) {
		if (err) {
			logger.info(err);
		} else {
			recurringMessages = JSON.parse(data);
			recurringMessages.RecurringMessages.forEach(function(rm) {
				logger.info('Starting recurring message: ' + rm);
				messageSenders.push(sendRecurringMessage(rm));
			});
			logger.info('Message senders: ' + messageSenders);
		}
	});
	fs.readFile('./wordlist.json', 'utf8', function readFiledCallback(err, data) {
		if (err) {
			logger.info(err);
		} else {
			wordLists = JSON.parse(data).Groups;
		}
	});
	bot.setPresence({
		idle_since: null,
		game: {
			name: "'Ruko, what can you do?' for help"
		}
	});
});
bot.on('message', function (user, userID, channelID, message, evt) {
	// IGNORE OWN MESSAGES
	if (userID === '569999487909494796') {
		return;
	}
	if (channelID === '459179194509819914') {
		// logger.info(message);
	}
	var lowerMessage = message.toLowerCase();
	if (message === `?bean <@569999487909494796>`) {
		var response = `pls no bulli ruko <:RukoAngery:487284094846238721>`;
		if (isMod(userID)) {
			response = 'What the fuck did you just try to bean me, you little bitch? I\'ll have you know I graduated top star at Seisho Academy, and I\'ve been involved in numerous secret revues, and I have over 300 lead roles. I am trained in stage combat and I\'m the top traditional Japanese dancer in the entirety of takarazuka. You are nothing to me but just another stage hand.  I will wipe you the fuck out with precision the likes of which has never been seen before by the audience, mark my fucking words. You think you can get away with beaning me over the Internet? Think again, fucker. As we speak I am contacting my Futaba-han and your IP is being traced right now so you better prepare for the storm, maggot. The storm that wipes out the pathetic little thing you call your life. Omae wa mou shindeiru, kid. I can be anywhere, anytime, and I can dazzle you in over seven hundred ways, and that\'s just with my dance skills. Not only am I extensively trained in stage combat, but I have access to Suisenka and I will use it to its full extent to wipe your miserable ass off the face of the stage, you little shit. If only you could have known what unholy retribution your little "clever" bean was about to bring down upon you, maybe you would have held your fucking tongue. You cheated not only the game, but yourself, you didn\'t learn, you didn\'t grow, and now you\'re paying the price, you goddamn baka. This is Ruko Bot, kiddo. Okini';
		} else if (userID === FlyID) {
			response = `Sorry Fly... Have I been a bad bot? <:dondoncry:499134526199562251>`;
		}
		sendMessage(channelID, response);
		return;
	}
	// AQOURS CHECK
	if (lowerMessage.includes('aquor')) {
		if (idiotList.includes(userID)) {
			rukoAngery(channelID);
			return;
		} else {
			idiotList.push(userID);
			bot.sendMessage({
				to: channelID,
				message: '***AQOURS***',
			});
		}
		return;
	}
	// FLIRY CHECK
	if (lowerMessage.includes('flirry') || lowerMessage.includes('flury')) {
		if (idiotList.includes(userID)) {
			rukoAngery(channelID);
			return;
		} else {
			idiotList.push(userID);
			bot.sendMessage({
				to: channelID,
				message: '***FLIRY***',
			});
		}
		return;
	}
	//CONTINUE ONGOING CONVERSATIONS
	if (topic !== '' && userID === partnerID) {
		if (lowerMessage === 'never mind') {
			clearConversation();
			sendMessage(channelID, 'Ok');
			return;
		}
		if (topic === 'SETUP_RECURRING_MESSAGE') {
			if (phase === 1) {
				phase = 2;
				newRecurringMessage['message'] = message;
				sendMessage(channelID, 'I see. Please link the channel you would like this message sent in.');
			} else if (phase === 2) {
				phase = 3;
				newRecurringMessage['channelID'] = message.substring(2,20);
				//TODO: VERIFY, ALLOW MULTIPLE CHANNELS
				sendMessage(channelID, 'Got it. How often do you want me to send this message (just enter number in minutes)?');
			} else if (phase === 3) {
				var interval = parseInt(message);
				if (message.includes('.') || isNaN(interval) || interval < 1) {
					sendMessage(channelID, 'The interval needs to be an integer greater than or equal to 1');
					return;
				}
				clearConversation();
				newRecurringMessage['interval'] = interval;
				sendMessage(channelID, 'Okay. I shall begin sending this message.');
				logger.info(recurringMessages);
				recurringMessages.RecurringMessages.push(newRecurringMessage);
				logger.info(recurringMessages);
				var json = JSON.stringify(recurringMessages);
				fs.writeFile('./RecurringMessages.json', json, 'utf8', function() {
					messageSenders.push(sendRecurringMessage(newRecurringMessage));
				});
			}
			return;
		}
		if (topic === 'REMOVE_RECURRING_MESSAGE') {
			if (phase === 1) {
				var request = parseInt(message);
				if (message.includes('.') || isNaN(request)) {
					sendMessage(channelID, 'Please reply with one of the IDs.');
					return;
				}
				clearConversation();
				sendMessage(channelID, 'Okay. Removing message.');
				recurringMessages.RecurringMessages.splice(request, 1);
				logger.info('messageSenders before: ' + messageSenders.length);
				clearInterval(messageSenders.splice(request, 1)[0]);
				logger.info('messageSenders after: ' + messageSenders.length);
				var json = JSON.stringify(recurringMessages);
				fs.writeFile('./RecurringMessages.json', json, 'utf8');
			}
		}
		return;
	}
	//THIS SECTION FOR INTERACTIONS WITH RUKO
	if (lowerMessage.substring(0,4) === 'ruko' || lowerMessage.substring(0,8) === 'hey ruko') {
		var splitMessage = lowerMessage.split(wordRegex);
		if (splitMessage[0] === 'hey') {splitMessage.shift();}
		if (splitMessage[0] === 'ruko') {splitMessage.shift();}
		//DISPLAY HELP
		if (splitMessage[0] === 'what' && splitMessage[1] === 'can' && splitMessage[2] === 'you' && splitMessage[3] === 'do') {
			var reply = "Precede *all* commands with 'Ruko' or 'Hey Ruko'\n";
			if (isMod(userID) || userID === FlyID) {
				data.privateFunctions.forEach(function(command) {
					reply += "\n" + command;
				});
			}
			data.publicFunctions.forEach(function(command) {
				reply += "\n" + command;
			});
			sendMessage(channelID, reply);
			return;
		}
		//THIS SECTION STARTS SETUP
		if (splitMessage[0] === 'setup' || splitMessage[0] === 'create') {
			//RECURRING MESSAGE
			if (splitMessage[1] === 'recurring' && splitMessage[2] === 'message') {
				//CHECK PERMISSIONS
				if (!(isMod(userID) || userID === FlyID)) {
					sendMessage(channelID, 'Sorry, this is a restricted function.');
				} else {
					fs.readFile('./RecurringMessages.json', 'utf8', function readFileCallback(err, data) {
						if (err) {
							logger.info(err);
						} else {
							recurringMessages = JSON.parse(data);
						}
					});
					logger.info(recurringMessages);
					topic = 'SETUP_RECURRING_MESSAGE';
					partnerID = userID;
					phase = 1;
					newRecurringMessage = {
						creator: userID
					}
					sendMessage(channelID, 'Sure. What is the message?');
				}
			}
			return;
		}
		//REMOVE STUFF
		if (splitMessage[0] === 'remove' || splitMessage[0] === 'delete') {
			//RECURRING MESSAGE
			if (splitMessage[1] === 'recurring' && splitMessage[2] === 'message') {
				//CHECK PERMISSIONS
				if (!(isMod(userID) || userID === FlyID)) {
					sendMessage(channelID, 'Sorry, this is a restricted function.');
				} else if (recurringMessages.RecurringMessages.length === 0) {
					sendMessage(channelID, 'There aren\'t any recurring messages');
				} else {
					topic = 'REMOVE_RECURRING_MESSAGE';
					partnerID = userID;
					phase = 1;
					var reply = 'Okay. Please enter the index of the message you wish to remove.'
					recurringMessages.RecurringMessages.forEach(function(rm, index) {
						reply += '\nIndex: ' + index +
							', \n    Channel: ' + `<#${rm.channelID}>` +
							', \n    Message: ' + rm.message;
							', \n    Interval: ' + rm.interval;
					});
					sendMessage(channelID, reply);
				}
			}
			return;
		}
		//SHOW STUFF
		if (splitMessage[0] === 'list' || splitMessage[0] === 'show' || splitMessage[0] === 'display') {
			//RECURRING MESSAGE
			if (splitMessage[1] === 'recurring' && splitMessage[2] === 'message') {
				if (!(isMod(userID) || userID === FlyID)) {
					sendMessage(channelID, 'Sorry, this is a restricted function.');
				} else if (recurringMessages.RecurringMessages.length === 0) {
					sendMessage(channelID, 'There aren\'t any recurring messages');
				} else {
					var reply = 'Okay.'
					recurringMessages.RecurringMessages.forEach(function(rm, index) {
						reply += '\nIndex: ' + index +
							', \n    Channel: ' + `<#${rm.channelID}>` +
							', \n    Message: ' + rm.message;
							', \n    Interval: ' + rm.interval;
					});
					sendMessage(channelID, reply);
				}
			}
			return;
		}
		//HUSH RUKO
		if (splitMessage[0] === 'hush') {
			if (!(isMod(userID) || userID === FlyID)) {
				sendMessage(channelID, 'I\'m not listening to just anyone!');
			} else if (hushed === true) {
				sendMessage(channelID, 'Hey, Ruko is already hushed okay?');
			} else {
				sendMessage(channelID, 'F-fine!');
				var duration = parseInt(splitMessage[1]) * 60000;
				hushed = true;
				dehusher = setTimeout(unhush, duration);
			}
			return;
		}
		if (splitMessage[0] === 'unhush') {
			if (!(isMod(userID) || userID === FlyID)) {
				sendMessage(channelID, 'I\'m supposed to listen to the mods. Also Fly, I guess.');
			}
			if (hushed === false) {
				sendMessage(channelID, 'Ruko is not hushed right now.');
			} else {
				sendMessage(channelID, 'Phew.');
				hushed = false;
				clearTimeout(dehusher);
			}
			return;
		}
		//REDIRECT
		if (splitMessage[0] === 'redirect' && splitMessage[1]) {
			triggerMessage(channelID, splitMessage[1]);
		}
		//GREETINGS
		if (splitMessage[0] === 'headpat' || (splitMessage[0] === 'head' && splitMessage[1] === 'pat')) {
			gasm(channelID);
			return;
		}
		if (splitMessage[0] === 'good' && splitMessage[1] === 'bot') {
			acceptPraise(channelID);
			return;
		}
		if (splitMessage[0] === 'goodnight' || (splitMessage[0] === 'good' && splitMessage[1] === 'night') || splitMessage[0] === 'oyasumi') {
			sendMessage(channelID, 'Oyasumi <:rukonap:475621586762858506>');
			return;
		}
		if (splitMessage[0] === 'morning' || (splitMessage[0] && splitMessage[0].includes('ohayo')) || (splitMessage[0] === 'good' && splitMessage[1] === 'morning')) {
			sendMessage(channelID, 'Ohayou~ <:KaorukoSmol:506883771912683520>');
			return;
		}
		if (splitMessage[0] === 'i' && splitMessage[1] === 'love' && splitMessage[2] === 'you') {
			sendMessage(channelID, 'Ookini. Ruko loves Ruko too. And maybe Futaba-han. <:xmasKaoruko:518324205687668738>');
			return;
		}
		if (splitMessage[0] === 'who' && splitMessage[1] === 'are' && splitMessage[2] === 'you') {
			sendMessage(channelID, 'I\'m Ruko, of course. Fully organic and definitely not made by Flygoniq. I help the mods and play with everyone! <:Kaoruko:428941858073346056>\nMy code is at https://github.com/Flygoniq/RukoBot');
			return;
		}
	}
	if (hushed) return;
    // ignore message if not from included channel. Ignore own messages. Ignore # as those are unlikely to be culprits.
	if (!operationalChannels.includes(channelID) || onWhitelist(userID) || message.includes('#') || message.length < 10) {
		// logger.info('message disqualified');
		return;
	}
	
	var splitMessage = lowerMessage.split(wordRegex);
	var score = calculateQuestionScore(splitMessage, lowerMessage);
	wordLists.forEach(function(wordList) {
		var miniScore = 0;
		wordList.words.forEach(function(word) {
			if (splitMessage.includes(word)) {
				miniScore += wordList.wordValue;
			}
		});
		if (miniScore > wordList.maxValue) {
			miniScore = wordList.maxValue;
		}
		score += miniScore;
	});
	if (score >= 1) {
		triggerMessage(channelID, userID);
		logger.info(message);
	}
});

function isMod (userID) {
	return modList.includes(userID);
}

function rukoAngery (channelID) {
	bot.sendMessage({
		to: channelID,
		message: `Ruko senses you\'re trolling her <:RukoAngery:487284094846238721>`,
	});
}

function acceptPraise (channelID) {
	bot.sendMessage({
		to: channelID,
		message: `Ruko knows she\s the best <:RukoFufu:487283860409942017>`,
	});
}

function gasm (channelID) {
	bot.sendMessage({
		to: channelID,
		message: `<:rukogasm:472364433981833227>`,
	});
}

function onWhitelist(userID) {
	return isMod(userID) || whitelist.includes(userID);
}

function calculateQuestionScore(messageArray, message) {
	var score = 0;
	questionWords.forEach(function(word) {
		if (messageArray.includes(word)) {
			score += .25;
		}
	});
	score += message.includes('?') ? .34 : 0;
	if (score > .34) {
		score = .34;
	}
	return score;
}

function sendMessage(channelID, output) {
	bot.sendMessage({
		to: channelID,
		message: output
	});
}

function sendRecurringMessage(recurringMessage) {
	var intervalObj = setInterval(sendMessage, parseInt(recurringMessage.interval) * 60000, recurringMessage.channelID, recurringMessage.message);
	return intervalObj;
}

function unhush() {
	hushed = false;
}

function clearConversation() {
	partnerID = '';
	topic = '';
	phase = 0;
}

function triggerMessage(channelID, userID) {
	sendMessage(channelID, `Hey <@${userID}>, it seems like you may be looking to talk about Starlight Relive.\n` + 
				`Allow me to point you towards the relive section, such as <#459984807179321354>, <#568703574230695936>, or <#500310588984000513>, which is where the players and news will be.\n` + 
				'If Ruko made a mistake, pls ping Flygoniq so he can teach me.');
}