var beautystack = require('../');

var bs = new beautystack;


var config = {
  source: 'images/',
  output: 'output/example1.png',
  columns: 5,
};

bs.on('progress', function(data) {
  console.log("Percent: " + data.percent);
});

bs.process(config, function(err, data) {
  if (err) {
    console.log('Beautystack processing error: ' + err);
    return;
  }
  console.log('Photos processed! Check out your new beautiful stack of photos: ' + data.output);
});


