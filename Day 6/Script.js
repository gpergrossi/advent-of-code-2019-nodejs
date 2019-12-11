// Certain variables are present in a NodeJS module:
// e.g. module, console, process
//
// 'module.require' is valid, but so is simply 'require'.
// The "module." part only serves to differentiate that 
// 'require' method from another one that could exist.

const fs = require('fs');
const readline = require('readline');
//=====================================================================
// Class "Planet"

function Planet(id) {
   this.id = id;
   this.orbit = null;
   this.orbitedBy = [];
}

Planet.prototype.setOrbit = function(around) {
   if (this.orbit !== null) throw new Error("Orbit already set!");
   if (around === this) throw new Error("Planet cannot orbit itself!");
   this.orbit = around;
   around.orbitedBy.push(this);
}

Planet.prototype.toString = function() {
   return this.id;
}

Planet.prototype.countOrbits = function(resultCallback) {
   if (this.orbit === null) resultCallback(0);
   else setImmediate(() => this.orbit.countOrbitsInternal(this, (result) => resultCallback(result + 1)));
}

Planet.prototype.countOrbitsInternal = function(initialPlanet, resultCallback) {
   if (this.orbit === null) resultCallback(0);
   else if (this.orbit === initialPlanet) throw new Error("Planet orbits itself indirectly!");
   else {
      setImmediate(() => {
         this.orbit.countOrbitsInternal(initialPlanet, (result) => resultCallback(result + 1));
      });
   }
}

Planet.prototype.listOrbits = function*() {
   var firstPlanet = this;
   var planet = this;
   while (planet.orbit !== null) {
      planet = planet.orbit;
      if (planet === firstPlanet) throw new Error("Planet orbits itself indirectly!");
      yield planet;
   }
}

// End of Class "Planet"
//=====================================================================


//==============================================================================================
//==============================================================================================
//==============================================================================================

function main() {
   var readInterface = readline.createInterface({
      input: fs.createReadStream('Input.txt'),
      output: process.stdout,
      terminal: false
   });

   var lineNumber = 0;
   var planets = [];

   readInterface.on('line', function(line) {
      lineNumber++;
      
      var parts = line.split(')');
      var planetNameA = parts[0];
      var planetNameB = parts[1];
      
      if (typeof planets[planetNameA] === 'undefined') {
         planets[planetNameA] = new Planet(planetNameA);
      }
      var planetA = planets[planetNameA];
      
      if (typeof planets[planetNameB] === 'undefined') {
         planets[planetNameB] = new Planet(planetNameB);
      }
      var planetB = planets[planetNameB];
      
      try {
         planetB.setOrbit(planetA);
      } catch (e) {
         console.log(e.message + " on line " + lineNumber);
         process.exit(1);
      }
   });
   
   readInterface.on('close', function() {
      countAllOrbits(planets, (result) => {
         console.log("ANSWER 1 = " + result);
         
         findDistance(planets.YOU, planets.SAN, (result) => {
            console.log("ANSWER 2 = " + (result - 2));
         });
      });      
   });
}

function countAllOrbits(planets, resultCallback)
{
   var numPlanets = Object.keys(planets).length;      
   var completedPlanets = [];      
   for (let planetName in planets) {
      let planet = planets[planetName];
      planet.countOrbits((orbits) => {
         let entry = {planet: planet, orbits: orbits};
         completedPlanets.push(entry);
         
         if (completedPlanets.length == numPlanets) {
            setTimeout(() => onOrbitCountsCompleted(completedPlanets, resultCallback), 0);
         }
      });
   }
}

function onOrbitCountsCompleted(completedPlanets, resultCallback) {
   var totalOrbits = 0;
   for (let entry of completedPlanets) {
      totalOrbits += entry.orbits;
   }
   resultCallback(totalOrbits);
}

function findDistance(fromPlanet, toPlanet, resultCallback) {
   var fromPlanetOrbits = Array.from(fromPlanet.listOrbits());
   var toPlanetOrbits = Array.from(toPlanet.listOrbits());
   
   var complete = false;
   iloop:
   for (let i in fromPlanetOrbits) {
      let planetI = fromPlanetOrbits[i];
      for (let j in toPlanetOrbits) {
         let planetJ = toPlanetOrbits[j];
         if (planetI === planetJ) {
            complete = true;
            setTimeout(() => resultCallback(2 + i*1 + j*1), 0);
            break iloop;
         }
      }
   }
   
   if (!complete) {
      throw new Error(fromPlanet + " and " + toPlanet + " do not exist in the same system!");
   }
}

main();