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
   
   var min = 0;
   var max = 0;

   readInterface.on('line', function(line) {
      var parts = line.split('-');
      min = parts[0];
      max = parts[1];
   });
   
   readInterface.on('close', function() {
      var passwords = findPasswords(min, max, pswdPred);
      console.log(passwords.length);
      var passwords2 = findPasswords(min, max, pswdPred2);
      console.log(passwords2.length);
      
      console.log(exactlyDoubleLetter('112233'));
      console.log(exactlyDoubleLetter('123444'));
      console.log(exactlyDoubleLetter('111122'));
   });
}

function findPasswords(min, max, predicate) {
   var passwords = [];
   for (let i = min; i <= max; i++) {
      if (predicate(i)) {
         passwords.push(i);
      }
   }
   return passwords;
}

function pswdPred(pass) {
   var string = pass.toString(10);
   if (!ascending(string)) return false;
   if (!doubleLetter(string)) return false;
   return true;   
}

function ascending(string) {
   var lastC = '0';
   for (const c of string) {
      if (c < lastC) return false;
      lastC = c;
   }
   return true;
}

function doubleLetter(string) {
   var lastC = '-';
   for (const c of string) {
      if (c == lastC) return true;
      lastC = c;
   }
   return false;
}

function pswdPred2(pass) {
   var string = pass.toString(10);
   if (!ascending(string)) return false;
   if (!exactlyDoubleLetter(string)) return false;
   return true;   
}

function exactlyDoubleLetter(string) {
   var lastC = '-';
   var inARow = 1;
   for (const c of string) {
      if (c == lastC) {
         inARow++;
      } else {
         if (inARow == 2) {
            return true;
         }
         inARow = 1;
      }
      lastC = c;
   }
   if (inARow == 2) {
      return true;
   }
   return false;
}