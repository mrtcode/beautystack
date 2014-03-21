var beautystack = require('../');

var bs = new beautystack;


var config = {
  source: [
    'images/Yellow-leaf.jpg',
    'images/Winter-wallpaper-by-cool-wallpapers-15.jpg',
    'images/winter-accident.jpg',
    'images/wallpapers-nature-animals.jpg',
    'images/Spring-starts.jpg',
    'images/Siamese-Kittens-domestic-animals-2256707-1280-1024.jpg',
    'images/orange_color_animals_15.jpg',
    'images/Nature-Wallpapers-HD-640x360.jpg',
    'images/nature-wallpaper-362.jpeg',
    'images/from-africa-kenya-forest-zebras-animals_498253.jpg',
    'images/Dog-wallpaper-cute-puppy-wallpaper-puppies-photo-animals-free.jpg',
    'images/Cute-Panda-Bears-animals-34916401-1455-1114.jpg',
    'images/Coconut-Tree-at-Beach-Nature-Wallpaper.jpg',
    'images/Autumn-steps.jpg',
    'images/Autumn-morning.jpg',
    'images/autumn-leaves1.jpg',
    'images/autumn-leaves-wallpapers-photos.jpg',
    'images/Animals-animals-31477061-1280-1024.jpg',
  ],
  output: 'output/example2.png',
  columns: 4,
  width: 200,
  height: 140,
  rotation: 30,
  //background: 'white'
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


