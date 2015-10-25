#!/usr/bin/env node
'use strict';

let fs = require('fs');
let csv = require('csv');
let streamify = require('stream-array');

let folder = __dirname + '/data/';

let parser = csv.parse({columns:true, delimiter:'\t', quote:'§'});

let lines = {};
let byParent = {};

parser.on('readable', function() {
	var record;
	while (record = parser.read()) {
		// console.log(record);
		var kielOverwrite = record['kiel overwrite'];
		if (!kielOverwrite || (kielOverwrite && kielOverwrite.indexOf('xxx') === -1)) {
			lines[record.ID] = record;
		}
		else {
			console.log('xxx: Lösche ' + record.ID );
		}
	}
})
.on('error', function(error) {
	console.log('Fehler: ' + error.message);
})
.on('finish', function() {
	next();
});

let filePath = 'data/Google-Export.tsv';
fs.createReadStream(filePath).pipe(parser);

let hierarchicallyImproveKiel = function (line) {
	let kielquery = line['kiel overwrite'] ? line['kiel overwrite'] : line['kiel+'];
	console.log(line.ID + ': ' + kielquery);

	if (kielquery && kielquery.indexOf('Loading') !== -1) {
		console.log('kiel Loading ersetzen für ' + line.ID);
		let children = byParent[line.ID];
		let childSubjects = {};
		for (var childIndex in children) {
			let kielResult = children[childIndex]['kiel result'];
			if (kielResult.length > 0 && kielResult[0] === '[') {
				let queryList = JSON.parse(kielResult);
				for (var queryIndex in queryList) {
					let subjectQuery = queryList[queryIndex];
					childSubjects[subjectQuery] = true;
				}
			}
		}
		return Object.keys(childSubjects);
	}

	if (kielquery) {
		return JSON.parse(kielquery);
	}

	return null;
}

let hierarchicallyImproveGoe = function (line) {
	let goequery = line['goe overwrite'] ? line['goe overwrite'] : line['goe+'];
	console.log(line.ID + ': ' + goequery);
	
	if (goequery && goequery.indexOf('Loading') !== -1) {
		console.log('goe Loading ersetzen für ' + line.ID);
		let children = byParent[line.ID];
		let childSubjects = {};
		for (var childIndex in children) {
			let goeResult = children[childIndex]['goe result'];
			if (goeResult && goeResult.length > 0 && goeResult[0] === '{') {
				let queryObject = JSON.parse(goeResult);
				for (var region in queryObject) {
					let regionQuery = queryObject[region];
					if (!childSubjects[region]) {
						childSubjects[region] = [];
					}
					childSubjects[region].push(regionQuery);
				}
			}
		}
		for (var region in childSubjects) {
			childSubjects[region] = '(' + childSubjects[region].join(' or ') + ')';
		}
		return childSubjects;
	}

	if (goequery) {
		return JSON.parse(goequery);
	}

	return null;
}

let next = function () {
	
	for (var id in lines) {
		let line = lines[id];
		let parentId = line['parent ID'];
		if (!byParent[parentId]) {
			byParent[parentId] = [];
		}
		byParent[parentId].push(line);
	}
	
	// anreichern
	for (var id in lines) {
		let line = lines[id];
		line.kielquery = hierarchicallyImproveKiel(line);
		line.goequery = hierarchicallyImproveGoe(line);
		let fullquery = {};
		if (line.kielquery && line.kielquery.length > 0) {
			fullquery.kiel = line.kielquery;
		}
		if (line.goequery && Object.keys(line.goequery).length > 0) {
			fullquery.goe = line.goequery;
		}
		console.log(fullquery);
		line.fullquery = fullquery;
	}
	
	// ausgeben
	let resultLines = [];
	for (var id in lines) {
		let line = lines[id];
		let resultLine = {
			id: line['ID'],
			parent: line['parent ID'],
			de: line['DE merge'],
			query: JSON.stringify(line['fullquery']).replace(/\s*"/g, '"').replace(/\*/g, '?'),
			en: line['EN merge']
		}
		resultLines.push(resultLine);
		console.log(resultLine);
	}
	
	let stringifier = csv.stringify({delimiter: ';'});
	let writeStream = fs.createWriteStream(folder + 'vifanord2.csv');
	streamify(resultLines).pipe(stringifier).pipe(writeStream);
	
};