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

   var asteroidMap = [];

   readInterface.on('line', function(line) {
      var row = [];
      for (let c of line) {
         if (c == '#') row.push(1);
         else if (c == '.') row.push(0);
         else throw new Error("Unexpected character " + c);
      }
      asteroidMap.push(row);
   });
   
   readInterface.on('close', function() {
      
      var mostSeen = 0;
      var bestPos = null;
      
      var height = asteroidMap.length;
      var width = asteroidMap[0].length;
      for (let row = 0; row < height; row++) {
         for (let col = 0; col < width; col++) {
            if (asteroidMap[row][col] == 1) {
               var sightLines = resolveSightLines(asteroidMap, col, row);
               var num = countVisibleAsteroids(asteroidMap, sightLines);
               
               if (num > mostSeen) {
                  mostSeen = num;
                  bestPos = {x: col, y: row};
               }
            }
         }
      }
      
      var sightLines = resolveSightLines(asteroidMap, bestPos.x, bestPos.y);
      render(asteroidMap, sightLines);
      
      console.log();
      console.log("ANSWER 1 = " + mostSeen + " asteroids visible from " + bestPos.x + "," + bestPos.y);
      console.log();
      
      var vaporizeCount = 0;
      var answer2 = 0;
      vaporizeAll(asteroidMap, bestPos.x, bestPos.y, (asteroid) => {
         vaporizeCount++;
         if (vaporizeCount == 200) {
            answer2 = (asteroid.x * 100 + asteroid.y);
         }
      });
      console.log();
      console.log("ANSWER 2 = " + answer2);
      console.log();
      
   });
}





// Helper functions

function resolveSightLines(map, x, y) {
   var height = map.length;
   var width = map[0].length;
   
   // Construct empty sight line array
   var sightLines = [];
   for (let row = 0; row < height; row++) {
      sightLines[row] = [];
      for (let col = 0; col < width; col++) {
         let cell = map[row][col];
         sightLines[row][col] = {viewedFrom: {x: x, y: y}, visible: true};
      }
   }
   
   for (let dx = -x; dx < (width-x); dx++) {
      for (let dy = -y; dy < (height-y); dy++) {
         // Skip if looking at self
         if (dx == 0 && dy == 0) continue;
         
         let asteroidX = x + dx;
         let asteroidY = y + dy;
         
         if (map[asteroidY][asteroidX] == 1) {
            // Normalize <dx,dy> to cast proper shadows
            var denom = gcd(dx, dy);
            var sx = dx/denom;
            var sy = dy/denom;
            
            // Otherwise, begin marking shadows until edge of map is reached
            let shadowX = asteroidX + sx;
            let shadowY = asteroidY + sy;
            while (shadowX >= 0 && shadowX < width && shadowY >= 0 && shadowY < height) {
               // Mark shadow
               var entry = sightLines[shadowY][shadowX];
               if (entry.visible) {
                  entry.visible = false;
                  entry.blockedBy = [];
               }
               entry.blockedBy.push({x: asteroidX, y: asteroidY});
               
               shadowX += sx;
               shadowY += sy;
            }
         }
      }
   }
   
   return sightLines;   
}

function countVisibleAsteroids(map, sightLines) {
   var height = map.length;
   var width = map[0].length;
   var count = 0;
   
   for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
         if (map[row][col] == 1) {
            var sight = sightLines[row][col];
            if (col == sight.viewedFrom.x && row == sight.viewedFrom.y) {
               // Don't count self
            } else if (sight.visible) {
               count++;
            }
         }
      }
   }
   return count;
}

