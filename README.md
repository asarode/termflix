# I'm not supporting this project anymore
This project was something I wrote when I was first learning JavaScript. The code's gross. I don't even really use it anymore so I don't feel untangling this garbage or rewriting it. [torrentflix](https://github.com/ItzBlitz98/torrentflix) looks like a good alternative to termflix.

# termflix
Search and stream torrents from your command line.

![Demo](/../screenshots/termflix_demo.gif?raw=true)

## Requirements
You'll need to have [VLC](http://www.videolan.org/vlc/index.html), [Node](https://nodejs.org/download/), and [peerflix](https://github.com/mafintosh/peerflix) installed on your machine. 

##Installing
Make sure you have [peerflix](https://github.com/mafintosh/peerflix) installed globally. After that it's just a simple `npm install -g termflix`. Boom.

## Usage
    termflix play [magnet] --vlc
Just pass in a magnet link to a torrent and it'll start streaming to your VLC player. Here's an example magnet link to try it out: *magnet:?xt=urn:btih:31ff6c7f8af99bdbc2d5f022367bc6b85bd613ee*

    termflix search [query] --order [orderBy] --category [category]
You can use this to search the pirate bay for torrents. Make sure you wrap your search in quotes! A list of torrents will come up and you can just hit enter on one of them to open the stream in VLC. You can use the --order option to order the results. The valid orderBy options are "seeds" (default), "name", "date", "size", and "leeches". You can also add a category to filter the results. The valid categories are "movies", "tv", and "anime".

    termflix marathon
When you select a torrent with multiple files in its folder, you will have the choice to enable marathon mode for that folder. If you do, just type this command to select a file from that folder instead of having to go search for the folder again. This is perfect for marathoning entire seasons of shows!

![Demo](/../screenshots/marathon_walkthrough.png?raw=true)

    termflix vendor [api]
Termflix currently supports using two search APIs: [Strike](https://github.com/mafintosh/torrent-stream) and The Pirate Bay. Since torrent sites can be a little volatile, one or the other may go down every now and then. You can switch the primary search API by using this command with "strike" or "tpb" as the [api] field. Also, if the primary API fails, it'll fallback to trying the second API. If both of them fail, it's not your lucky day..

## Issues
**VLC Has Issues Quitting**

When you have a stream open in VLC, don't terminate termflix in the command line because VLC will complain and you'll have to force quit it. You should stop the stream by quitting VLC instead. This issue should be solved soon. If you want to help fix this, send a pull request my way!

##Shoutouts
Termflix stands on the back of some giants so I wanted to make sure they're mentioned here. [Peerflix](https://github.com/mafintosh/peerflix) and [torrent-stream](https://github.com/mafintosh/torrent-stream) are two amazing repos for doing anything related to streaming torrents. [Strike](https://getstrike.net/) is the default torrent searching API. I think you all know The Pirate Bay. Termflix uses an API wrapper to access their torrents.

##Contact
This is the first time I've written a node cli tool so let me know if there's some better ways to structure the code! Always open to a code review :) You can open an issue, send me a tweet ([@rjun07a](https://twitter.com/rjun07a)), or shoot me an email if you want to get in touch. I'll try to get back to you quickly.
