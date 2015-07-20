#!/usr/bin/env iojs

var fs = require('fs');
var csv = require('csv-parse');

var parser = csv({columns: true, delimiter: ','}, function(err, data){
  console.log(data);
})

var rs = fs.createReadStream(__dirname+'/data/Kiel.csv')
	.pipe(parser);
