"use strict";

const fs = require('fs');
const readline = require('readline');
const xxhash = require('js-xxhash');



// Main

main();
  
function main() {
   
   var readInterface = readline.createInterface({
      input: fs.createReadStream('Input.txt'),
      output: process.stdout,
      terminal: false
   });

   var moons = [];

   readInterface.on('line', function(line) {
      var regex = /<x=(-?\d+), y=(-?\d+), z=(-?\d+)>/g;
      var match;
      while ((match = regex.exec(line)) !== null) {
         var moon = {x: parseInt(match[1]), y: parseInt(match[2]), z: parseInt(match[3])};
         console.log("Moon <x=" + moon.x + ", y=" + moon.y + ", z=" + moon.z + ">");
         moons.push(moon);         
      }
   });
   
   readInterface.on('close', function() {
      for (let moon of moons) {
         moon.dx = 0;
         moon.dy = 0;
         moon.dz = 0;
      }
      console.log();
      
      var afterSim = simMoons(moons, 1000);
      var totalEnergy = 0;
      for (let moon of afterSim) {
         moon.potentialEnergy = Math.abs(moon.x) + Math.abs(moon.y) + Math.abs(moon.z);
         moon.kineticEnergy = Math.abs(moon.dx) + Math.abs(moon.dy) + Math.abs(moon.dz);
         moon.energy = moon.potentialEnergy * moon.kineticEnergy;
         totalEnergy += moon.energy;
      }
      console.log(afterSim);
      console.log();
      console.log("ANSWER 1 = " + totalEnergy);
      console.log();
      
      var cycleX = findCycle(moons, (moon) => moon.x, (moon) => moon.dx);
      var cycleY = findCycle(moons, (moon) => moon.y, (moon) => moon.dy);
      var cycleZ = findCycle(moons, (moon) => moon.z, (moon) => moon.dz);
      
      if (cycleX.from == 0 && cycleY.from == 0 && cycleZ.from == 0) {
         console.log();
         console.log("ANSWER 2 = " + lcm(cycleX.length, cycleY.length, cycleZ.length));
         console.log();
      } else {
         console.log("Synchronizing...");
         var i = cycleX.from + cycleX.length;
         var j = cycleY.from + cycleY.length
         var k = cycleZ.from + cycleZ.length;
         while (i != j || j != k) {
            if (i <= j && i <= k) i += cycleX.length;
            else if (j <= i && j <= k) j += cycleY.length;
            else if (k <= i && k <= j) k += cycleZ.length;
            //console.log([j-i, k-i]);
         }
         console.log();
         console.log("ANSWER 2 = " + i);
         console.log();
      }
   });
   
}




function simMoons(moons_in, iterations) {
   var start = new Date();
   
   // Make a working copy
   var moons = [];
   for (let i = 0; i < moons_in.length; i++) {
      moons[i] = { 
         x:  moons_in[i].x, 
         y:  moons_in[i].y, 
         z:  moons_in[i].z, 
         dx: moons_in[i].dx,
         dy: moons_in[i].dy,
         dz: moons_in[i].dz,
      };
   }
   
   for (let step = 0; step < iterations; step++) {      
      // Apply gravity
      for (let i = 0; i < moons.length; i++) {
         for (let j = i+1; j < moons.length; j++) {
            if      (moons[i].x < moons[j].x) { moons[i].dx += 1; moons[j].dx -= 1; }
            else if (moons[i].x > moons[j].x) { moons[i].dx -= 1; moons[j].dx += 1; }
            if      (moons[i].y < moons[j].y) { moons[i].dy += 1; moons[j].dy -= 1; }
            else if (moons[i].y > moons[j].y) { moons[i].dy -= 1; moons[j].dy += 1; }
            if      (moons[i].z < moons[j].z) { moons[i].dz += 1; moons[j].dz -= 1; }
            else if (moons[i].z > moons[j].z) { moons[i].dz -= 1; moons[j].dz += 1; }
         }
      }
      
      // Apply velocity
      for (let i = 0; i < moons.length; i++) {
         moons[i].x += moons[i].dx;
         moons[i].y += moons[i].dy;
         moons[i].z += moons[i].dz;
      }
   }
   
   var end = new Date();
   console.log("Simulated " + iterations + " iterations in %dms", end-start);
   
   return moons;
}