function render(map, sightLines) {
   var height = map.length;
   var width = map[0].length;
   var count = 0;
   
   {
      var str = "  ";
      for (let col = 0; col < width; col++) {
         str += (col % 10) + " ";
      }
      console.log(str);
   }
   
   for (let row = 0; row < height; row++) {
      var str = (row % 10) + " ";
      for (let col = 0; col < width; col++) {
         var chr = " ";
         
         var sight = sightLines[row][col];
         if (sight.viewedFrom.x == col && sight.viewedFrom.y == row) chr = "@";
         else if (sight.visible == false && map[row][col] == 1) chr = ".";
         else if (sight.visible == false) chr = " ";
         else if (map[row][col] === 1) chr = "O"
         else if (map[row][col] !== 0) chr = map[row][col] + "";
         str += chr + " ";
      }
      console.log(str);
   }
   return count;
}

function vaporizeAll(map, x, y, vaporizeCallback) {
   var height = map.length;
   var width = map[0].length;
   
   var totalAsteroids = 0;
   var mapCopy = [];
   for (let row = 0; row < height; row++) {
      mapCopy[row] = [];
      for (let col = 0; col < width; col++) {
         mapCopy[row][col] = map[row][col];
         if (row == y && col == x) continue;
         if (map[row][col] == 1) totalAsteroids++;
      }
   }
   
   var laserPos = {x: x, y: y}
   
   console.log(totalAsteroids + " total asteroids");
   var asteroidsVaporized = 0;
   while (asteroidsVaporized < totalAsteroids) {
      var sightLines = resolveSightLines(mapCopy, x, y);
      
      var toBeVaporized = [];
      
      // Sweep
      var reach = Math.max(x, width-x-1, y, height-y-1);
      for (let coord of radialIteratorAsteroids(reach)) {
         if (coord.x == 0 && coord.y == 0) continue;
         
         let col = x + coord.x;
         let row = y + coord.y;
         if (col < 0 || row < 0 || col >= width || row >= height) continue;
         
         if (mapCopy[row][col] == 1 && sightLines[row][col].visible) {
            // Mark this asteroid
            toBeVaporized.push({x: col, y: row});
         }
      }
      
      asteroidsVaporized += toBeVaporized.length;
      console.log("Vaporizing " + toBeVaporized.length + " asteroids... (" + (totalAsteroids - asteroidsVaporized) + " remaining)");
      
      // Render vaporization
      for (let asteroid of toBeVaporized) {
         vaporizeCallback(asteroid);
         mapCopy[asteroid.y][asteroid.x] = 0;
      }
      sightLines = resolveSightLines(mapCopy, x, y);
      for (let asteroid of toBeVaporized) {
         mapCopy[asteroid.y][asteroid.x] = "X";
      }
      render(mapCopy, sightLines);
      console.log();
      
      // Remove asteroids from map
      for (let asteroid of toBeVaporized) {
         mapCopy[asteroid.y][asteroid.x] = 0;
      }
      
   }
}

function *radialIteratorAsteroids(reach) {
   for (let result of radialIterator(reach)) {
      yield {x: result.y, y: -result.x};
   }
}

function *radialIterator(reach) {
   // Return center
   yield {x: 0, y: 0};
   
   // First quadrant
   for (let result of radialIteratorFirstQuadrant(reach)) {
      yield result;
   }
   
   // Second quadrant
   for (let result of radialIteratorFirstQuadrant(reach)) {
      // Rotate 90 degress counter-clockwise
      yield {x: -result.y, y: result.x};
   }
   
   // Third quadrant
   for (let result of radialIteratorFirstQuadrant(reach)) {
      // Rotate 180 degress counter-clockwise
      yield {x: -result.x, y: -result.y};
   }
   
   // Fourth quadrant
   for (let result of radialIteratorFirstQuadrant(reach)) {
      // Rotate 270 degress counter-clockwise
      yield {x: result.y, y: -result.x};
   }
}

