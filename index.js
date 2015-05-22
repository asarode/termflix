#! /usr/bin/env node

// ==============================
// MODULES
// ==============================
var tpb 		= require('thepiratebay');
var spawn 		= require('child_process').spawn;
var exec 		= require('child_process').exec;
var inquirer 	= require('inquirer');
var program 	= require('commander');
var tStream 	= require('torrent-stream');
var jf			= require('jsonfile');
var Promise		= require('bluebird');
var moment 		= require('moment');

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

var dataFile = 'data.json';
var dataObj = {
	marathonMagnet: "",
	lastWatched: ""
};

// ==============================
// FUNCTIONS
// ==============================

function enableMarathon(magnet) {
	dataObj.marathonMagnet = magnet;

	jf.writeFile(dataFile, dataObj, function(err) {
		console.log("Enabled marathon! Just run `termflix marathon` to select the next file!");
	});
}

function checkForMultipleFiles(args) {
	var magnet = args[0];
	var engine = tStream(magnet);

	engine.on('ready', function() {
		if (engine.files.length > 1) {
			var fileNameHash = [];
			var fileNames = [];
			engine.files.forEach(function(file, i){
				fileNameHash[file.name] = i;
				fileNames.push(file.name);
			});

			inquirer.prompt([
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
			], function(answers) {
				var file = answers.fileName;
				var fileIndex = fileNameHash[file];
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
 * @param: args - the arguments the user entered
 * Starts streaming the torrent using peerflix
 */
function playMagnet(args) {

	// TODO: Promisify the call to checkForMultipleFiles so spawning the peerflix command
	//		 will stay inside the playMagnet function.
	checkForMultipleFiles(args);
}

/*
 * Gets the saved marathon torrent and lets the user pick which file within the folder to play.
 * Throws an error if there is no data.json file (and therefore no marathon saved).
 */
function marathonCommand() {
	jf.readFile(dataFile, function(err, data) {
		if (err != null) {
			console.log("Sorry, you probably haven't enabled marathon mode for any torrent folder yet!");
		} else {
  			var magnet = data.marathonMagnet;
  			playMagnet([magnet, '--vlc']);
		}
	});
}

/*
 * @param: magnet - a magnet link for a torrent
 * @param: options - an options object
 * Starts streaming the torrent form a magnet link and passes
 * any options off to the playMagnet function
 */
function playCommand(magnet, options) {
	var ops = options.parent.rawArgs.splice(4);
	var playArgs = [magnet];
	ops.forEach(function(op) {
		playArgs.push(op);
	});
	playMagnet(playArgs);
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
	var order;
	var infoField;

	switch (orderBy) {
		case 'name':
			order = orderEnum.NAME;
			infoField = 'seeders';
			break;
		case 'date':
			order = orderEnum.DATE;
			infoField = 'uploadDate';
			break;
		case 'size':
			order = orderEnum.SIZE;
			infoField = 'size';
			break;
		case 'seeds':
			order = orderEnum.SEEDS;
			infoField = 'seeders';
			break;
		case 'leeches':
			order = orderEnum.LEECHES;
			infoField = 'leechers';
			break;
		default:
			order = orderEnum.SEEDS;
			infoField = 'seeders';
	}

	tpb.search(query, {
		category: 200,
		orderBy: order
	}, function(err, results) {
		if (err) {
			console.log(err);
		} else {
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
				results.forEach(function(result) {
					torrentHash[result.name] = result.magnetLink;
					
					if (infoField == 'uploadDate') {
						var date = moment(result[infoField], 'MM-DD YYYY');
						result[infoField] = moment(date).format('MMM Do, YYYY');
					}

					torrentInfos.push(result.name + ' :: ' + result[infoField]);
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
		}
	});
}

// ==============================
// LOGIC
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
