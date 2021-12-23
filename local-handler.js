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
// https://www.npmjs.com/package/ibm-cos-sdk
const { S3 } = require("ibm-cos-sdk");

// Function source code
const handler = require("./handler");

// Local variables to run via PM2
const BUCKET_RECEIVER = process.env.COS_BUCKET_RECEIVER;
const MAX_KEYS = 1;

//
let params = {
  hostname: process.env.LOGDNA_HOSTNAME,
  ingestionKey: process.env.LOGDNA_INGESTION_KEY,
  region: process.env.LOGDNA_REGION,
  bucketArchive: process.env.COS_BUCKET_ARCHIVE,
  apiKeyId: process.env.COS_APIKEY,
  endpoint: process.env.COS_ENDPOINT,
  serviceInstanceId: process.env.COS_INSTANCEID,
};

//
let cos;

async function main() {
  if (!cos) {
    cos = new S3({
      endpoint: params.endpoint,
      apiKeyId: params.apiKeyId,
      ibmAuthEndpoint: "https://iam.cloud.ibm.com/identity/token",
      serviceInstanceId: params.serviceInstanceId,
    });
  }
  const lo = await cos
    .listObjectsV2({ Bucket: BUCKET_RECEIVER, MaxKeys: MAX_KEYS })
    .promise();
  if (lo.Contents[0]) {
    console.log(`DEBUG: log file = ${lo.Contents[0].Key}`);
    params = {
      ...params,
      notification: {
        bucket_name: BUCKET_RECEIVER,
        object_name: lo.Contents[0].Key,
      },
    };
    const response = await handler.main(params);
    switch (response.status) {
      case 200:
        console.log(`DEBUG: Fetch new log file`);
        await main(params);
        break;
      case 204:
        console.log(
          `DEBUG: Wait 30 seconds to fetch new log file on COS Bucket`
        );
        await new Promise((r) => setTimeout(r, 30000));
        await main(params);
        break;
      default:
        console.log(`DEBUG: Uncommon behavior`);
        break;
    }
  } else {
    await new Promise((r) => setTimeout(r, 30000));
    await main(params);
  }
}

// Run the local app
main();
