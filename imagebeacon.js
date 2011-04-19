var sys = require("sys"), 
	url = require('url'), 
	fs = require('fs'), 
	http = require('http'),
	haml = require('hamljs'),
	uuid = require('node-uuid'),
	Db = require('mongodb/lib/mongodb').Db,
	Connection = require('mongodb/lib/mongodb').Connection,
	Server = require('mongodb/lib/mongodb').Server,
	// BSON = require('../lib/mongodb').BSONPure;
	BSON = require('mongodb/lib/mongodb').BSONNative;

var COLLECTION_NAME='http_request';

function getConnection(callback) {
	var client = new Db('imagebeacon', new Server("flame.mongohq.com", 27022, {}));
	client.open( function(err, p_client) {
		client.authenticate('tlianza', 'pickles', function(err, p_client) {
			callback(err, client);
		});
	});
}

//make sure our collections are created at startup
getConnection(function(err, client) {
		sys.puts('creating collection');
		client.createCollection(COLLECTION_NAME, function(err, collection) {	
			client.createIndex(COLLECTION_NAME, 'beaconId', false, function(err, collection) {
				client.createIndex(COLLECTION_NAME, 'visitorId', false, function(err, collection) {});
			});
	});
});

function insertHttpRequest(req, beaconId, visitorId, callback)
{
	getConnection(function(err, client) {
		client.collection(COLLECTION_NAME, function(err, collection) {
			sys.puts("inserting http request for beacon: "+beaconId);
			var d = new Date();
			var day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
			var h = d.getUTCHours();
			collection.insert({ beaconId:beaconId, 
								visitorId: visitorId,
							    userAgent:req.headers['user-agent'], 
							    referrer:req.headers['referer'], 
							    host:req.headers['host'], 
							    cTime: d,
							    cDay: day,
							    cHour: h,
							   }, callback);
		});
	});
}

function displayStats(beaconId, req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	fs.readFile('./templates/stats.haml', function(e, c) {
	    var data = {
			beaconId: beaconId
		};
	    var html = haml.render(c.toString(), {locals: data});
	    res.end(html);
	});
}

function returnError(res)
{
	res.writeHead(404, {'Content-Type': 'text/plain'});
	res.end("Je ne comprend pas");
}


http.createServer( function (req, res) {
	//we only deal with requests for actual beacons
	var urlParts = url.parse(req.url);
	var qs = urlParts.query;
	if(typeof(qs) == 'undefined' || qs.toLowerCase().indexOf("id=") != 0)
	{
		returnError(res);
		return;
	}
	
	//see if the user has been cookied
  var cookies = {};
  req.headers.cookie && req.headers.cookie.split(';').forEach(function( cookie ) {
	var parts = cookie.split('=');
	cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
  });
  
  //generate the id we'll cookie them with
  var ibid = cookies['ibid'];
  if(typeof(ibid) == 'undefined' || ibid.length < 1)
  	ibid = uuid();
   
    
	var beaconId = qs.substring(3);
	switch(urlParts.pathname) 
	{
		case '/':
			var farfuture = new Date();
			farfuture.setFullYear(farfuture.getFullYear() + 2);
			res.writeHead(200, {'Content-Type': 'image/gif', 'Cache-Control': 'no-cache', 'Set-Cookie': 'ibid='+ibid+ "; expires=" + farfuture.toGMTString()});
			res.end();
			insertHttpRequest(req, beaconId, ibid, function(err, docs) {});
			break;
		case '/stats':
			displayStats(beaconId, req, res);
			break;
		default:
			res.writeHead(404, {'Content-Type': 'text/plain'});
			res.end('Right idea, wrong place.\n');	
	}
	
	
	
}).listen(8124, "127.0.0.1");

