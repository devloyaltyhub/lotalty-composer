const inquirer = require('inquirer');
const Separator = inquirer.Separator;
const chalk = require('chalk');
const boxen = require('boxen');

class MenuRenderer {
  printHeader() {
    console.clear();
    console.log(
      boxen(
        `${chalk.bold.cyan('Loyalty Hub - CLI de Automacao')}\n${chalk.gray('v2.0 - Interativo & Fluxos de Trabalho')}`,
        {
          padding: 1,
          margin: { top: 1, bottom: 0, left: 2, right: 2 },
          borderStyle: 'double',
          borderColor: 'cyan',
          textAlignment: 'center',
        }
      )
    );
  }

  groupByCategory(items) {
    const grouped = {};

    Object.values(items).forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    return grouped;
  }

  createMenuChoices(items, type = 'script') {
    const grouped = this.groupByCategory(items);
    const choices = [];

    Object.entries(grouped).forEach(([category, categoryItems]) => {
      choices.push(new Separator(chalk.bold.yellow(`\n${category}`)));

      categoryItems.forEach((item) => {
        const prefix = type === 'workflow' ? '>' : '-';
        choices.push({
          name: `  ${chalk.green(prefix)} ${item.name} ${chalk.gray(`- ${item.description}`)}`,
          value: item,
          short: item.name,
        });
      });
    });

    choices.push(new Separator('\n'));

    return choices;
  }
}

module.exports = MenuRenderer;
