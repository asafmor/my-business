import { assertCloudEnvironment } from "../../src/server/config/cloud-environment";

assertCloudEnvironment(process.env);

console.log("Cloud environment boundary verified.");
