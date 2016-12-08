var cmap = require('colormap'),
    canvas = document.getElementById('canvas'),
    c = canvas.getContext('2d'),
    n = 15000, // Number of strips.
    div = $(window).width() / n,
    colormaps = ['anger','anticipation','joy','disgust','sadness','fear']; // Name of coloring pattern.

run();

function drawColorMaps (colormap, name, height) {
    for (var j = 0; j < n; j++) {
        c.fillStyle = colormap[j];      
        c.fillRect(j*div*0.7, height, div, 200); 
    }
    c.fillStyle = '#FFFFFF';
    c.font = "30px lanenar";
    c.fillText(name, div*n*0.75, height + 100);
}

function run() {
    var height, colormap;
    c.canvas.height = 1200;
    c.canvas.width = 0.9*$(window).width();

    for (var i = 0; i < colormaps.length; i++) {
        height = i*200;
        colormap = cmap({
            colormap: colormaps[i],
            nshades: n,
            format: 'rgbaString'
        });
        drawColorMaps(colormap, colormaps[i], height);
    }
}
    
