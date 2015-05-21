# termflix
Search and stream torrents from your command line.

![Demo](/../screenshots/termflix_demo.gif?raw=true)

## Requirements
You'll need to have [VLC](http://www.videolan.org/vlc/index.html), [Node](https://nodejs.org/download/), and [peerflix](https://github.com/mafintosh/peerflix) installed on your machine. 

##Installing
It's just a simple `npm install -g termflix`. Boom.

## Usage
    termflix play [magnet] --vlc
Just pass in a magnet link to a torrent and it'll start streaming to your VLC player. Here's an example magnet link to try it out: *magnet:?xt=urn:btih:31ff6c7f8af99bdbc2d5f022367bc6b85bd613ee*

    termflix search [query] --order [orderBy]
You can use this to search the pirate bay for torrents. Make sure you wrap your search in quotes! A list of torrents will come up and you can just hit enter on one of them to open the stream in VLC. You can use the --order option to order the results. The valid orderBy options are 'seeds' (default), 'name', 'date', 'size', 'leeches'.

    termflix marathon
When you select a torrent with multiple files in its folder, you will have the choice to enable marathon mode for that folder. If you do, just type this command to select a file from that folder instead of having to go search for the folder again. This is perfect for marathoning entire seasons of shows!

![Demo](/../screenshots/marathon_walkthrough.png?raw=true)

## Issues
When you have a stream open in VLC, don't terminate termflix in the command line because VLC will complain and you'll have to force quit it. You should stop the stream by quitting VLC instead. This issue should be solved soon. If you want to help fix this, send a pull request my way!
