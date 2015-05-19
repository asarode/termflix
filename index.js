#! /usr/bin/env node

// ==============================
// MODULES
// ==============================
var torStream 	= require('torrent-stream');
var tpb 		= require('thepiratebay');
var spawn 		= require('child_process').spawn;
var inquirer 	= require("inquirer");

// ==============================
// VARIABLES
// ==============================
var sortEnum = {
	NAME_DEC: '1',
	NAME_ACS: '2',
	DATE_DESC: '3',
	DATE_ASC: '4',
	SIZE_DECS: '5',
	SIZE_ASC: '6',
	SEEDS_DESC: '7',
	SEEDS_ASC: '8',
	LEECHES_DESC: '9',
	LEECHED_ASC: '10'
}

var argEnum = {
	MAGNET: '0',
	SEARCH: '1'
}

var torrentList = [];

// ==============================
// HELPER FUNCTIONS
// ==============================

/*
 * @param: args - the arguments the user entered
 * @return: the enum for the type of function to execute
 * Finds whether the user entered a magnet link or is searching for
 * a list of torrents with a query
 */
function findArgType(args) {
	for (var i = 0; i < userArgs.length; i++) {
		if (userArgs[i].indexOf('magnet:?xt=urn:btih:') == 0) {
			return argEnum.MAGNET;
		}
	}

	return argEnum.SEARCH;
}

/*
 * @param: args - the arguments the user entered
 * Starts streaming the torrent using peerflix
 */
function playMagnet(args) {
	var cmd = spawn('peerflix', args);
	cmd.stdout.pipe(process.stdout);
	cmd.stderr.pipe(process.stdout);
}

/*
 * @param: query - the search query the user entered
 * @param: queryParams - an array with [query, category, orderBy] info
 * Searches the pirate bay for videos with the given query and returns
 * a list of torrent objects
 */
function searchForTorrents(args) {
	var _query = args[0];
	var _category = args[1] || '200';
	var _orderBy = args[2] || sortEnum.SEEDS_DESC;

	tpb.search(_query, {
		category: _category,
		orderBy: _orderBy
	}, function(err, results) {
		if (err) {
			console.log(err);
		} else {
			results.forEach(function(result, i, results) {
				torrentList.push(result.name);
			}); 

			inquirer.prompt([
				{
					type: 'list',
					name: 'Torrents',
					message: 'Which torrent do you want to stream?',
					choices: torrentList
				}
			]);
		}
	});
}

// ==============================
// LOGIC
// ==============================
var userArgs = process.argv.splice(2);

var argType = findArgType(userArgs);

if (argType == argEnum.MAGNET) {
	console.log('SETTING UP TORRENT STREAM');
	playMagnet(userArgs);
} else if (argType == argEnum.SEARCH) {
	console.log('SEARCHING FOR TORRENTS');
	searchForTorrents(userArgs);
}

