// Certain variables are present in a NodeJS module:
// e.g. module, console, process
//
// 'module.require' is valid, but so is simply 'require'.
// The "module." part only serves to differentiate that 
// 'require' method from another one that could exist.

const fs = require('fs');
const readline = require('readline');

main();

function main() {
   var readInterface = readline.createInterface({
      input: fs.createReadStream('Input.txt'),
      output: process.stdout,
      terminal: false
   });

   var modules = [];

   readInterface.on('line', function(line) {
      var moduleMass = parseInt(line, 10);
      modules.push(moduleMass);
   });
   
   readInterface.on('close', function() {      
      var totalBaseFuel = getTotalBaseFuel(modules);
      console.log("Answer 1: " + totalBaseFuel);
      var totalFuel = getTotalFuel(modules);
      console.log("Answer 2: " + totalFuel);
   });
}

function getTotalBaseFuel(modules) {
   var totalBaseFuel = 0;
   for (let module of modules) {
      var mass = module;
      var fuel = getBaseFuelForMass(mass);
      totalBaseFuel += fuel;
   }
   return totalBaseFuel;
}

function getBaseFuelForMass(mass) {
   if (mass < 9) return 0;
   return Math.floor(mass / 3) - 2;
}

function getTotalFuel(modules) {
   var totalFuel = 0;
   for (let module of modules) {
      var mass = module;
      var fuel = getFuelForMass(mass);
      totalFuel += fuel;
   }
   return totalFuel;
}

function getFuelForMass(mass) {
   var totalFuel = 0;
   var fuel = getBaseFuelForMass(mass);
   while (fuel > 0) {
      totalFuel += fuel;
      fuel = getBaseFuelForMass(fuel);
   }
   return totalFuel;
}