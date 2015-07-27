#!/usr/bin/env iojs

var fs = require('fs');
var csv = require('csv');
var streamify = require('stream-array');

var queryTypes = {hgw:'lklhgw', sub:'lkl', kiel:'kiss'};
var folder = __dirname + '/data/';

var hgwData = {};
var subData = {};
var kielData = {};
var tree = {};


var makeParser = function (resultObject, next) {
	var parser = csv.parse({columns: true, delimiter: ','});
	var line = 0;
	parser.on('readable', function() {
		var record;
		while (record = parser.read()) {
			line++;
			var id = record.id;
			if (id && line > 2) {
				resultObject[id] = record;
			} else {
				console.log('Zeile ' + line + ' ausgelassen');
			}
		}
	});
	parser.on('error', function(error) {
		console.log('Fehler: ' + error.message);
	});
	parser.on('finish', function() {
		next();
	});
	return parser;
}


var readFileIntoObject = function (fileName, targetObject, next) {
	var parser = makeParser(targetObject, next);
	console.log('\nLese ' + fileName);
	var filePath = folder + fileName;
	fs.createReadStream(filePath).pipe(parser);
}


var makeBaseLine = function (value) {
	return {
	    id: value.id,
		parent: value.parent,
		name_DE: value.label_de,
		query: '',
		name_EN: value.label_en,
		display: value.display,
		ddc: value.ddc,
		search: {
			'all': {},
			'nord': {},
			'sca': {},
			'fi': {},
			'se': {},
			'no': {},
			'dk': {},
			'ic': {},
			'gro': {},
			'fae': {},
			'bal': {},
			'ee': {},
			'lv': {},
			'lt': {},
		},
	};
};


// Abfragen umschreiben
var makePazpar2Query = function (picaQuery, querytype) {
    var pazpar2Query = picaQuery 
      	? picaQuery
			.toLowerCase() // Kleinschreibung
			.replace(/[*?]+/g, "?") // Trunkierung mit ? und nur einfach
			.replace(/(or (?!\()|not (?!\()|and (?!\()|\(|^)/g, "$1" + querytype + "=\"") // öffnende Klammern
			.replace(/(\)( |$)| or| not| and|$)/g, "\"$1") // schließende Klammern
	  		.replace(/\)"$/, ")") // ")" am Ende des Ausdrucks kompensieren
		: "";
	return pazpar2Query;
};


var addQueriesToLine = function (line, library, libraryQueries) {
	Object.keys(line.search).forEach(function(region) {
		var libraryLine = libraryQueries[line.id];
		if (libraryLine) {
			var picaQuery;
			if (library === 'kiel') {
				picaQuery = libraryLine[region];
				if (picaQuery && picaQuery.length > 1 && !picaQuery.match('#')) {
					line.search[region][library] = picaQuery.replace(/\*/, '?');
				}
			}
			else {
				var picaQuery = libraryLine[region + '_ori'];
				if (picaQuery && picaQuery.length > 1) {
					picaQuery = picaQuery.replace(/\s+/, ' ');
					line.search[region][library] = makePazpar2Query(picaQuery, queryTypes[library]);
				}				
			}
		}
	});
};


var processData = function () {
	Object.keys(hgwData).forEach(function(key) {
	    var value = hgwData[key];
	    var line = makeBaseLine(value);
	  	addQueriesToLine(line, 'hgw', hgwData);	
		tree[key] = line;	  
	});
	
	Object.keys(subData).forEach(function(key) {
		var value = subData[key];
		if (value) {
		    var line = makeBaseLine(value);
			if (tree[key]) {
				Object.keys(line).forEach(function(fieldName) {
					if (!tree[key][fieldName] && line[fieldName]) {
						tree[key][fieldName] = line[fieldName];
					}
				});
			} else {
				tree[key] = line;
			}
			addQueriesToLine(tree[key], 'sub', subData);
		} 
	});
	
	Object.keys(kielData).forEach(function(key) {
		var value = kielData[key];
		if (value) {
		    var line = makeBaseLine(value);
			if (tree[key]) {
				Object.keys(line).forEach(function(fieldName) {
					if (!tree[key][fieldName] && line[fieldName]) {
						tree[key][fieldName] = line[fieldName];
					}
				});
			} else {
				tree[key] = line;
			}
			addQueriesToLine(tree[key], 'kiel', kielData);
		} 	
	});
	
	createCSV();
};


var makeDDCQuery = function(ddc) {
	var query =  makePazpar2Query(ddc, 'ddc');
	return query.replace(/ddc="([tg])/g, 'ddc-$1="');
}; 


// Ergebnis ausgeben
var mergeQueries = function (entry) {
	var result = JSON.parse(JSON.stringify(entry));
	result.query = {};
	
	Object.keys(result.search).forEach(function(region) {
		var queryParts = [];
		var queries = result.search[region];
		if (queries) {
			var sub = queries.sub;
			var hgw = queries.hgw;
			var kiel = queries.kiel;
			if (sub) queryParts.push(sub);
			if (hgw) queryParts.push(hgw);
			if (kiel) queryParts.push(kiel);
		}
		if (result.ddc) queryParts.push(makeDDCQuery(result.ddc));

		var fullQuery = queryParts.length ? '(' + queryParts.join(') or (') + ')' : '';
		result.query[region] = fullQuery;
	});
	delete result.search;
	delete result.ddc;
	delete result.display;
	return result;
};


var createCSV = function () {
	var results = Object.keys(tree).sort().map(function(key) {
		return mergeQueries(tree[key])
	});
	
	var stringifier = csv.stringify({delimiter: ';'});
	var writeStream = fs.createWriteStream(folder + 'vifanord.csv');
	streamify(results).pipe(stringifier).pipe(writeStream);
};


var readKiel = function () {
	readFileIntoObject('Kiel.csv', kielData, processData);
};

var readSUB = function () {
	readFileIntoObject('SUB.csv', subData, readKiel);
};

var readHGW = function () {
	readFileIntoObject('HGW.csv', hgwData, readSUB);
};

readHGW();
