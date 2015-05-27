#! /usr/bin/env node

// ==============================
// MODULES
// ==============================
var tpb 		= require('thepiratebay');
var strike 		= require('strike-api');
var spawn 		= require('child_process').spawn;
var exec 		= require('child_process').exec;
var inquirer 	= require('inquirer');
var program 	= require('commander');
var tStream 	= require('torrent-stream');
var jf			= require('jsonfile');
var Promise		= require('bluebird');
var moment 		= require('moment');
var db 			= require('text-db')('storage');

// ==============================
// VARIABLES
// ==============================
/*
 * value of each key corresponds to tpb search query options
 * 1 - name descending
 * 2 - name ascending
 * 3 - date descending
 * 4 - date ascending
 * 5 - size descending
 * 6 - size ascending
 * 7 - seeds descending
 * 8 - seeds ascending
 * 9 - leeches descending
 * 10 - leeches ascending
 */
var orderEnum = {
	NAME: '1',
	DATE: '4',
	SIZE: '5',
	SEEDS: '7',
	LEECHES: '10'
}

var engine;

// ==============================
// FUNCTIONS
// ==============================

/*
 * @param: magnet - a magnet link to save
 * Saves a magnet link to file for future retrieval
 */
function enableMarathon(magnet) {
	db.setItem("marathonMagnet", magnet);
	console.log("Enabled marathon! Just run `termflix marathon` to select the next file!");
}

/*
 * @param: args - the arguments the user entered
 * Starts streaming the torrent using peerflix
 */
function playMagnet(args) {
	var magnet = args[0];
	engine = tStream(magnet);

	engine.on('ready', function() {
		if (engine.files.length > 1) {
			// var fileIndexHash = [];
			var fileNames = [];
			var fileHash = [];
			var subtitleFileNames = [];
			engine.files.forEach(function(file, i){
				fileHash[file.name] = file;
				// fileIndexHash[file.name] = i;
				fileNames.push(file.name);
				if (file.name.slice(file.name.length - 4) == '.srt') {
					subtitleFileNames.push(file.name);
				}
			});
			var questions = [
				{
					type: 'list',
					name: 'fileName',
					message: 'Which file from this torrent do you want to play?',
					choices: fileNames
				},
				{
					type: 'confirm',
					name: 'enableMarathon',
					message: 'Enable marathon mode for these files?',
					default: true
				}
			];

			inquirer.prompt(questions, function(answers) {
				var file = answers.fileName;
				// var fileIndex = fileIndexHash[file];
				var fileIndex = fileNames.indexOf(file);
				args.push('--index=' + fileIndex);

				if (answers.enableMarathon) {
					enableMarathon(magnet);
				}

				// if (answers.addSubtitle) {
				// 	fileHash[subtitleFileNames[0]].select();
				// 	args.push('--subtitles \"/tmp/torrent-stream/%s\"', fileHash[subtitleFileNames[0]].path)
				// }

				// if (answers.wantsSubtitle) {
				// 	var subtitleFile = answers.subtitleFile;
				// }

				// return args;
				var cmd = spawn('peerflix', args);
				cmd.stdout.pipe(process.stdout);
				cmd.stderr.pipe(process.stdout);
			});
		} else {
			// return args;
			var cmd = spawn('peerflix', args);
			cmd.stdout.pipe(process.stdout);
			cmd.stderr.pipe(process.stdout);
		}
	});
}

/*
 * Gets the saved marathon torrent and lets the user pick which file within the folder to play.
 * Prints out a message if there is no saved marathon magnet.
 */
function marathonCommand() {
	var magnet = db.getItem("marathonMagnet");

	if (magnet != undefined) {
		playMagnet([magnet, '--vlc']);
	} else {
		console.log("Sorry, you probably haven't enabled marathon mode for any torrent folder yet!");
	}
}

/*
 * @param: magnet - a magnet link for a torrent
 * @param: options - an options object
 * Starts streaming the torrent form a magnet link and passes
 * any options off to the playMagnet function
 */
function playCommand(magnet, options) {
	var ops = options.parent.rawArgs.splice(4);
	var playArgs = [magnet, '--remove'];
	ops.forEach(function(op) {
		playArgs.push(op);
	});
	playMagnet(playArgs);
}

/*
 * @param: orderOption - the optin string entered with --option
 * @return: an object with "order" and "infoField" fields
 * Converts the given orderOption to the corrent order enum type. Also chooses
 * the right name for infoField based on what name the torrent search api uses
 * for the given orderOption.
 */
