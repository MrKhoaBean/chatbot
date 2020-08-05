import {
	logST,
	parseArg
} from "./utils.js";
import CommandManager from "./command/manager.js";

const commandManager = new CommandManager();

const TRANS_KEY = "trnsl.1.1.20200421T120324Z.a5209d29ad08ae85.7328dad8e46f00dad4a4cdb9a911868d8ace112b"; // you can use your own yandex translate API KEY
const MITSUKU_THREADID = "47719737069";

const whiteListGroup = [ // phần này để loại bỏ những group mà bạn không muốn bot hoạt động (tránh gây phiền hà)
	// 'whitelist id'
];
const emotes = ":3 🙂 😀 😞 😢 😛 😇 😈 o.O 😉 😮 😑  😠 😗 ❤ 😊 😎 😠 ♒ 😕 ♊ ☺ 󰀀 💩 ☀ ☁ ☔ ⚡ ✨ ⭐ ✳ ⛄ ☕ ♨ ⛵ ⛽ ✈ ⛲ ⛺ ⛪ ☎ ✉ ✂ 🚽 🛀 👙 👙 👕 👘 👗 👢 👠 👡 💼 👜 👔 🎩 👒 👑 💍 🚭 ⚽   ⚾ ⚾ ⛳ 🏈 🏀 🎾 🎱 🎯 🎿 🎌 🏁 🏆".split(" ");

import login from "facebook-chat-api";
import random from "random";
import axios from "axios";
import {
	JSDOM
} from "jsdom";
const {
	window
} = new JSDOM("");
import JQ from "jquery";
const jquery = JQ(window);

function deployChatbot(appState, parent) {
	login({
		appState: JSON.parse(appState)
	}, function(err, api) {

		let {
			groupManager,
			chatbot
		} = parent;
		let {
			queue
		} = chatbot;

		if (err) return console.log(err);

		let sendMessage = function(data, callback) {
			api.sendMessage(data.text, data.threadID, callback);
		};

		// saving cac thu
		parent.appState = JSON.stringify(api.getAppState());
		chatbot.err = err;
		chatbot.api = api;
		// --
		groupManager.downloadAllFromFacebook(api);

		api.listenMqtt(async function(err, mssg) {

			if (!mssg || mssg.threadID == undefined)
				return;

			let {
				threadID,
				senderID,
				body,
				isGroup
			} = mssg;

			if (whiteListGroup.indexOf(threadID) != -1) return;

			if (threadID != MITSUKU_THREADID && body && isGroup) { // tin nhan tu group gui toi
				body = body.trim();

				let group = groupManager.find(threadID, true, true);

				if (group.updating) // check if is updating . . .
					return;
				if (!group.live) // disable from dashboard
					return;
				if (group.memberManager.items.length == 0) {
					group.downloadFromFacebook(api);
				}

				if (body[0] == "/") { // check if command
					const temp = body.split(" ")[0].split("/");
					const commandName = temp[temp.length - 1]; // lay ten command
					if (commandName) {
						const command = commandManager.find(commandName);
						if (command)
							command.execute(parseArg(body, "א"), api, parent, mssg, group);
						else
							api.sendMessage("Lệnh không xác định!", threadID);
					}
					return;
				} else { // not a command
					group.messagesCount++;
					group.memberManager.find(senderID, true, true).messagesCount++;
					// group.uploadToDtb();
					// group.memberManager.find(senderID, true, true).uploadToDtb();
				}

				if (group.gaming) {
					const validNumber = ["11", "12", "13", "21", "22", "23", "31", "32", "33"];
					if (validNumber.indexOf(body) == -1)
						return;
					const game = group.game.tictactoe;
					const numbers = body.split("");
					game.add(numbers);
					const winner = game.isEnd();
					sendMessage({
						text: game.getData(),
						threadID
					});
					if (winner) {
						sendMessage({
							text: `${winner} đã chiến thắng :v`,
							threadID
						});
						group.gaming = false;
					}
				}

				if (!group.chat)
					return;

				let {
					data
				} = await axios.get(`https://translate.yandex.net/api/v1.5/tr.json/detect?key=${TRANS_KEY}&text=${encodeURI(body)}`);
				let {
					code,
					lang: userLanguage
				} = data;
				logST({
					text: `USER: '${body}' - detected (${userLanguage})`,
					icon: "reply",
					bg: "bg1"
				}, parent);
				if (code == 200) { // request thanh cong
					if (userLanguage == "en") { // neu la tieng anh thi khoi can dich (tiet kiem thoi gian)
						let text = body;
						queue.push(threadID); // khi nao api translate gui thanh cong thi moi xoa queue

						sendMessage({ // send message to mitsuku
							text,
							threadID: MITSUKU_THREADID
						});
					} else {
						axios.get(`https://translate.yandex.net/api/v1.5/tr/translate?key=${TRANS_KEY}&text=${encodeURI(body)}&lang=${userLanguage}-en`).then(({
							data
						} = {}) => {
							queue.push(threadID); // khi nao api translate gui thanh cong thi moi xoa queue
							jquery("body").html(data);
							let text = jquery("text").html();

							sendMessage({
								text,
								threadID: MITSUKU_THREADID
							});
							logST({
								text: `"${body}"" - translated to "${text}" (${userLanguage} --> en)`,
								icon: "exchange-alt",
								bg: "bg1"
							}, parent);
						});
					}
				}
			}

			if (mssg.threadID == MITSUKU_THREADID) { // neu la MITSUKU thi gui cho group
				let queryID = queue.splice(0, 1)[0];
				let group = groupManager.find(queryID, true, true);
				let {
					language: groupLanguage,
					emote
				} = group; // lay current language cua group
				let _emote = emote ? emotes[random.int(0, emotes.length - 1)] : "";

				if (groupLanguage == "en") {
					let text = body + _emote;

					sendMessage({
						text,
						threadID: queryID
					});
					logST({
						text: `MITSUKU: '${text}'`,
						icon: "robot",
						bg: "bg1"
					}, parent);
				} else {
					axios.get(`https://translate.yandex.net/api/v1.5/tr/translate?key=${TRANS_KEY}&text=${encodeURI(body)}&lang=en-${groupLanguage}`).then(({
						data
					} = {}) => {
						jquery("body").html(data);
						let text = jquery("text").html() + _emote;

						sendMessage({
							text,
							threadID: queryID
						});
						logST({
							text: `MITSUKU: '${body}' - translated to '${text}' (en --> ${groupLanguage})`,
							icon: "exchange-alt",
							bg: "bg1"
						}, parent);
					});
				}
			} // listen to message
		});
	});
}

export {
	deployChatbot
};
