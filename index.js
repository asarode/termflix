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
 * The possible orderings to sort the torrent results by.
 */
var strikeOrderEnum = {
	NAME: '0', // ascending order
	DATE: '1', // ascending order (earliest upload date first)
	SIZE: '2', // descending order
	SEEDS: '3', // descending order
	LEECHES: '4' // descending order
}
/*
 * The names of the fields on the torrent objects that the search api returns.
 */
var strikeFieldEnum = {
	NAME: 'torrent_title',
	DATE: 'upload_date',
	SIZE: 'size',
	SEEDS: 'seeds',
	LEECHES: 'leeches'
}

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
var tpbOrderEnum = {
	NAME: '1',
	DATE: '4',
	SIZE: '5',
	SEEDS: '7',
	LEECHES: '10'
}

var tpbFieldEnum = {
	NAME: 'name',
	DATE: 'uploadDate',
	SIZE: 'size',
	SEEDS: 'seeders',
	LEECHES: 'leechers'
}

var orderEnum = strikeOrderEnum;
var fieldEnum = strikeFieldEnum;

/*
 * The torrent stream engine that is used to stream the file.
 * NOTE: Declared as a global so we can manipulate it on process.on('SIGINT')
 */
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
		if (videoCount(engine.files) > 1) {
			var fileNames = [];
			var fileHash = [];
			var subtitleFileNames = [];
			engine.files.forEach(function(file, i){
				fileHash[file.name] = file;
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
				}
			];

			if (db.getItem("marathonMagnet") != magnet) {
				questions.push({
					type: 'confirm',
					name: 'enableMarathon',
					message: 'Enable marathon mode for these files?',
					default: true
				});
			}

			inquirer.prompt(questions, function(answers) {
				var file = answers.fileName;
				var fileIndex = fileNames.indexOf(file);
				args.push('--index=' + fileIndex);

				if (answers.enableMarathon) {
					enableMarathon(magnet);
				}

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
			orderObj.infoField = fieldEnum.NAME;
			break;
		case 'date':
			orderObj.order = orderEnum.DATE;
			orderObj.infoField = fieldEnum.DATE;
			break;
		case 'size':
			orderObj.order = orderEnum.SIZE;
			orderObj.infoField = fieldEnum.SIZE;
			break;
		case 'seeds':
			orderObj.order = orderEnum.SEEDS;
			orderObj.infoField = fieldEnum.SEEDS;
			break;
		case 'leeches':
			orderObj.order = orderEnum.LEECHES;
			orderObj.infoField = fieldEnum.LEECHES;
			break;
		default:
			orderObj.order = orderEnum.SEEDS;
			orderObj.infoField = fieldEnum.SEEDS;
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

function repeatSearch(options) {
	inquirer.prompt([
		{
			type: 'input',
			name: 'title',
			message: 'Sorry, 0 results. Enter new search: ',
		}
	], function(answers) {
		searchCommand(answers.title, options);
	});
}

function formatTorrentString(torrent, order, infoField) {
	if (order == orderEnum.NAME) {
		return torrent[fieldEnum.NAME] + ' :: ' + torrent[fieldEnum.SEEDS];
	} else {
		return torrent[fieldEnum.NAME] + ' :: ' + torrent[infoField];
	}
}

function fileSelectPrompt(torrentHash, torrentInfos) {
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

function videoCount(files) {
	var extensions = ['mp4', 'mp4', 'mkv', 'avi', 'mov', 'flv', 'f4v', 'm4p'];
	var count = 0;
	files.forEach(function(file) {
		var ending = file.name.substr(file.name.lastIndexOf('.') + 1);
		if (extensions.indexOf(ending) > -1) {
			count++;
		}
	});
	return count;
}

function toTpbCategory(category) {
	switch (category) {
		case 'movies':
			return 201;
		case 'tv':
			return 205;
		default:
			return 200;
	}
}

function toStrikeEnums() {
	orderEnum = strikeOrderEnum;
	fieldEnum = strikeFieldEnum;
}

function toTpbEnums() {
	orderEnum = tpbOrderEnum;
	fieldEnum = tpbFieldEnum;
}

function strikeProcess(res, order, infoField, options) {
	var torrentHash = [];
	var torrentInfos = [];
	var results = res.torrents;

	if (results.length == 0) {
		repeatSearch(options);
	} else {
		results = sortTorrents(order, infoField, results);
		results.forEach(function(result) {
			torrentHash[result[fieldEnum.NAME]] = result.magnet_uri;
			torrentInfos.push(formatTorrentString(result, order, infoField));
		});
		
		fileSelectPrompt(torrentHash, torrentInfos);
	}
}

function tpbProcess(res, order, infoField, options) {
	var torrentHash = [];
	var torrentInfos = [];
	var results = res;

	if (results.length == 0) {
		repeatSearch(options);
	} else {
		results.forEach(function(result) {
			torrentHash[result.name] = result.magnetLink;
			
			if (infoField == fieldEnum.DATE) {
				var date = moment(result[infoField], 'MM-DD YYYY');
				result[infoField] = moment(date).format('MMM Do, YYYY');
			}

			torrentInfos.push(formatTorrentString(result, order, infoField));
		});

		fileSelectPrompt(torrentHash, torrentInfos);
	}
}

/*
 * @param: query - the search query the user entered
 * @param: options - an options object
 * Searches the pirate bay for videos with the given query and returns
 * a list of torrent objects
 */
function searchCommand(query, options) {
	var orderBy = options.order;
	var category = options.category;

	if (db.getItem('vendor') == 'strike') {
		toStrikeEnums();
		var orderObj = convertOrder(orderBy);
		var order = orderObj.order;
		var infoField = orderObj.infoField;

		strike.search(query, category).then(function(res, err) {
			if (res.statuscode == 200) {
				strikeProcess(res, order, infoField, options);
			}
		}).catch(function(err) {
			if (err.status == 404) {
				strikeProcess({torrents: []}, order, infoField, options);
			} else {
				console.log(res.status || res.statuscode);
				console.log('\nERROR: The Strike API is returning an error right now. Trying The Pirate Bay...');
				toTpbEnums();
				var orderObj = convertOrder(orderBy);
				var order = orderObj.order;
				var infoField = orderObj.infoField;
				category = toTpbCategory(category);
				tpb.search(query, {
					category: category,
					orderBy: order
				}, function(err, res) {
					if (err) { 
						console.log(err);
						console.log("\nERROR: The Pirate Bay API is also down right now :(");
					}
					else {
						tpbProcess(res, order, infoField, options);
					}
				});
			}
		});
	} else if (db.getItem('vendor') == 'tpb') {
		toTpbEnums();
		var orderObj = convertOrder(orderBy);
		var order = orderObj.order;
		var infoField = orderObj.infoField;
		category = toTpbCategory(category);
		tpb.search(query, {
			category: category,
			orderBy: order
		}, function(err, res) {
			if (err) {
				console.log(err);
				console.log('\nERROR: The Pirate Bay API is down right now. Trying Strike...')
				toStrikeEnums();
				var orderObj = convertOrder(orderBy);
				order = orderObj.order;
				infoField = orderObj.infoField;
				category = options.category;
				strike.search(query, category).then(function(res) {
					strikeProcess(res, order, infoField, options);
				}).catch(function(err) {
					console.log(err);
					console.log('\nERROR: The Strike API is also down right now :(');
				});
			} else { 
				toTpbEnums();
				var orderObj = convertOrder(orderBy);
				order = orderObj.order;
				infoField = orderObj.infoField;
				category = toTpbCategory(category);
				tpbProcess(res, order, infoField, options);
			}
		});
	} else {
		toTpbEnums();
		var orderObj = convertOrder(orderBy);
		var order = orderObj.order;
		var infoField = orderObj.infoField;
		category = toTpbCategory(category);
		tpb.search(query, {
			category: category,
			orderBy: order
		}, function(err, res) {
			if (err) {
				console.log(err);
				console.log('\nERROR: The Pirate Bay API is down right now. Trying Strike...')
				toStrikeEnums();
				var orderObj = convertOrder(orderBy);
				order = orderObj.order;
				infoField = orderObj.infoField;
				category = options.category;
				strike.search(query, category).then(function(res) {
					strikeProcess(res, order, infoField, options);
				}).catch(function(err) {
					console.log(err);
					console.log('\nERROR: The Strike API is also down right now :(');
				});
			} else { 
				toTpbEnums();
				var orderObj = convertOrder(orderBy);
				order = orderObj.order;
				infoField = orderObj.infoField;
				category = toTpbCategory(category);
				tpbProcess(res, order, infoField, options);
			}
		});
	}
}

function vendorCommand(api) {
	if (api == 'strike') {
		db.setItem('vendor', 'strike');
	} else if (api == 'tpb') {
		db.setItem('vendor', 'tpb');
	} else {
		console.log("Sorry, that's not a supported vendor. Supported vendors: \"strike\", \"tpb\"");
	}
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
		'order results by a given field: ' +
		'seeds (default) | name | date | size | leeches')
	.option('-c, --category [cat]', 
		'search results within a given category: ' +
		'movies | tv | anime')
	.action(function(query, options) {
		searchCommand(query, options);
	});
program
	.command('vendor [api]')
	.description('set the default api to use')
	.action(function(api) {
		vendorCommand(api);
	})
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

