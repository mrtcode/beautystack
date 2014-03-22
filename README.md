#Beautystack.js

Node.js module to make beautiful stacks of photos.

![](https://raw.githubusercontent.com/bagdonas/beautystack/master/docs/images/example1.jpg)

##Features
- Supports background color, image or trancparency
- Has mansy customization parameters like spacing, rotation, quality..
- Supports directory or array of files for input
- Works asynchroniously, supports simultanious conversions of images
- Has event for tracking progress of conversion in percents
- With jhead makes loseless autorotations of images

##Installation
For this module only [ImageMagick](http://www.imagemagick.org/) and [jhead](http://www.sentex.net/~mwandel/jhead/) are needed to be installed.

###For Ubuntu and Debian
    apt-get install imagemagick
    apt-get install jhead

###For Mac OS X
    brew install imagemagick
    brew install jhead

###Instalation of module
via [npm](http://www.npmjs.org/)

    npm install beautystack
    
or clone repo

    npm install git://github.com/bagdonas/beautystack.git

##Getting Started
The bare minimum code needed to start conversion
```js
var beautystack = require('beautystack');

var bs = new beautystack;

bs.process({source: 'images/', output: 'output/example1.png',}, function(err, data) {
  if (err) {
    console.log('Beautystack processing error: ' + err);
    return;
  }
  console.log('Photos processed! Check out your new beautiful stack of photos: ' + data.output);
});
```
To track progress of conversion
```js
bs.on('progress', function(data) {
  console.log("Percent: " + data.percent);
});
```


