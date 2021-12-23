/**
 *
 * Copyright 2021 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
// https://www.npmjs.com/package/dotenv
require("dotenv").config();
// https://www.npmjs.com/package/express
const express = require("express");
// https://www.npmjs.com/package/helmet
const helmet = require("helmet");

// Function source code
const handler = require("./handler");

// Express configuration
const app = express();
app.use(express.json());
app.use(helmet());

// Handler
app.post("/", (req, res) => {
  let params = {
    ...req.body,
    hostname: process.env.LOG_ANALYSIS_HOSTNAME,
    ingestionKey: process.env.LOG_ANALYSIS_INGESTION_KEY,
    region: process.env.LOG_ANALYSIS_REGION,
    bucketArchive: process.env.COS_BUCKET_ARCHIVE,
    apiKeyId: process.env.COS_APIKEY,
    endpoint: process.env.COS_ENDPOINT,
    serviceInstanceId: process.env.COS_INSTANCEID,
  };
  res.send(handler.main(params));
});

// Express server configuration
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Server is up and running at ${HOST}:${PORT}`);
});
