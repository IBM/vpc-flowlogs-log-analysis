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
// https://www.npmjs.com/package/ibm-cos-sdk
const { S3 } = require("ibm-cos-sdk");
// https://www.npmjs.com/package/request
const request = require("request-promise").defaults({ forever: true });
// https://nodejs.org/api/zlib.html
const { unzip } = require("zlib");
// https://nodejs.org/api/util.html
const util = require("util");

const unzipPromise = util.promisify(unzip);
/**
 *
 * IBM CLOUD OBJECT STORAGE
 * Instance access through COS SDK
 * - Endpoint;
 * - API Key;
 * - Service Instance ID;
 * - Bucket for archive purpose.
 *
 */
let cos;
let BUCKET_ARCHIVE;
/**
 *
 * IBM LOG ANALYSIS WITH LOGDNA
 * API Key and Hostname to send the logs
 *
 */
let INGESTION_KEY;
let HOSTNAME;

async function uploadAndDeleteBucket(bucketReceiver, fileName) {
  try {
    const encodedURI = encodeURI(fileName);
    console.log(
      `DEBUG: Uploading the log file = ${bucketReceiver}/${encodedURI}`
    );
    await cos
      .copyObject({
        Bucket: BUCKET_ARCHIVE,
        CopySource: `${bucketReceiver}/${encodedURI}`,
        Key: fileName,
      })
      .promise();
    console.log("DEBUG: Deleting the log file");
    await cos.deleteObject({ Bucket: bucketReceiver, Key: fileName }).promise();
    return { status: 200, message: "Update and delete log file DONE" };
  } catch (e) {
    console.error(e);
    return e;
  }
}

function sendLogDNA(json) {
  return request({
    method: "POST",
    url: `https://logs.us-south.logging.cloud.ibm.com/logs/ingest?hostname=${HOSTNAME}`,
    body: json,
    auth: {
      user: INGESTION_KEY,
    },
    headers: { "Content-Type": "application/json" },
    json: true,
    timeout: 18000,
    agent: false,
    pool: { maxSockets: 200 },
  })
    .then((response) => response)
    .catch(async (e) => {
      console.error(e);
      console.log("Retrying to send package");
      return sendLogDNA(json);
    });
}

async function downloadAndSend(params) {
  try {
    const o = await cos
      .getObject({ Bucket: params.notification.bucket_name, Key: params.notification.object_name })
      .promise();
    console.log(`DEBUG: log file = ${params.notification.object_name}`);
    const buffer = Buffer.from(o.Body);
    const newBuffer = await unzipPromise(buffer);
    const json = JSON.parse(newBuffer);
    console.log(`Flow Logs: ${json.number_of_flow_logs}`);
    const fj = { lines: [] };
    if (json.number_of_flow_logs === 0) {
      fj.lines.push({
        timestamp: new Date(json.capture_end_time).getTime(),
        line: "[AUTOMATIC] LOG FROM FLOW LOGS STORED ON COS BUCKET",
        app: "flow-logs",
        level: "INFO",
        meta: {
          customfield: json,
        },
      });
    } else {
      const promises = json.flow_logs.map(async (flow_log, i) => {
        const input = { ...json };
        input.flow_logs = flow_log;
        fj.lines.push({
          timestamp: new Date(json.capture_end_time).getTime(),
          line: "[AUTOMATIC] LOG FROM FLOW LOGS STORED ON COS BUCKET",
          app: "flow-logs",
          level: "INFO",
          meta: {
            customfield: input,
          },
        });
      });
      await Promise.all(promises);
    }
    console.log("DONE PARSE TO LOGDNA FORMAT");
    await sendLogDNA(fj);
    console.log("DEBUG: uploadAndDeleteBucket");
    return await uploadAndDeleteBucket(
      params.notification.bucket_name,
      params.notification.object_name
    );
  } catch (e) {
    console.error(e);
    return { status: 500, message: JSON.stringify(e) };
  }
}

async function main(params) {
  console.time("Flow Logs Collector on COS");
  if (!cos) {
    cos = new S3({
      endpoint: params.endpoint,
      apiKeyId: params.apiKeyId,
      ibmAuthEndpoint: "https://iam.cloud.ibm.com/identity/token",
      serviceInstanceId: params.serviceInstanceId,
    });
  }
  if (!INGESTION_KEY || !HOSTNAME) {
    INGESTION_KEY = params.ingestionKey;
    HOSTNAME = params.hostname;
  }
  if (!BUCKET_ARCHIVE) {
    BUCKET_ARCHIVE = params.bucketArchive;
  }
  const response = await downloadAndSend(params);
  console.log(`DEBUG: downloadAndSend = ${JSON.stringify(response.message)}`);
  console.timeEnd("Flow Logs Collector on COS");
}

exports.main = main;
