var childProcess = require('child_process');
var path = require('path');
var fs = require('fs');
var events = require('events');
var util = require('util');


// Image source type constants

var ST_LIST = 1;
var ST_DIR = 2;

/* 
 * Instance number to distinguish between Beautystack objects
 * when created simulaniosly and later isolate files prefixes 
 * for each instance by using this number.
 * It needed, for example, to simulationsly process files with 
 * the some file names and to prevent confusion between files 
 * in temp directory. Also, on every execution of 
 * Beautystack.process the new instance should be assigned.
 */
var instanceNr = 0;


function Beautystack() {
  this.busy = false;

  // Initializing events
  events.EventEmitter.call(this);
}

util.inherits(Beautystack, events.EventEmitter);

// Exports Beautystack object
module.exports = Beautystack;

/*
 * Main function for iniciating images processing
 * 
 * @param {array} options
 * @param {function} next - function to call after this functios finishes
 */
Beautystack.prototype.process = function(options, next) {
  var self = this;

  if (this.busy === true)
    throw new Error('Object is bussy');

  this.busy = true;

  function callback(err) {
    self.cleanup(function() {

      // Make main object unbusy
      self.busy = false;

      if (err) {

        // Callback with error, if next function defined
        if (typeof next === 'function')
          next(err);

        // Emit error event
        self.emit('error', err);
      }
      else {
        var data = {};
        data.output = self.output;
        // Callback with ouput image path, if next function defined
        if (typeof next === 'function')
          next(null, data);

        // Emit success event and pass output image path
        self.emit('success', data);
      }
    });
  }

  // Assigning instance number for newly created object
  this.instance = instanceNr++;

  // Image path array given by user or readed of the directory given by user
  this.images = [];

  // Image path array of original images copied to temp directory
  this.orgImages = [];

  // Image path array of generated polaroid images
  this.polImages = [];

  // Polaroid images dimensions [width, height]
  this.polImagesDimensions = [];

  // Total steps to complete processing. Every step is a small operation, like conversion of one image
  this.progressTotalSteps = 0;

  // Steps currently made
  this.progressSteps = 0;

  // Current progress of processing which is expressed by percents
  this.progressPercent = 0;

  // Temp directory, where all intermediate files will be kept
  this.temp = options.temp || '/tmp';

  // Detecting source type of given images
  if (typeof options.source === 'string') { //If string, it should be directory
    this.sourceType = ST_DIR;
    this.source = options.source;
  } else if (typeof options.source === 'object') { //If object, it should be array of images paths
    this.sourceType = ST_LIST;
    this.images = options.source;
  } else {
    throw new Error('Wrong source type. Only "string" for directory and "array" object for image path list is allowed');
  }

  // Checking if output file path is defined
  if (typeof options.output === 'undefined')
    throw new Error('Output file not selected');
  else
    this.output = options.output;

  // Setting allowed images extensions when source type is ST_DIR to filter unwanted files
  this.extensions = options.extensions || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif'];

  // Width for every polaroid image
  this.width = options.width || 200;

  // Height for every polaroid image
  this.height = options.height || 140;

  // Columns count of polaroid images in the main image
  this.columns = options.columns || 4;

  // Space between images horizontaly
  this.xspace = options.xspace || (-50);

  // Space between images verticaly
  this.yspace = options.yspace || (-20);

  // Max rotation angle. It ranges between -this.rotation and this.rotation randomly
  this.rotation = options.rotation || 30;

  // Progress interval describes how often progress event is triggered when progress+
  this.progressInterval = options.progressInterval || 10;

  // If source type is directory, then additional reading of that directory is needed
  if (this.sourceType === ST_DIR) {
    this.loadImages(this.source, function(err) {
      if (err) callback(err);

      // Sorting images to be in the some order as in directory
      self.images.sort();
      // If image loading is successful, then call immage processing function
      _imageProc();
    })
  } else {

    // Call image processing function
    _imageProc();
  }

  // Starting processing of images in this.images array
  function _imageProc() {

    // Calculating total count of steps
    self.progressTotalSteps = self.images.length * 3;

    // Copying all images declared in self.images to temp directoy
    self.copyImageAll(function(err) {
      if (err) return callback(err);

      // Autorotating all images declared in self.orgImages
      self.autoRotateImageAll(function(err) {
        if (err) return callback(err);

        // Making polaroid versions of all images in self.orgImages
        self.polaroidImageAll(function(err) {
          if (err) return callback(err);

          // Combining all processed polaroid images in self.polImages
          self.combineGridImage(function(err) {
            if (err) return callback(err);

            // If success, we should already have a generated main image
            // Calling back
            callback(null);
          });
        });
      });
    });
  }
}

