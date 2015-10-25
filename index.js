#!/usr/bin/env node

var fs = require('fs');
var csv = require('csv');
var streamify = require('stream-array');

var folder = __dirname + '/data/';

var hgwData = {};
var goeData = {};
var kielData = {};
var tree = {};


var kielRegionSearch = {
	'fi': ['reg 25.3*'],
	'se': ['reg 25.6*'],
	'no': ['reg 25.5*'],
	'dk': ['reg 25.2', 'reg 25.21*', 'reg 25.22*', 'reg 25.23*'],
	'ic': ['reg 25.4*'],
	'gro': ['reg 25.25*'],
	'fae': ['reg 25.24*']
};

// zum Umordnen: alte ID -> neue ID
var IDMapping = {
	'4XX': 'vn11',
	'8XX': 'vn12',
	'9XX': 'vn2',
	'3XX': 'vn3',
	'2XX': 'vn4',
	'7XX': 'vn5',
	'AX': 'vn6',
	'A1': 'vn61',
	'A2': 'vn62',
	'A5': 'vn63',
	'A6': 'vn64',
	'0XX': 'vn65',
};

// neues Elternelement einfügen: ID -> neues Elternelement
var parentRemapping = {
	'vn11': 'vn1',
	'vn12': 'vn1',
	'vn65': 'vn6',
};

var extraLines = [
	{
		'id': 'vn1',
		'parent': 'vifanord-ROOT',
		'name_DE': 'Philologie und Literatur',
		'query': '',
		'name_EN': 'Language and Literature'
	}
];

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
			'goe': {},
			'kiel': []
		},
	};
};


// Abfragen umschreiben
var makePazpar2Query = function (picaQuery, library) {
    var pazpar2Query = picaQuery 
      	? picaQuery
			.toLowerCase() // Kleinschreibung
			.replace(/[*?]+/g, "?") // Trunkierung mit ? und nur einfach
			.replace(/(or (?!\()|not (?!\()|and (?!\()|\(|^)/g, "$1" + " lsg='" + library + " ") // öffnende Klammern
			.replace(/(\)( |$)| or| not| and|$)/g, "'$1") // schließende Klammern
	  		.replace(/\)"$/, ")") // ")" am Ende des Ausdrucks kompensieren
		: "";
	return pazpar2Query;
};


var addQueriesToLine = function (line, library, libraryQueries) {
	var libraryLine = libraryQueries[line.id];
	if (libraryLine) {
		if (library === 'kiel') {
			var kissArrayString = libraryLine['kiss_array'];
			if (kissArrayString) {
				line.search.kiel = JSON.parse(libraryLine['kiss_array'].replace(/'/g, "\""));			
			}
		}
		else {
			Object.keys(kielRegionSearch).forEach(function(region) {
				var picaQuery = libraryLine[region + '_ori'];
				if (picaQuery && picaQuery.length > 1) {
					picaQuery = picaQuery.replace(/\s+/, ' ').replace(/^\s+/, '');
					line.search.goe[region] = makePazpar2Query(picaQuery, '7');
				}				
			});
		}
	}
};


var processData = function () {
	Object.keys(hgwData).forEach(function(key) {
	    var value = hgwData[key];
	    var line = makeBaseLine(value);
	  	// addQueriesToLine(line, 'hgw', hgwData);	
		tree[key] = line;	  
	});
	
	Object.keys(goeData).forEach(function(key) {
		var value = goeData[key];
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
			addQueriesToLine(tree[key], 'goe', goeData);
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
	var query = makePazpar2Query(ddc, 'ddc');
	return query.replace(/ddc="([tg])/g, 'ddc-$1="');
}; 


// Ergebnis ausgeben
var cleanQueries = function (entry) {
	var result = JSON.parse(JSON.stringify(entry));

	var replacementID = IDMapping[result.id];
	if (replacementID) {
		result.id = replacementID;
	}
	var replacementParentID = parentRemapping[result.id] || IDMapping[result.parent];
	if (replacementParentID) {
		result.parent = replacementParentID;
	}

	if (Object.keys(entry.search.goe).length === 0) {
		delete entry.search.goe;
	}
	if (entry.search.kiel.length === 0)  {
		delete entry.search.kiel;
	}
	
	if (Object.keys(entry.search).length > 0) {
		result.query = JSON.stringify(entry.search);
	}

	delete result.search;
	delete result.ddc;
	delete result.display;

	return result;
};


var createCSV = function () {
	var results = extraLines.concat(
		Object.keys(tree).sort().map(function(key) {
			var clean = cleanQueries(tree[key]);

			return clean;
		})
	);

	var stringifier = csv.stringify({delimiter: ';'});
	var writeStream = fs.createWriteStream(folder + 'vifanord.csv');
	streamify(results).pipe(stringifier).pipe(writeStream);
};


var readKiel = function () {
	readFileIntoObject('Kiel.csv', kielData, processData);
};

var readSUB = function () {
	readFileIntoObject('SUB.csv', goeData, readKiel);
};

var readHGW = function () {
	readFileIntoObject('HGW.csv', hgwData, readSUB);
};

readHGW();
