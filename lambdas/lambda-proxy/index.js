const fetch = require('node-fetch');
const aws = require('aws-sdk');
const lambda = new aws.Lambda({ region: 'us-east-1'});
const { URL, URLSearchParams } = require('url');
const https = require('https');

const httpsAgent = new https.Agent({
     rejectUnauthorized: false,
});
    
const replaceAll = function (originalStr, searchStr , replaceStr) {
  const str = originalStr;
  searchStr = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return str.replace(new RegExp(searchStr, 'gi'), replaceStr);
};

// Get Call Uri Function: 
// Returns the real URI that we are going to call.
// For instance it converts event.uri:
// /users/{id} into /users/1

const getCallUri = function(pathParams, uri) {
  let callUri = uri;
  Object.keys(pathParams).forEach(function (pathParam, index) {
    const replaceValue = `{${pathParam}}`;
    const value = pathParams[pathParam];
    callUri = replaceAll(callUri, replaceValue, pathParams[pathParam]);
  });
  return callUri;
}

const appendQueryParams = function(uri, queryParams) {
    let finalUri = new URL(uri);
    finalUri.search = new URLSearchParams(queryParams).toString();
    return finalUri.toString();
}

const callApi = async function (uri, method, bodyPayload, queryParams, headers) {
    const body = (method !== "GET" && method !== "HEAD") ? bodyPayload : null;
    const finalUri = appendQueryParams(uri, queryParams);
    const apiResponse = await fetch(finalUri,{ method, body, headers, agent: httpsAgent });
    return apiResponse.json(); // revisar content type, si es JSON parseamos, si no proxy
}

exports.handler = async (event,context,callback) => {
    let payload = JSON.stringify(event);
    let response = null;
    
    // Before hooks
    try {
        for (var _i = 0; _i < event.hooksBefore.length; _i++) {
            response = await lambda.invoke({FunctionName: event.hooksBefore[_i],Payload:payload}).promise();
            payload = JSON.stringify({body: JSON.parse(response.Payload)});
        }
    } catch (err) {
        callback(err,null);
    }
    
    //call realAPI with response
    let callUri = getCallUri(event.pathParams, event.uri);
    const json = await callApi(callUri, event.method, event.body, event.queryParams, event.headers);
    
    // after
    payload = json;
    response = payload;
    try {
        for (var _i = 0; _i < event.hooksAfter.length; _i++) {
            response = await lambda.invoke({FunctionName: event.hooksBefore[_i],Payload:payload}).promise();
            payload = JSON.stringify({body: JSON.parse(response.Payload)});
        }
    } catch (err) {
        callback(err,null);
    }
    return response.Payload ? response.Payload : response;
};