function *radialIteratorFirstQuadrant(reach) {
   if (reach < 1) yield undefined;
   
   // First, trace from center to edge
   for (let i = 1; i <= reach; i++) {
      yield {x: i, y: 0};
   }
   
   // Lower triangle
   for (let result of radialIteratorFirstQuadrantLowerTriangle(reach)) {
      yield result;
   }
   
   // Diagonal
   for (let i = 1; i <= reach; i++) {
      yield {x: i, y: i};
   }
   
   // Upper triangle
   for (let result of radialIteratorFirstQuadrantUpperTriangle(reach)) {
      yield result;
   }
}

function *radialIteratorFirstQuadrantLowerTriangle(reach) {   
   // Crawl through lower triangle looking for best tiles until pool is empty
   if (reach > 1) {
      // The pool is a minimal data structure to keep track of which tiles
      // have been returned in the triangle that looks like this:
      //      /
      //     /5    e.g. reach = 5
      //    /45    "pool" is the array down the right hand side, from bottom
      //   /345    to top and indexed from 1: {5, 5, 5, 5}. Each row is empty
      //  /2345    when pool[i] <= i. In this triangle, X = pool[i], Y = i.
      // 0-----
      var pool = [];
      for (let i = 1; i < reach; i++) {
         pool[i] = reach;
      }
      
      let best;
      do {
         best = 0;
         for (let i = 1; i < reach; i++) {
            // if row is empty, skip it
            if (pool[i] <= i) continue;
            
            if (best == 0) {
               best = i;
            } else if (radialCompareInFirstQuadrant(pool[best], best, pool[i], i) > 0) {
               best = i;
            }
         }
         
         if (best != 0) {
            let result = {x: pool[best], y: best};
            pool[best]--; // delete best tile from pool
            yield result; // return it
         }
      } while (best != 0);
   }
}

function *radialIteratorFirstQuadrantUpperTriangle(reach) {
   // Crawl through upper triangle looking for best tiles until pool is empty
   if (reach > 1) {
      // The pool is a minimal data structure to keep track of which tiles
      // have been returned in the triangle that looks like this:
      // |5555/
      // |444/     e.g. reach = 5
      // |33/      "pool" is the array along the diagonal from bottom left to
      // |2/       top right and indexed from 1: {5, 5, 5, 5}. Each column is
      // |/        empty when pool[i] > reach. In this triangle, X = i, Y = pool[i].
      // 0
      var pool = [];
      for (let i = 1; i < reach; i++) {
         pool[i] = i+1;
      }
      
      let best;
      do {
         best = 0;
         for (let i = 1; i < reach; i++) {
            // if row is empty, skip it
            if (pool[i] > reach) continue;
            
            if (best == 0) {
               best = i;
            } else if (radialCompareInFirstQuadrant(best, pool[best], i, pool[i]) > 0) {
               best = i;
            }
         }
         
         if (best != 0) {
            let result = {x: best, y: pool[best]};
            pool[best]++; // delete best tile from pool
            yield result; // return it
         }
      } while (best != 0);
   }
}

function radialCompareInFirstQuadrant(x1, y1, x2, y2) {
   let gcd1 = gcd(x1, y1);
   let x1n = x1 / gcd1;
   let y1n = y1 / gcd1;
   
   let gcd2 = gcd(x2, y2);
   let x2n = x2 / gcd2;
   let y2n = y2 / gcd2;
   
   // We want to compare y1/x1 to y2/x2. To avoid floating point numbers, 
   // we will convert fractions to the same denominator by cross multiplication.
   // then compare the numerators. (e.g. y1*x2/x1*x2 <=> y2*x1/x2*x1)
   let compare = y1n*x2n - y2n*x1n;
   if (compare != 0) return compare;
   
   // Same slope, break ties by distance
   else return x1-x2;
   
}

function gcd(a, b) {
   if (a < 0) a = -a;
   if (b < 0) b = -b;
   
   let recurseCount = 0;
   
   var recurse = function(a, b) {
      if (a == 0) return b;
      if (b == 0) return a;
      return recurse(b, a % b);
   }; 
   
   var result = recurse(a, b);
   return result;
}