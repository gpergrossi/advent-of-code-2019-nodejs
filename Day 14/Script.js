"use strict";

const fs = require('fs');
const readline = require('readline');

//================================================================================
// Class "Recipe"

function Recipe(string) {
   this.inputs = [];
   this.output = null;
   
   var recipeParts = string.split(" => ");
   var inputsStr = recipeParts[0];
   var outputStr = recipeParts[1];
   
   var regex = /([1-9][0-9]*) ([A-Z]+)/g;
   var match = [];
   while ((match = regex.exec(inputsStr)) !== null) {
      let ingredientQuantity = match[1];
      let ingredientName = match[2];
      this.inputs.push({name: ingredientName, quantity: ingredientQuantity});
   }
   
   var match = [];
   while ((match = regex.exec(outputStr)) !== null) {
      let ingredientQuantity = match[1];
      let ingredientName = match[2];
      this.output = {name: ingredientName, quantity: ingredientQuantity};
   }
}

Recipe.prototype.toString = function() {
   return this.inputs.map((ingredient) => ingredient.quantity + " " + ingredient.name).join(", ") + " => " + this.output.quantity + " " + this.output.name;
}

// End of Class "Recipe"
//================================================================================



// Main

main();

function main() {
   var readInterface = readline.createInterface({
      input: fs.createReadStream('Input.txt'),
      output: process.stdout,
      terminal: false
   });

   var recipes = [];

   readInterface.on('line', function(line) {
      var recipe = new Recipe(line);
      recipes.push(recipe);
   });
   
   readInterface.on('close', function() {
      var expanded = expandFully(recipes, {FUEL: 1});
      console.log("ANSWER 1 = " + expanded.ORE);
      
      var oreLimit = 1000000000000;
      var orePerFuelEstimate = expanded.ORE;
      var numCrafts = 1;
      
      // Quickly approach limit
      while (expanded.ORE < oreLimit) {
         var needed = (oreLimit - expanded.ORE);
         if (needed > 0) {
            numCrafts += Math.ceil(needed/orePerFuelEstimate);
            expanded = expandFully(recipes, {FUEL: numCrafts});
         }
      }
      
      // Fix potential overshot
      while (expanded.ORE > oreLimit) {
         numCrafts--;
         expanded = expandFully(recipes, {FUEL: numCrafts});
      }
      
      console.log("ANSWER 2 = " + numCrafts);
   });
}





// Helper functions

function expandFully(recipes, ingredientsMap) {
   var previous = ingredientsMap;
   var expanded = expand(recipes, ingredientsMap);
   while (!identical(previous, expanded)) {
      previous = expanded;
      expanded = expand(recipes, previous);
   }
   return expanded;
}

function expand(recipes, ingredientsMap) {
   var outputMap = {};
   expandLoop:
   for (var key in ingredientsMap) {
      var desiredIngredient = key;
      var desiredQuantity = ingredientsMap[key];
      
      // Delete items with no quantity
      if (desiredQuantity == 0) {
         continue expandLoop;
      }
      
      // Don't expand on surplus items
      if (desiredQuantity < 0) {
         if (typeof(outputMap[desiredIngredient]) === 'undefined') {
            outputMap[desiredIngredient] = desiredQuantity;
         } else {
            outputMap[desiredIngredient] += desiredQuantity;
         }
         continue expandLoop;
      }
      
      //console.log("Expanding " + desiredIngredient + " x" + desiredQuantity + "...");
      
      // Try to expand using recipes
      for (var recipe of recipes) {
         if (recipe.output.name == desiredIngredient) {
            var batchSize = Math.ceil(desiredQuantity / recipe.output.quantity);
            var totalOutputQuantity = recipe.output.quantity * batchSize;
            var surplus = totalOutputQuantity - desiredQuantity;
            
            // Subtract surplus product from output
            if (surplus > 0) {
               //console.log("   Surplus " + desiredIngredient + " x" + surplus);
               if (typeof(outputMap[desiredIngredient]) === 'undefined') {
                  outputMap[desiredIngredient] = -surplus;
               } else {
                  outputMap[desiredIngredient] -= surplus;
               }
            }
            
            // Add ingredients to output
            for (var recipeIngredient of recipe.inputs) {
               //console.log("   Needs " + recipeIngredient.name + " x" + (recipeIngredient.quantity * batchSize));
               if (typeof(outputMap[recipeIngredient.name]) === 'undefined') {
                  outputMap[recipeIngredient.name] = recipeIngredient.quantity * batchSize;
               } else {
                  outputMap[recipeIngredient.name] += recipeIngredient.quantity * batchSize;
               }
            }
            continue expandLoop;
         }
      }
      
      // No recipe found, pass through
      //console.log("   No recipe");
      if (typeof(outputMap[desiredIngredient]) === 'undefined') {
         outputMap[desiredIngredient] = desiredQuantity;
      } else {
         outputMap[desiredIngredient] += desiredQuantity;
      }
      continue expandLoop;
   }
   return outputMap;
}

function toMap(ingredients) {
   var outputMap = {};
   for (var ingredient of ingredients) {
      if (typeof(outputMap[ingredient.name]) === 'undefined') {
         outputMap[ingredient.name] = ingredient.quantity;
      } else {
         outputMap[ingredient.name] += ingredient.quantity;
      }
   }
   return outputMap;
}

function toArray(ingredientsMap) {
   var outputIngredients = [];
   for (let key in ingredientsMap) {
      outputIngredients.push({name: key, quantity: ingredientsMap[key]});
   }
   return outputIngredients;
}

function identical(mapA, mapB) {
   if (Object.keys(mapA).length != Object.keys(mapB).length) return false;
   for (var key in mapA) {
      if (typeof(mapB[key]) == 'undefined') return false;
      if (mapB[key] != mapA[key]) return false;
   }
   return true;
}