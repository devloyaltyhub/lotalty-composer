const readline = require('readline');

class InputHandler {
  static askQuestion(question) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  static askYesNo(question) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`${question} (S/N): `, (answer) => {
        rl.close();
        resolve(/^s$/i.test(answer.trim()));
      });
    });
  }
}

module.exports = { InputHandler };
