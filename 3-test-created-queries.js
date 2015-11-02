#!/usr/bin/env node

var fs = require('fs');
var csv = require('csv');
var streamify = require('stream-array');
var _ = require('lodash');
var request = require('sync-request');
var parseString = require('xml2js').parseString;

var jQuery = _; // fake jQuery für das eingebundene Skript

var folder = __dirname + '/data/';
var pazpar2URL = 'http://localhost/pazpar2/search.pz2?';

var parser = csv.parse({delimiter:';', quote:'"'});

var records = [];

// Skript mit Funktionen der Website einbinden
eval(fs.readFileSync(__dirname + '/../HGW Server/typo3-2014/fileadmin/pazpar2/pazpar2-vifanord.js')+'');

parser.on('readable', function() {
	var record;
	while (record = parser.read()) {
		records.push(record);
	}
})
.on('error', function(error) {
	console.log('Fehler: ' + error.message);
})
.on('finish', function() {
	next();
});

var filePath = 'data/vifanord2.csv';
fs.createReadStream(filePath).pipe(parser);

var runPazpar2 = function(query) {
	console.log(url);
	http.get(url, function(result) {
		console.log(result);
	});
};

var testQuery = function(query, ID, name) {
	console.log(ID + ': ' + name);
	var initURL = pazpar2URL + 'command=init&service=vifanord-themen';
	var initResult = request('GET', initURL).getBody('utf-8').replace('<?xml version="1.0" encoding="UTF-8"?>', '');
	var sessionId
	parseString(initResult, function(err, result) {
		sessionId = result.init.session;
		console.log('init -> Session ID ' + sessionId);
	});
	
	console.log('search »' + query + '« ->');
	var queryURL = pazpar2URL + 'command=search&query=' + escape(query) + '&session=' + sessionId;
	var queryResult = request('GET', queryURL).getBody('utf-8').replace('<?xml version="1.0" encoding="UTF-8"?>', '');
	parseString(queryResult, function(err, result) {
		console.log(result.search.status[0]);
		if (result.search.status[0] !=='OK') {
			console.log('*********************************');
		}
	});
	
	console.log('');
};
var index = 0;

var next = function() {
	for (var index in records) {
		var record = records[index];
		var JSONString = record[3];
		var queryObject = JSON.parse(JSONString);
		var regions = Object.keys(kielRegionSearch); // alle Regionen ausgewählt
		var queries = makeKielQueries(regions, queryObject)
						.concat(makeGoeQuery(regions, queryObject));
		_.forEach(queries, function (query) {
			index ++;
			try {
				testQuery(query, record[0], record[2]);
			}
			catch (e) {
				console.log('Fehler: ' + e)
			}
		});
	}
};
