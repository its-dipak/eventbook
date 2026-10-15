import { app } from "./app.js";
import { config } from "./lib/config.js";

app.listen(config.port, () => {
  console.log(`EventBook API listening on port ${config.port}`);
});
