/**
 * Constants Module - Barrel Export
 */

const plans = require('./plans');

module.exports = {
  plans,
  ...plans,
};