/*
 * Increases progress steps, calculates percents and emits "progress" event
 */
Beautystack.prototype.incProgress = function() {
  this.progressSteps++;
  var prc = Math.floor(this.progressSteps * 100 / this.progressTotalSteps);
  if (prc > this.progressPercent) {
    this.emit('progress', {percent: prc});
  }
  this.progressPercent = prc;
}

/*
 * Generates unique file prefix for this process and this object instance
 */
Beautystack.prototype.getPrefix = function() {
  var str = 'pg_';
  if (process.pid) {
    str += process.pid + '_' + this.instance + '_';
  }
  return str;
}

/*
 * Load images from directory
 */
Beautystack.prototype.loadImages = function(dir, callback) {
  dir = path.resolve(dir);
  var self = this;
  var filteredFiles = [];
  fs.readdir(dir, function(err, fileNames) {
    if (err) {
      return callback(err);
    }
    var remaining = fileNames.length;
    fileNames.forEach(function(fileName) {
      fs.stat(path.join(dir, fileName), function(err, stat) {

        if (stat && stat.isFile()) {
          var extension = path
                  .extname(fileName)
                  .toLowerCase()
                  .substr(1);

          self.extensions.forEach(function(value) {
            if (extension === value) {
              self.images.push(path.join(dir, fileName));
            }
          });
        }
        if (!--remaining) {
          self.imageList = filteredFiles;
          callback(null);
        }
      });
    });

  });
}

/*
 * Copies all original images to temp directory and assigns new names for the files
 */
Beautystack.prototype.copyImageAll = function(callback) {
  var self = this;
  var i = 0;
  (function p() {
    var index = i;
    i++;
    if (index < self.images.length) {
      var src = self.images[index];
      var prefix = self.getPrefix() + index + '_';
      var dest = path.join(self.temp, prefix + path.extname(src).toLowerCase());

      self.copyFile(src, dest, function(err) {
        if (err) callback(err);
        self.orgImages[index] = dest;
        self.incProgress();
        setTimeout(p, 0);
      });
    } else {
      callback();
    }
  })();
}

/*
 * Just simple copy file function
 */
Beautystack.prototype.copyFile = function(source, target, callback) {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      callback(err);
      cbCalled = true;
    }
  }
}

/*
 * Rotates all images
 */
Beautystack.prototype.autoRotateImageAll = function(callback) {
  var self = this;
  var i = 0;
  (function p() {
    var index = i;
    i++;
    if (index < self.orgImages.length) {
      var src = self.orgImages[index];
      self.autoRotateImage(src, function(err) {
        if (err) callback(err);
        self.incProgress();
        setTimeout(p, 0);
      });
    } else {
      callback();
    }
  })();
}

/*
 * Executes jhead to rotate an image
 */
Beautystack.prototype.autoRotateImage = function(src, callback) {
  var self = this;
  var cmd = 'jhead -autorot "' + src + '"';
  var im = childProcess.exec(cmd, function(error, stdout, stderr) {
    if (error) {
      return callback(new Error('code: ' + error.code + ' signal: ' + error.signal + ' ' + stderr));
    }
    callback(null, src);
  });
}

/*
 * Makes polaroid versions of all images in orgImages array
 */
Beautystack.prototype.polaroidImageAll = function(callback) {
  var self = this;
  var i = 0;
  (function p() {
    var index = i;
    i++;
    if (index < self.orgImages.length) {
      var src = self.orgImages[index];
      var prefix = self.getPrefix() + index + '_p_';
      var dest = path.join(self.temp, prefix + '.png');
      self.polaroidImage(src, dest, function(err, data) {
        if (err) callback(err);
        self.polImages[index] = dest;
        self.polImagesDimensions[index] = data.dimensions;
        self.incProgress();
        setTimeout(p, 0);
      });
    } else {
      callback();
    }
  })();
}