function findCycle(moons_in, getPos, getVel) {
   var start = new Date();
   
   // Make a working copy
   var moons = [];
   for (let i = 0; i < moons_in.length; i++) {
      moons[i] = { 
         x: getPos(moons_in[i]), 
         dx: getVel(moons_in[i]),
      };
   }
   
   var startIter;
   var endIter;
   
   var previousHashes = [];
   let step = 0;
   while (true) {      
      // Check for re-occurrence of previous x-state
      var buf = Buffer.alloc(32);
      buf.writeInt32BE(moons[0].x,  0);
      buf.writeInt32BE(moons[0].dx, 4);
      buf.writeInt32BE(moons[1].x,  8);
      buf.writeInt32BE(moons[1].dx, 12);
      buf.writeInt32BE(moons[2].x,  16);
      buf.writeInt32BE(moons[2].dx, 20);
      buf.writeInt32BE(moons[3].x,  24);
      buf.writeInt32BE(moons[3].dx, 28);
      var hash = xxhash.xxHash32(buf, 0x1758E1AB);
      
      var summary = [
         step,
         moons[0].x,
         moons[0].dx,
         moons[1].x,
         moons[1].dx,
         moons[2].x, 
         moons[2].dx,
         moons[3].x, 
         moons[3].dx
      ];
      
      if (typeof(previousHashes[hash]) !== 'undefined') {
         var states = previousHashes[hash];
         var matchFound = false;
         for (let state of states) {
            let match = true;
            for (let i = 1; i <= 8; i++) {
               if (summary[i] != state[i]) {
                  match = false;
                  break;
               }
            }
            
            if (match) {               
               startIter = state[0];
               endIter = step;
               matchFound = true;
               break;
            }
         }
         if (matchFound) break;
      } else {
         previousHashes[hash] = [summary];
      }
      
      step++;
      
      // Apply gravity
      for (let i = 0; i < moons.length; i++) {
         for (let j = i+1; j < moons.length; j++) {
            if      (moons[i].x < moons[j].x) { moons[i].dx += 1; moons[j].dx -= 1; }
            else if (moons[i].x > moons[j].x) { moons[i].dx -= 1; moons[j].dx += 1; }
         }
      }
      
      // Apply velocity
      for (let i = 0; i < moons.length; i++) {
         moons[i].x += moons[i].dx;
      }
   }
   
   var cycle = { from: startIter, to: endIter, length: (endIter - startIter) };
   var end = new Date();
   
   console.log("Found a cycle {from: " + cycle.from + ", to: " + cycle.to + ", length: " + cycle.length + "} in: %dms", end-start);
   return cycle;
}

function lcm(a, b, c) {
   return lcm_internal(a, b, c, []);
}

function lcm_internal(a, b, c, factors) {
   if (a == 1 && b == 1 && c == 1) {
      var result = 1;
      for (let factor of factors) {
         result *= factor;
      }
      return result;
   }
   
   let i = 2;
   while (true) {
      var quotientA = Math.floor(a / i);
      var remainderA = a % i;
      var nextA = (remainderA == 0) ? quotientA : a;
      
      var quotientB = Math.floor(b / i);
      var remainderB = b % i;
      var nextB = (remainderB == 0) ? quotientB : b;
      
      var quotientC = Math.floor(c / i);
      var remainderC = c % i;
      var nextC = (remainderC == 0) ? quotientC : c;
      
      if (remainderA == 0 || remainderB == 0 || remainderC == 0) {
         factors.push(i);
         return lcm_internal(nextA, nextB, nextC, factors);
      }
      
      i++;
   }
}