function convertOrder(orderOption) {

	orderObj = {};

	switch (orderOption) {
		case 'name':
			orderObj.order = orderEnum.NAME;
			orderObj.infoField = 'torrent_title';
			break;
		case 'date':
			orderObj.order = orderEnum.DATE;
			orderObj.infoField = 'upload_date';
			break;
		case 'size':
			orderObj.order = orderEnum.SIZE;
			orderObj.infoField = 'size';
			break;
		case 'seeds':
			orderObj.order = orderEnum.SEEDS;
			orderObj.infoField = 'seeds';
			break;
		case 'leeches':
			orderObj.order = orderEnum.LEECHES;
			orderObj.infoField = 'leeches';
			break;
		default:
			orderObj.order = orderEnum.SEEDS;
			orderObj.infoField = 'seeds';
	}

	return orderObj;
}

/*
 * @param: order - an order enum type
 * @param: infoField - the info field corresponding to the order enum
 * @param: torrents - an array of torrent objects
 * @return: a sorted array of torrent objects
 * Sorts the torrents in the torrent object by the given order.
 */
function sortTorrents(order, infoField, torrents) {
	sortedTorrents = [];
	if (order == orderEnum.DATE) {
		torrents.forEach(function(torrent) {
			var date = moment(torrent[infoField], "MMM DD, YYYY");
			sortedTorrents.push({
				torrent: torrent,
				sortValue: date.valueOf()
			});
		});
	} else {
		torrents.forEach(function(torrent) {
			sortedTorrents.push({
				torrent: torrent,
				sortValue: torrent[infoField]
			});
		})
	}

	if (order == orderEnum.NAME || order == orderEnum.LEECHES) {
		sortedTorrents.sort(function(a, b) {
			if (a.sortValue > b.sortValue) {
				return 1;
			}
			if (a.sortValue < b.sortValue) {
				return -1;
			}
			return 0;
		});
	} else {
		sortedTorrents.sort(function(a, b) {
			if (a.sortValue > b.sortValue) {
				return -1;
			}
			if (a.sortValue < b.sortValue) {
				return 1;
			}
			return 0;
		});
	}

	result = [];
	sortedTorrents.forEach(function(torrent) {
		result.push(torrent.torrent);
	});
	return result;
}

/*
 * @param: query - the search query the user entered
 * @param: options - an options object
 * Searches the pirate bay for videos with the given query and returns
 * a list of torrent objects
 */
function searchCommand(query, options) {
	var torrentHash = [];
	var torrentInfos = [];
	var orderBy = options.order;
	var infoField = convertOrder(orderBy).infoField;
	var order = convertOrder(orderBy).order;

	strike.search(query).then(function(res) {
		var results = res.torrents;
		if (results.length == 0) {
			inquirer.prompt([
				{
					type: 'input',
					name: 'title',
					message: 'Sorry, 0 results. Enter new search: ',

				}
			], function(answers) {
					searchCommand(answers.title, options);
			});
		} else {
			results = sortTorrents(order, infoField, results);
			results.forEach(function(result) {
				torrentHash[result.torrent_title] = result.magnet_uri;
				if (order == orderEnum.NAME) {
					torrentInfos.push(result.torrent_title + ' :: ');
				} else {
					torrentInfos.push(result.torrent_title + ' :: ' + result[infoField]);
				}
			});
			
			inquirer.prompt([
				{
					type: 'list',
					name: 'title',
					message: 'Which torrent do you want to stream?',
					choices: torrentInfos
				}
			], function(answers) {
				var title = answers.title;
				var titleString = title.substring(0, title.indexOf(' :: '));
				playMagnet([torrentHash[titleString], '--vlc']);
			});
		}
	});
}

// ==============================
// COMMANDS
// ==============================
program
	.version('0.1.0');

program
	.command('play [magnet]')
	.description('stream a torrent file with the given magnet link')
	.option('-v, --vlc', 'open the torrent stream with vlc player')
	.action(function(magnet, options) {
		playCommand(magnet, options);
	});
program
	.command('search [query]')
	.description('search the pirate bay with a query')
	.option('-o, --order [orderBy]', 
		'order results by a given field:' +
		'seeds (default) | name | date | size | leeches')
	.action(function(query, options) {
		searchCommand(query, options);
	});
program
	.command('marathon')
	.description("if you've enabled a marthon, this will let you select the next file to watch in a folder")
	.action(function() {
		marathonCommand();
	});

program.parse(process.argv);

process.on('SIGINT', function() {
	if (engine) {
		console.log("\n Closing...");
		engine.remove(function() {
			process.exit();
		});
	}
});