/*
 * Executes imagemagick's convert to make a polaroid image
 */
Beautystack.prototype.polaroidImage = function(src, dest, callback) {
  var self = this;
  var data = {};
  data.dimensions = {};
  var rotation = Math.floor(Math.random() * (this.rotation * 2 - 0 - 1) - this.rotation);
  data.dimensions.width = Math.ceil(Math.sin(Math.abs(rotation) * Math.PI / 180) * (this.height + 32) + Math.cos(Math.abs(rotation) * Math.PI / 180) * (this.width + 32));
  data.dimensions.height = Math.ceil(Math.cos(Math.abs(rotation) * Math.PI / 180) * (this.height + 32) + Math.sin(Math.abs(rotation) * Math.PI / 180) * (this.width + 32));
  data.src = src;

  var cmd = 'convert "' + src + '" -quality 100 -thumbnail ' + this.width + 'x' + this.height + '^ -gravity center -extent ' + this.width + 'x' + this.height + ' -bordercolor snow -background black -border 2 -polaroid ' + rotation + ' "' + dest + '"';
  var im = childProcess.exec(cmd, function(error, stdout, stderr) {
    if (error) {
      return callback(new Error('code: ' + error.code + ' signal: ' + error.signal + ' ' + stderr));
    }
    callback(null, data);
  });
}

/*
 * Combines all polaroid images to one main image
 */
Beautystack.prototype.combineGridImage = function(callback) {
  var self = this;
  var width = 0;
  var height = 0;
  var cmd = '';
  var x = 0, y = 0, n = 0;
  this.polImages.forEach(function(el, i) {
    var dimensions = self.polImagesDimensions[i];
    var xm, ym;
    xm = -(Math.random() * (20 - 0 - 1)) + self.xspace;

    if (n % self.columns !== 0) {
      x += xm;
    }

    x = Math.ceil(x);
    y = Math.ceil(y);

    cmd += el + ' -geometry +' + x + '+' + y + ' -composite ';

    x += dimensions.width;

    n++;

    if (self.polImages.length > self.columns) {
      if (n % self.columns === 0 && self.polImages.length - n !== 0) {
        if (x > width)
          width = x;
        x = 0;
        y += self.height + self.yspace;
      }
    } else {
      if (self.polImages.length - n === 0)
        width = x;
    }

    if (n % self.columns >= 0 && self.polImages.length - n < self.columns) {
      var yTemp = y + dimensions.height;
      if (yTemp > height)
        height = yTemp;
    }

  });
  width = Math.ceil(width);
  height = Math.ceil(height);

  cmd = 'convert -quality 100 -size ' + width + 'x' + height + ' xc:transparent ' + cmd + this.output;
  //console.log(cmd);

  var im = childProcess.exec(cmd, function(error, stdout, stderr) {
    if (error) {
      return callback(new Error('code: ' + error.code + ' signal: ' + error.signal + ' ' + stderr));
    }
    callback(null);
  });
}

/*
 * Cleans up all files created in temp directory
 * Cleanup is executed after image processing,
 * and it works event after this.process function returns.
 * With this function we only make sure the file removal tasks
 * are scheduled and parameters are passed
 */
Beautystack.prototype.cleanup = function(callback) {
  var self = this;
  removeFiles(this.orgImages, function() {
    removeFiles(self.polImages, function() {
      callback();
    });
  });

}

/*
 * Removes all files in array.
 * This function must work independedly of the object, 
 * becouse object could be reused imediately after this.process returns,
 * but file removal is still working
 */
var removeFiles = function(files, callback) {
  // We only need to make sure this function is executed and files array copied
  callback();

  // Duplicating array to be independed from 'this' object
  var _files = files;
  var i = 0;
  (function p() {
    var index = i;
    i++;
    if (index < _files.length) {
      var src = _files[index];
      fs.unlink(src, function(err) {
        setTimeout(p, 0);
      });
    } else {
      // We are not tracking when files removal will be done
      //callback();
    }
  })();
}

