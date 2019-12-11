"use strict";

const fs = require('fs');
const readline = require('readline');

const imageWidth = 25;
const imageHeight = 6;



// Main

main();

function main() {
   var readInterface = readline.createInterface({
      input: fs.createReadStream('Input.txt'),
      output: process.stdout,
      terminal: false
   });

   var input = "";

   readInterface.on('line', function(line) {
      input += line;
   });
   
   readInterface.on('close', function() {            
      let layerSize = imageWidth * imageHeight;
      let numLayers = input.length / layerSize;
      console.log("Image contains " + numLayers + " layers of " + imageWidth + "x" + imageHeight);
      
      let image = [];
      let index = 0;
      for (let layer = 0; layer < numLayers; layer++) {
         console.log("Layer " + layer + ":");
         image[layer] = [];
         for (let y = 0; y < imageHeight; y++) {
            image[layer][y] = [];
            var row = "";
            for (let x = 0; x < imageWidth; x++) {
               let chr = input.charAt(index);
               row += chr;
               image[layer][y][x] = chr * 1;
               index++;
            }
            console.log("   " + row);
         }
      }
      
      let leastZeros = imageWidth * imageHeight + 1;
      let leastZerosLayer = -1;
      for (let layer = 0; layer < numLayers; layer++) {
         var zeros = count(image, layer, (v) => (v == 0));
         if (zeros < leastZeros) {
            leastZeros = zeros;
            leastZerosLayer = layer;
            console.log("Layer " + layer + " had " + zeros + " zeros");
         }
      }
      
      var ones = count(image, leastZerosLayer, (v) => (v == 1));
      console.log("Layer " + leastZerosLayer + " had " + ones + " ones");
      var twos = count(image, leastZerosLayer, (v) => (v == 2));
      console.log("Layer " + leastZerosLayer + " had " + twos + " twos");
      
      console.log("ANSWER 1 = " + (ones * twos));
      
      console.log("ANSWER 2:");
      let composed = [];
      for (let y = 0; y < imageHeight; y++) {
         composed[y] = [];
         for (let x = 0; x < imageWidth; x++) {
            for (let layer = 0; layer < numLayers; layer++) {
               var sample = image[layer][y][x];
               if (sample != 2) {
                  composed[y][x] = sample;
                  break;
               }
            }
         }
      }
      for (let y = 0; y < imageHeight; y++) {
         var row = "";
         for (let x = 0; x < imageWidth; x++) {
            if (composed[y][x] == 0) row += " ";
            else if (composed[y][x] == 1) row += "X";
            else row += ".";
         }
         console.log("   " + row);
      }
   });
}





// Helper functions

function count(image, layerIndex, predicate) {
   var count = 0;
   for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
         let chr = image[layerIndex][y][x];
         if (predicate(chr)) count++;
      }
   }
   return count;
}