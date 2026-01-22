module.exports = {
  ...require("./env-setup"),
  ...require("./prompts"),
  ...require("./config-generator"),
  ...require("./firebase-setup"),
  ...require("./data-setup"),
  ...require("./credentials-setup"),
  ...require("./notifications-setup"),
  ...require("./assets-setup"),
  ...require("./git-setup"),
  ...require("./summary-display"),
};
